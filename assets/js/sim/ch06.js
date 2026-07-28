/* ==========================================================================
   sim/ch06.js — Ch6 熱化學
   模組 A（3D）：燃燒反應的鍵結重組。斷鍵時分子振動拉長、畫面轉冷；
                 成鍵時放熱、熱粒子向外輻射、畫面轉暖
   模組 B（2D）：反應座標能量圖 + 鍵能總和法的 ΔH 計算
   綠色情境：燃料的單位能量碳排比較（含製氫方式與生質短碳循環）

   化學說明：
     鍵能法 ΔH ≈ Σ(斷鍵所需能量) − Σ(成鍵放出能量)
     這是「近似法」，因為用的是各種分子的平均鍵能；
     精確值要用標準生成焓 ΔH°f 以赫斯定律計算。本頁兩種都算給學生比較。
   ========================================================================== */

import { createStage, THREE, atom, bond, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { BOND_E, HF298, HUALIEN_ENERGY } from '../../data/constants.js';

/* 燃料的鍵結清單（每莫耳燃料）與精確熱數據 */
const FUEL = {
  CH4: {
    zh: '甲烷 CH₄（天然氣）', M: 16.043, nC: 1, nH: 4, o2: 2,
    break: { 'C-H': 4, 'O=O': 2 }, form: { 'C=O': 2, 'O-H': 4 },
    dHf_exact: HF298['CO2(g)'] + 2 * HF298['H2O(g)'] - HF298['CH4(g)'],
    energyMJkg: 50.0, note: '以氣態水計算',
  },
  C2H5OH: {
    zh: '乙醇 C₂H₅OH（生質酒精）', M: 46.068, nC: 2, nH: 6, o2: 3,
    break: { 'C-H': 5, 'C-C': 1, 'C-O': 1, 'O-H': 1, 'O=O': 3 }, form: { 'C=O': 4, 'O-H': 6 },
    dHf_exact: 2 * HF298['CO2(g)'] + 3 * HF298['H2O(g)'] - HF298['C2H5OH(g)'],
    energyMJkg: 26.8, note: '以氣態乙醇與氣態水計算',
  },
  C8H18: {
    zh: '辛烷 C₈H₁₈（汽油代表）', M: 114.23, nC: 8, nH: 18, o2: 12.5,
    break: { 'C-H': 18, 'C-C': 7, 'O=O': 12.5 }, form: { 'C=O': 16, 'O-H': 18 },
    dHf_exact: 8 * HF298['CO2(g)'] + 9 * HF298['H2O(g)'] - (-208.4),
    energyMJkg: 44.4, note: 'ΔH°f(C₈H₁₈, g) 取 −208.4 kJ/mol',
  },
  H2: {
    zh: '氫氣 H₂', M: 2.016, nC: 0, nH: 2, o2: 0.5,
    break: { 'H-H': 1, 'O=O': 0.5 }, form: { 'O-H': 2 },
    dHf_exact: HF298['H2O(g)'],
    energyMJkg: 120.0, note: '低熱值 LHV；燃燒產物只有水',
  },
};

/* 製氫方式的碳足跡（kg CO₂ / kg H₂）——文獻常見區間之代表值 */
const H2_ROUTE = {
  grey: { zh: '灰氫（天然氣重組，無捕碳）', kg: 10, approx: true },
  blue: { zh: '藍氫（重組＋碳捕捉）', kg: 3, approx: true },
  green: { zh: '綠氫（再生電力電解）', kg: 0.5, approx: true },
};
/* 生質酒精的耕作、發酵與蒸餾碳排（g CO₂e / MJ 燃料）*/
const BIO_UPSTREAM = { low: 25, mid: 45, high: 70 };

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.6, 9], fov: 45, minDistance: 4, maxDistance: 22,
    ariaLabel: '燃燒反應的鍵結重組 3D 動畫',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------- 3D：燃料分子 + O₂ → CO₂ + H₂O ---------- */
  let parts = [];      // {mesh, from, to, kind}
  let heatPts = null, heatVel = [];

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    parts = []; heatPts = null; heatVel = [];
  }

  const EC = { C: 0x4A5B54, H: 0xF2F6F4, O: 0xFF6B5B };
  const ER = { C: 0.30, H: 0.19, O: 0.27 };

  function buildScene() {
    const f = FUEL[fuelKey()];
    const nC = Math.min(f.nC, 2), nH = Math.min(f.nH, 6);   // 畫面上最多畫 2 個碳，避免辛烷太擠
    const scaled = f.nC > 2;

    // 反應物側：燃料分子（左）與 O₂（右）
    const fuelG = new THREE.Group();
    if (nC > 0) {
      for (let i = 0; i < nC; i++) {
        const c = atom(ER.C, EC.C, 16); c.position.set(i * 0.9 - (nC - 1) * 0.45, 0, 0);
        c.userData.role = 'C'; fuelG.add(c);
      }
      for (let i = 0; i < nH; i++) {
        const ang = i / nH * Math.PI * 2;
        const h = atom(ER.H, EC.H, 12);
        h.position.set(Math.cos(ang) * 0.72 - 0.2, Math.sin(ang) * 0.6, Math.sin(ang * 1.7) * 0.4);
        h.userData.role = 'H'; h.userData.home = h.position.clone();
        fuelG.add(h);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const h = atom(ER.H * 1.2, EC.H, 12); h.position.set(i * 0.6 - 0.3, 0, 0);
        h.userData.role = 'H'; h.userData.home = h.position.clone(); fuelG.add(h);
      }
    }
    fuelG.position.set(-2.6, 0.2, 0);
    world.add(fuelG);
    const lf = textSprite(f.zh.split('（')[0] + (scaled ? '（示意）' : ''), { scale: 0.008 });
    lf.position.set(-2.6, 1.7, 0); world.add(lf);

    // O₂
    const oG = new THREE.Group();
    const nO2 = Math.min(3, Math.ceil(f.o2));
    for (let i = 0; i < nO2; i++) {
      const g = new THREE.Group();
      const a = atom(ER.O, EC.O, 14), b = atom(ER.O, EC.O, 14);
      a.position.set(-0.3, 0, 0); b.position.set(0.3, 0, 0);
      g.add(a, b, bond(a.position, b.position, 0.07, 0xE8B0A6));
      g.position.set((i - (nO2 - 1) / 2) * 1.0, (i % 2) * 0.7 - 0.35, 0);
      oG.add(g);
    }
    oG.position.set(2.6, 0.2, 0);
    world.add(oG);
    const lo = textSprite(`O₂ × ${f.o2}`, { scale: 0.008 });
    lo.position.set(2.6, 1.7, 0); world.add(lo);

    world.userData.fuelG = fuelG;
    world.userData.oG = oG;

    // 熱粒子（成鍵時向外輻射）
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
      heatVel.push(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5)
        .normalize().multiplyScalar(0.6 + Math.random() * 1.6));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    heatPts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xFFC93C, size: 0.12, transparent: true, opacity: 0,
    }));
    world.add(heatPts);
  }

  function fuelKey() { return C.values.fuel; }

  /* ---------- 下方能量圖 ---------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-c>
      📉 反應座標能量圖（鍵能總和法）</div>
    <canvas id="ec" aria-label="反應能量圖"></canvas>`;
  const ec = new Chart2D(ctx.subEl.querySelector('#ec'), {
    height: 200, pad: { l: 62, r: 14, t: 16, b: 34 },
    xLabel: '反應座標 →', yLabel: '相對焓 (kJ/mol)',
  });
  ec.onResize = drawEC;

  function bondSums(key) {
    const f = FUEL[key];
    const Eb = Object.entries(f.break).reduce((s, [k, n]) => s + BOND_E[k] * n, 0);
    const Ef = Object.entries(f.form).reduce((s, [k, n]) => s + BOND_E[k] * n, 0);
    return { Eb, Ef, dH: Eb - Ef, exact: f.dHf_exact };
  }

  function drawEC() {
    if (mode !== 'classic') { drawGreenChart(); return; }
    const key = fuelKey();
    const { Eb, Ef, dH } = bondSums(key);
    const top = Eb, bottom = dH;
    ec.xLabel = '反應座標 →'; ec.yLabel = '相對焓 (kJ/mol)';
    ec.clear().setRange(0, 1, Math.min(bottom * 1.25, -50), top * 1.15)
      .axes({ xTicks: [0, .5, 1], xFmt: v => ({ 0: '反應物', 0.5: '拆成原子', 1: '產物' })[v] ?? '', yTicks: 5 });
    // 三段折線：反應物 0 → 全部斷鍵 +Eb → 成鍵後 dH
    ec.line([[0, 0], [0.14, 0], [0.5, top], [0.86, bottom], [1, bottom]], { color: PALETTE.coralDeep, width: 3 });
    ec.hline(0, { color: '#B9CFC4', dash: [3, 3] });
    ec.label(0.5, top, `斷鍵吸熱 +${Eb.toFixed(0)}`, { color: PALETTE.ocean, bg: PALETTE.ocean, dy: 6 });
    ec.label(0.88, bottom, `成鍵放熱 −${Ef.toFixed(0)}`, { color: PALETTE.coralDeep, bg: PALETTE.coralDeep, dy: -14, align: 'right' });
    ec.label(0.5, bottom * 0.55, `ΔH ≈ ${dH.toFixed(0)} kJ/mol（放熱）`, { color: PALETTE.leafDeep });
    // 反應進度指示
    const prog = C.values.prog / 100;
    const x = 0.14 + prog * 0.72;
    const y = prog < 0.5 ? top * (prog / 0.5) : top + (bottom - top) * ((prog - 0.5) / 0.5);
    ec.dot(x, y, { color: PALETTE.sun, r: 6, stroke: '#fff' });
  }

  function drawGreenChart() {
    const items = Object.keys(FUEL).map(k => {
      const g = carbonIntensity(k);
      return { label: FUEL[k].zh.split('（')[0], value: g.net, color: k === fuelKey() ? PALETTE.leaf : '#CFE3D4' };
    });
    ec.xLabel = ''; ec.yLabel = 'g CO₂e / MJ';
    const mx = Math.max(20, ...items.map(i => Math.abs(i.value))) * 1.3;
    ec.clear().setRange(0, items.length, Math.min(0, -mx * 0.2), mx).axes({ xTicks: [], yTicks: 5 });
    ec.bars(items, { fmt: v => v.toFixed(1) });
    ec.hline(carbonIntensity('C8H18').net, { color: PALETTE.coralDeep, label: '汽油基準' });
  }

  /** 每 MJ 燃料的生命週期碳排（g CO₂e/MJ）*/
  function carbonIntensity(key) {
    const f = FUEL[key];
    const dHc = Math.abs(f.dHf_exact);                        // kJ/mol
    const burn = f.nC * 44.009 / dHc * 1000;                  // g CO₂ / MJ（燃燒本身）
    if (key === 'H2') {
      const r = H2_ROUTE[C && C.values.h2 ? C.values.h2 : 'grey'];
      return { burn: 0, up: r.kg * 1000 / f.energyMJkg, net: r.kg * 1000 / f.energyMJkg };
    }
    if (key === 'C2H5OH') {
      const bioFrac = C && C.values.bio !== undefined ? C.values.bio / 100 : 1;
      const up = BIO_UPSTREAM[C && C.values.crop ? C.values.crop : 'mid'];
      // 生質碳為短碳循環：燃燒排的 CO₂ 由作物生長時吸收回去
      return { burn, up, net: burn * (1 - bioFrac) + up };
    }
    return { burn, up: key === 'CH4' ? 8 : 15, net: burn + (key === 'CH4' ? 8 : 15) };
  }

  /* ---------- 綠色指標 ---------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'ci', name: '碳排強度', unit: 'g CO₂e/MJ', min: 0, max: 110, digits: 1,
      better: 'low', good: 30, bad: 75, note: '含上游製造與使用階段（原則 #6、#7）' },
    { key: 'dens', name: '質量能量密度', unit: 'MJ/kg', min: 0, max: 130, digits: 1,
      better: 'high', good: 60, bad: 25, note: '每公斤燃料能放出的能量' },
    { key: 'save', name: '相對汽油減碳', unit: '%', min: -60, max: 100, digits: 1,
      better: 'high', good: 40, bad: 0, note: '以汽油為基準的碳排改善幅度' },
  ]);

  /* ---------- 面板 ---------- */
  function buildForScenario() {
    const fuelOpts = Object.keys(FUEL).map(k => ({ v: k, label: FUEL[k].zh.split('（')[0], title: FUEL[k].zh }));
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：燃燒中的鍵結重組（斷鍵吸熱、成鍵放熱）');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'fuel', label: '燃料分子', value: 'CH4', options: fuelOpts },
        { type: 'range', key: 'prog', label: '反應進度', min: 0, max: 100, step: 1, value: 0, unit: '%',
          hint: '0–50%：斷鍵，畫面轉冷；50–100%：成鍵，熱粒子向外輻射、畫面轉暖。' },
        { type: 'range', key: 'mol', label: '燃料用量', min: 0.1, max: 10, step: 0.1, value: 1, unit: 'mol' },
        { type: 'check', key: 'showHeat', label: '顯示熱粒子輻射', value: true },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'Eb', label: '斷鍵吸熱 Σ', unit: 'kJ/mol', digits: 0 },
        { key: 'Ef', label: '成鍵放熱 Σ', unit: 'kJ/mol', digits: 0 },
        { key: 'dH', label: 'ΔH（鍵能法）', unit: 'kJ/mol', digits: 0 },
        { key: 'ex', label: 'ΔH（生成焓法）', unit: 'kJ/mol', digits: 1 },
        { key: 'err', label: '兩法差異', unit: '%', digits: 1 },
        { key: 'tot', label: '本次放熱總量', unit: 'kJ', digits: 0, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：同樣是燃燒，碳排差多少？');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'fuel', label: '燃料', value: 'CH4', options: fuelOpts },
        { type: 'seg', key: 'h2', label: '製氫方式（選 H₂ 時）', value: 'grey', options: [
          { v: 'grey', label: '灰氫', title: '天然氣重組，無碳捕捉，約 10 kg CO₂/kg H₂' },
          { v: 'blue', label: '藍氫', title: '重組＋碳捕捉，約 3 kg CO₂/kg H₂' },
          { v: 'green', label: '綠氫', title: '再生電力電解，約 0.5 kg CO₂/kg H₂' },
        ] },
        { type: 'range', key: 'bio', label: '生質來源比例（選乙醇時）', min: 0, max: 100, step: 5, value: 100, unit: '%',
          hint: '生質碳是短碳循環：作物生長時吸走的 CO₂ 抵掉燃燒排放。' },
        { type: 'seg', key: 'crop', label: '生質上游排放', value: 'mid', options: [
          { v: 'low', label: '低（農業廢棄物）', title: '稻稈、蔗渣等纖維素原料，約 25 g CO₂e/MJ' },
          { v: 'mid', label: '中（玉米／甘蔗）', title: '約 45 g CO₂e/MJ' },
          { v: 'high', label: '高（需開墾林地）', title: '約 70 g CO₂e/MJ' },
        ] },
        { type: 'range', key: 'mol', label: '年用量', min: 1, max: 500, step: 1, value: 100, unit: 'GJ' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'burn', label: '燃燒本身排放', unit: 'g CO₂/MJ', digits: 1 },
        { key: 'up', label: '上游排放', unit: 'g CO₂e/MJ', digits: 1 },
        { key: 'net', label: '生命週期碳排', unit: 'g CO₂e/MJ', digits: 1, wide: true },
        { key: 'dens', label: '質量能量密度', unit: 'MJ/kg', digits: 1 },
        { key: 'year', label: '年碳排', unit: '公噸 CO₂e', digits: 2 },
        { key: 'vsgas', label: '相對汽油', unit: '%', digits: 1 },
      ]);
    }
    clearWorld(); buildScene(); drawEC(); update();
  }

  function onChange(key) {
    if (key === 'fuel') { clearWorld(); buildScene(); }
    drawEC(); update();
  }

  /* ---------- 數值 ---------- */
  function update() {
    const key = fuelKey(), f = FUEL[key];
    const { Eb, Ef, dH, exact } = bondSums(key);
    if (mode === 'classic') {
      readout({
        Eb, Ef, dH, ex: exact,
        err: Math.abs((dH - exact) / exact * 100),
        tot: dH * C.values.mol,
      });
      const prog = C.values.prog;
      ctx.setOverlay(
        `<b>${f.zh}</b><br>` +
        (prog < 50
          ? `🔵 斷鍵階段：正在<strong>吸收</strong>能量（已投入 ${(Eb * prog / 50).toFixed(0)} kJ/mol）`
          : `🔴 成鍵階段：正在<strong>放出</strong>能量（已放出 ${(Ef * (prog - 50) / 50).toFixed(0)} kJ/mol）`) +
        `<br>ΔH（鍵能法）≈ ${dH.toFixed(0)}｜精確值 ${exact.toFixed(1)} kJ/mol`);
      const ci = carbonIntensity(key);
      gauge({ ci: ci.net, dens: f.energyMJkg, save: (1 - ci.net / carbonIntensity('C8H18').net) * 100 },
        `<strong>斷鍵一定吸熱、成鍵一定放熱。</strong>燃燒之所以放熱，是因為新形成的 C=O 與 O–H 鍵
         比原本的 C–H 與 O=O 鍵「更穩定」，多出來的能量就以熱的形式跑出來。
         注意兩種算法差了 <strong>${Math.abs((dH - exact) / exact * 100).toFixed(1)}%</strong>——
         鍵能法用的是<em>平均</em>鍵能，本來就是近似。切到綠色情境，看這些能量的碳代價。`);
    } else {
      const ci = carbonIntensity(key);
      const gasoline = carbonIntensity('C8H18').net;
      const year = C.values.mol * 1000 * ci.net / 1e6;      // GJ × g/MJ → 公噸
      const vs = (1 - ci.net / gasoline) * 100;
      readout({
        burn: ci.burn, up: ci.up, net: ci.net, dens: f.energyMJkg,
        year, vsgas: vs,
      });
      ctx.setOverlay(`<b>${f.zh}</b><br>生命週期碳排 <strong>${ci.net.toFixed(1)}</strong> g CO₂e/MJ<br>
        能量密度 ${f.energyMJkg} MJ/kg｜相對汽油 ${vs >= 0 ? '減' : '增'} ${Math.abs(vs).toFixed(1)}%`);
      gauge({ ci: ci.net, dens: f.energyMJkg, save: vs },
        key === 'H2'
          ? (C.values.h2 === 'grey'
            ? `⚠ 這是氫能最大的陷阱：<strong>燃燒端零碳排，不代表零碳排。</strong>
               灰氫由天然氣重組製得（約 10 kg CO₂/kg H₂），換算後碳排強度
               <strong>${ci.net.toFixed(1)} g CO₂e/MJ</strong>，比直接燒天然氣還糟。切到「綠氫」再看一次。`
            : `${H2_ROUTE[C.values.h2].zh}把碳排壓到 ${ci.net.toFixed(1)} g CO₂e/MJ。
               氫的能量密度 120 MJ/kg 是所有燃料裡最高的（原則 #7 可再生原料）——
               但體積能量密度極低，儲存與運輸才是真正的挑戰。`)
          : key === 'C2H5OH'
            ? `生質酒精的關鍵在<strong>短碳循環</strong>：燃燒排的 CO₂ 是作物幾個月前才從大氣吸走的。
               但上游的耕作、施肥、發酵、蒸餾都要排碳（目前設定 ${ci.up} g CO₂e/MJ）。
               把「生質上游排放」切到「低（農業廢棄物）」——用稻稈這類<strong>本來就要處理的廢棄物</strong>
               當原料，同時滿足原則 #7（可再生原料）與原則 #1（預防廢棄物）。`
            : `甲烷是碳氫比最好的化石燃料（每個碳配 4 個氫），因此單位能量碳排最低（約 ${ci.net.toFixed(1)} g CO₂e/MJ）。
               但它仍然是化石碳——燒掉就回不去了。而且甲烷本身的 GWP 是 29.8（見 Ch5），
               <strong>管線洩漏 1% 就足以抵消它相對燃煤的優勢</strong>。`);
    }
  }

  /* ---------- 動畫 ---------- */
  stage.start(({ dt, t }) => {
    if (mode !== 'classic' || !world.userData.fuelG) {
      world.rotation.y += dt * 0.12;
      return;
    }
    const prog = C.values.prog / 100;
    const fg = world.userData.fuelG, og = world.userData.oG;
    // 0–0.5：分子振動拉長（斷鍵）；0.5–1：原子重組成產物並靠攏
    const stretch = Math.min(1, prog / 0.5);
    fg.children.forEach((m, i) => {
      if (m.userData.role !== 'H' || !m.userData.home) return;
      const amp = 1 + stretch * 1.5 + Math.sin(t * 14 + i) * stretch * 0.18;
      m.position.copy(m.userData.home).multiplyScalar(amp);
    });
    // 冷 → 暖：用燈光顏色與粒子表現
    const warm = Math.max(0, (prog - 0.5) / 0.5);
    stage.scene.children.forEach(o => {
      if (o.isHemisphereLight) o.color.setHSL(warm > 0 ? 0.09 : 0.55, 0.35, warm > 0 ? 0.62 : 0.55);
    });
    fg.position.x = -2.6 + prog * 1.4;
    og.position.x = 2.6 - prog * 1.4;

    if (heatPts) {
      const show = C.values.showHeat && warm > 0;
      heatPts.material.opacity = show ? warm * 0.85 : 0;
      if (show) {
        const arr = heatPts.geometry.attributes.position.array;
        for (let i = 0; i < heatVel.length; i++) {
          arr[i * 3] += heatVel[i].x * dt * 2.4;
          arr[i * 3 + 1] += heatVel[i].y * dt * 2.4;
          arr[i * 3 + 2] += heatVel[i].z * dt * 2.4;
          const d = Math.hypot(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
          if (d > 6) { arr[i * 3] = 0; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = 0; }
        }
        heatPts.geometry.attributes.position.needsUpdate = true;
      }
    }
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); ec.destroy(); } };
}
