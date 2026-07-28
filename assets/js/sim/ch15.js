/* ==========================================================================
   sim/ch15.js — Ch15 酸鹼平衡與緩衝溶液
   模組 A（3D）：緩衝對像「離子海綿」把加進來的質子接住，pH 只微幅變動
   模組 B（2D）：即時繪製滴定曲線，標出緩衝區間、半當量點（pH = pKa）與當量點
                 可切換「無緩衝的純水」對照，看到 pH 崩落式暴衝
   綠色情境：血液 HCO₃⁻/H₂CO₃ 緩衝、海洋碳酸鹽緩衝容量的極限、
             土壤緩衝力與花蓮農地酸化、廢水中和的加藥最佳化

   化學說明：
     緩衝區 pH = pKa + log([A⁻]/[HA])（Henderson–Hasselbalch）
     半當量點：[A⁻] = [HA] → pH = pKa
     當量點（弱酸配強鹼）：pH = 7 + ½pKa + ½log C_鹽
     緩衝容量 β ≈ 2.303 · C_total · (Ka[H⁺]) / (Ka + [H⁺])²
   ========================================================================== */

import { createStage, THREE, atom, bond, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { ACIDS, KW, BLOOD_BUFFER, SOIL_BUFFER, OCEAN_CO2 } from '../../data/constants.js';

/* 可選的緩衝對 */
const PAIRS = {
  acetate: { zh: '醋酸／醋酸根 CH₃COOH / CH₃COO⁻', Ka: ACIDS.CH3COOH.Ka },
  carbonate: { zh: '碳酸／碳酸氫根 H₂CO₃ / HCO₃⁻', Ka: ACIDS.H2CO3.Ka },
  phosphate: { zh: '磷酸二氫根／磷酸氫根 H₂PO₄⁻ / HPO₄²⁻', Ka: 6.2e-8 },
  ammonium: { zh: '銨／氨 NH₄⁺ / NH₃', Ka: ACIDS.NH4.Ka },
};

/* 綠色情境的天然緩衝系統 */
const NATURAL = {
  blood: { zh: '人體血液（HCO₃⁻/H₂CO₃）', pKa: BLOOD_BUFFER.pKa1_body, Ct: 0.027,
    lo: BLOOD_BUFFER.pH_lo, hi: BLOOD_BUFFER.pH_hi, unit: 'mol/L',
    note: '體溫 37 °C 下的表觀 pKa 為 6.1，[HCO₃⁻]/[H₂CO₃] ≈ 20:1' },
  ocean: { zh: '海洋碳酸鹽系統', pKa: 6.0, Ct: 0.0023, lo: 7.9, hi: 8.3, unit: 'mol/L',
    note: '海水總鹼度約 2.3 mmol/L，是地球最大的緩衝庫，但容量有限' },
  soil: { zh: '土壤（有機質＋碳酸鹽）', pKa: 6.3, Ct: 0.05, lo: SOIL_BUFFER.ideal_lo, hi: SOIL_BUFFER.ideal_hi,
    unit: 'mol/kg', note: '緩衝力隨有機質與黏粒含量而異；砂質土最脆弱' },
  waste: { zh: '工業廢水中和槽', pKa: 6.3, Ct: 0.01, lo: 6.0, hi: 9.0, unit: 'mol/L',
    note: '放流水標準一般要求 pH 6.0–9.0' },
};

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.4, 9], fov: 45, minDistance: 4, maxDistance: 22,
    ariaLabel: '緩衝溶液與滴定的 3D 模擬',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);
  let particles = [], drops = [], beakerColor = null;

  /* ---------------- 3D ---------------- */
  const BK = { w: 5.2, h: 4.0, d: 2.6 };

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    particles = []; drops = [];
  }

  function makeHA() {
    const g = new THREE.Group();
    const A = atom(0.24, 0xFF7A59, 12), H = atom(0.13, 0xFFC93C, 10);
    H.position.set(0.32, 0.08, 0);
    g.add(A, H, bond(A.position, H.position, 0.04, 0xE8CFC6));
    g.userData.kind = 'HA';
    return g;
  }
  function makeA() {
    const g = new THREE.Group();
    g.add(atom(0.24, 0x3FA34D, 12));
    g.userData.kind = 'A';
    return g;
  }

  function buildBeaker() {
    clearWorld();
    world.add(glassBox(BK.w, BK.h, BK.d, 0x1E9EB3));
    const label = mode === 'green'
      ? (NATURAL[C.values.system]?.zh || '天然緩衝系統')
      : (C.values.pure ? '純水（無緩衝）對照' : PAIRS[C.values.pair].zh.split(' ')[0]);
    const t = textSprite(label, { scale: 0.007 });
    t.position.set(0, BK.h / 2 + 0.45, 0); world.add(t);
    // 滴定管
    const burette = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 2.2, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xCFE3D4, transparent: true, opacity: .35, roughness: .1 })
    );
    burette.position.set(0, BK.h / 2 + 1.6, 0); world.add(burette);

    const N = 34;
    for (let i = 0; i < N; i++) {
      const m = i < N / 2 ? makeHA() : makeA();
      m.position.set((Math.random() - .5) * (BK.w - .8), (Math.random() - .5) * (BK.h - .8), (Math.random() - .5) * (BK.d - .6));
      m.userData.v = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.8);
      world.add(m); particles.push(m);
    }
  }

  /** 依目前的 [HA]/[A⁻] 比例更新畫面上的分子種類 */
  function syncSpecies() {
    if (mode !== 'classic') return;
    const st = titrate(C.values.V);
    const frac = st.fHA;                       // HA 佔的比例
    const want = Math.round(particles.length * frac);
    let have = particles.filter(p => p.userData.kind === 'HA').length;
    particles.forEach(p => {
      if (have > want && p.userData.kind === 'HA') { toA(p); have--; }
      else if (have < want && p.userData.kind === 'A') { toHA(p); have++; }
    });
  }
  function toA(p) {
    p.userData.kind = 'A';
    p.children.forEach((c, i) => { if (i > 0) c.visible = false; });
    p.children[0].material.color.setHex(0x3FA34D);
  }
  function toHA(p) {
    p.userData.kind = 'HA';
    p.children.forEach(c => { c.visible = true; });
    p.children[0].material.color.setHex(0xFF7A59);
  }

  /* ---------------- 滴定計算 ---------------- */
  /** 傳回加入 Vb mL 滴定劑後的 pH 與物種分布 */
  function titrate(Vb) {
    const Ca = C.values.Ca, Va = C.values.Va, Cb = C.values.Cb;
    const Ka = C.values.pure ? null : PAIRS[C.values.pair].Ka;
    const na = Ca * Va / 1000;                 // mol 弱酸
    const nb = Cb * Vb / 1000;                 // mol 強鹼
    const Vtot = (Va + Vb) / 1000;             // L

    if (C.values.pure) {
      // 純水（僅含極少量自解離）＋強鹼
      if (nb <= 0) return { pH: 7, fHA: 0.5, region: '純水' };
      const OH = nb / Vtot;
      return { pH: 14 + Math.log10(OH), fHA: 0, region: '純水（無緩衝）' };
    }

    if (nb <= 0) {                              // 起點：純弱酸
      const Cm = na / Vtot;
      const H = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * Cm)) / 2;
      return { pH: -Math.log10(H), fHA: 1, region: '起點（純弱酸）' };
    }
    if (nb < na - 1e-12) {                      // 緩衝區
      const ratio = nb / (na - nb);
      return { pH: -Math.log10(Ka) + Math.log10(ratio), fHA: (na - nb) / na, region: '緩衝區' };
    }
    if (Math.abs(nb - na) < 1e-12) {            // 當量點
      const Csalt = na / Vtot;
      const pKa = -Math.log10(Ka);
      return { pH: 7 + pKa / 2 + Math.log10(Csalt) / 2, fHA: 0, region: '當量點' };
    }
    const OH = (nb - na) / Vtot;                // 過量強鹼
    return { pH: 14 + Math.log10(OH), fHA: 0, region: '過量鹼' };
  }

  /** 緩衝容量 β（mol/L per pH） */
  function beta(pH) {
    if (C.values.pure) return 0;
    const Ka = PAIRS[C.values.pair].Ka;
    const H = Math.pow(10, -pH);
    const Ct = C.values.Ca;
    return 2.303 * Ct * (Ka * H) / Math.pow(Ka + H, 2);
  }

  /* ---------------- 圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t>📈 滴定曲線</div>
    <canvas id="tit" aria-label="滴定曲線"></canvas>`;
  const tit = new Chart2D(ctx.subEl.querySelector('#tit'), {
    height: 210, pad: { l: 52, r: 14, t: 14, b: 34 },
    xLabel: '加入強鹼體積 (mL)', yLabel: 'pH',
  });
  tit.onResize = drawChart;

  function drawChart() {
    if (mode === 'green') { drawNatural(); return; }
    const Vmax = Math.max(10, C.values.Ca * C.values.Va / C.values.Cb * 2);
    const pts = [], purePts = [];
    const savePure = C.values.pure;
    for (let v = 0; v <= Vmax; v += Vmax / 300) {
      C.values.pure = false; pts.push([v, titrate(v).pH]);
      C.values.pure = true; purePts.push([v, titrate(v).pH]);
    }
    C.values.pure = savePure;

    tit.xLabel = '加入強鹼體積 (mL)'; tit.yLabel = 'pH';
    tit.clear().setRange(0, Vmax, 0, 14).axes({ xTicks: 4, yTicks: 7 });

    const Ka = PAIRS[C.values.pair].Ka, pKa = -Math.log10(Ka);
    const Veq = C.values.Ca * C.values.Va / C.values.Cb;
    // 緩衝區底色（pKa ± 1）
    tit.line([[Veq * 0.09, pKa + 1], [Veq * 0.91, pKa + 1]], { color: 'rgba(63,163,77,.35)', width: 1.5, dash: [3, 3] });
    tit.line([[Veq * 0.09, pKa - 1], [Veq * 0.91, pKa - 1]], { color: 'rgba(63,163,77,.35)', width: 1.5, dash: [3, 3] });
    tit.label(Veq * 0.5, pKa + 1.35, '緩衝區（pKa ± 1）', { color: PALETTE.leafDeep });

    if (C.values.showPure) tit.line(purePts, { color: '#C3D2CB', width: 2, dash: [5, 4] });
    tit.line(pts, { color: PALETTE.leafDeep, width: 3 });

    tit.vline(Veq / 2, { color: PALETTE.ocean, label: `半當量點：pH = pKa = ${pKa.toFixed(2)}` });
    tit.dot(Veq / 2, pKa, { color: PALETTE.ocean, r: 5, stroke: '#fff' });
    tit.vline(Veq, { color: PALETTE.coralDeep, label: '當量點' });
    const eq = (() => { const s = C.values.pure; C.values.pure = false; const r = titrate(Veq); C.values.pure = s; return r; })();
    tit.dot(Veq, eq.pH, { color: PALETTE.coralDeep, r: 5, stroke: '#fff' });

    const cur = titrate(C.values.V);
    tit.dot(C.values.V, cur.pH, { color: PALETTE.sun, r: 7, stroke: '#fff' });
    if (C.values.showPure) {
      tit.legend([{ label: '緩衝溶液', color: PALETTE.leafDeep }, { label: '純水對照', color: '#C3D2CB' }],
        { x: 70, y: 26 });
    }
  }

  function drawNatural() {
    const S = sysNow();
    const pct = C.values.loadPct;
    const cap = safeCapacity(S);
    const pts = [], bare = [];
    for (let p = 0; p <= 150; p += 1) {
      const x = p / 100 * cap;
      pts.push([p, naturalPH(S, x)]);
      bare.push([p, x > 0 ? -Math.log10(x) : 7]);
    }
    tit.xLabel = '累積酸負荷（占「安全酸容量」%）'; tit.yLabel = 'pH';
    tit.clear().setRange(0, 150, Math.min(2.5, S.lo - 2), Math.max(9.5, S.hi + 1))
      .axes({ xTicks: 5, yTicks: 6 });
    tit.hline(S.lo, { color: PALETTE.sun, dash: [4, 4], label: `安全下限 pH ${S.lo}` });
    tit.hline(S.hi, { color: PALETTE.sun, dash: [4, 4], label: `安全上限 pH ${S.hi}` });
    tit.line(bare, { color: '#C3D2CB', width: 2, dash: [5, 4] });
    tit.line(pts, { color: PALETTE.ocean, width: 3 });
    tit.vline(100, { color: PALETTE.coralDeep, dash: [3, 3], label: '安全容量用盡' });
    tit.dot(pct, naturalPH(S, pct / 100 * cap), { color: PALETTE.coralDeep, r: 7, stroke: '#fff' });
    tit.legend([{ label: '有緩衝', color: PALETTE.ocean }, { label: '完全無緩衝', color: '#C3D2CB' }],
      { x: 74, y: 24 });
  }

  /** 目前選定的天然系統（含使用者調整的緩衝總量倍率）*/
  function sysNow() {
    const S = NATURAL[C.values.system];
    return { ...S, Ct: S.Ct * (C.values.Ct ?? 1) };
  }

  /** 系統起始的 [A⁻] 與 [HA]（依 pKa 與目標 pH 分配總量）*/
  function initSpecies(S) {
    const pH0 = (S.lo + S.hi) / 2;
    const r0 = Math.pow(10, pH0 - S.pKa);
    const A = S.Ct * r0 / (1 + r0);
    return { A, HA: S.Ct - A };
  }
  /** 「安全酸容量」：把 pH 從起始值壓到安全下限所需的酸量（mol/L）
      這比「總緩衝量」更有意義——它回答「這個系統還能撐多少酸」。 */
  function safeCapacity(S) {
    const { A, HA } = initSpecies(S);
    const R = Math.pow(10, S.lo - S.pKa);
    return Math.max(1e-9, (A - R * HA) / (1 + R));
  }

  /** 天然緩衝系統加入酸負荷後的 pH（以 Henderson–Hasselbalch 推算）*/
  function naturalPH(S, load) {
    let { A, HA } = initSpecies(S);
    A -= load; HA += load;                       // 加入的 H⁺ 把 A⁻ 轉成 HA
    if (A <= 1e-9) {
      // 緩衝耗盡：剩下的酸直接放在水裡
      const excess = -A;
      return Math.max(1, -Math.log10(Math.max(excess, 1e-7)));
    }
    return S.pKa + Math.log10(A / HA);
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'beta', name: '緩衝容量 β', unit: 'mol/L per pH', min: 0, max: 0.06, digits: 4,
      better: 'high', good: 0.02, bad: 0.004, note: '每改變 1 個 pH 單位需要多少酸鹼（越大越穩）' },
    { key: 'dose', name: '中和藥劑用量', unit: '相對值', min: 0, max: 100, digits: 0,
      better: 'low', good: 30, bad: 75, note: '達標所需的加藥量（原則 #1：少加藥＝少污泥）' },
    { key: 'sludge', name: '中和污泥產量', unit: 'kg/m³', min: 0, max: 5, digits: 2,
      better: 'low', good: 0.8, bad: 3, note: '加藥後生成的沉澱污泥，須當事業廢棄物處理' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A／B：緩衝溶液的「離子海綿」與滴定曲線');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'pair', label: '緩衝對', value: 'acetate', options: [
          { v: 'acetate', label: '醋酸鹽', title: 'pKa 4.74，最常見的教學緩衝對' },
          { v: 'carbonate', label: '碳酸鹽', title: 'pKa₁ 6.37，血液與海洋的緩衝系統' },
          { v: 'phosphate', label: '磷酸鹽', title: 'pKa₂ 7.21，細胞內與生化實驗常用' },
          { v: 'ammonium', label: '銨鹽', title: 'pKa 9.25，鹼性側的緩衝' },
        ] },
        { type: 'range', key: 'V', label: '加入強鹼體積（逐滴加入）', min: 0, max: 60, step: 0.2, value: 0, unit: 'mL',
          hint: '慢慢往右拉，注意 pH 在緩衝區幾乎不動，過了當量點才暴衝。' },
        { type: 'range', key: 'Ca', label: '弱酸濃度', min: 0.01, max: 0.5, step: 0.01, value: 0.1, unit: 'M' },
        { type: 'range', key: 'Va', label: '待測液體積', min: 10, max: 50, step: 1, value: 25, unit: 'mL' },
        { type: 'range', key: 'Cb', label: '滴定劑（NaOH）濃度', min: 0.05, max: 0.5, step: 0.01, value: 0.1, unit: 'M' },
        { type: 'check', key: 'showPure', label: '疊上「無緩衝純水」對照曲線', value: true },
        { type: 'check', key: 'pure', label: '把燒杯換成純水（看 pH 崩落）', value: false },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'pH', label: 'pH 計讀數', unit: '', digits: 2, wide: true },
        { key: 'region', label: '目前位於', unit: '', digits: 0, wide: true },
        { key: 'pKa', label: 'pKa', unit: '', digits: 2 },
        { key: 'ratio', label: '[A⁻] / [HA]', unit: '', digits: 2 },
        { key: 'Veq', label: '當量點體積', unit: 'mL', digits: 2 },
        { key: 'beta', label: '緩衝容量 β', unit: 'mol/L·pH⁻¹', digits: 4 },
        { key: 'dpH', label: '每加 1 mL 的 pH 變化', unit: '', digits: 3, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：天然緩衝系統與加藥最佳化');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'system', label: '緩衝系統', value: 'blood', options: [
          { v: 'blood', label: '人體血液', title: 'HCO₃⁻/H₂CO₃，pH 必須維持 7.35–7.45' },
          { v: 'ocean', label: '海洋', title: '碳酸鹽系統，地球最大的緩衝庫' },
          { v: 'soil', label: '土壤', title: '有機質與碳酸鹽提供緩衝，砂質土最脆弱' },
          { v: 'waste', label: '廢水中和槽', title: '放流水標準 pH 6.0–9.0' },
        ] },
        { type: 'range', key: 'loadPct', label: '累積酸負荷（占該系統緩衝總量）', min: 0, max: 150, step: 1, value: 20, unit: '%',
          hint: '模擬酸雨、代謝產酸、施肥或工業廢酸持續進入系統。超過 100% 代表緩衝已被耗盡。' },
        { type: 'range', key: 'Ct', label: '緩衝物質總量倍率', min: 0.2, max: 3, step: 0.1, value: 1, unit: '×',
          hint: '土壤有機質流失、海洋鹼度下降，都會讓這個倍率變小。' },
        { type: 'range', key: 'dose', label: '中和藥劑加藥量', min: 0, max: 3, step: 0.05, value: 1, unit: '× 理論量',
          hint: '加藥過量不但浪費，還會把 pH 推過頭並增加污泥。' },
        { type: 'range', key: 'Ca', label: '（沿用）緩衝濃度', min: 0.01, max: 0.5, step: 0.01, value: 0.1, unit: 'M' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'sys', label: '系統', unit: '', digits: 0, wide: true },
        { key: 'pH', label: '目前 pH', unit: '', digits: 3 },
        { key: 'safe', label: '是否在安全範圍', unit: '', digits: 0 },
        { key: 'bare', label: '若完全無緩衝的 pH', unit: '', digits: 2 },
        { key: 'cap', label: '剩餘安全容量', unit: '%', digits: 1 },
        { key: 'capAbs', label: '該系統可吸收的酸總量', unit: 'mmol/L', digits: 3 },
        { key: 'dose', label: '中和藥劑用量', unit: '相對值', digits: 0 },
        { key: 'sludge', label: '中和污泥產量', unit: 'kg/m³', digits: 2, wide: true },
      ]);
    }
    buildBeaker(); drawChart(); update();
  }

  function onChange(key) {
    if (key === 'pure' || key === 'pair') buildBeaker();
    drawChart(); update();
    if (key === 'V') syncSpecies();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    if (mode === 'classic') {
      const st = titrate(C.values.V);
      const Ka = PAIRS[C.values.pair].Ka, pKa = -Math.log10(Ka);
      const Veq = C.values.Ca * C.values.Va / C.values.Cb;
      const next = titrate(C.values.V + 1);
      const ratio = st.fHA > 0 && st.fHA < 1 ? (1 - st.fHA) / st.fHA : (st.fHA >= 1 ? 0 : Infinity);
      readout({
        pH: st.pH, region: st.region, pKa,
        ratio: Number.isFinite(ratio) ? ratio : '→ ∞',
        Veq, beta: beta(st.pH), dpH: next.pH - st.pH,
      });
      ctx.setOverlay(
        `<b>${C.values.pure ? '純水（無緩衝）' : PAIRS[C.values.pair].zh}</b><br>
         已加入 ${C.values.V.toFixed(1)} mL NaOH｜pH = <strong>${st.pH.toFixed(2)}</strong><br>
         ${st.region}｜每再加 1 mL，pH 變化 ${(next.pH - st.pH).toFixed(3)}`);
      gauge({ beta: beta(st.pH), dose: 0, sludge: 0 },
        C.values.pure
          ? `⚠ 這是<strong>沒有緩衝</strong>的對照組：第一滴鹼下去，pH 就直接從 7 跳到 11 以上。
             把這個核取方塊取消，換回緩衝溶液再拉一次滑桿，差別會非常明顯。`
          : (st.region === '緩衝區'
            ? `🧽 現在正在<strong>緩衝區</strong>：加進來的 OH⁻ 被 HA 接住（HA + OH⁻ → A⁻ + H₂O），
               所以 pH 幾乎不動——每加 1 mL 只變 ${Math.abs(next.pH - st.pH).toFixed(3)}。
               3D 畫面裡橘色 HA 正一顆顆轉成綠色 A⁻，這就是「離子海綿」在吸收。<br>
               緩衝容量在 <strong>pH = pKa</strong>（半當量點）時最大，此時 [A⁻] = [HA]。`
            : st.region === '當量點'
              ? `📍 <strong>當量點</strong>：酸剛好被中和完。注意 pH 不是 7 而是 ${st.pH.toFixed(2)}——
                 因為此時溶液中是<span data-term="共軛鹼">共軛鹼</span> A⁻，它會水解使溶液呈鹼性。
                 弱酸配強鹼的當量點一定在鹼性側。`
              : st.region === '過量鹼'
                ? `緩衝已耗盡，多加的 NaOH 直接留在溶液中，pH 由過量的 OH⁻ 決定——
                   曲線在這裡幾乎和「純水對照」重疊了。`
                : `起點是純弱酸。開始往右拉滑桿，看 pH 什麼時候開始「不動」。`));

    } else {
      const S2 = sysNow();
      const S = NATURAL[C.values.system];
      const Ct = S2.Ct;
      const cap = safeCapacity(S2);
      const load = C.values.loadPct / 100 * cap;
      const pH = naturalPH(S2, load);
      const bare = load > 0 ? -Math.log10(load) : 7;
      // 剩餘安全容量（%）
      const capPct = Math.max(0, Math.min(100, (1 - C.values.loadPct / 100) * 100));
      const doseRel = Math.min(100, C.values.dose * 33);
      const sludge = Math.max(0.05, C.values.dose * 0.9 + Math.max(0, C.values.dose - 1) * 1.2);

      readout({
        sys: S.zh, pH, safe: (pH >= S.lo && pH <= S.hi) ? '✅ 在安全範圍' : '❌ 已超出範圍',
        bare, cap: capPct, capAbs: cap * 1000, dose: doseRel, sludge,
      });
      ctx.setOverlay(
        `<b>${S.zh}</b><br>酸負荷 ${C.values.loadPct}%（${(load * 1000).toFixed(2)} mmol/L）
         → pH <strong>${pH.toFixed(3)}</strong><br>
         若完全沒有緩衝，pH 會是 ${bare.toFixed(2)}`);
      gauge({ beta: 2.303 * Ct * 0.25, dose: doseRel, sludge },
        C.values.system === 'blood'
          ? `🩸 血液必須維持在 <strong>${BLOOD_BUFFER.pH_lo}–${BLOOD_BUFFER.pH_hi}</strong>，
             掉到 7.0 以下或升到 7.8 以上都會危及生命。它靠的是
             HCO₃⁻/H₂CO₃ 緩衝對（表觀 pKa 6.1，比例約 20:1），
             而且是一個<strong>開放系統</strong>——肺可以呼掉 CO₂、腎可以排掉 H⁺，
             等於隨時在補充緩衝劑。這是化學課本裡的緩衝方程式最重要的應用。`
          : C.values.system === 'ocean'
            ? `🌊 海洋是地球最大的緩衝庫，但看那條灰色虛線與藍線的差距——
               緩衝<strong>不是免費也不是無限</strong>。把「緩衝物質總量倍率」往左拉（模擬鹼度下降），
               你會看到同樣的酸負荷造成更大的 pH 跌幅。
               這就是 Ch13、Ch14 談的海洋酸化在化學上的本質：
               <strong>緩衝容量正在被消耗。</strong>`
            : C.values.system === 'soil'
              ? `🌱 土壤的緩衝力來自有機質與碳酸鹽。多數作物適宜 pH ${SOIL_BUFFER.ideal_lo}–${SOIL_BUFFER.ideal_hi}；
                 長期施用生理酸性肥料（如硫酸銨）會持續消耗緩衝容量，導致農地酸化。
                 對策是補充有機質與適量石灰資材——注意面板上的「中和藥劑加藥量」，
                 <strong>過量施用石灰會把 pH 推過頭，反而造成微量元素（Fe、Mn、Zn）不足。</strong>`
              : `🏭 廢水中和的目標不是「pH = 7」，而是<strong>落在放流水標準 6.0–9.0 之內</strong>。
                 把加藥量從 1.0 拉到 3.0 倍，看污泥產量怎麼上升——
                 過量加藥不但浪費藥劑，還製造更多必須當事業廢棄物處理的污泥。
                 <strong>加藥最佳化本身就是綠色化學（原則 #1）</strong>：
                 少加一點藥，就少一點污泥、少一點處理費、少一點環境負荷。`);
    }
  }

  /* ---------------- 動畫 ---------------- */
  let dropTimer = 0, lastV = 0;
  stage.start(({ dt }) => {
    // 加鹼時掉一滴
    if (mode === 'classic' && C.values.V > lastV) {
      lastV = C.values.V;
      dropTimer -= dt;
      if (dropTimer <= 0) {
        dropTimer = 0.25;
        const d = atom(0.13, 0x4C7DE0, 8, { emissive: 0x4C7DE0, emissiveIntensity: .5 });
        d.position.set((Math.random() - .5) * .2, BK.h / 2 + 1.2, 0);
        world.add(d); drops.push(d);
      }
      syncSpecies();
    } else if (mode === 'classic' && C.values.V < lastV) { lastV = C.values.V; syncSpecies(); }

    for (let i = drops.length - 1; i >= 0; i--) {
      drops[i].position.y -= dt * 5;
      if (drops[i].position.y < -BK.h / 2 + .3) {
        world.remove(drops[i]); drops[i].geometry.dispose(); drops.splice(i, 1);
      }
    }
    particles.forEach(m => {
      m.position.addScaledVector(m.userData.v, dt * 1.2);
      m.rotation.y += dt * 0.7;
      ['x', 'y', 'z'].forEach((a, i) => {
        const lim = [BK.w, BK.h, BK.d][i] / 2 - 0.4;
        if (Math.abs(m.position[a]) > lim) { m.position[a] = Math.sign(m.position[a]) * lim; m.userData.v[a] *= -1; }
      });
    });
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); tit.destroy(); } };
}
