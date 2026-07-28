/* ==========================================================================
   sim/ch01.js — Ch1 化學基礎
   模組 A（3D）：同體積立方盒內的原子堆積 → 由晶格算密度 d = m/V
   模組 B（2D）：射靶圖，示範精密度 vs 準確度四象限
   綠色情境：輕量化材料比較 → 車輛減重 → 油耗與 CO₂

   物理／化學說明：
   立方晶系的理論密度 ρ = Z·M / (N_A · a³)
     Z = 單位晶胞內的原子數（FCC 4、BCC 2）
     M = 原子量 (g/mol)、a = 晶格常數 (cm)
   六方最密堆積（Ti）用 V_cell = (3√3/2)·a²·c，Z = 6。
   ========================================================================== */

import { createStage, THREE, atomMaterial, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { METALS, LIGHTWEIGHT, FUEL_CO2, HUALIEN_ROCKS, CONST } from '../../data/constants.js';

/* Ti 的 c 軸（HCP）*/
const TI_C_PM = 468.3;

/* 材料隱含碳（原生製程，kg CO₂e / kg 材料）
   來源：Nuss & Eckelman, PLoS ONE 9(7):e101298 (2014) 之量級；
   實際值隨電力來源差異極大，故一律標為概略值。 */
const EMBODIED = {
  //         kg CO₂e/kg（原生 / 再生）        MJ/kg 一次能源（原生 / 再生）
  Au:  { primary: 12500, recycled: 60,  ePri: 208000, eRec: 900, range: '10³–10⁴ 量級' },
  Al:  { primary: 8.2,   recycled: 0.6, ePri: 155,    eRec: 15,  range: '6–12' },
  Fe:  { primary: 1.9,   recycled: 0.5, ePri: 25,     eRec: 9,   range: '1.4–2.3' },
  Ti:  { primary: 35,    recycled: 8,   ePri: 500,    eRec: 100, range: '8–45（Kroll 製程電力來源影響大）' },
  CFRP:{ primary: 24,    recycled: 12,  ePri: 300,    eRec: 150, range: '20–30（含樹脂與碳纖維前驅物）' },
  Mg:  { primary: 18,    recycled: 2,   ePri: 300,    eRec: 25,  range: '14–40' },
};

export async function init(ctx) {
  /* ---------------- 3D 舞台 ---------------- */
  const stage = createStage(ctx.stageEl, {
    cameraPos: [3.4, 2.6, 4.6], fov: 42, minDistance: 2.6, maxDistance: 14,
    ariaLabel: '立方盒內的金屬原子堆積 3D 模型，可拖曳旋轉、滾輪或雙指縮放',
  });
  let group = new THREE.Group();
  stage.scene.add(group);

  /* ---------------- 2D 射靶（放在舞台下方）---------------- */
  ctx.subEl.innerHTML = `
    <div style="display:flex;gap:.8rem;flex-wrap:wrap;align-items:flex-start">
      <div style="flex:0 0 auto">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.25rem" data-bull-title>
          🎯 射靶：精密度 vs 準確度</div>
        <canvas id="bull" width="230" height="230"
          style="border-radius:12px;background:#fff;border:1px solid var(--line);cursor:crosshair;touch-action:none"
          aria-label="射靶圖，點擊或拖曳可加入量測點"></canvas>
      </div>
      <div style="flex:1 1 220px;min-width:200px">
        <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem" id="bull-presets"></div>
        <div id="bull-stats" style="font-size:var(--fs-sm);line-height:1.9"></div>
        <p style="font-size:var(--fs-xs);color:var(--ink-3);margin:.4rem 0 0" data-bull-note>
          在靶上點幾下加入量測點。<strong>準確度</strong>＝離紅心多近；<strong>精密度</strong>＝彼此有多集中。
        </p>
      </div>
    </div>`;

  const bull = ctx.subEl.querySelector('#bull');
  const bctx = bull.getContext('2d');
  const bstats = ctx.subEl.querySelector('#bull-stats');
  let shots = [];

  const BULL_R = 100, CX = 115, CY = 115;

  function drawBull() {
    const c = bctx;
    c.clearRect(0, 0, 230, 230);
    // 靶環
    const rings = [[100, '#EAF6FF'], [78, '#D8EEF4'], [56, '#BFE3EC'], [34, '#FFE2B0'], [16, '#FF9C86']];
    rings.forEach(([r, col]) => {
      c.beginPath(); c.arc(CX, CY, r, 0, Math.PI * 2);
      c.fillStyle = col; c.fill();
      c.strokeStyle = 'rgba(18,59,46,.12)'; c.lineWidth = 1; c.stroke();
    });
    c.beginPath(); c.arc(CX, CY, 4, 0, Math.PI * 2); c.fillStyle = '#C6412A'; c.fill();
    // 量測點
    shots.forEach(p => {
      c.beginPath(); c.arc(p.x, p.y, 4.6, 0, Math.PI * 2);
      c.fillStyle = 'rgba(30,158,179,.9)'; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.4; c.stroke();
    });
    // 平均位置
    if (shots.length >= 2) {
      const mx = shots.reduce((s, p) => s + p.x, 0) / shots.length;
      const my = shots.reduce((s, p) => s + p.y, 0) / shots.length;
      c.beginPath(); c.arc(mx, my, 8, 0, Math.PI * 2);
      c.strokeStyle = '#2E7D3A'; c.lineWidth = 2.4; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#2E7D3A'; c.font = '11px system-ui'; c.textAlign = 'center';
      c.fillText('平均', mx, my - 12);
    }
  }

  function bullStats() {
    const n = shots.length;
    if (n === 0) {
      bstats.innerHTML = '<span style="color:var(--ink-3)">還沒有量測點。</span>';
      return { n: 0 };
    }
    // 把像素換算成「量測值」：以靶心為真值 0，半徑 100 px 對應 ±10 個單位
    const vals = shots.map(p => ({
      x: (p.x - CX) / BULL_R * 10,
      y: (p.y - CY) / BULL_R * 10,
      d: Math.hypot(p.x - CX, p.y - CY) / BULL_R * 10,
    }));
    const mean = vals.reduce((s, v) => s + v.d, 0) / n;                    // 平均偏差（準確度指標）
    const mx = vals.reduce((s, v) => s + v.x, 0) / n;
    const my = vals.reduce((s, v) => s + v.y, 0) / n;
    const bias = Math.hypot(mx, my);                                        // 系統誤差（平均離靶心多遠）
    const sd = n > 1 ? Math.sqrt(vals.reduce((s, v) =>
      s + (v.x - mx) ** 2 + (v.y - my) ** 2, 0) / (n - 1)) : 0;             // 散布（精密度指標）

    const acc = bias < 2 ? '高' : bias < 4.5 ? '中' : '低';
    const pre = sd < 1.6 ? '高' : sd < 3.5 ? '中' : '低';
    bstats.innerHTML = `
      <div>量測點數 <span class="num">${n}</span></div>
      <div>平均值離真值（系統誤差）<span class="num">${bias.toFixed(2)}</span> 單位 → 準確度 <strong>${acc}</strong></div>
      <div>標準差 s <span class="num">${sd.toFixed(2)}</span> 單位 → 精密度 <strong>${pre}</strong></div>
      <div style="margin-top:.3rem;padding:.35rem .6rem;border-radius:8px;background:${
        acc === '高' && pre === '高' ? 'var(--leaf-soft);color:var(--leaf-deep)'
        : 'var(--sun-soft);color:var(--sun-deep)'}">
        ${acc === '高' && pre === '高' ? '✅ 又準又精密——這才是可信的量測。'
          : acc === '低' && pre === '高' ? '⚠ 精密但不準確：典型的系統誤差（儀器沒校正）。'
          : acc === '高' && pre === '低' ? '⚠ 平均值碰巧準，但散得很開：隨機誤差大。'
          : '⚠ 又不準又不精密：儀器與操作都要檢討。'}
      </div>`;
    return { n, bias, sd };
  }

  function addShot(e) {
    const r = bull.getBoundingClientRect();
    const px = (e.clientX - r.left) * (230 / r.width);
    const py = (e.clientY - r.top) * (230 / r.height);
    if (Math.hypot(px - CX, py - CY) > BULL_R + 6) return;
    shots.push({ x: px, y: py });
    if (shots.length > 40) shots.shift();
    drawBull(); bullStats();
  }
  bull.addEventListener('pointerdown', addShot);
  bull.addEventListener('pointermove', (e) => { if (e.buttons === 1) addShot(e); });

  /* 四象限預設按鈕 */
  const presets = [
    { k: '高精密 · 高準確', bias: 0, spread: 6 },
    { k: '高精密 · 低準確', bias: 52, spread: 6 },
    { k: '低精密 · 高準確', bias: 0, spread: 34 },
    { k: '低精密 · 低準確', bias: 46, spread: 34 },
    { k: '清空', clear: true },
  ];
  const pHost = ctx.subEl.querySelector('#bull-presets');
  presets.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn sm ghost'; b.textContent = p.k;
    b.setAttribute('aria-label', p.clear ? '清空所有量測點' : `示範${p.k}的量測結果`);
    b.addEventListener('click', () => {
      shots = [];
      if (!p.clear) {
        const ang = Math.PI * 0.75;
        for (let i = 0; i < 8; i++) {
          shots.push({
            x: CX + Math.cos(ang) * p.bias + (Math.random() - .5) * p.spread * 2,
            y: CY + Math.sin(ang) * p.bias + (Math.random() - .5) * p.spread * 2,
          });
        }
      }
      drawBull(); bullStats();
    });
    pHost.appendChild(b);
  });
  drawBull(); bullStats();

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'ec', name: '材料隱含碳', unit: 'kg CO₂e/kg', min: 0, max: 40, digits: 1,
      better: 'low', good: 2, bad: 20, note: '生產 1 kg 該材料的溫室氣體排放（概略值）' },
    { key: 'energy', name: '製造能耗', unit: 'MJ/kg', min: 0, max: 400, digits: 0,
      better: 'low', good: 60, bad: 250, note: '生產 1 kg 材料的一次能源投入；超過 400 以滿格表示（原則 #6）' },
    { key: 'save', name: '減碳效益', unit: '%', min: -50, max: 100, digits: 1,
      better: 'high', good: 25, bad: 0, note: '相對於「原生鋼製車體」的生命週期 CO₂ 變化' },
  ]);

  /* ---------------- 即時數據 ---------------- */
  let readout = buildReadouts(ctx.hostReadout, []);

  /* ---------------- 控制項 ---------------- */
  let C = null;             // buildControls 回傳
  let mode = ctx.scenario;  // 'classic' | 'green'

  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：同體積盒子裡的原子堆積');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'metal', label: '選擇金屬', value: 'Au',
          options: Object.keys(METALS).map(k => ({ v: k, label: `${k} ${METALS[k].zh}`, title: METALS[k].note })) },
        { type: 'range', key: 'cells', label: '盒子大小（單位晶胞數 n×n×n）', min: 2, max: 6, step: 1, value: 4, unit: '³ 個晶胞',
          hint: '盒子變大 → 原子數與質量同步變大，但密度（強度性質）完全不變。' },
        { type: 'range', key: 'rscale', label: '原子顯示半徑', min: 0.3, max: 1.0, step: 0.05, value: 0.55, unit: '×',
          hint: '調到 1.0 就是「原子彼此相切」的最密堆積畫面。' },
        { type: 'range', key: 'recy', label: '再生料比例', min: 0, max: 100, step: 5, value: 0, unit: '%',
          hint: '再生金屬省去冶煉還原，隱含碳大幅下降（原則 #6）。' },
        { type: 'check', key: 'cell', label: '顯示單位晶胞', value: true },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'n', label: '盒內原子數', unit: '顆', digits: 0 },
        { key: 'V', label: '盒子體積', unit: 'nm³', digits: 3 },
        { key: 'm', label: '盒內質量', unit: '×10⁻²¹ g', digits: 3 },
        { key: 'd', label: '算出的密度 d = m/V', unit: 'g/cm³', digits: 3, wide: true },
        { key: 'dlit', label: '文獻密度', unit: 'g/cm³', digits: 2 },
        { key: 'apf', label: '堆積因子 APF', unit: '', digits: 2 },
        { key: 'zcell', label: '每個晶胞原子數 Z', unit: '顆', digits: 0 },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：同體積不同材料 → 車輛減重與減碳');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'mat', label: '車體材料', value: 'Fe',
          options: [
            { v: 'Fe', label: '鋼', title: '低碳鋼，密度 7.85 g/cm³' },
            { v: 'Al', label: '鋁合金', title: '6061 鋁合金，密度 2.70 g/cm³' },
            { v: 'Mg', label: '鎂合金', title: 'AZ91 鎂合金，密度約 1.81 g/cm³' },
            { v: 'CFRP', label: '碳纖維複材', title: 'CFRP，密度約 1.55 g/cm³' },
          ] },
        { type: 'range', key: 'vol', label: '車體結構材料體積', min: 0.02, max: 0.08, step: 0.005, value: 0.04, unit: 'm³',
          hint: '一般乘用車的白車身結構約 0.03–0.05 m³；同樣體積換材料就換掉整車的重量。' },
        { type: 'range', key: 'km', label: '年行駛里程', min: 3000, max: 30000, step: 1000, value: 15000, unit: 'km' },
        { type: 'range', key: 'recy', label: '再生料比例', min: 0, max: 100, step: 5, value: 0, unit: '%',
          hint: '再生鋁的隱含碳約只有原生鋁的 5–10%。' },
        { type: 'range', key: 'life', label: '使用年限', min: 5, max: 20, step: 1, value: 12, unit: '年' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'mass', label: '結構件質量', unit: 'kg', digits: 0 },
        { key: 'dm', label: '相對鋼材減重', unit: 'kg', digits: 0 },
        { key: 'fuel', label: '年省油量', unit: 'L', digits: 1 },
        { key: 'useCO2', label: '使用階段年減碳', unit: 'kg CO₂', digits: 1 },
        { key: 'mkCO2', label: '製造階段碳排', unit: 'kg CO₂e', digits: 0 },
        { key: 'net', label: '全生命週期淨減碳', unit: 'kg CO₂', digits: 0, wide: true },
      ]);
    }
    rebuild();
  }

  function onChange(key) {
    if (key === 'metal' || key === 'cells' || key === 'rscale' || key === 'cell' || key === 'mat') rebuild();
    else update();
  }

  /* ---------------- 產生 3D 內容 ---------------- */
  function clearGroup() {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    stage.scene.remove(group);
    group = new THREE.Group();
    stage.scene.add(group);
  }

  /* ---- 單位晶胞定義：dims 為晶胞三軸長度（nm），basis 為分數座標 ----
     FCC：4 顆/晶胞　BCC：2 顆/晶胞
     HCP 改用「正交超晶胞」(a, √3a, c) 表示，內含 4 顆原子，
     這樣三種晶格都能用同一段程式產生，且原子數是精確的整數倍。 */
  function cellInfo(sym) {
    const m = METALS[sym];
    const a = m.a_pm / 1000;                                   // nm
    if (m.lattice === 'FCC') return { dims: [a, a, a], basis: [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]] };
    if (m.lattice === 'BCC') return { dims: [a, a, a], basis: [[0, 0, 0], [.5, .5, .5]] };
    const c = TI_C_PM / 1000;                                  // HCP：Ti
    return { dims: [a, Math.sqrt(3) * a, c], basis: [[0, 0, 0], [.5, .5, 0], [.5, 1 / 6, .5], [0, 2 / 3, .5]] };
  }

  /** 產生 n×n×n 個晶胞內的所有原子座標（nm）。原子數 = n³ × 晶胞內原子數，精確可數。 */
  function latticePoints(sym, n) {
    const { dims, basis } = cellInfo(sym);
    const pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      basis.forEach(b => pts.push([
        (i + b[0]) * dims[0], (j + b[1]) * dims[1], (k + b[2]) * dims[2],
      ]));
    }
    return pts;
  }

  /** 盒子的三軸尺寸與體積（nm、nm³）*/
  function boxSize(sym, n) {
    const { dims } = cellInfo(sym);
    return { dims: dims.map(d => d * n), V: dims[0] * dims[1] * dims[2] * n ** 3 };
  }

  /** 由晶格常數推算理論密度 (g/cm³)，與上面的數點法應完全一致 */
  function crystalDensity(sym) {
    const m = METALS[sym];
    const { dims, basis } = cellInfo(sym);
    const Vcm3 = dims[0] * dims[1] * dims[2] * 1e-21;          // nm³ → cm³
    return basis.length * m.M / (CONST.NA * Vcm3);
  }

  function buildClassic() {
    const sym = C.values.metal, n = Math.round(C.values.cells), rs = C.values.rscale;
    const m = METALS[sym];
    const { dims } = cellInfo(sym);
    const box = boxSize(sym, n);
    const pts = latticePoints(sym, n);
    // 讓盒子的最長邊在畫面上固定為 3.2，方便不同金屬視覺比較
    const SCALE = 3.2 / Math.max(...box.dims);
    const rNm = (m.r_pm / 1000) * rs;         // 顯示半徑（nm）
    const half = box.dims.map(d => d / 2);

    group.add(glassBox(box.dims[0] * SCALE, box.dims[1] * SCALE, box.dims[2] * SCALE, 0x1E9EB3));

    const geo = new THREE.SphereGeometry(1, 16, 14);
    const mat = atomMaterial(m.color, { roughness: 0.28, metalness: 0.55 });
    const N = Math.min(pts.length, 3000);
    const inst = new THREE.InstancedMesh(geo, mat, N);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      dummy.position.set((p[0] - half[0]) * SCALE, (p[1] - half[1]) * SCALE, (p[2] - half[2]) * SCALE);
      dummy.scale.setScalar(rNm * SCALE);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);

    // 單位晶胞外框（用珊瑚色標出「一個晶胞」在哪裡）
    if (C.values.cell) {
      const d = dims.map(x => x * SCALE);
      const cell = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(d[0], d[1], d[2])),
        new THREE.LineBasicMaterial({ color: 0xFF7A59 })
      );
      cell.position.set(-half[0] * SCALE + d[0] / 2, -half[1] * SCALE + d[1] / 2, -half[2] * SCALE + d[2] / 2);
      group.add(cell);
    }
  }

  function buildGreen() {
    const keys = ['Fe', 'Al', 'Mg', 'CFRP'];
    const colors = { Fe: 0x9AA4AD, Al: 0xBFD3DB, Mg: 0x7ED08A, CFRP: 0x4A5B54 };
    const sel = C.values.mat;
    keys.forEach((k, i) => {
      const rho = LIGHTWEIGHT[k].rho;
      const x = (i - 1.5) * 1.75;
      // 立方塊：體積一律相同（邊長 1.2），高度不變 → 用「上方的質量柱」表現重量差
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshStandardMaterial({
          color: colors[k], roughness: 0.42, metalness: k === 'CFRP' ? 0.05 : 0.6,
          emissive: k === sel ? 0x2E7D3A : 0x000000, emissiveIntensity: 0.28,
        })
      );
      cube.position.set(x, -0.6, 0);
      group.add(cube);

      // 質量柱（高度 ∝ 密度）
      const hgt = rho / 7.85 * 2.4;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, hgt, 14),
        new THREE.MeshStandardMaterial({ color: k === sel ? 0x3FA34D : 0xCBDBD3, roughness: .4 })
      );
      bar.position.set(x, 0.1 + hgt / 2, 0);
      group.add(bar);

      const s = textSprite(`${LIGHTWEIGHT[k].zh} ${rho} g/cm³`, { scale: 0.0072 });
      s.position.set(x, 0.2 + hgt + 0.35, 0);
      group.add(s);
    });
    // 地面
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 40),
      new THREE.MeshStandardMaterial({ color: 0xE7F3EC, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25;
    group.add(floor);
  }

  function rebuild() {
    clearGroup();
    if (mode === 'classic') buildClassic(); else buildGreen();
    update();
  }

  /* ---------------- 數值更新 ---------------- */
  function update() {
    if (mode === 'classic') {
      const sym = C.values.metal, cells = Math.round(C.values.cells);
      const m = METALS[sym];
      const info = cellInfo(sym);
      const box = boxSize(sym, cells);
      const n = info.basis.length * cells ** 3;
      const V_nm3 = box.V;
      const V_cm3 = V_nm3 * 1e-21;
      const mass_g = n * m.M / CONST.NA;
      const d = mass_g / V_cm3;
      const dCryst = crystalDensity(sym);

      readout({
        n, V: V_nm3, m: mass_g * 1e21, d, dlit: m.rho, apf: m.apf, zcell: info.basis.length,
      });
      ctx.setOverlay(
        `<b>${sym}（${m.zh}）</b><br>${m.lattice}　a = ${m.a_pm} pm<br>
         盒子 ${box.dims.map(x => x.toFixed(2)).join(' × ')} nm<br>
         晶格公式密度 ${dCryst.toFixed(2)} g/cm³`);

      const e = EMBODIED[sym];
      const r = C.values.recy / 100;
      const ec = e.primary * (1 - r) + e.recycled * r;
      const energy = e.ePri * (1 - r) + e.eRec * r;
      const base = EMBODIED.Fe.primary;
      const save = (1 - ec / base) * 100;
      gauge({ ec, energy, save: Math.max(-50, Math.min(100, save)) },
        sym === 'Au'
          ? `⚠ 金的隱含碳約 <strong>${e.primary.toLocaleString()}</strong> kg CO₂e/kg（${e.range}）——這也是「都市採礦」在 Ch2 被看重的原因。`
          : `目前隱含碳 <strong>${ec.toFixed(2)}</strong> kg CO₂e/kg（文獻範圍 ${e.range}）。把再生料拉到 100% 看看差多少。`);

    } else {
      const k = C.values.mat, vol = C.values.vol, km = C.values.km, life = C.values.life;
      const r = C.values.recy / 100;
      const rho = LIGHTWEIGHT[k].rho;                       // g/cm³ = t/m³
      const mass = rho * 1000 * vol;                        // kg
      const massFe = LIGHTWEIGHT.Fe.rho * 1000 * vol;
      const dm = massFe - mass;

      // 減重 → 省油：整車以 1400 kg 為基準；減重 1% → 省油 0.7%
      const CAR = 1400;
      const basefuel = 8.0;                                  // L/100km 基準油耗
      const pctLighter = dm / CAR * 100;
      const fuelSaved = basefuel * (pctLighter * FUEL_CO2.weightToFuelPct / 100) * km / 100;
      const useCO2 = fuelSaved * FUEL_CO2.gasoline_kg_per_L;

      const e = EMBODIED[k];
      const ec = e.primary * (1 - r) + e.recycled * r;
      const energy = e.ePri * (1 - r) + e.eRec * r;
      const ecFe = EMBODIED.Fe.primary;
      const mkCO2 = ec * mass;
      const mkCO2Fe = ecFe * massFe;
      const net = (mkCO2Fe - mkCO2) + useCO2 * life;

      readout({ mass, dm, fuel: fuelSaved, useCO2, mkCO2, net });
      ctx.setOverlay(
        `<b>${LIGHTWEIGHT[k].zh}</b><br>ρ = ${rho} g/cm³<br>
         結構件 ${mass.toFixed(0)} kg（鋼 ${massFe.toFixed(0)} kg）`);

      const save = mkCO2Fe + useCO2 * life > 0 ? net / (mkCO2Fe + useCO2 * life) * 100 : 0;
      gauge({ ec, energy, save: Math.max(-50, Math.min(100, save)) },
        net > 0
          ? `✅ ${life} 年下來淨減碳 <strong>${net.toFixed(0)} kg CO₂</strong>。減重省下的油，補得回製造多花的碳。`
          : `⚠ 目前淨值是 <strong>${net.toFixed(0)} kg CO₂</strong>（負值＝反而更糟）。輕量化材料的製造碳排較高，要開夠久、或用再生料才划算——這正是生命週期思考的重點。`);
    }
  }

  /* ---------------- 情境切換 ---------------- */
  ctx.onScenario(v => {
    mode = v;
    // 射靶模組在綠色情境改成「花蓮岩石密度的重複量測」情境說明
    const t = ctx.subEl.querySelector('[data-bull-title]');
    const note = ctx.subEl.querySelector('[data-bull-note]');
    if (v === 'green') {
      t.innerHTML = '🎯 射靶：量測花蓮蛇紋岩密度的重複實驗';
      note.innerHTML = `真值取蛇紋岩 <strong>${HUALIEN_ROCKS.serpentine.rho_lo}–${HUALIEN_ROCKS.serpentine.rho_hi} g/cm³</strong>。
        製程若要即時判斷礦石可否再利用，就必須先有「又準又精密」的量測（<span data-term="原子經濟性" style="display:none"></span>綠色化學原則 #11 即時分析防污染）。`;
      stage.camera.position.set(0, 2.2, 7.2);
    } else {
      t.innerHTML = '🎯 射靶：精密度 vs 準確度';
      note.innerHTML = '在靶上點幾下加入量測點。<strong>準確度</strong>＝離紅心多近；<strong>精密度</strong>＝彼此有多集中。';
      stage.camera.position.set(3.4, 2.6, 4.6);
    }
    stage.controls.target.set(0, 0, 0);
    stage.controls.update();
    buildForScenario();
  });

  buildForScenario();
  stage.start(() => { group.rotation.y += 0.0016; });

  return { destroy() { stage.dispose(); } };
}
