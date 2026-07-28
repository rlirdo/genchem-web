/* ==========================================================================
   sim/ch05.js — Ch5 氣體
   模組 A（3D）：分子動力論 KMT——數百顆分子在密閉容器中碰撞
   模組 B（2D）：Maxwell–Boltzmann 速率分布曲線隨溫度變形；理想 ↔ 凡得瓦 PV 曲線
   綠色情境：溫室氣體 GWP 比較與胺吸收法碳捕捉

   物理說明：
     理想氣體 PV = nRT
     凡得瓦   (P + a n²/V²)(V − nb) = nRT
     方均根速率 v_rms = √(3RT/M)；最可能速率 v_p = √(2RT/M)
     Maxwell–Boltzmann 速率分布 f(v) = 4π(M/2πRT)^{3/2} v² exp(−Mv²/2RT)
   ========================================================================== */

import { createStage, THREE, glassBox, textSprite, atomMaterial } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { VDW, GWP100, CCS, CONST } from '../../data/constants.js';

const MAXN = 600;                       // 依規格：分子數上限 600

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [4.6, 3.4, 6.4], fov: 46, minDistance: 4, maxDistance: 22,
    ariaLabel: '密閉容器中的氣體分子 3D 模擬',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------------- 粒子系統 ---------------- */
  let inst = null, box = null;
  const P = { pos: [], vel: [], n: 0 };
  let L = 3.0;                          // 立方盒半邊長（畫面單位）
  let wallHits = 0, hitWindow = 0, hitRate = 0;
  let captured = 0;                     // 綠色情境：被胺吸收的 CO₂ 數

  function makeParticles(n, colorHex) {
    if (inst) { world.remove(inst); inst.geometry.dispose(); inst.material.dispose(); }
    const geo = new THREE.SphereGeometry(1, 8, 6);
    inst = new THREE.InstancedMesh(geo, atomMaterial(colorHex, { roughness: .3, metalness: .1 }), MAXN);
    inst.count = n;
    world.add(inst);
    P.n = n;
    P.pos = []; P.vel = [];
    for (let i = 0; i < n; i++) {
      P.pos.push(new THREE.Vector3((Math.random() - .5) * 2 * L, (Math.random() - .5) * 2 * L, (Math.random() - .5) * 2 * L));
      P.vel.push(randVel());
    }
  }

  /** 依 Maxwell–Boltzmann 抽速度（三個方向各為高斯分布）*/
  function randVel() {
    const s = speedScale();
    return new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(s);
  }
  function gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }

  /** 畫面單位的速度尺度：正比於 √(T/M)，並縮放到看得順眼的速度 */
  function speedScale() {
    const T = C.values.T, M = VDW[gasKey()].M;
    return Math.sqrt(CONST.R_J * T / (M / 1000)) / 380;      // ≈ v_rms/√3 除以 380
  }
  function gasKey() { return mode === 'green' ? 'CO2' : C.values.gas; }

  function rebuildBox() {
    if (box) { world.remove(box); }
    L = 1.6 + (C.values.V - 5) * 0.12;       // 體積滑桿 → 盒子邊長
    box = glassBox(L * 2, L * 2, L * 2, 0x1E9EB3);
    world.add(box);
    // 把跑到盒外的粒子拉回來
    P.pos.forEach(p => { ['x', 'y', 'z'].forEach(a => { p[a] = Math.max(-L + .05, Math.min(L - .05, p[a])); }); });
  }

  /* ---------------- 下方圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="display:flex;gap:.8rem;flex-wrap:wrap">
      <div style="flex:1 1 300px;min-width:260px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-c1>
          📈 Maxwell–Boltzmann 速率分布</div>
        <canvas id="mb" aria-label="Maxwell-Boltzmann 速率分布曲線"></canvas>
      </div>
      <div style="flex:1 1 300px;min-width:260px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-c2>
          📉 理想氣體 vs 凡得瓦修正</div>
        <canvas id="pv" aria-label="壓力對體積曲線"></canvas>
      </div>
    </div>`;
  const mbChart = new Chart2D(ctx.subEl.querySelector('#mb'), {
    height: 170, pad: { l: 46, r: 12, t: 12, b: 32 }, xLabel: '速率 (m/s)', yLabel: 'f(v)',
  });
  const pvChart = new Chart2D(ctx.subEl.querySelector('#pv'), {
    height: 170, pad: { l: 50, r: 12, t: 12, b: 32 }, xLabel: '體積 V (L)', yLabel: '壓力 P (bar)',
  });
  mbChart.onResize = drawMB; pvChart.onResize = drawPV;

  function mbF(v, T, M_gmol) {
    const M = M_gmol / 1000, R = CONST.R_J;
    return 4 * Math.PI * Math.pow(M / (2 * Math.PI * R * T), 1.5) * v * v * Math.exp(-M * v * v / (2 * R * T));
  }

  function drawMB() {
    const g = VDW[gasKey()], T = C.values.T;
    const vmax = 2800;
    // 三條溫度曲線：目前溫度、與 ±40% 對照
    const temps = [[T, PALETTE.ocean, 3], [T * 0.6, PALETTE.leaf, 1.5], [T * 1.6, PALETTE.coral, 1.5]];
    let ymax = 0;
    temps.forEach(([t]) => { for (let v = 0; v < vmax; v += 20) ymax = Math.max(ymax, mbF(v, t, g.M)); });
    mbChart.clear().setRange(0, vmax, 0, ymax * 1.12)
      .axes({ xTicks: 4, yTicks: 3, yFmt: () => '' });
    temps.forEach(([t, col, w]) => {
      const pts = [];
      for (let v = 0; v <= vmax; v += 20) pts.push([v, mbF(v, t, g.M)]);
      mbChart.line(pts, { color: col, width: w, dash: w < 2 ? [4, 4] : null });
    });
    const vrms = Math.sqrt(3 * CONST.R_J * T / (g.M / 1000));
    const vp = Math.sqrt(2 * CONST.R_J * T / (g.M / 1000));
    mbChart.vline(vp, { color: PALETTE.sun, label: `v_p ${vp.toFixed(0)}` });
    mbChart.vline(vrms, { color: PALETTE.coralDeep, label: `v_rms ${vrms.toFixed(0)}` });
    mbChart.legend([
      { label: `${(T * 0.6).toFixed(0)} K`, color: PALETTE.leaf },
      { label: `${T.toFixed(0)} K`, color: PALETTE.ocean },
      { label: `${(T * 1.6).toFixed(0)} K`, color: PALETTE.coral },
    ], { x: 200, y: 22 });
  }

  function drawPV() {
    const g = VDW[gasKey()], T = C.values.T, n = C.values.n;
    const Vlo = Math.max(0.05, n * g.b * 1.25), Vhi = 6;
    const ideal = [], vdw = [];
    for (let V = Vlo; V <= Vhi; V += 0.02) {
      ideal.push([V, n * CONST.R_Lbar * T / V]);
      const p = n * CONST.R_Lbar * T / (V - n * g.b) - g.a * n * n / (V * V);
      vdw.push([V, p]);
    }
    const ymax = Math.min(400, n * CONST.R_Lbar * T / Vlo * 1.05);
    pvChart.clear().setRange(0, Vhi, 0, ymax).axes({ xTicks: 4, yTicks: 4 });
    pvChart.line(ideal, { color: PALETTE.muted, width: 2, dash: [5, 4] });
    pvChart.line(vdw, { color: PALETTE.leafDeep, width: 3 });
    pvChart.legend([
      { label: '理想氣體 PV=nRT', color: PALETTE.muted },
      { label: `凡得瓦（a=${g.a}, b=${g.b}）`, color: PALETTE.leafDeep },
    ], { x: 90, y: 22, vertical: true });
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'co2', name: '碳排（CO₂當量）', unit: 't CO₂e', min: 0, max: 300, digits: 1,
      better: 'low', good: 40, bad: 180, note: '排放量 × GWP-100（IPCC AR6）' },
    { key: 'energy', name: '能耗', unit: 'GJ/t CO₂', min: 0, max: 6, digits: 2,
      better: 'low', good: 2.5, bad: 4.2, note: '碳捕捉的再生能耗（原則 #6）' },
    { key: 'net', name: '淨減碳效益', unit: '%', min: -20, max: 100, digits: 1,
      better: 'high', good: 60, bad: 20, note: '扣掉捕捉本身的碳排後真正減下來的比例' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：分子動力論——幾百顆分子在盒子裡亂撞');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'gas', label: '氣體種類', value: 'N2', options: [
          { v: 'He', label: 'He' }, { v: 'N2', label: 'N₂' },
          { v: 'CO2', label: 'CO₂' }, { v: 'H2O', label: 'H₂O' },
        ] },
        { type: 'range', key: 'T', label: '溫度 T', min: 100, max: 1200, step: 10, value: 300, unit: 'K',
          hint: '拉高溫度，看速率分布怎麼往右變寬變扁。' },
        { type: 'range', key: 'V', label: '體積 V', min: 0.5, max: 6, step: 0.1, value: 2.0, unit: 'L' },
        { type: 'range', key: 'n', label: '莫耳數 n', min: 0.2, max: 4, step: 0.1, value: 1.0, unit: 'mol' },
        { type: 'range', key: 'N', label: '畫面上的分子數', min: 40, max: MAXN, step: 20, value: 260, unit: '顆',
          hint: `畫面粒子數僅為視覺呈現，上限 ${MAXN} 顆以保護效能。` },
        { type: 'check', key: 'vdw', label: '顯示凡得瓦修正後的壓力', value: true },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'Pi', label: '理想氣體壓力', unit: 'bar', digits: 2 },
        { key: 'Pv', label: '凡得瓦壓力', unit: 'bar', digits: 2 },
        { key: 'dev', label: '偏離理想的幅度', unit: '%', digits: 2 },
        { key: 'vrms', label: '方均根速率 v_rms', unit: 'm/s', digits: 0 },
        { key: 'vp', label: '最可能速率 v_p', unit: 'm/s', digits: 0 },
        { key: 'hits', label: '壁面碰撞頻率', unit: '次/秒（模擬）', digits: 0, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：溫室氣體 GWP 與胺吸收法碳捕捉');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'ghg', label: '溫室氣體', value: 'CO2', options: [
          { v: 'CO2', label: 'CO₂', title: 'GWP-100 = 1（基準）' },
          { v: 'CH4', label: 'CH₄', title: 'GWP-100 ≈ 29.8（化石來源）' },
          { v: 'N2O', label: 'N₂O', title: 'GWP-100 ≈ 273' },
        ] },
        { type: 'range', key: 'emit', label: '排放量', min: 0.1, max: 20, step: 0.1, value: 5, unit: '公噸' },
        { type: 'seg', key: 'tech', label: '碳捕捉技術', value: 'mea', options: [
          { v: 'mea', label: '胺吸收（MEA）', title: '目前商業化主流，再生能耗約 3.7 GJ/t' },
          { v: 'adv', label: '先進吸收劑', title: '新型胺/固態吸附劑，約 2.4 GJ/t' },
        ] },
        { type: 'range', key: 'cap', label: '捕捉率', min: 0, max: 95, step: 5, value: 0, unit: '%',
          hint: '從 0 拉到 90，看被吸收的 CO₂ 分子在畫面上變色附著。' },
        { type: 'range', key: 'grid', label: '再生能源來自電網的碳強度', min: 20, max: 850, step: 10, value: 500, unit: 'g CO₂/kWh',
          hint: '若捕捉所用的能源本身是高碳的，減碳效益會被吃掉。' },
        { type: 'range', key: 'T', label: '溫度 T', min: 250, max: 600, step: 10, value: 320, unit: 'K' },
        { type: 'range', key: 'V', label: '體積 V', min: 0.5, max: 6, step: 0.1, value: 2.0, unit: 'L' },
        { type: 'range', key: 'n', label: '莫耳數 n', min: 0.2, max: 4, step: 0.1, value: 1.0, unit: 'mol' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'gwp', label: 'GWP-100', unit: '× CO₂', digits: 0 },
        { key: 'co2e', label: 'CO₂ 當量', unit: '公噸', digits: 2 },
        { key: 'cap', label: '捕捉量', unit: '公噸 CO₂', digits: 2 },
        { key: 'gj', label: '所需能量', unit: 'GJ', digits: 1 },
        { key: 'penalty', label: '捕捉造成的額外碳排', unit: '公噸 CO₂', digits: 3 },
        { key: 'net', label: '淨減碳', unit: '公噸 CO₂', digits: 3, wide: true },
      ]);
    }
    makeParticles(mode === 'classic' ? C.values.N : 220, mode === 'green' ? 0xFF7A59 : gasColor());
    rebuildBox();
    drawMB(); drawPV(); update();
  }

  function gasColor() {
    return { He: 0xC9E8F0, N2: 0x4C7DE0, CO2: 0xFF7A59, H2O: 0x5FD08A }[C.values.gas] || 0x4C7DE0;
  }

  function onChange(key, v) {
    if (key === 'gas') { makeParticles(C.values.N, gasColor()); }
    if (key === 'N') { makeParticles(v, mode === 'green' ? 0xFF7A59 : gasColor()); }
    if (key === 'V') rebuildBox();
    if (key === 'T') { P.vel = P.vel.map(() => randVel()); }
    drawMB(); drawPV(); update();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    const g = VDW[gasKey()], T = C.values.T, n = C.values.n, V = C.values.V;
    const Pi = n * CONST.R_Lbar * T / V;
    const Pv = n * CONST.R_Lbar * T / (V - n * g.b) - g.a * n * n / (V * V);
    const vrms = Math.sqrt(3 * CONST.R_J * T / (g.M / 1000));
    const vp = Math.sqrt(2 * CONST.R_J * T / (g.M / 1000));

    if (mode === 'classic') {
      readout({
        Pi, Pv, dev: (Pv - Pi) / Pi * 100, vrms, vp, hits: hitRate,
      });
      ctx.setOverlay(
        `<b>${g.zh}｜${T} K｜${V} L｜${n} mol</b><br>
         P(理想) = ${Pi.toFixed(2)} bar　P(凡得瓦) = ${Pv.toFixed(2)} bar<br>
         v_rms = ${vrms.toFixed(0)} m/s`);
      const dev = Math.abs((Pv - Pi) / Pi * 100);
      gauge({ co2: 0, energy: 0, net: 0 },
        `理想氣體是一個<strong>近似</strong>：假設分子不占體積、彼此不吸引。
         目前偏離幅度 <strong>${dev.toFixed(2)}%</strong>。
         把體積壓到 0.5 L 或把溫度降到 100 K 再看一次——偏離會明顯放大。
         切到綠色情境，看同樣是氣體，為什麼有些氣體特別麻煩。`);

    } else {
      const G = GWP100[C.values.ghg];
      const emit = C.values.emit;
      const co2e = emit * G.v;
      const capFrac = C.values.cap / 100;
      const capped = co2e * capFrac;
      const gjPerT = C.values.tech === 'mea' ? CCS.mea_GJ_per_tCO2 : CCS.advanced_GJ_per_tCO2;
      const gj = capped * gjPerT;
      // 能量轉成電力當量（1 GJ = 277.8 kWh），再乘電網碳強度
      const penalty = gj * 277.8 * C.values.grid / 1e6;      // g → 公噸
      const net = capped - penalty;
      const netPct = co2e > 0 ? net / co2e * 100 : 0;

      readout({ gwp: G.v, co2e, cap: capped, gj, penalty, net });
      ctx.setOverlay(
        `<b>${G.zh}</b>　GWP-100 = ${G.v}<br>
         排放 ${emit} 公噸 → <strong>${co2e.toFixed(2)} 公噸 CO₂e</strong><br>
         捕捉 ${C.values.cap}%｜淨減碳 ${net.toFixed(2)} 公噸`);
      gauge({ co2: co2e, energy: gjPerT, net: netPct },
        C.values.cap === 0
          ? `先看 GWP：同樣<strong>一公噸</strong>的氣體，CH₄ 相當於 29.8 公噸 CO₂、N₂O 相當於 273 公噸。
             這就是為什麼減甲烷（畜牧、廢棄物、天然氣洩漏）常常比減 CO₂ 更划算。現在把「捕捉率」拉起來。`
          : (netPct < 40
            ? `⚠ 注意「淨減碳效益」掉下來了。捕捉本身要花能量，如果那些能量來自高碳電網
               （目前設定 ${C.values.grid} g CO₂/kWh），減下來的碳有很大一部分會被再排回去。
               <strong>把電網碳強度拉到 100 以下再看一次</strong>——碳捕捉必須搭配乾淨電力才有意義。`
            : `✅ 在低碳電力搭配下，捕捉 ${C.values.cap}% 真的減下了 ${net.toFixed(2)} 公噸 CO₂。
               先進吸收劑把再生能耗從 ${CCS.mea_GJ_per_tCO2} 降到 ${CCS.advanced_GJ_per_tCO2} GJ/t，
               這正是原則 #6「能源效率設計」在做的事。`));
    }
  }

  /* ---------------- 動畫（含壁面碰撞計數）---------------- */
  const dummy = new THREE.Object3D();
  stage.start(({ dt }) => {
    const scale = 0.13;
    const capFrac = mode === 'green' ? C.values.cap / 100 : 0;
    captured = Math.floor(P.n * capFrac);
    for (let i = 0; i < P.n; i++) {
      const p = P.pos[i], v = P.vel[i];
      const isCap = mode === 'green' && i < captured;
      if (isCap) {
        // 被胺吸收：貼到容器底部並停住
        p.lerp(new THREE.Vector3(p.x * 0.9, -L + 0.15, p.z * 0.9), dt * 2);
      } else {
        p.addScaledVector(v, dt * 3.2);
        ['x', 'y', 'z'].forEach(a => {
          if (p[a] > L - .06) { p[a] = L - .06; v[a] *= -1; wallHits++; }
          else if (p[a] < -L + .06) { p[a] = -L + .06; v[a] *= -1; wallHits++; }
        });
      }
      dummy.position.copy(p);
      dummy.scale.setScalar(isCap ? scale * 0.8 : scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;

    hitWindow += dt;
    if (hitWindow >= 0.5) {
      hitRate = Math.round(wallHits / hitWindow);
      wallHits = 0; hitWindow = 0;
      if (mode === 'classic') update();
    }
  });

  ctx.onScenario(v => {
    mode = v;
    stage.camera.position.set(4.6, 3.4, 6.4);
    stage.controls.target.set(0, 0, 0); stage.controls.update();
    buildForScenario();
  });

  buildForScenario();
  return { destroy() { stage.dispose(); mbChart.destroy(); pvChart.destroy(); } };
}
