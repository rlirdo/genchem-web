/* ==========================================================================
   sim/ch04.js — Ch4 水溶液反應與溶液計量
   模組 A（3D）：NaCl 晶體被水偶極包圍、水合、逐顆離子剝離（時間軸可倒轉）
   模組 B（3D）：選陽離子＋陰離子滴入，觀察是否生成沉澱，並列出淨離子方程式
   綠色情境：重金屬廢水處理——調 pH 與加藥量，看殘留濃度與放流水標準比較

   化學說明：
   沉澱判定用反應商 Q 與溶解度積 Ksp 比較：Q > Ksp → 沉澱。
   氫氧化物沉澱法的殘留濃度 [M²⁺] = Ksp / [OH⁻]²；
   兩性金屬（Pb、Zn）在高 pH 會再溶解成 M(OH)₃⁻ 而使殘留回升（U 型曲線）。
   ========================================================================== */

import { createStage, THREE, atom, bond, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { KSP, EFFLUENT_TW, ATOMIC_MASS } from '../../data/constants.js';

/* 離子的顯示樣式 */
const ION = {
  'Na+':  { c: 0xA97BE0, r: 0.30, z: +1, zh: 'Na⁺' },
  'K+':   { c: 0x9B6BD6, r: 0.34, z: +1, zh: 'K⁺' },
  'Ag+':  { c: 0xCFD8DC, r: 0.34, z: +1, zh: 'Ag⁺' },
  'Ba2+': { c: 0x6FC6A8, r: 0.38, z: +2, zh: 'Ba²⁺' },
  'Pb2+': { c: 0x8E9BA6, r: 0.38, z: +2, zh: 'Pb²⁺' },
  'Cu2+': { c: 0xE08A4C, r: 0.34, z: +2, zh: 'Cu²⁺' },
  'Cl-':  { c: 0x5FD08A, r: 0.42, z: -1, zh: 'Cl⁻' },
  'Br-':  { c: 0xB5651D, r: 0.44, z: -1, zh: 'Br⁻' },
  'I-':   { c: 0x8B5FBF, r: 0.48, z: -1, zh: 'I⁻' },
  'NO3-': { c: 0x4C7DE0, r: 0.40, z: -1, zh: 'NO₃⁻' },
  'SO42-':{ c: 0xFFC93C, r: 0.44, z: -2, zh: 'SO₄²⁻' },
  'S2-':  { c: 0xD4A017, r: 0.46, z: -2, zh: 'S²⁻' },
  'CO32-':{ c: 0x7FB3A0, r: 0.42, z: -2, zh: 'CO₃²⁻' },
};

/* 常見組合的溶解度規則（教學用簡表）*/
const PAIR = {
  'Ag+|Cl-':   { ksp: KSP.AgCl,  zh: 'AgCl',   solid: true },
  'Ag+|Br-':   { ksp: KSP.AgBr,  zh: 'AgBr',   solid: true },
  'Ag+|I-':    { ksp: KSP.AgI,   zh: 'AgI',    solid: true },
  'Ba2+|SO42-':{ ksp: KSP.BaSO4, zh: 'BaSO₄',  solid: true },
  'Pb2+|Cl-':  { ksp: KSP.PbCl2, zh: 'PbCl₂',  solid: true, n: 2 },
  'Pb2+|SO42-':{ ksp: KSP.PbSO4, zh: 'PbSO₄',  solid: true },
  'Pb2+|S2-':  { ksp: KSP.PbS,   zh: 'PbS',    solid: true },
  'Cu2+|S2-':  { ksp: KSP.CuS,   zh: 'CuS',    solid: true },
  'Ba2+|CO32-':{ ksp: { v: 2.6e-9, approx: true, zh: 'BaCO₃' }, zh: 'BaCO₃', solid: true },
};

/* 兩性金屬在高 pH 的再溶解係數（教學用參數，用來重現 U 型溶解度曲線）*/
const AMPHO = { 'Pb2+': 1e-4, 'Cu2+': 0, 'Cd2+': 0 };
const HYDROX = {
  'Pb2+': { ksp: KSP['Pb(OH)2'].v, M: ATOMIC_MASS.Pb, std: EFFLUENT_TW.Pb, zh: '鉛 Pb²⁺' },
  'Cu2+': { ksp: KSP['Cu(OH)2'].v, M: ATOMIC_MASS.Cu, std: EFFLUENT_TW.Cu, zh: '銅 Cu²⁺' },
  'Cd2+': { ksp: KSP['Cd(OH)2'].v, M: ATOMIC_MASS.Cd, std: EFFLUENT_TW.Cd, zh: '鎘 Cd²⁺' },
};
const SULFIDE = {
  'Pb2+': KSP.PbS.v, 'Cu2+': KSP.CuS.v, 'Cd2+': 1e-27,
};

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 2.4, 9], fov: 45, minDistance: 4, maxDistance: 24,
    ariaLabel: '水溶液中的離子與沉澱 3D 模擬',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------- 建立水分子（V 形，鍵角 104.5°）---------- */
  function water() {
    const g = new THREE.Group();
    const O = atom(0.20, 0xFF6B5B, 12);
    const H1 = atom(0.11, 0xF2F6F4, 10), H2 = atom(0.11, 0xF2F6F4, 10);
    const a = 104.5 / 2 * Math.PI / 180, L = 0.33;
    H1.position.set(Math.sin(a) * L, -Math.cos(a) * L, 0);
    H2.position.set(-Math.sin(a) * L, -Math.cos(a) * L, 0);
    g.add(O, H1, H2,
      bond(O.position, H1.position, 0.04, 0xE0E8E4),
      bond(O.position, H2.position, 0.04, 0xE0E8E4));
    return g;
  }

  /* ---------- 模組 A：NaCl 溶解 ---------- */
  let crystal = null;
  function buildDissolve() {
    crystal = new THREE.Group();
    const n = 4, a = 0.62;
    const ions = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const isNa = (i + j + k) % 2 === 0;
      const t = isNa ? ION['Na+'] : ION['Cl-'];
      const m = atom(t.r, t.c, 14, { roughness: .3, metalness: .1 });
      const home = new THREE.Vector3((i - 1.5) * a, (j - 1.5) * a, (k - 1.5) * a);
      m.position.copy(home);
      m.userData = {
        home, isNa,
        // 越靠近角落越先被剝離（角落離子配位數最少，最容易溶解）
        order: 1 - (Math.abs(i - 1.5) + Math.abs(j - 1.5) + Math.abs(k - 1.5)) / 4.5,
        dir: new THREE.Vector3(i - 1.5, j - 1.5, k - 1.5).normalize()
          .add(new THREE.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .6, (Math.random() - .5) * .6)),
      };
      crystal.add(m); ions.push(m);
    }
    world.add(crystal);

    // 周圍的水分子
    const waters = new THREE.Group();
    const NW = stage.quality === 'low' ? 30 : 60;
    for (let i = 0; i < NW; i++) {
      const w = water();
      const r = 2.9 + Math.random() * 2.4, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      w.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
      w.userData.spin = Math.random() * 0.8 + 0.2;
      w.userData.orbit = Math.random() * 0.4 + 0.1;
      waters.add(w);
    }
    world.add(waters);
    world.userData.waters = waters;
    world.userData.ions = ions;
    world.add(glassBox(9, 7, 9, 0x1E9EB3));
  }

  /* ---------- 模組 B / 綠色：沉澱 ---------- */
  let precipGroup = null;
  function buildPrecip() {
    precipGroup = new THREE.Group();
    world.add(precipGroup);
    world.add(glassBox(9, 7, 9, 0x1E9EB3));
  }

  function refreshPrecip() {
    if (!precipGroup) return;
    for (let i = precipGroup.children.length - 1; i >= 0; i--) {
      const o = precipGroup.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      precipGroup.remove(o);
    }
    const info = currentPair();
    const N = 26;
    const cat = mode === 'green' ? C.values.metal : C.values.cation;
    const an = mode === 'green' ? (C.values.agent === 'oh' ? 'OH-' : 'S2-') : C.values.anion;
    const catT = ION[cat] || { c: 0x8E9BA6, r: 0.36 };
    const anT = ION[an] || { c: 0x5FD08A, r: 0.34 };

    if (info.solid) {
      // 生成晶格狀沉澱堆在底部
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 5; k++) {
        const isCat = (i + j + k) % 2 === 0;
        const t = isCat ? catT : anT;
        const m = atom(t.r * 0.9, t.c, 12, { roughness: .35 });
        m.position.set((i - 2) * 0.62, (j - 1) * 0.62 - 2.4, (k - 2) * 0.62);
        g.add(m);
      }
      precipGroup.add(g);
      const t = textSprite(`${info.zh} 沉澱`, { scale: 0.0085 });
      t.position.set(0, -0.7, 0); precipGroup.add(t);
      // 剩下少量仍溶在水中的離子
      for (let i = 0; i < 8; i++) addFreeIon(precipGroup, i % 2 ? catT : anT, 2.4);
    } else {
      for (let i = 0; i < N; i++) addFreeIon(precipGroup, i % 2 ? catT : anT, 3.0);
      const t = textSprite('沒有沉澱：離子仍自由分散在水中', { scale: 0.0075 });
      t.position.set(0, 2.6, 0); precipGroup.add(t);
    }
  }
  function addFreeIon(parent, t, R) {
    const m = atom(t.r, t.c, 12, { roughness: .3 });
    m.position.set((Math.random() - .5) * R * 2, (Math.random() - .3) * R, (Math.random() - .5) * R * 2);
    m.userData.free = new THREE.Vector3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(0.35);
    parent.add(m);
  }

  function currentPair() {
    if (mode === 'green') {
      const m = C.values.metal, ag = C.values.agent;
      return { solid: true, zh: ag === 'oh' ? `${m.replace('2+', '')}(OH)₂` : `${m.replace('2+', '')}S` };
    }
    const key = `${C.values.cation}|${C.values.anion}`;
    const p = PAIR[key];
    if (p) return { ...p, ksp: p.ksp.v ?? p.ksp, approx: p.ksp.approx };
    return { solid: false, zh: '（可溶）' };
  }

  /* ---------- 下方圖表 ---------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-sub-title>淨離子方程式</div>
    <div id="ionic" style="font-size:var(--fs-sm);line-height:1.9"></div>
    <canvas id="phc" aria-label="殘留濃度對 pH 曲線" style="margin-top:.4rem"></canvas>`;
  const ionicEl = ctx.subEl.querySelector('#ionic');
  const phChart = new Chart2D(ctx.subEl.querySelector('#phc'), {
    height: 190, pad: { l: 62, r: 14, t: 14, b: 34 },
    xLabel: 'pH', yLabel: '殘留濃度 (mg/L)',
  });
  phChart.onResize = drawPh;

  /** 氫氧化物／硫化物沉澱後的殘留金屬濃度（mg/L）*/
  function residual(metal, agent, pH, dose) {
    const H = HYDROX[metal];
    let molar;
    if (agent === 'oh') {
      const OH = Math.pow(10, pH - 14);
      molar = H.ksp / (OH * OH) + (AMPHO[metal] || 0) * OH;    // 第二項為兩性再溶解
    } else {
      // 硫化物：以加藥量代表過量 S²⁻ 濃度（教學用簡化，忽略 S²⁻ 的質子化平衡）
      const S = Math.max(1e-9, dose * 1e-5);
      molar = SULFIDE[metal] / S;
    }
    return molar * H.M * 1000;                                  // M → mg/L
  }

  function drawPh() {
    if (mode !== 'green') { phChart.cv.style.display = 'none'; return; }
    phChart.cv.style.display = '';
    const metal = C.values.metal, agent = C.values.agent, dose = C.values.dose;
    const H = HYDROX[metal];
    const pts = [];
    for (let pH = 5; pH <= 13.5; pH += 0.1) {
      const v = residual(metal, agent, pH, dose);
      pts.push([pH, Math.log10(Math.max(1e-8, v))]);
    }
    phChart.yLabel = 'log₁₀ 殘留濃度 (mg/L)';
    phChart.clear().setRange(5, 13.5, -8, 4)
      .axes({ xTicks: [5, 7, 9, 11, 13], yTicks: 6, yFmt: v => '10^' + v.toFixed(0) });
    phChart.line(pts, { color: agent === 'oh' ? PALETTE.ocean : PALETTE.leaf, width: 3 });
    phChart.hline(Math.log10(H.std), { color: PALETTE.coralDeep, label: `放流水標準 ${H.std} mg/L` });
    phChart.vline(C.values.pH, { color: PALETTE.sun, label: `目前 pH ${C.values.pH.toFixed(1)}` });
    if (AMPHO[metal] && agent === 'oh') {
      phChart.label(12.6, 2.6, '↑ 兩性金屬在高 pH 再溶解', { color: PALETTE.coralDeep, align: 'right' });
    }
  }

  function renderIonic() {
    if (mode === 'green') {
      const m = C.values.metal.replace('2+', '');
      ionicEl.innerHTML = C.values.agent === 'oh'
        ? `<code>${m}²⁺(aq) + 2 OH⁻(aq) → ${m}(OH)₂(s)↓</code>
           <br><span style="color:var(--ink-3)">加鹼（石灰、NaOH）提高 pH，OH⁻ 濃度上升 → Q 超過 Ksp → 沉澱析出。</span>`
        : `<code>${m}²⁺(aq) + S²⁻(aq) → ${m}S(s)↓</code>
           <br><span style="color:var(--ink-3)">金屬硫化物的 Ksp 極小（10⁻²⁷ 量級），殘留濃度可壓得更低，
           但硫化物藥劑本身有毒、遇酸會放出 H₂S。</span>`;
      return;
    }
    if (C.values.module === 'dissolve') {
      ionicEl.innerHTML = `
        <code>NaCl(s) → Na⁺(aq) + Cl⁻(aq)</code>
        <br><span style="color:var(--ink-3)">水分子以偶極的負端（O）朝向 Na⁺、正端（H）朝向 Cl⁻，
        把離子從晶格上一顆一顆拉下來，這個過程叫<b>水合</b>。角落的離子配位數最少，最先被剝離。</span>`;
      return;
    }
    const info = currentPair();
    const cat = ION[C.values.cation], an = ION[C.values.anion];
    ionicEl.innerHTML = info.solid
      ? `<code>${cat.zh}(aq) + ${Math.abs(cat.z / an.z) !== 1 ? Math.abs(cat.z / an.z) + ' ' : ''}${an.zh}(aq) → ${info.zh}(s)↓</code>
         <br><span style="color:var(--ink-3)">Ksp(${info.zh}) = ${info.ksp.toExponential(1)}${info.approx ? '（概略值）' : ''}
         ——這就是<b>淨離子方程式</b>：把兩邊都沒變的旁觀離子刪掉之後剩下的部分。</span>`
      : `<code>沒有反應（NR）</code>
         <br><span style="color:var(--ink-3)">${cat.zh} 與 ${an.zh} 形成的鹽類可溶，
         溶液中只剩下互相獨立的水合離子——所有離子都是<b>旁觀離子</b>。</span>`;
  }

  /* ---------- 綠色指標 ---------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'rm', name: '重金屬去除率', unit: '%', min: 0, max: 100, digits: 3,
      better: 'high', good: 99, bad: 80, note: '相對於進流濃度的去除比例（原則 #1）' },
    { key: 'tox', name: '藥劑毒性等級', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '所用沉澱劑本身的危害程度（原則 #3）' },
    { key: 'sludge', name: '污泥產量', unit: 'kg/m³', min: 0, max: 6, digits: 2,
      better: 'low', good: 1, bad: 3.5, note: '加藥越多污泥越多，後續要當事業廢棄物處理（原則 #1）' },
  ]);

  /* ---------- 面板 ---------- */
  function buildForScenario() {
    if (mode === 'classic') {
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'module', label: '模組', value: 'dissolve', options: [
          { v: 'dissolve', label: 'A · NaCl 溶解', title: '看水分子如何把離子從晶格拉下來' },
          { v: 'precip', label: 'B · 沉澱反應', title: '自己選離子，看會不會生成沉澱' },
        ] },
        { type: 'range', key: 'time', label: '時間軸（可倒轉）', min: 0, max: 100, step: 1, value: 0, unit: '%',
          hint: '拉到右邊 = 溶解；拉回左邊 = 讓離子回到晶格（重結晶）。' },
        { type: 'seg', key: 'cation', label: '陽離子（模組 B）', value: 'Ag+', options: [
          { v: 'Ag+', label: 'Ag⁺' }, { v: 'Ba2+', label: 'Ba²⁺' },
          { v: 'Pb2+', label: 'Pb²⁺' }, { v: 'Na+', label: 'Na⁺' },
        ] },
        { type: 'seg', key: 'anion', label: '陰離子（模組 B）', value: 'Cl-', options: [
          { v: 'Cl-', label: 'Cl⁻' }, { v: 'SO42-', label: 'SO₄²⁻' },
          { v: 'S2-', label: 'S²⁻' }, { v: 'NO3-', label: 'NO₃⁻' },
        ] },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'state', label: '結果', unit: '', digits: 0, wide: true },
        { key: 'ksp', label: 'Ksp', unit: '', digits: 0 },
        { key: 'sol', label: '莫耳溶解度', unit: 'M', digits: 0 },
        { key: 'free', label: '已離開晶格', unit: '%', digits: 0 },
        { key: 'hyd', label: '水合離子數', unit: '顆', digits: 0 },
      ]);
      ctx.setStageTitle('模組 A：NaCl 晶體的溶解與水合');
    } else {
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'metal', label: '待處理重金屬', value: 'Pb2+', options: [
          { v: 'Pb2+', label: '鉛 Pb²⁺', title: '兩性金屬，高 pH 會再溶解' },
          { v: 'Cu2+', label: '銅 Cu²⁺' }, { v: 'Cd2+', label: '鎘 Cd²⁺', title: '放流水標準最嚴：0.03 mg/L' },
        ] },
        { type: 'seg', key: 'agent', label: '沉澱劑', value: 'oh', options: [
          { v: 'oh', label: '氫氧化物法', title: '加石灰或 NaOH 提高 pH' },
          { v: 's', label: '硫化物法', title: 'Ksp 更小，殘留更低，但藥劑有毒' },
        ] },
        { type: 'range', key: 'pH', label: '調整 pH', min: 5, max: 13.5, step: 0.1, value: 8.0, unit: '' },
        { type: 'range', key: 'dose', label: '加藥量', min: 0.2, max: 5, step: 0.1, value: 1.0, unit: '× 理論量' },
        { type: 'range', key: 'c0', label: '進流重金屬濃度', min: 1, max: 200, step: 1, value: 50, unit: 'mg/L' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'res', label: '放流殘留濃度', unit: 'mg/L', digits: 0, wide: true },
        { key: 'std', label: '放流水標準', unit: 'mg/L', digits: 2 },
        { key: 'pass', label: '是否合格', unit: '', digits: 0 },
        { key: 'rm', label: '去除率', unit: '%', digits: 4 },
        { key: 'sludge', label: '污泥產量', unit: 'kg/m³', digits: 2 },
      ]);
      ctx.setStageTitle('綠色情境：重金屬廢水的沉澱處理');
    }
    clearWorld();
    if (mode === 'classic' && C.values.module === 'dissolve') buildDissolve();
    else { buildPrecip(); refreshPrecip(); }
    renderIonic(); drawPh(); update();
  }

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    crystal = null; precipGroup = null; world.userData = {};
  }

  function onChange(key) {
    if (key === 'module') { buildForScenario(); return; }
    if (key === 'cation' || key === 'anion' || key === 'metal' || key === 'agent') { refreshPrecip(); }
    renderIonic(); drawPh(); update();
  }

  /* ---------- 數值 ---------- */
  function update() {
    if (mode === 'classic') {
      if (C.values.module === 'dissolve') {
        const t = C.values.time / 100;
        const ions = world.userData.ions || [];
        const freed = ions.filter(m => m.userData.order >= 1 - t).length;
        readout({
          state: t === 0 ? '完整晶體' : t >= 1 ? '完全溶解' : '溶解中',
          ksp: '（NaCl 為可溶鹽）', sol: '6.15（飽和，25 °C）',
          free: freed / Math.max(1, ions.length) * 100, hyd: freed,
        });
        ctx.setOverlay(`<b>NaCl(s) → Na⁺(aq) + Cl⁻(aq)</b><br>
          時間軸 ${C.values.time}%｜已水合 ${freed} 顆離子<br>把滑桿拉回去可以看到重結晶`);
      } else {
        const info = currentPair();
        readout({
          state: info.solid ? `生成 ${info.zh} 沉澱` : '無沉澱（可溶）',
          ksp: info.solid ? info.ksp.toExponential(1) + (info.approx ? ' ≈' : '') : '—',
          sol: info.solid ? Math.sqrt(info.ksp).toExponential(1) : '易溶',
          free: info.solid ? 4 : 100, hyd: info.solid ? 8 : 26,
        });
        ctx.setOverlay(`<b>${ION[C.values.cation].zh} + ${ION[C.values.anion].zh}</b><br>
          ${info.solid ? `Q > Ksp → 生成 ${info.zh} 沉澱` : '所有離子都是旁觀離子，沒有淨反應'}`);
      }
      gauge({ rm: 0, tox: 0.2, sludge: 0 },
        `水是<strong>最安全的溶劑</strong>——無毒、不可燃、不揮發、可回收。
         綠色化學原則 #5 明確鼓勵以水系反應取代有機溶劑，這一整章的反應全部在水裡進行。
         切到綠色情境，看看同樣的沉澱原理怎麼用來處理重金屬廢水。`);

    } else {
      const metal = C.values.metal, agent = C.values.agent;
      const H = HYDROX[metal];
      const res = residual(metal, agent, C.values.pH, C.values.dose);
      const c0 = C.values.c0;
      const rm = Math.max(0, Math.min(100, (1 - res / c0) * 100));
      // 污泥：金屬氫氧化物 + 過量加藥產生的鹽（教學用簡化估算）
      const sludge = (c0 / 1000) * 2.2 + (C.values.dose - 1) * 0.8 + (agent === 'oh' ? (C.values.pH - 7) * 0.18 : 0.1);
      const pass = res <= H.std;
      readout({
        res: res < 0.001 ? res.toExponential(2) : res.toFixed(res < 1 ? 4 : 2),
        std: H.std, pass: pass ? '✅ 合格' : '❌ 超標',
        rm, sludge: Math.max(0.05, sludge),
      });
      ctx.setOverlay(`<b>${H.zh}｜${agent === 'oh' ? '氫氧化物法' : '硫化物法'}</b><br>
        pH ${C.values.pH.toFixed(1)}｜殘留 ${res < 0.001 ? res.toExponential(2) : res.toFixed(4)} mg/L<br>
        ${pass ? '✅ 低於放流水標準' : '❌ 超過放流水標準 ' + H.std + ' mg/L'}`);

      gauge({ rm, tox: agent === 'oh' ? 1.2 : 4.0, sludge: Math.max(0.05, sludge) },
        agent === 'oh'
          ? (metal === 'Pb2+' && C.values.pH > 11
            ? `⚠ 注意曲線右邊翹起來了！鉛是<strong>兩性金屬</strong>，pH 過高時會生成可溶的 Pb(OH)₃⁻ 而<strong>重新溶解</strong>。
               「加越多鹼越乾淨」是錯的——加藥最佳化本身就是綠色化學（原則 #1：少加藥＝少污泥）。`
            : `氫氧化物法用的是石灰或 NaOH，藥劑毒性低（原則 #3），而且反應在水中進行（原則 #5）。
               試著找出殘留濃度最低的 pH，那就是這個金屬的<strong>最適操作點</strong>。`)
          : `硫化物的 Ksp 小到 10⁻²⁷ 量級，殘留濃度可以壓得比氫氧化物法低好幾個數量級。
             但代價是：硫化物藥劑本身有毒、遇酸放出劇毒的 H₂S，違反原則 #3 與 #12。
             <strong>更乾淨的水，換來更危險的藥品</strong>——這種取捨在環工現場天天發生。`);
    }
  }

  /* ---------- 動畫 ---------- */
  stage.start(({ dt, t }) => {
    if (mode === 'classic' && C.values.module === 'dissolve' && world.userData.ions) {
      const prog = C.values.time / 100;
      world.userData.ions.forEach(m => {
        const u = m.userData;
        const out = u.order >= 1 - prog;
        const target = out
          ? u.home.clone().add(u.dir.clone().multiplyScalar(2.4 + Math.sin(t * 0.8 + u.order * 9) * 0.5))
          : u.home;
        m.position.lerp(target, dt * 2.4);
      });
      const w = world.userData.waters;
      if (w) w.children.forEach((x, i) => {
        x.rotation.y += dt * x.userData.spin;
        x.rotation.x += dt * x.userData.spin * 0.4;
        x.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * x.userData.orbit * 0.3);
      });
    }
    if (precipGroup) {
      precipGroup.children.forEach(o => {
        if (!o.userData.free) return;
        o.position.addScaledVector(o.userData.free, dt);
        ['x', 'y', 'z'].forEach(ax => {
          if (Math.abs(o.position[ax]) > 3) o.userData.free[ax] *= -1;
        });
      });
    }
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); phChart.destroy(); } };
}
