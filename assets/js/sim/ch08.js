/* ==========================================================================
   sim/ch08.js — Ch8 化學鍵基本概念
   模組 A（3D）：拖曳兩顆原子改變核間距，即時畫出勢能曲線（斥力區／平衡鍵長／解離能）
                 電子雲以顏色梯度呈現極化偏移，並顯示偶極矩向量與 Born–Haber 循環
   綠色情境：仿生黏著與可分解材料——酯鍵水解 vs C–C 主鏈；貽貝足絲蛋白 vs 含甲醛膠

   物理說明：
     勢能曲線採 Morse 位能 V(r) = De[(1 − e^{−a(r−re)})² − 1]
     re 與 De 使用實測值（CRC / NIST）；形狀參數 a 為教學用取值。
   ========================================================================== */

import { createStage, THREE, atom, textSprite, softDot } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { DIATOMIC, BORN_HABER_NACL, BORN_HABER_SUM, EN, POLYMERS } from '../../data/constants.js';

/* Morse 形狀參數 a（Å⁻¹）——教學用取值，使曲線寬度合理 */
const MORSE_A = { 'H-H': 1.94, 'H-Cl': 1.87, 'H-F': 2.22, 'Na-Cl': 1.05, 'Cl-Cl': 2.00 };
const ATOM_COLOR = { H: 0xF2F6F4, Cl: 0x5FD08A, F: 0x8FE04C, Na: 0xA97BE0 };
const ATOM_R = { H: 0.30, Cl: 0.50, F: 0.44, Na: 0.60 };
const Z_OF = { H: 1, Cl: 17, F: 9, Na: 11 };

/* 綠色情境的材料資料（半衰期為文獻常見區間之代表值，皆為概略值）*/
/* k 為 25 °C 基準的一階降解速率常數（/天）；實際速率再乘上溫度因子（Q₁₀ ≈ 2）。
   數值為文獻常見區間換算而得的教學用代表值，實際降解強烈依環境條件而異。 */
