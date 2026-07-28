/* ==========================================================================
   sim/ch14.js — Ch14 酸與鹼
   模組 A（3D）：兩個並排燒杯（弱酸 vs 強酸），看質子轉移給水形成 H₃O⁺
   模組 B（2D）：解離度、pH 與濃度的關係（奧士華稀釋定律）
   綠色情境：酸雨（SO₂／NOₓ）與海洋酸化；天然指示劑取代合成指示劑

   化學說明：
     弱酸 HA ⇌ H⁺ + A⁻，Ka = [H⁺][A⁻]/[HA]
     解精確二次式：x² + Ka·x − Ka·C = 0 → [H⁺] = (−Ka + √(Ka² + 4KaC)) / 2
     解離度 α = [H⁺]/C；奧士華稀釋定律指出稀釋時 α 反而增加。
   ========================================================================== */

import { createStage, THREE, atom, bond, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { ACIDS, KW, RAIN, NATURAL_INDICATORS, OCEAN_CO2 } from '../../data/constants.js';

/* 天然指示劑的顏色帶（pH → RGB）*/
const INDICATOR = {
  redCabbage: { zh: '紫甘藍（花青素）', stops: [
    [1, '#D6244C'], [3, '#E4557E'], [5, '#C86FA8'], [7, '#8E5FB5'],
    [9, '#4A6FD6'], [10.5, '#2FA88C'], [12, '#C2D63A'], [14, '#E8E24A']] },
  roselle: { zh: '洛神花（花青素）', stops: [
    [1, '#E01E3C'], [3, '#D6395E'], [5, '#C05A86'], [7, '#8E4E8E'],
    [9, '#5C7A6B'], [11, '#97A62F'], [14, '#C9C24A']] },
  turmeric: { zh: '薑黃素', stops: [
    [1, '#F2C230'], [7, '#F2C230'], [8, '#E8A83C'], [9.5, '#C4622A'], [14, '#A83E1E']] },
};
function indicatorColor(key, pH) {
  const s = INDICATOR[key].stops;
  for (let i = 0; i < s.length - 1; i++) {
    if (pH >= s[i][0] && pH <= s[i + 1][0]) {
      const t = (pH - s[i][0]) / (s[i + 1][0] - s[i][0]);
      return mix(s[i][1], s[i + 1][1], t);
    }
  }
  return pH < s[0][0] ? s[0][1] : s[s.length - 1][1];
}
function mix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.2, 10], fov: 45, minDistance: 4, maxDistance: 22,
    ariaLabel: '弱酸與強酸解離程度的 3D 對照',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------------- 3D：兩個燒杯 ---------------- */
  let beakers = [];
  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    beakers = [];
  }

  function makeHA() {                      // 未解離的 HA 分子
    const g = new THREE.Group();
    const A = atom(0.26, 0xFF7A59, 12), H = atom(0.14, 0xF2F6F4, 10);
    H.position.set(0.34, 0.1, 0);
    g.add(A, H, bond(A.position, H.position, 0.045, 0xE8CFC6));
    return g;
  }
  function makeH3O() {                     // 水合質子 H₃O⁺
    const g = new THREE.Group();
    const O = atom(0.22, 0x4C7DE0, 12);
    for (let i = 0; i < 3; i++) {
      const th = i / 3 * Math.PI * 2;
      const H = atom(0.12, 0xFFC93C, 10);
      H.position.set(Math.cos(th) * 0.36, Math.sin(th) * 0.36, 0.1);
      g.add(H, bond(O.position, H.position, 0.04, 0xE0E8F4));
    }
    g.add(O);
    return g;
  }
  function makeAnion() {                   // 共軛鹼 A⁻
    const g = new THREE.Group();
    g.add(atom(0.26, 0x3FA34D, 12));
    return g;
  }

  function buildBeakers() {
    clearWorld();
    const w = 3.4, h = 3.6, d = 2.2;
    const info = state();
    [{ x: -2.1, label: `弱酸 ${ACIDS[C.values.acid].zh}`, alpha: info.alphaW },
     { x: 2.1, label: `強酸 ${ACIDS.HCl.zh}`, alpha: 1 }].forEach((b, bi) => {
      const box = glassBox(w, h, d, bi ? 0xFF7A59 : 0x1E9EB3);
      box.position.set(b.x, 0, 0);
      world.add(box);
      const t = textSprite(b.label, { scale: 0.0072 });
      t.position.set(b.x, h / 2 + 0.4, 0); world.add(t);

      const N = 22;
      const nIon = Math.round(N * b.alpha);
      const group = new THREE.Group();
      for (let i = 0; i < N; i++) {
        let m;
        if (i < nIon) { m = i % 2 === 0 ? makeH3O() : makeAnion(); }
        else m = makeHA();
        m.position.set(b.x + (Math.random() - .5) * (w - .8),
          (Math.random() - .5) * (h - .8), (Math.random() - .5) * (d - .6));
        m.userData = {
          v: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.9),
          bx: b.x, w, h, d,
        };
        group.add(m);
      }
      world.add(group);
      beakers.push(group);
    });
  }

  /* ---------------- 綠色情境：雨滴與指示劑 ---------------- */
  function buildRain() {
    clearWorld();
    const pH = rainPH();
    const col = new THREE.Color(indicatorColor(C.values.ind, pH));
    // 一大滴雨（用指示劑顏色呈現）
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: col, transparent: true, opacity: 0.72, roughness: 0.05,
        transmission: 0.5, thickness: 1.2,
      })
    );
    drop.position.set(-2.6, 0.2, 0);
    world.add(drop);
    world.add(place(`雨水 pH ${pH.toFixed(2)}`, -2.6, 2.1));

    // 溶入的污染物分子
    const N = Math.round(6 + C.values.so2 * 1.2 + C.values.nox * 0.8);
    for (let i = 0; i < Math.min(40, N); i++) {
      const isS = i % 2 === 0 && C.values.so2 > 0;
      const m = atom(0.16, isS ? 0xFFC93C : 0x4C7DE0, 10, { emissiveIntensity: .3 });
      m.position.set(-2.6 + (Math.random() - .5) * 2.2, 0.2 + (Math.random() - .5) * 2.2, (Math.random() - .5) * 2.2);
      m.userData = { v: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.5), orbit: drop.position };
      world.add(m);
    }

    // 海洋方塊（顯示 pH 與碳酸鈣殼體）
    const oceanPH = OCEAN_CO2.pH_preindustrial +
      (OCEAN_CO2.pH_now - OCEAN_CO2.pH_preindustrial) *
      (Math.log10(C.values.co2) - Math.log10(OCEAN_CO2.co2_ppm_1750)) /
      (Math.log10(OCEAN_CO2.co2_ppm_2023) - Math.log10(OCEAN_CO2.co2_ppm_1750));
    const sea = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.6, 2.2),
      new THREE.MeshPhysicalMaterial({
        color: 0x1E9EB3, transparent: true, opacity: 0.24, transmission: .6, roughness: .1,
      })
    );
    sea.position.set(2.4, -0.2, 0); world.add(sea);
    world.add(place(`海水 pH ${oceanPH.toFixed(2)}`, 2.4, 1.7));
    // 貝殼（碳酸鈣）——pH 越低越「被侵蝕」
    const erosion = Math.max(0, Math.min(1, (OCEAN_CO2.pH_preindustrial - oceanPH) / 0.5));
    const shell = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.42 * (1 - erosion * 0.55), 0.13, 60, 8),
      new THREE.MeshStandardMaterial({ color: 0xFFF3E0, roughness: .55 + erosion * .4 })
    );
    shell.position.set(2.4, -1.0, 0); shell.userData.spin = 1; world.add(shell);
    world.add(place(erosion > 0.35 ? '⚠ 碳酸鈣殼體被侵蝕' : '碳酸鈣殼體', 2.4, -1.75));
  }
  function place(text, x, y) { const s = textSprite(text, { scale: 0.0068 }); s.position.set(x, y, 0); return s; }

  /* ---------------- 圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t>
      📈 解離度與濃度的關係（奧士華稀釋定律）</div>
    <canvas id="ch" aria-label="解離度對濃度的關係圖"></canvas>
    <div id="strip" style="margin-top:.5rem"></div>`;
  const ch = new Chart2D(ctx.subEl.querySelector('#ch'), {
    height: 190, pad: { l: 56, r: 14, t: 14, b: 34 },
    xLabel: 'log₁₀ 濃度 (M)', yLabel: '解離度 α (%)',
  });
  ch.onResize = drawChart;
  const strip = ctx.subEl.querySelector('#strip');

  /** 弱酸精確解 */
  function weakH(Ka, Cm) {
    if (Cm <= 0) return 1e-7;
    const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * Cm)) / 2;
    return Math.max(x, 1e-7);
  }

  function state() {
    const a = ACIDS[C.values.acid];
    const Cm = C.values.conc;
    const hW = weakH(a.Ka, Cm);
    const alphaW = Math.min(1, hW / Cm);
    const hS = Cm;                       // 強酸視為完全解離
    return {
      a, Cm, hW, alphaW, hS,
      pHw: -Math.log10(hW), pHs: -Math.log10(Math.max(hS, 1e-7)),
      pKa: -Math.log10(a.Ka),
    };
  }

  function drawChart() {
    if (mode === 'green') { drawRainChart(); return; }
    const s = state();
    ch.xLabel = 'log₁₀ 濃度 (M)'; ch.yLabel = '解離度 α (%)';
    ch.clear().setRange(-6, 0.5, 0, 105).axes({ xTicks: 5, yTicks: 4, xFmt: v => '10^' + v.toFixed(0) });
    // 三種代表性弱酸的曲線
    [['CH3COOH', PALETTE.ocean], ['HCOOH', PALETTE.leafDeep], ['H2CO3', PALETTE.coralDeep]].forEach(([k, col]) => {
      const pts = [];
      for (let lg = -6; lg <= 0.5; lg += 0.05) {
        const Cm = Math.pow(10, lg);
        pts.push([lg, weakH(ACIDS[k].Ka, Cm) / Cm * 100]);
      }
      ch.line(pts, { color: col, width: k === C.values.acid ? 3 : 1.6, dash: k === C.values.acid ? null : [4, 4] });
    });
    ch.hline(100, { color: PALETTE.muted, dash: [3, 3], label: '強酸（HCl）永遠 100%' });
    ch.dot(Math.log10(s.Cm), s.alphaW * 100, { color: PALETTE.sun, r: 6, stroke: '#fff' });
    ch.legend([
      { label: '醋酸', color: PALETTE.ocean }, { label: '甲酸', color: PALETTE.leafDeep },
      { label: '碳酸', color: PALETTE.coralDeep },
    ], { x: 70, y: 24 });
    strip.innerHTML = '';
  }

  /** 雨水 pH：CO₂ 平衡 + SO₂（氧化為 H₂SO₄）+ NOₓ（氧化為 HNO₃）
      轉換係數為教學用尺度，用以重現 pH 4.5–5.6 的真實區間 */
  function rainPH() {
    const hCO2 = Math.pow(10, -RAIN.clean_pH) * Math.sqrt(C.values.co2 / OCEAN_CO2.co2_ppm_2023);
    const hSO2 = C.values.so2 * 2e-6;      // ppb → M（H₂SO₄ 為雙質子）
    const hNOx = C.values.nox * 3e-7;
    return -Math.log10(Math.max(1e-14, hCO2 + hSO2 + hNOx));
  }

  function drawRainChart() {
    ch.xLabel = 'SO₂ 濃度 (ppb)'; ch.yLabel = '雨水 pH';
    ch.clear().setRange(0, 30, 3.5, 6.2).axes({ xTicks: 5, yTicks: 5 });
    const pts = [];
    const so2Save = C.values.so2;
    for (let s = 0; s <= 30; s += 0.5) {
      C.values.so2 = s; pts.push([s, rainPH()]);
    }
    C.values.so2 = so2Save;
    ch.line(pts, { color: PALETTE.coralDeep, width: 3 });
    ch.hline(RAIN.clean_pH, { color: PALETTE.ocean, dash: [4, 4], label: `乾淨雨水 pH ${RAIN.clean_pH}（與大氣 CO₂ 平衡）` });
    ch.hline(RAIN.acid_rain_pH, { color: PALETTE.sun, dash: [4, 4], label: `酸雨定義 pH < ${RAIN.acid_rain_pH}` });
    ch.dot(C.values.so2, rainPH(), { color: PALETTE.sun, r: 6, stroke: '#fff' });

    // 指示劑色帶
    const key = C.values.ind;
    let html = `<div style="font-size:var(--fs-xs);color:var(--ink-3);margin-bottom:.2rem">
      🌿 ${INDICATOR[key].zh} 在各 pH 下的顏色（${NATURAL_INDICATORS[key]?.range || ''}）</div>
      <div style="display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--line)">`;
    for (let p = 1; p <= 14; p++) {
      const c = indicatorColor(key, p);
      const cur = Math.abs(p - rainPH()) < 0.5;
      html += `<div style="flex:1;height:34px;background:${c};display:flex;align-items:center;justify-content:center;
        font:700 10px var(--font-num);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);
        ${cur ? 'outline:3px solid #123B2E;outline-offset:-3px;' : ''}">${p}</div>`;
    }
    html += '</div>';
    strip.innerHTML = html;
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'acid', name: '雨水酸度偏離', unit: 'pH 單位', min: 0, max: 2.5, digits: 2,
      better: 'low', good: 0.3, bad: 1.2, note: '相對乾淨雨水 pH 5.6 的下降幅度' },
    { key: 'tox', name: '指示劑毒性', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1, bad: 3.5, note: '所用酸鹼指示劑的健康與環境危害（原則 #3）' },
    { key: 'shell', name: '碳酸鈣殼體風險', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '海水 pH 下降對造殼生物的壓力' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：弱酸 vs 強酸——同樣的濃度，差多少？');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'acid', label: '弱酸種類', value: 'CH3COOH', options: [
          { v: 'CH3COOH', label: '醋酸', title: 'Ka = 1.8×10⁻⁵，pKa 4.74' },
          { v: 'HCOOH', label: '甲酸', title: 'Ka = 1.8×10⁻⁴，pKa 3.74' },
          { v: 'HF', label: '氫氟酸', title: 'Ka = 7.2×10⁻⁴，pKa 3.14' },
          { v: 'H2CO3', label: '碳酸', title: 'Ka₁ = 4.3×10⁻⁷，pKa₁ 6.37' },
        ] },
        { type: 'range', key: 'conc', label: '濃度', min: 0.0001, max: 1, step: 0.0001, value: 0.1, unit: 'M',
          hint: '把濃度往左拉（稀釋），你會發現解離度 α 反而上升——這就是奧士華稀釋定律。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'Ka', label: 'Ka', unit: '', digits: 0 },
        { key: 'pKa', label: 'pKa', unit: '', digits: 2 },
        { key: 'alpha', label: '弱酸解離度 α', unit: '%', digits: 2 },
        { key: 'ratio', label: '未解離 : 已解離', unit: '', digits: 0 },
        { key: 'pHw', label: '弱酸 pH', unit: '', digits: 2 },
        { key: 'pHs', label: '同濃度強酸 pH', unit: '', digits: 2 },
        { key: 'dH', label: '[H⁺] 相差', unit: '倍', digits: 0, wide: true },
      ]);
      buildBeakers();
    } else {
      ctx.setStageTitle('綠色情境：酸雨、海洋酸化與天然指示劑');
      C = buildControls(ctx.hostControls, [
        { type: 'range', key: 'so2', label: '大氣 SO₂', min: 0, max: 30, step: 0.5, value: 2, unit: 'ppb',
          hint: '燃煤與工業排放的主要酸性前驅物，氧化後生成硫酸。' },
        { type: 'range', key: 'nox', label: '大氣 NOₓ', min: 0, max: 60, step: 1, value: 10, unit: 'ppb',
          hint: '交通與燃燒排放，氧化後生成硝酸。' },
        { type: 'range', key: 'co2', label: '大氣 CO₂', min: 250, max: 1000, step: 5, value: 419, unit: 'ppm' },
        { type: 'seg', key: 'ind', label: '天然指示劑', value: 'redCabbage', options: [
          { v: 'redCabbage', label: '紫甘藍', title: '花青素，變色範圍涵蓋 pH 2–12' },
          { v: 'roselle', label: '洛神花', title: '花青素，台灣（尤其台東花蓮）常見作物' },
          { v: 'turmeric', label: '薑黃', title: '薑黃素，pH 8–9 由黃轉紅棕' },
        ] },
        { type: 'check', key: 'synth', label: '改用合成指示劑（甲基橙／酚酞）', value: false,
          hint: '看看儀表板的「指示劑毒性」怎麼變。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'rain', label: '雨水 pH', unit: '', digits: 2 },
        { key: 'clean', label: '乾淨雨水 pH', unit: '', digits: 1 },
        { key: 'isAcid', label: '是否為酸雨', unit: '', digits: 0 },
        { key: 'ocean', label: '海水 pH', unit: '', digits: 3 },
        { key: 'hplus', label: '海水 [H⁺] 相對工業革命前', unit: '倍', digits: 2 },
        { key: 'color', label: '指示劑顏色', unit: '', digits: 0, wide: true },
      ]);
      buildRain();
    }
    drawChart(); update();
  }

  function onChange(key) {
    if (mode === 'classic') { if (key === 'acid' || key === 'conc') buildBeakers(); }
    else buildRain();
    drawChart(); update();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    if (mode === 'classic') {
      const s = state();
      const und = 1 - s.alphaW;
      readout({
        Ka: s.a.Ka.toExponential(1), pKa: s.pKa,
        alpha: s.alphaW * 100,
        ratio: s.alphaW > 0 ? `${(und / s.alphaW).toFixed(0)} : 1` : '—',
        pHw: s.pHw, pHs: s.pHs,
        dH: s.hS / s.hW,
      });
      ctx.setOverlay(
        `<b>${s.a.zh}　Ka = ${s.a.Ka.toExponential(1)}（pKa ${s.pKa.toFixed(2)}）</b><br>
         ${s.Cm.toFixed(4)} M 下解離度 <strong>${(s.alphaW * 100).toFixed(2)}%</strong><br>
         弱酸 pH ${s.pHw.toFixed(2)}　vs　強酸 pH ${s.pHs.toFixed(2)}<br>
         [H⁺] 差 <strong>${(s.hS / s.hW).toFixed(0)} 倍</strong>`);
      gauge({ acid: 0, tox: 0, shell: 0 },
        `左邊燒杯裡大部分還是<strong>完整的 HA 分子</strong>（橘＋白），只有少數變成 H₃O⁺（藍＋黃）與 A⁻（綠）；
         右邊的強酸則幾乎全部解離。<br>
         現在把濃度滑桿往左拉（稀釋）——注意 α 不但沒有下降，反而<strong>上升</strong>。
         這是<span data-term="解離度">奧士華稀釋定律</span>：稀釋等於降低了逆反應（H⁺ 與 A⁻ 重新結合）的機會，
         平衡因此往解離方向移（勒沙特列，見 Ch13）。切到綠色情境，看這個 pH 怎麼影響雨水與海洋。`);

    } else {
      const pH = rainPH();
      const oceanPH = OCEAN_CO2.pH_preindustrial +
        (OCEAN_CO2.pH_now - OCEAN_CO2.pH_preindustrial) *
        (Math.log10(C.values.co2) - Math.log10(OCEAN_CO2.co2_ppm_1750)) /
        (Math.log10(OCEAN_CO2.co2_ppm_2023) - Math.log10(OCEAN_CO2.co2_ppm_1750));
      const ratio = Math.pow(10, -oceanPH) / Math.pow(10, -OCEAN_CO2.pH_preindustrial);
      const col = indicatorColor(C.values.ind, pH);
      readout({
        rain: pH, clean: RAIN.clean_pH,
        isAcid: pH < RAIN.acid_rain_pH ? '⚠ 是酸雨' : '否',
        ocean: oceanPH, hplus: ratio,
        color: `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;
                 background:${col};vertical-align:-2px;margin-right:4px"></span>${INDICATOR[C.values.ind].zh}`,
      });
      ctx.setOverlay(
        `<b>雨水 pH ${pH.toFixed(2)}</b>（乾淨雨水 ${RAIN.clean_pH}）<br>
         SO₂ ${C.values.so2} ppb｜NOₓ ${C.values.nox} ppb<br>
         海水 pH ${oceanPH.toFixed(3)}（[H⁺] ${ratio.toFixed(2)} 倍）`);
      gauge({
        acid: Math.max(0, RAIN.clean_pH - pH),
        tox: C.values.synth ? 3.8 : 0.4,
        shell: Math.min(5, (ratio - 1) * 6),
      },
        C.values.synth
          ? `⚠ 甲基橙屬偶氮染料（部分偶氮化合物有致癌疑慮），酚酞曾被用作瀉藥後因致癌疑慮下架。
             這些合成指示劑用量雖小，但學校實驗每年累積的量並不小，而且最後多半直接倒進排水。<br>
             切回天然指示劑看看毒性指標的差別。`
          : `🌿 <strong>紫甘藍與洛神花的花青素</strong>是很好的天然指示劑：
             變色範圍涵蓋 pH 2–12、無毒、可食用、廢液可直接堆肥。
             這對應綠色化學<strong>原則 #3（低毒性合成）</strong>與<strong>原則 #4（更安全的化學品）</strong>。<br>
             ${pH < RAIN.acid_rain_pH
               ? `⚠ 目前雨水 pH ${pH.toFixed(2)}，已達酸雨定義（< ${RAIN.acid_rain_pH}）。
                  把 SO₂ 拉回 0 看看——這正是脫硫設備（FGD）與燃料脫硫在做的事。`
               : `目前雨水 pH ${pH.toFixed(2)}，尚未達酸雨標準。試著把 SO₂ 拉到 20 ppb 以上看看。`}`);
    }
  }

  /* ---------------- 動畫 ---------------- */
  stage.start(({ dt }) => {
    beakers.forEach(g => g.children.forEach(m => {
      const u = m.userData;
      m.position.addScaledVector(u.v, dt * 1.4);
      m.rotation.y += dt * 0.8;
      const lim = { x: [u.bx - u.w / 2 + .4, u.bx + u.w / 2 - .4], y: [-u.h / 2 + .4, u.h / 2 - .4], z: [-u.d / 2 + .3, u.d / 2 - .3] };
      ['x', 'y', 'z'].forEach(a => {
        if (m.position[a] < lim[a][0]) { m.position[a] = lim[a][0]; u.v[a] *= -1; }
        if (m.position[a] > lim[a][1]) { m.position[a] = lim[a][1]; u.v[a] *= -1; }
      });
    }));
    world.children.forEach(o => {
      if (o.userData.spin) o.rotation.y += dt * 0.5;
      if (o.userData.orbit) {
        o.position.addScaledVector(o.userData.v, dt);
        if (o.position.distanceTo(o.userData.orbit) > 1.4) {
          o.userData.v.multiplyScalar(-1);
        }
      }
    });
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); ch.destroy(); } };
}
