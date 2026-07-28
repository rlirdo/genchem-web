/* ==========================================================================
   sim/ch13.js — Ch13 化學平衡
   模組 A（3D）：N₂ + 3H₂ ⇌ 2NH₃ 的分子在畫面中持續雙向轉換
   模組 B（2D）：正逆反應速率曲線交會 → 動態平衡；濃度—時間圖與 Q / K 追趕
   綠色情境：哈柏法 vs 仿生固氮（固氮酶）；海洋 CO₂ 溶解平衡與酸化

   化學說明：
     Kc = [NH₃]² / ([N₂][H₂]³)
     正反應速率 r_f = k_f [N₂][H₂]³　逆反應速率 r_r = k_r [NH₃]²
     平衡時 r_f = r_r，於是 Kc = k_f / k_r。
     溫度效應以凡特荷夫式處理：d(lnK)/d(1/T) = −ΔH/R（ΔH = −92.2 kJ/mol，放熱）
   ========================================================================== */

import { createStage, THREE, atom, bond, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { HABER, NITROGENASE, OCEAN_CO2, CONST } from '../../data/constants.js';

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.2, 9.5], fov: 45, minDistance: 4, maxDistance: 22,
    ariaLabel: '氨合成反應的動態平衡 3D 模擬',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------------- 平衡狀態（以濃度為狀態變數）---------------- */
  const S = { N2: 1.0, H2: 3.0, NH3: 0.0, t: 0, hist: [], rf: 0, rr: 0 };
  const BOX = { w: 7.5, h: 4.2, d: 2.6 };

  /** 平衡常數 Kc(T)：以 298 K 的 Kp 換算並用凡特荷夫式外推（教學用）*/
  function Kc(T) {
    const K298 = 3.6e8;                                  // Kc(298 K)，由 Kp = 5.8×10⁵ 換算
    const dH = HABER.dH * 1000;                          // J/mol
    return K298 * Math.exp(-dH / CONST.R_J * (1 / T - 1 / 298));
  }

  /* ---------------- 3D 分子 ---------------- */
  let mols = [];
  const MOL_STYLE = {
    N2: { c: 0x4C7DE0, n: 2, r: 0.26 },
    H2: { c: 0xF2F6F4, n: 2, r: 0.17 },
    NH3: { c: 0x7ED08A, n: 4, r: 0.24 },
  };

  function makeMol(kind) {
    const g = new THREE.Group();
    const st = MOL_STYLE[kind];
    if (kind === 'NH3') {
      const N = atom(0.26, 0x4C7DE0, 12); g.add(N);
      const a = 107 / 2 * Math.PI / 180;
      for (let i = 0; i < 3; i++) {
        const th = i / 3 * Math.PI * 2;
        const H = atom(0.16, 0xF2F6F4, 10);
        H.position.set(Math.cos(th) * Math.sin(a) * 0.6, -Math.cos(a) * 0.6, Math.sin(th) * Math.sin(a) * 0.6);
        g.add(H, bond(N.position, H.position, 0.045, 0xD8E4DE));
      }
    } else {
      const a = atom(st.r, st.c, 12), b = atom(st.r, st.c, 12);
      a.position.set(-st.r * 1.05, 0, 0); b.position.set(st.r * 1.05, 0, 0);
      g.add(a, b, bond(a.position, b.position, 0.05, 0xD8E4DE));
    }
    g.userData = {
      kind,
      v: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(1.4),
      spin: (Math.random() - .5) * 2,
    };
    g.position.set((Math.random() - .5) * BOX.w * .85, (Math.random() - .5) * BOX.h * .8, (Math.random() - .5) * BOX.d * .8);
    return g;
  }

  function syncMolecules() {
    // 依濃度決定畫面上各物種的分子數（總數上限 90）
    const total = S.N2 + S.H2 + S.NH3;
    const cap = 90;
    const want = {
      N2: Math.round(S.N2 / total * cap),
      H2: Math.round(S.H2 / total * cap),
      NH3: Math.round(S.NH3 / total * cap),
    };
    const have = { N2: 0, H2: 0, NH3: 0 };
    mols.forEach(m => have[m.userData.kind]++);
    for (const k of ['N2', 'H2', 'NH3']) {
      while (have[k] < want[k] && mols.length < cap + 6) { const m = makeMol(k); world.add(m); mols.push(m); have[k]++; }
      while (have[k] > want[k]) {
        const idx = mols.findIndex(m => m.userData.kind === k);
        if (idx < 0) break;
        const m = mols[idx];
        m.traverse(x => x.geometry && x.geometry.dispose());
        world.remove(m); mols.splice(idx, 1); have[k]--;
      }
    }
  }

  /* ---------------- 圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="display:flex;gap:.8rem;flex-wrap:wrap">
      <div style="flex:1 1 300px;min-width:260px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem">⚖ 正逆反應速率（交會＝達平衡）</div>
        <canvas id="rate" aria-label="正逆反應速率對時間"></canvas>
      </div>
      <div style="flex:1 1 300px;min-width:260px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t2>📊 濃度—時間圖</div>
        <canvas id="conc" aria-label="濃度對時間"></canvas>
      </div>
    </div>`;
  const rateCh = new Chart2D(ctx.subEl.querySelector('#rate'), {
    height: 175, pad: { l: 52, r: 12, t: 12, b: 30 }, xLabel: '時間', yLabel: '反應速率',
  });
  const concCh = new Chart2D(ctx.subEl.querySelector('#conc'), {
    height: 175, pad: { l: 52, r: 12, t: 12, b: 30 }, xLabel: '時間', yLabel: '濃度 (M)',
  });
  rateCh.onResize = drawCharts; concCh.onResize = drawCharts;

  function drawCharts() {
    if (mode === 'green' && C.values.gmod === 'ocean') { drawOcean(); return; }
    const h = S.hist;
    if (!h.length) return;
    const t0 = h[0].t, t1 = Math.max(h[h.length - 1].t, t0 + 1);
    const maxR = Math.max(1e-6, ...h.map(p => Math.max(p.rf, p.rr)));
    rateCh.xLabel = '時間'; rateCh.yLabel = '反應速率';
    rateCh.clear().setRange(t0, t1, 0, maxR * 1.15).axes({ xTicks: 4, yTicks: 4, yFmt: () => '' });
    rateCh.line(h.map(p => [p.t, p.rf]), { color: PALETTE.ocean, width: 2.5 });
    rateCh.line(h.map(p => [p.t, p.rr]), { color: PALETTE.coral, width: 2.5 });
    rateCh.legend([{ label: '正反應 r_f', color: PALETTE.ocean }, { label: '逆反應 r_r', color: PALETTE.coral }],
      { x: 70, y: 22 });

    const maxC = Math.max(0.5, ...h.map(p => Math.max(p.N2, p.H2, p.NH3)));
    concCh.xLabel = '時間'; concCh.yLabel = '濃度 (M)';
    concCh.clear().setRange(t0, t1, 0, maxC * 1.15).axes({ xTicks: 4, yTicks: 4 });
    concCh.line(h.map(p => [p.t, p.N2]), { color: PALETTE.ocean, width: 2.2 });
    concCh.line(h.map(p => [p.t, p.H2]), { color: PALETTE.muted, width: 2.2 });
    concCh.line(h.map(p => [p.t, p.NH3]), { color: PALETTE.leafDeep, width: 3 });
    concCh.legend([
      { label: 'N₂', color: PALETTE.ocean }, { label: 'H₂', color: PALETTE.muted },
      { label: 'NH₃', color: PALETTE.leafDeep },
    ], { x: 66, y: 22 });
  }

  function drawOcean() {
    // 海洋 CO₂ 溶解平衡：大氣 CO₂ 上升 → 海水 pH 下降
    const ppm = C.values.ppm;
    rateCh.xLabel = '大氣 CO₂ (ppm)'; rateCh.yLabel = '海水 pH';
    rateCh.clear().setRange(250, 1000, 7.6, 8.35).axes({ xTicks: 4, yTicks: 4 });
    const pts = [];
    for (let p = 250; p <= 1000; p += 5) pts.push([p, oceanPH(p)]);
    rateCh.line(pts, { color: PALETTE.ocean, width: 3 });
    rateCh.dot(OCEAN_CO2.co2_ppm_1750, oceanPH(OCEAN_CO2.co2_ppm_1750), { color: PALETTE.leafDeep, r: 5, stroke: '#fff' });
    rateCh.label(OCEAN_CO2.co2_ppm_1750, oceanPH(OCEAN_CO2.co2_ppm_1750), '工業革命前', { dy: 10, color: PALETTE.leafDeep });
    rateCh.dot(ppm, oceanPH(ppm), { color: PALETTE.coralDeep, r: 6, stroke: '#fff' });
    rateCh.label(ppm, oceanPH(ppm), `${ppm} ppm`, { dy: -14, color: PALETTE.coralDeep });

    // 右圖：碳酸鈣飽和度示意
    concCh.xLabel = '大氣 CO₂ (ppm)'; concCh.yLabel = '[H⁺] 相對倍率';
    concCh.clear().setRange(250, 1000, 0, 4).axes({ xTicks: 4, yTicks: 4 });
    const p2 = [];
    for (let p = 250; p <= 1000; p += 5) {
      p2.push([p, Math.pow(10, -(oceanPH(p))) / Math.pow(10, -oceanPH(OCEAN_CO2.co2_ppm_1750))]);
    }
    concCh.line(p2, { color: PALETTE.coralDeep, width: 3 });
    concCh.hline(1, { color: PALETTE.muted, dash: [4, 4], label: '工業革命前 = 1' });
  }
  /** 海水 pH 對大氣 CO₂ 的簡化關係（以觀測錨點校準的教學用近似）*/
  function oceanPH(ppm) {
    // 278 ppm → 8.21；419 ppm → 8.10（IPCC AR6 觀測值），以 log 關係內插外推
    const a = (OCEAN_CO2.pH_now - OCEAN_CO2.pH_preindustrial) /
      (Math.log10(OCEAN_CO2.co2_ppm_2023) - Math.log10(OCEAN_CO2.co2_ppm_1750));
    return OCEAN_CO2.pH_preindustrial + a * (Math.log10(ppm) - Math.log10(OCEAN_CO2.co2_ppm_1750));
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'energy', name: '能耗', unit: 'GJ/噸 NH₃', min: 0, max: 40, digits: 1,
      better: 'low', good: 10, bad: 28, note: '每生產 1 噸氨的能量投入（原則 #6）' },
    { key: 'co2', name: '碳排', unit: 't CO₂/t NH₃', min: 0, max: 2.5, digits: 2,
      better: 'low', good: 0.4, bad: 1.6, note: '每噸氨的溫室氣體排放' },
    { key: 'cond', name: '製程嚴苛度', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '溫度與壓力的嚴苛程度（原則 #12 本質安全）' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：N₂ + 3H₂ ⇌ 2NH₃ 的動態平衡');
      C = buildControls(ctx.hostControls, [
        { type: 'range', key: 'T', label: '溫度', min: 300, max: 900, step: 10, value: 700, unit: 'K',
          hint: '這是放熱反應（ΔH = −92.2 kJ/mol）：升溫會讓平衡往左移，K 變小。' },
        { type: 'range', key: 'P', label: '壓力（以容器體積表示）', min: 50, max: 400, step: 10, value: 200, unit: 'atm',
          hint: '左邊 4 莫耳氣體、右邊 2 莫耳。加壓會把平衡推向莫耳數少的一邊（右）。' },
        { type: 'button', key: 'addN2', label: '＋ 加入 N₂' },
        { type: 'button', key: 'addH2', label: '＋ 加入 H₂' },
        { type: 'button', key: 'removeNH3', label: '－ 抽走 NH₃' },
        { type: 'button', key: 'reset', label: '↺ 重設' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'N2', label: '[N₂]', unit: 'M', digits: 3 },
        { key: 'H2', label: '[H₂]', unit: 'M', digits: 3 },
        { key: 'NH3', label: '[NH₃]', unit: 'M', digits: 3 },
        { key: 'rf', label: '正反應速率', unit: '', digits: 4 },
        { key: 'rr', label: '逆反應速率', unit: '', digits: 4 },
        { key: 'Q', label: '反應商 Q', unit: '', digits: 0, wide: true },
        { key: 'K', label: '平衡常數 K(T)', unit: '', digits: 0, wide: true },
        { key: 'state', label: '系統往哪走', unit: '', digits: 0, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：哈柏法 vs 固氮酶，以及海洋的 CO₂ 平衡');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'gmod', label: '主題', value: 'fix', options: [
          { v: 'fix', label: '固氮：工業 vs 仿生', title: '哈柏法與固氮酶的能耗與條件比較' },
          { v: 'ocean', label: '海洋 CO₂ 平衡', title: '大氣 CO₂ 上升如何改變海水 pH' },
        ] },
        { type: 'seg', key: 'route', label: '固氮方式', value: 'haber', options: [
          { v: 'haber', label: '哈柏法（工業）', title: '450 °C、200 atm、鐵觸媒' },
          { v: 'green', label: '綠氨（再生電力）', title: '以綠氫取代天然氣重組製氫' },
          { v: 'enzyme', label: '固氮酶（仿生）', title: '常溫常壓、FeMo 輔因子' },
        ] },
        { type: 'range', key: 'T', label: '溫度', min: 300, max: 900, step: 10, value: 700, unit: 'K' },
        { type: 'range', key: 'P', label: '壓力', min: 1, max: 400, step: 1, value: 200, unit: 'atm' },
        { type: 'range', key: 'ppm', label: '大氣 CO₂ 濃度', min: 250, max: 1000, step: 5, value: 419, unit: 'ppm',
          hint: '工業革命前 278 ppm；2023 年約 419 ppm。' },
        { type: 'range', key: 'output', label: '年產量', min: 1, max: 500, step: 1, value: 100, unit: '萬噸' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'cond', label: '操作條件', unit: '', digits: 0, wide: true },
        { key: 'K', label: '該溫度的 K', unit: '', digits: 0 },
        { key: 'yield', label: '單程轉化率', unit: '%', digits: 1 },
        { key: 'energy', label: '能耗', unit: 'GJ/噸', digits: 1 },
        { key: 'co2', label: '碳排', unit: 't CO₂/t', digits: 2 },
        { key: 'annual', label: '年碳排', unit: '萬噸 CO₂', digits: 1, wide: true },
        { key: 'ph', label: '對應海水 pH', unit: '', digits: 3 },
        { key: 'hplus', label: '[H⁺] 相對工業革命前', unit: '倍', digits: 2 },
      ]);
    }
    resetSystem();
    syncMolecules();
    drawCharts(); update();
  }

  function resetSystem() {
    S.N2 = 1.0; S.H2 = 3.0; S.NH3 = 0.0; S.t = 0; S.hist = [];
  }

  function onChange(key) {
    if (key === 'addN2') S.N2 += 0.5;
    if (key === 'addH2') S.H2 += 1.5;
    if (key === 'removeNH3') S.NH3 = Math.max(0, S.NH3 - 0.5);
    if (key === 'reset') resetSystem();
    drawCharts();
    update();
  }

  /* ---------------- 反應動力學積分 ---------------- */
  function step(dt) {
    const T = C.values.T;
    const K = Kc(T);
    // 以壓力（濃度尺度）調節：加壓等於把所有濃度乘上一個因子
    const kf = 0.35, kr = kf / Math.max(1e-12, K);
    const rf = kf * Math.max(0, S.N2) * Math.pow(Math.max(0, S.H2), 3);
    const rr = kr * Math.pow(Math.max(0, S.NH3), 2);
    const net = (rf - rr) * dt;
    const lim = Math.min(S.N2, S.H2 / 3, net > 0 ? Infinity : S.NH3 / 2);
    const x = Math.max(-Math.min(S.NH3 / 2, 0.4), Math.min(Math.min(S.N2, S.H2 / 3, 0.4), net));
    S.N2 -= x; S.H2 -= 3 * x; S.NH3 += 2 * x;
    S.N2 = Math.max(0, S.N2); S.H2 = Math.max(0, S.H2); S.NH3 = Math.max(0, S.NH3);
    S.rf = rf; S.rr = rr;
    S.t += dt;
    S.hist.push({ t: S.t, rf, rr, N2: S.N2, H2: S.H2, NH3: S.NH3 });
    if (S.hist.length > 420) S.hist.shift();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    const T = C.values.T;
    const K = Kc(T);
    const Q = S.NH3 ** 2 / Math.max(1e-12, S.N2 * S.H2 ** 3);

    if (mode === 'classic') {
      readout({
        N2: S.N2, H2: S.H2, NH3: S.NH3, rf: S.rf, rr: S.rr,
        Q: fmtSci(Q), K: fmtSci(K),
        state: Math.abs(S.rf - S.rr) < 1e-4 ? '⚖ 已達平衡（正逆速率相等）'
          : (Q < K ? '➡ Q < K，反應繼續往右（生成 NH₃）' : '⬅ Q > K，反應往左（分解 NH₃）'),
      });
      ctx.setOverlay(
        `<b>N₂ + 3H₂ ⇌ 2NH₃</b>　ΔH = ${HABER.dH} kJ/mol（放熱）<br>
         T = ${T} K｜K = ${fmtSci(K)}<br>
         ${Math.abs(S.rf - S.rr) < 1e-4 ? '⚖ 動態平衡：分子仍在雙向轉換，只是速率相等' : '反應進行中…'}`);
      gauge({ energy: HABER.energy_GJ_per_tNH3, co2: HABER.co2_t_per_tNH3, cond: 4.5 },
        `<strong>平衡不是停止。</strong>看 3D 畫面——分子仍然不斷在兩邊轉換，
         只是正逆速率相等，所以濃度不再改變。<br>
         試試按「抽走 NH₃」：Q 立刻掉到 K 以下，系統會再生成更多 NH₃ 把 Q「追」回 K——
         這就是<span data-term="勒沙特列原理">勒沙特列原理</span>，工業上稱為「移除產物以推動反應」。`);

    } else if (C.values.gmod === 'ocean') {
      const ph = oceanPH(C.values.ppm);
      const ratio = Math.pow(10, -(ph)) / Math.pow(10, -OCEAN_CO2.pH_preindustrial);
      readout({
        cond: '海洋碳酸鹽平衡', K: fmtSci(K), yield: 0,
        energy: 0, co2: 0, annual: 0, ph, hplus: ratio,
      });
      ctx.setOverlay(
        `<b>CO₂(g) ⇌ CO₂(aq) ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻</b><br>
         大氣 ${C.values.ppm} ppm → 海水 pH ${ph.toFixed(3)}<br>
         [H⁺] 為工業革命前的 <strong>${ratio.toFixed(2)} 倍</strong>`);
      gauge({ energy: 0, co2: 0, cond: Math.min(5, (ratio - 1) * 5) },
        `海洋吸收了人為 CO₂ 排放的約四分之一，這是地球最大的緩衝系統。
         但緩衝<strong>不是免費的</strong>：溶進去的 CO₂ 生成碳酸並釋出 H⁺，
         使海水 pH 由 ${OCEAN_CO2.pH_preindustrial} 降到 ${OCEAN_CO2.pH_now}。
         pH 只掉了 0.11 聽起來很少，但 pH 是<strong>對數尺度</strong>——
         [H⁺] 實際上增加了約 <strong>${OCEAN_CO2.H_increase_pct}%</strong>。
         這會使碳酸鈣殼體（珊瑚、貝類、有孔蟲）更難形成甚至溶解。
         Ch14、Ch15 會把這條線索接到酸鹼平衡與緩衝容量。`);

    } else {
      const route = C.values.route;
      const yieldPct = equilibriumYield(T, C.values.P);
      const data = {
        haber: { e: HABER.energy_GJ_per_tNH3, c: HABER.co2_t_per_tNH3, cond: 4.5,
          zh: `${HABER.industry_T_C} °C、${HABER.industry_P_atm} atm、鐵觸媒` },
        green: { e: 36, c: 0.35, cond: 4.2, zh: `${HABER.industry_T_C} °C、${HABER.industry_P_atm} atm、綠氫進料` },
        enzyme: { e: 8, c: 0.15, cond: 0.8, zh: `${NITROGENASE.T_C} °C、${NITROGENASE.P_atm} atm、FeMo 輔因子` },
      }[route];
      readout({
        cond: data.zh, K: fmtSci(K), yield: yieldPct,
        energy: data.e, co2: data.c, annual: data.c * C.values.output,
        ph: oceanPH(C.values.ppm), hplus: Math.pow(10, -oceanPH(C.values.ppm)) / Math.pow(10, -OCEAN_CO2.pH_preindustrial),
      });
      ctx.setOverlay(
        `<b>${{ haber: '哈柏法（工業）', green: '綠氨', enzyme: '固氮酶（仿生）' }[route]}</b><br>
         ${data.zh}<br>能耗 ${data.e} GJ/噸｜碳排 ${data.c} t CO₂/t`);
      gauge({ energy: data.e, co2: data.c, cond: data.cond },
        route === 'haber'
          ? `哈柏法養活了全球約一半的人口，但代價驚人：約占全球能源使用的
             <strong>${HABER.world_energy_pct}%</strong>，每噸氨排放約 ${HABER.co2_t_per_tNH3} 噸 CO₂。<br>
             這裡有一個殘酷的化學矛盾：反應是<strong>放熱</strong>的，所以低溫在熱力學上更有利（K 更大）；
             但低溫下反應太慢。工業只好折衷到 450 °C，再用<strong>高壓</strong>（原則 #12 的反面）
             把平衡推回去。<strong>熱力學與動力學的拉鋸，是整個化工的核心難題。</strong>`
          : route === 'green'
            ? `綠氨把進料的氫從天然氣重組改成再生電力電解，碳排由 ${HABER.co2_t_per_tNH3} 降到約 0.35 t/t。
               但注意<strong>能耗反而更高</strong>（電解效率有限）——它解決的是碳排問題，不是能耗問題。
               這是誠實的綠色化學：說清楚哪一項改善了、哪一項沒有。`
            : `🦠 <span data-term="固氮酶">固氮酶</span>在<strong>${NITROGENASE.T_C} °C、常壓</strong>下做同一件事，
               靠的是鐵鉬輔因子（FeMo-co）逐步傳遞電子與質子，把 N≡N 的 941 kJ/mol 三鍵一步步拆開，
               而不是硬用高溫高壓。代價是每固定 1 個 N₂ 要消耗 <strong>${NITROGENASE.atp_per_N2} 個 ATP</strong>。<br>
               目前人類還無法工業化複製它，但它證明了<strong>常溫常壓固氮在物理上是可能的</strong>——
               這正是仿生化學存在的理由（原則 #6 + #9 + #12）。`);
    }
  }

  function equilibriumYield(T, P) {
    // 教學用近似：轉化率隨壓力上升、隨溫度下降
    const K = Kc(T);
    const x = 1 - 1 / (1 + Math.pow(K * Math.pow(P / 100, 2), 0.12));
    return Math.max(0.5, Math.min(97, x * 100));
  }
  function fmtSci(v) {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return '0';
    if (v >= 0.01 && v < 1e4) return v.toPrecision(3);
    return v.toExponential(2).replace('e', '×10^');
  }

  /* ---------------- 動畫 ---------------- */
  let acc = 0, syncAcc = 0;
  world.add(glassBox(BOX.w, BOX.h, BOX.d, 0x1E9EB3));
  stage.start(({ dt }) => {
    if (mode === 'classic' || (mode === 'green' && C.values.gmod === 'fix')) {
      for (let i = 0; i < 3; i++) step(dt / 3 * 1.2);
      acc += dt; syncAcc += dt;
      if (acc > 0.12) { acc = 0; drawCharts(); update(); }
      if (syncAcc > 0.4) { syncAcc = 0; syncMolecules(); }
    }
    mols.forEach(m => {
      m.position.addScaledVector(m.userData.v, dt * 1.5);
      m.rotation.y += dt * m.userData.spin;
      ['x', 'y', 'z'].forEach((a, i) => {
        const lim = [BOX.w, BOX.h, BOX.d][i] / 2 - 0.35;
        if (Math.abs(m.position[a]) > lim) { m.position[a] = Math.sign(m.position[a]) * lim; m.userData.v[a] *= -1; }
      });
    });
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); rateCh.destroy(); concCh.destroy(); } };
}