const MATERIAL = {
  PE:   { zh: '聚乙烯 PE', bond: 'C–C 主鏈（非極性、無可水解官能基）',
          hydro: 0, bio: 0, tox: 1.0, wet: 0, k: { sea: 0.00002, compost: 0.00004, landfill: 0.00001 } },
  PLA:  { zh: '聚乳酸 PLA', bond: '酯鍵 –COO–（可水解）',
          hydro: 1, bio: 100, tox: 0.6, wet: 0, k: { sea: 0.0002, compost: 0.0025, landfill: 0.00008 } },
  PHA:  { zh: '聚羥基烷酸酯 PHA', bond: '酯鍵 –COO–（可被酵素水解）',
          hydro: 1, bio: 100, tox: 0.4, wet: 0, k: { sea: 0.004, compost: 0.006, landfill: 0.0008 } },
  UF:   { zh: '尿素—甲醛膠 UF', bond: '亞甲基橋 –CH₂–（會釋出甲醛）',
          hydro: 0.3, bio: 0, tox: 4.5, wet: 15, k: { sea: 0.0005, compost: 0.001, landfill: 0.0002 } },
  DOPA: { zh: '貽貝仿生膠（兒茶酚 DOPA）', bond: '兒茶酚—金屬配位＋氫鍵（可逆）',
          hydro: 0.8, bio: 95, tox: 0.5, wet: 92, k: { sea: 0.002, compost: 0.004, landfill: 0.001 } },
};
/* 各環境的典型溫度（切換環境時自動帶入，使用者仍可再調整）*/
const ENV_TEMP = { sea: 20, compost: 58, landfill: 30 };

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.6, 8], fov: 44, minDistance: 3, maxDistance: 20,
    ariaLabel: '雙原子分子的核間距與電子雲極化 3D 模型',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------------- 傳統情境：兩顆原子 ---------------- */
  let atomA = null, atomB = null, cloud = null, arrow = null, lblA = null, lblB = null;

  function buildAtoms() {
    clearWorld();
    const d = DIATOMIC[C.values.mol];
    atomA = atom(ATOM_R[d.a], ATOM_COLOR[d.a], 24, { roughness: .3 });
    atomB = atom(ATOM_R[d.b], ATOM_COLOR[d.b], 24, { roughness: .3 });
    world.add(atomA, atomB);
    lblA = textSprite(d.a, { scale: 0.009 }); lblB = textSprite(d.b, { scale: 0.009 });
    world.add(lblA, lblB);

    // 電子雲：點雲，密度隨電負度差往電負度大的原子偏移
    const N = stage.quality === 'low' ? 1200 : 3000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    cloud = new THREE.Points(
      new THREE.BufferGeometry()
        .setAttribute('position', new THREE.BufferAttribute(pos, 3))
        .setAttribute('color', new THREE.BufferAttribute(col, 3)),
      new THREE.PointsMaterial({
        size: 0.16, map: softDot(), vertexColors: true, transparent: true,
        opacity: .55, depthWrite: false,
      })
    );
    world.add(cloud);

    // 偶極矩箭頭
    arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1.35, 0), 1, 0xC6412A, 0.22, 0.14);
    world.add(arrow);
  }

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    atomA = atomB = cloud = arrow = null;
  }

  /** 依核間距與電負度差更新電子雲 */
  function updateCloud(rAA) {
    if (!cloud) return;
    const d = DIATOMIC[C.values.mol];
    const dEN = d.dEN;
    const shift = Math.min(0.42, dEN * 0.16);       // 電子雲往電負度大的一端偏
    const arr = cloud.geometry.attributes.position.array;
    const cArr = cloud.geometry.attributes.color.array;
    const N = arr.length / 3;
    const xA = -rAA / 2, xB = rAA / 2;
    for (let i = 0; i < N; i++) {
      // 一半機率在 A 附近、一半在 B 附近，再加上鍵中間的重疊區
      const toB = Math.random() < 0.5 + shift;
      const cx = toB ? xB : xA;
      const sp = (toB ? ATOM_R[d.b] : ATOM_R[d.a]) * 0.9;
      const u = Math.random();
      let x, y, z;
      if (u < 0.32 && rAA < 3.4) {                  // 鍵重疊區（鍵長越短越明顯）
        x = (Math.random() - .5) * rAA * 0.9 + shift * rAA * 0.5;
        y = (Math.random() - .5) * 0.55; z = (Math.random() - .5) * 0.55;
      } else {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        const rr = sp * (0.4 + Math.random() * 0.9);
        x = cx + rr * Math.sin(ph) * Math.cos(th);
        y = rr * Math.sin(ph) * Math.sin(th);
        z = rr * Math.cos(ph);
      }
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      // 顏色梯度：偏向電負度大的一端為橘紅（電子多），另一端為藍（電子少）
      const t = Math.max(0, Math.min(1, (x + rAA / 2) / Math.max(0.1, rAA)));
      const w = dEN > 0.4 ? t : 0.5;
      cArr[i * 3] = 0.15 + w * 0.85;
      cArr[i * 3 + 1] = 0.55 - Math.abs(w - .5) * 0.3;
      cArr[i * 3 + 2] = 0.85 - w * 0.55;
    }
    cloud.geometry.attributes.position.needsUpdate = true;
    cloud.geometry.attributes.color.needsUpdate = true;
  }

  /* ---------------- 綠色情境：高分子鏈 ---------------- */
  let chain = null;
  function buildChain() {
    clearWorld();
    chain = new THREE.Group();
    world.add(chain);
    const M = MATERIAL[C.values.mat];
    const N = 26;
    for (let i = 0; i < N; i++) {
      const isEster = M.hydro > 0 && i % 3 === 2;
      const m = atom(isEster ? 0.26 : 0.30, isEster ? 0xFF7A59 : 0x4A5B54, 14, { roughness: .35 });
      m.position.set((i - (N - 1) / 2) * 0.52, Math.sin(i * 0.9) * 0.22, Math.cos(i * 0.7) * 0.18);
      m.userData = { home: m.position.clone(), isEster, idx: i };
      chain.add(m);
    }
    const t = textSprite(M.zh + '　' + M.bond, { scale: 0.0075 });
    t.position.set(0, 1.8, 0); chain.add(t);
  }

  /* ---------------- 下方圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="display:flex;gap:.8rem;flex-wrap:wrap">
      <div style="flex:1 1 320px;min-width:270px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t1>📉 勢能曲線</div>
        <canvas id="pe" aria-label="核間距與位能的關係曲線"></canvas>
      </div>
      <div style="flex:1 1 260px;min-width:240px">
        <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t2>🔁 Born–Haber 循環</div>
        <div id="bh" style="font-size:var(--fs-sm)"></div>
      </div>
    </div>`;
  const pe = new Chart2D(ctx.subEl.querySelector('#pe'), {
    height: 190, pad: { l: 56, r: 14, t: 14, b: 32 }, xLabel: '核間距 r (pm)', yLabel: '位能 (kJ/mol)',
  });
  pe.onResize = drawPE;
  const bhEl = ctx.subEl.querySelector('#bh');

  function morse(r_pm, key) {
    const d = DIATOMIC[key];
    const a = MORSE_A[key];
    const x = (r_pm - d.r0) / 100;         // pm → Å
    const e = 1 - Math.exp(-a * x);
    return d.De * (e * e - 1);
  }

  function drawPE() {
    if (mode === 'green') { drawDegrade(); return; }
    const key = C.values.mol, d = DIATOMIC[key];
    const rmin = d.r0 * 0.55, rmax = d.r0 * 3.2;
    const pts = [];
    for (let r = rmin; r <= rmax; r += (rmax - rmin) / 260) pts.push([r, Math.min(d.De * 1.4, morse(r, key))]);
    pe.xLabel = '核間距 r (pm)'; pe.yLabel = '位能 (kJ/mol)';
    pe.clear().setRange(rmin, rmax, -d.De * 1.18, d.De * 0.8).axes({ xTicks: 4, yTicks: 5 });
    pe.hline(0, { color: '#B9CFC4', dash: [3, 3], label: '分離狀態（r → ∞）' });
    pe.line(pts, { color: PALETTE.leafDeep, width: 3 });
    pe.vline(d.r0, { color: PALETTE.ocean, label: `平衡鍵長 ${d.r0} pm` });
    pe.dot(d.r0, -d.De, { color: PALETTE.coralDeep, r: 5, stroke: '#fff' });
    pe.label(d.r0 * 1.75, -d.De * 0.5, `解離能 De = ${d.De} kJ/mol`, { color: PALETTE.coralDeep });
    pe.label(rmin * 1.12, d.De * 0.55, '← 斥力區（核與核互斥）', { color: PALETTE.muted, align: 'left' });
    // 目前拖到的位置
    const r = C.values.r;
    pe.dot(r, Math.min(d.De * 1.4, morse(r, key)), { color: PALETTE.sun, r: 6, stroke: '#fff' });
  }

  function drawDegrade() {
    const M = MATERIAL[C.values.mat];
    const env = C.values.env;
    const k = M.k[env] * tempFactor();
    const pts = [];
    for (let m = 0; m <= 24; m += 0.25) pts.push([m, 100 * Math.exp(-k * m * 30)]);
    pe.xLabel = '時間（月）'; pe.yLabel = '剩餘質量 (%)';
    pe.clear().setRange(0, 24, 0, 105).axes({ xTicks: 4, yTicks: 5 });
    pe.line(pts, { color: PALETTE.leafDeep, width: 3 });
    pe.hline(50, { color: PALETTE.coralDeep, dash: [4, 4], label: '半衰期' });
    pe.vline(C.values.months, { color: PALETTE.sun, label: `${C.values.months} 個月` });
    // 其他材料做灰色對照
    Object.keys(MATERIAL).forEach(mk => {
      if (mk === C.values.mat) return;
      const kk = MATERIAL[mk].k[env] * tempFactor();
      const p2 = [];
      for (let m = 0; m <= 24; m += 0.5) p2.push([m, 100 * Math.exp(-kk * m * 30)]);
      pe.line(p2, { color: '#C3D2CB', width: 1.2, dash: [3, 3] });
    });
  }
  function tempFactor() {
    // 溫度每升高 10 °C 速率約加倍（教學用 Q10 = 2 的經驗法則）
    return Math.pow(2, (C.values.temp - 25) / 10);
  }

  function drawBH() {
    if (mode === 'green' || C.values.mol !== 'Na-Cl') {
      bhEl.innerHTML = `<p style="color:var(--ink-3);font-size:var(--fs-sm);margin:0">
        Born–Haber 循環用來拆解<strong>離子固體</strong>的生成焓。
        請把分子切到 <strong>NaCl</strong>，這裡就會列出完整的循環。</p>`;
      return;
    }
    bhEl.innerHTML = `
      <table class="data"><thead><tr><th>步驟</th><th>ΔH (kJ/mol)</th></tr></thead><tbody>
      ${BORN_HABER_NACL.map(s => `<tr><td>${s.zh}</td>
        <td style="color:${s.v > 0 ? 'var(--coral-deep)' : 'var(--leaf-deep)'}">${s.v > 0 ? '+' : ''}${s.v}</td></tr>`).join('')}
      <tr><td><strong>總和 = ΔH°f(NaCl, s)</strong></td><td><strong>${BORN_HABER_SUM}</strong></td></tr>
      </tbody></table>
      <p style="font-size:var(--fs-xs);color:var(--ink-3);margin:.4rem 0 0">
        注意：把 Na 變成 Na⁺、把 Cl₂ 拆開都要<strong>吸熱</strong>，
        真正讓 NaCl 穩定的是那個 −787 kJ/mol 的<span data-term="晶格能">晶格能</span>。</p>`;
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'deg', name: '可分解性', unit: '% 已降解', min: 0, max: 100, digits: 1,
      better: 'high', good: 70, bad: 15, note: '在選定環境與時間下的降解程度（原則 #10）' },
    { key: 'tox', name: '毒性等級', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.0, bad: 3.5, note: '製造與使用階段的健康危害（原則 #3、#4）' },
    { key: 'bio', name: '生質碳含量', unit: '%', min: 0, max: 100, digits: 0,
      better: 'high', good: 70, bad: 20, note: '原料來自可再生資源的比例（原則 #7）' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：拖曳原子改變核間距，看勢能曲線長出來');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'mol', label: '分子（電負度差遞增）', value: 'H-H', options: [
          { v: 'H-H', label: 'H–H', title: '非極性共價鍵，ΔEN = 0' },
          { v: 'H-Cl', label: 'H–Cl', title: '極性共價鍵，ΔEN = 0.96' },
          { v: 'H-F', label: 'H–F', title: '強極性共價鍵，ΔEN = 1.78' },
          { v: 'Na-Cl', label: 'Na–Cl', title: '離子鍵，ΔEN = 2.23' },
        ] },
        { type: 'range', key: 'r', label: '核間距 r（也可在畫面上左右拖曳）', min: 40, max: 700, step: 1, value: 74, unit: 'pm' },
        { type: 'check', key: 'drag', label: '在 3D 畫面上拖曳原子（關閉時可旋轉視角）', value: true },
        { type: 'button', key: 'snap', label: '↩ 回到平衡鍵長' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'r', label: '目前核間距', unit: 'pm', digits: 0 },
        { key: 'r0', label: '平衡鍵長 r₀', unit: 'pm', digits: 0 },
        { key: 'V', label: '目前位能', unit: 'kJ/mol', digits: 1 },
        { key: 'De', label: '解離能 De', unit: 'kJ/mol', digits: 0 },
        { key: 'dEN', label: '電負度差 ΔEN', unit: '', digits: 2 },
        { key: 'mu', label: '偶極矩 μ', unit: 'D', digits: 2 },
        { key: 'ionic', label: '離子性百分比', unit: '%', digits: 0, wide: true },
      ]);
      buildAtoms();
    } else {
      ctx.setStageTitle('綠色情境：可分解性設計與仿生黏著');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'mat', label: '材料', value: 'PE', options: Object.keys(MATERIAL).map(k => ({
          v: k, label: MATERIAL[k].zh.split(' ')[0], title: `${MATERIAL[k].zh}：${MATERIAL[k].bond}`,
        })) },
        { type: 'seg', key: 'env', label: '環境', value: 'sea', options: [
          { v: 'sea', label: '海水', title: '約 20 °C、含微生物、pH 8.1' },
          { v: 'compost', label: '工業堆肥', title: '約 58 °C、高濕度、高微生物活性' },
          { v: 'landfill', label: '掩埋場', title: '缺氧、低微生物活性' },
        ] },
        { type: 'range', key: 'months', label: '經過時間', min: 0, max: 24, step: 0.5, value: 6, unit: '個月' },
        { type: 'range', key: 'temp', label: '環境溫度', min: 5, max: 60, step: 1, value: ENV_TEMP.sea, unit: '°C',
          hint: '水解速率大致每升高 10 °C 加倍（Q₁₀ ≈ 2 的經驗法則）。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'bond', label: '主鏈鍵結', unit: '', digits: 0, wide: true },
        { key: 'left', label: '剩餘質量', unit: '%', digits: 1 },
        { key: 'half', label: '半衰期', unit: '個月', digits: 1 },
        { key: 'wet', label: '水下黏著強度', unit: '相對值', digits: 0 },
        { key: 'form', label: '甲醛釋放', unit: '', digits: 0 },
      ]);
      buildChain();
    }
    drawPE(); drawBH(); update();
  }

  function onChange(key, v) {
    if (key === 'mol') {
      buildAtoms();
      C.set('r', DIATOMIC[C.values.mol].r0);
      C.values.r = DIATOMIC[C.values.mol].r0;
    }
    if (key === 'snap') { C.set('r', DIATOMIC[C.values.mol].r0); C.values.r = DIATOMIC[C.values.mol].r0; }
    if (key === 'drag') stage.controls.enableRotate = !v;
    if (key === 'mat') buildChain();
    if (key === 'env') { const t = ENV_TEMP[v]; C.values.temp = t; C.set('temp', t); }
    drawPE(); drawBH(); update();
  }

  /* ---------------- 在 3D 上拖曳 ---------------- */
  let dragging = false, dragX = 0, dragR = 0;
  stage.renderer.domElement.addEventListener('pointerdown', e => {
    if (mode !== 'classic' || !C.values.drag) return;
    dragging = true; dragX = e.clientX; dragR = C.values.r;
    stage.renderer.domElement.setPointerCapture(e.pointerId);
  });
  stage.renderer.domElement.addEventListener('pointermove', e => {
    if (!dragging) return;
    const w = stage.renderer.domElement.clientWidth;
    const nr = Math.max(40, Math.min(700, dragR + (e.clientX - dragX) / w * 900));
    C.values.r = nr; C.set('r', Math.round(nr));
    drawPE(); update();
  });
  stage.renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
  stage.renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });

  /* ---------------- 數值 ---------------- */
  function update() {
    if (mode === 'classic') {
      const key = C.values.mol, d = DIATOMIC[key], r = C.values.r;
      const V = morse(r, key);
      // Pauling 的離子性經驗式
      const ionic = (1 - Math.exp(-0.25 * d.dEN * d.dEN)) * 100;
      readout({ r, r0: d.r0, V: Math.min(d.De * 1.4, V), De: d.De, dEN: d.dEN, mu: d.mu, ionic });
      ctx.setOverlay(
        `<b>${d.zh}</b>　ΔEN = ${d.dEN}<br>
         r = ${r.toFixed(0)} pm（平衡 ${d.r0} pm）<br>
         ${r < d.r0 - 6 ? '⚠ 核與核互斥，位能急速上升'
           : r > d.r0 + 60 ? '⬅ 吸引力把它們拉回來' : '✅ 接近平衡鍵長，位能最低'}`);
      gauge({ deg: 0, tox: 0, bio: 0 },
        d.dEN === 0
          ? `ΔEN = 0，電子雲<strong>對稱</strong>分布在兩核之間，偶極矩 μ = 0——這是純共價鍵。`
          : `ΔEN = ${d.dEN}，電子雲明顯偏向 ${d.b}，偶極矩 μ = ${d.mu} D，
             離子性約 <strong>${ionic.toFixed(0)}%</strong>。
             ${key === 'Na-Cl' ? '到了 NaCl 這一端，電子幾乎完全轉移，我們就稱它為離子鍵——'
               + '但請注意：共價與離子之間是<strong>連續的光譜</strong>，不是兩個分開的類別。' : ''}`);
    } else {
      const M = MATERIAL[C.values.mat], env = C.values.env;
      const k = M.k[env] * tempFactor();
      const left = 100 * Math.exp(-k * C.values.months * 30);
      const half = Math.log(2) / (k * 30);
      readout({
        bond: M.bond, left, half: Math.min(999, half),
        wet: M.wet, form: M.tox > 3 ? '⚠ 會釋出' : '不釋出',
      });
      ctx.setOverlay(`<b>${M.zh}</b><br>${M.bond}<br>
        ${C.values.months} 個月後剩餘 <strong>${left.toFixed(1)}%</strong>`);
      gauge({ deg: 100 - left, tox: M.tox, bio: M.bio },
        C.values.mat === 'PE'
          ? `PE 的主鏈是清一色的 <strong>C–C 鍵</strong>：非極性、沒有任何可被水攻擊的位置。
             這正是它耐用的原因，也是它在環境中幾乎不分解的原因。
             <strong>「好用」與「難分解」是同一個化學事實的兩面。</strong>`
          : C.values.mat === 'UF'
            ? `⚠ 尿素—甲醛膠靠亞甲基橋交聯，會<strong>持續緩慢釋出甲醛</strong>（IARC 第 1 類致癌物）。
               它便宜、黏得牢，但代價由使用者的呼吸道承擔。切到「貽貝仿生膠」比較看看。`
            : C.values.mat === 'DOPA'
              ? `🦪 貽貝能在<strong>水下</strong>把自己黏在濕滑的岩石上，靠的是足絲蛋白中的
                 <strong>兒茶酚（DOPA）</strong>基團——鄰位的兩個 –OH 能與礦物表面的金屬離子形成強配位鍵，
                 而且能把界面的水擠開。水下黏著強度相對值 ${M.wet}，且無甲醛。
                 這是<strong>仿生化學</strong>最成功的案例之一（原則 #3、#4、#7）。`
              : `酯鍵 <strong>–COO–</strong> 的羰基碳帶部分正電，是水分子（親核基）可以攻擊的位置，
                 因此可以水解斷鏈。這就是原則 #10「可分解性設計」的分子層次做法：
                 <strong>在設計階段就把「怎麼分解」寫進結構裡</strong>。
                 但請注意環境的差別——切到「海水」與「工業堆肥」比較半衰期，
                 <span data-term="可分解性設計">可分解</span>從來不是絕對的，要問「在哪裡、多久」。`);
    }
  }

  /* ---------------- 動畫 ---------------- */
  stage.start(({ dt, t }) => {
    if (mode === 'classic' && atomA) {
      const r = C.values.r / 100;                 // pm → 畫面單位（1 Å ≈ 1）
      atomA.position.set(-r / 2, 0, 0);
      atomB.position.set(r / 2, 0, 0);
      lblA.position.set(-r / 2, ATOM_R[DIATOMIC[C.values.mol].a] + 0.45, 0);
      lblB.position.set(r / 2, ATOM_R[DIATOMIC[C.values.mol].b] + 0.45, 0);
      updateCloud(r);
      const d = DIATOMIC[C.values.mol];
      arrow.visible = d.mu > 0;
      if (d.mu > 0) {
        arrow.position.set(-r / 2, -1.35, 0);
        arrow.setLength(Math.max(0.5, r * 0.9), 0.22, 0.14);
      }
    }
    if (mode === 'green' && chain) {
      const M = MATERIAL[C.values.mat];
      const k = M.k[C.values.env] * tempFactor();
      const frac = 1 - Math.exp(-k * C.values.months * 30);      // 已降解比例
      chain.children.forEach(o => {
        if (!o.userData.home) return;
        const broken = o.userData.isEster && (o.userData.idx / 26) < frac;
        const target = broken
          ? o.userData.home.clone().add(new THREE.Vector3(
            Math.sin(o.userData.idx * 2.1 + t * 0.5) * 1.6,
            Math.cos(o.userData.idx * 1.3 + t * 0.4) * 1.1 - 0.6,
            Math.sin(o.userData.idx) * 1.2))
          : o.userData.home;
        o.position.lerp(target, dt * 1.6);
      });
      chain.rotation.y += dt * 0.15;
    }
  });

  ctx.onScenario(v => {
    mode = v;
    stage.controls.enableRotate = true;
    buildForScenario();
    if (mode === 'classic') stage.controls.enableRotate = !C.values.drag;
  });
  buildForScenario();
  stage.controls.enableRotate = false;      // 預設進入拖曳模式
  return { destroy() { stage.dispose(); pe.destroy(); } };
}
