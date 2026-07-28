/* ==========================================================================
   sim/ch07.js — Ch7 原子結構與週期性
   模組 A（3D）：s / p / d / f 軌域的機率密度點雲，可顯示節面與節球
   模組 B（2D）：互動週期表 + 游離能／共價半徑的週期趨勢折線圖
   綠色情境：光與能源材料——能隙選擇、LED 節能、稀土供應風險與回收

   物理說明：
     點雲是以類氫原子波函數 ψ(r,θ,φ) 的 |ψ|² 做拒絕取樣（rejection sampling）產生的。
     真實多電子原子有電子—電子排斥，軌域形狀會變形；此處為教學示意。
   ========================================================================== */

import { createStage, THREE, softDot, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { IE1, COV_R, EN, BANDGAP, SHOCKLEY_QUEISSER, CONST } from '../../data/constants.js';
import { ELEMENTS, element, CAT_COLOR, CAT_NAME } from '../../data/elements.js';

/* 類氫波函數（單位：波耳半徑 a₀，Z = 1）。回傳含正負號的 ψ。 */
const ORB = {
  '1s': { n: 1, l: 0, radialNodes: [], psi: (r) => 2 * Math.exp(-r) },
  '2s': { n: 2, l: 0, radialNodes: [2], psi: (r) => (2 - r) * Math.exp(-r / 2) / (2 * Math.SQRT2) },
  '2pz': { n: 2, l: 1, radialNodes: [], angular: 'pz',
    psi: (r, ct) => r * Math.exp(-r / 2) * ct / (2 * Math.sqrt(6)) },
  '3s': { n: 3, l: 0, radialNodes: [1.9, 7.1],
    psi: (r) => (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3) * 2 / (81 * Math.sqrt(3)) },
  '3pz': { n: 3, l: 1, radialNodes: [6], angular: 'pz',
    psi: (r, ct) => (6 * r - r * r) * Math.exp(-r / 3) * ct * 4 / (81 * Math.sqrt(6)) },
  '3dz2': { n: 3, l: 2, radialNodes: [], angular: 'dz2',
    psi: (r, ct) => r * r * Math.exp(-r / 3) * (3 * ct * ct - 1) * 4 / (81 * Math.sqrt(30)) },
  '3dxy': { n: 3, l: 2, radialNodes: [], angular: 'dxy',
    psi: (r, ct, st, cp, sp) => r * r * Math.exp(-r / 3) * st * st * 2 * sp * cp * 4 / (81 * Math.sqrt(30)) },
  '4fz3': { n: 4, l: 3, radialNodes: [], angular: 'fz3',
    psi: (r, ct) => Math.pow(r, 3) * Math.exp(-r / 4) * (5 * Math.pow(ct, 3) - 3 * ct) / 3000 },
};
const ORB_LABEL = {
  '1s': '1s', '2s': '2s（有 1 個節球）', '2pz': '2p_z（1 個節面）',
  '3s': '3s（2 個節球）', '3pz': '3p_z（1 節面 + 1 節球）',
  '3dz2': '3d_z²（2 個節錐）', '3dxy': '3d_xy（2 個節面）', '4fz3': '4f_z³（3 個節面/錐）',
};

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 4, 14], fov: 42, minDistance: 4, maxDistance: 60,
    autoRotate: 0.5,
    ariaLabel: '原子軌域機率密度點雲 3D 模型',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);
  let selectedZ = 6;

  /* ---------------- 產生軌域點雲 ---------------- */
  function buildOrbital() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    const key = C.values.orb;
    const O = ORB[key];
    const N = { high: 9000, mid: 5000, low: 2600 }[stage.quality] || 5000;
    const Rmax = O.n * O.n * 3.2;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);

    // 先估最大 |ψ|² 以便拒絕取樣
    let pmax = 0;
    for (let i = 0; i < 4000; i++) {
      const p = randPoint(Rmax);
      pmax = Math.max(pmax, psi2(O, p).d);
    }
    let got = 0, guard = 0;
    while (got < N && guard < N * 400) {
      guard++;
      const p = randPoint(Rmax);
      const { d, s } = psi2(O, p);
      if (Math.random() * pmax > d) continue;
      const k = got * 3;
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
      // 用顏色表示波函數的正負相位（教學上很重要；關掉就全部同色）
      const showPhase = C.values.phase !== false;
      if (!showPhase) { col[k] = 0.12; col[k + 1] = 0.62; col[k + 2] = 0.70; }
      else if (s >= 0) { col[k] = 0.12; col[k + 1] = 0.62; col[k + 2] = 0.70; }
      else { col[k] = 1.0; col[k + 1] = 0.48; col[k + 2] = 0.35; }
      got++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, got * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col.slice(0, got * 3), 3));
    // 註：舞台是亮色背景，因此用一般混色（NormalBlending）而非加成混色，
    //     否則點雲會被白底吃掉，看不出正負相位的顏色。
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: C ? C.values.size : 0.28, map: softDot(), vertexColors: true,
      transparent: true, opacity: 0.55, depthWrite: false,
    }));
    world.add(pts);

    // 原子核
    const nuc = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xC6412A }));
    world.add(nuc);

    // 節面 / 節球
    if (C.values.nodes) {
      O.radialNodes.forEach(rn => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rn, 28, 18),
          new THREE.MeshBasicMaterial({ color: 0xFFC93C, wireframe: true, transparent: true, opacity: 0.28 }));
        world.add(s);
      });
      if (O.angular === 'pz' || O.angular === 'fz3') world.add(planeXY(Rmax));
      if (O.angular === 'dxy') { world.add(planeXY(Rmax, 'xz')); world.add(planeXY(Rmax, 'yz')); }
      if (O.angular === 'dz2') {
        [54.7356, 125.2644].forEach(deg => world.add(cone(deg, Rmax)));
      }
      if (O.angular === 'fz3') {
        [39.2, 140.8].forEach(deg => world.add(cone(deg, Rmax)));
      }
    }
    const lbl = textSprite(ORB_LABEL[key], { scale: 0.012 });
    lbl.position.set(0, Rmax * 0.95, 0);
    world.add(lbl);
  }

  function randPoint(R) {
    return { x: (Math.random() - .5) * 2 * R, y: (Math.random() - .5) * 2 * R, z: (Math.random() - .5) * 2 * R };
  }
  function psi2(O, p) {
    const r = Math.hypot(p.x, p.y, p.z) + 1e-6;
    const ct = p.z / r, st = Math.sqrt(Math.max(0, 1 - ct * ct));
    const ph = Math.atan2(p.y, p.x);
    const v = O.psi(r, ct, st, Math.cos(ph), Math.sin(ph));
    return { d: v * v * r * r * 0.0001 + v * v, s: v };
  }
  function planeXY(R, which = 'xy') {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.8, R * 1.8),
      new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    if (which === 'xy') g.rotation.x = Math.PI / 2;
    if (which === 'yz') g.rotation.y = Math.PI / 2;
    return g;
  }
  function cone(deg, R) {
    const th = deg * Math.PI / 180;
    const h = R * 1.4;
    const rad = Math.tan(th) * h;
    const m = new THREE.Mesh(new THREE.ConeGeometry(Math.abs(rad), Math.abs(h), 30, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    m.position.y = deg < 90 ? h / 2 : -h / 2;
    if (deg > 90) m.rotation.x = Math.PI;
    return m;
  }

  /* ---------------- 週期表 + 趨勢圖 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.3rem" data-sub-title>
      🧩 互動週期表：點任一元素看電子組態與趨勢</div>
    <div id="ptable" role="group" aria-label="互動週期表"></div>
    <div id="einfo" style="font-size:var(--fs-sm);margin:.5rem 0 .3rem;line-height:1.8"></div>
    <canvas id="trend" aria-label="週期趨勢折線圖"></canvas>
    <style>
      #ptable { display:grid; grid-template-columns: repeat(18, minmax(0,1fr)); gap:2px; }
      #ptable button {
        aspect-ratio:1; border:1px solid rgba(18,59,46,.12); border-radius:4px;
        font:700 clamp(6px,1.1vw,11px)/1.1 var(--font-num); cursor:pointer; padding:0;
        display:flex; align-items:center; justify-content:center; color:#123B2E;
        transition: transform .12s, box-shadow .12s;
      }
      #ptable button:hover { transform: scale(1.35); z-index:5; box-shadow: var(--shadow); }
      #ptable button[aria-pressed="true"] { outline:2.5px solid var(--leaf-deep); z-index:4; transform: scale(1.2); }
      #ptable .gap { aspect-ratio:1; }
    </style>`;

  const ptable = ctx.subEl.querySelector('#ptable');
  const einfo = ctx.subEl.querySelector('#einfo');
  const trend = new Chart2D(ctx.subEl.querySelector('#trend'), {
    height: 165, pad: { l: 52, r: 14, t: 14, b: 30 }, xLabel: '原子序 Z', yLabel: '',
  });
  trend.onResize = drawTrend;

  function buildTable() {
    ptable.innerHTML = '';
    const cells = {};
    ELEMENTS.forEach((e, i) => {
      const z = i + 1;
      const [sym, zh, period, group] = e;
      cells[`${period}_${group}`] = z;
    });
    for (let row = 1; row <= 8; row++) {
      for (let g = 1; g <= 18; g++) {
        const z = cells[`${row}_${g}`];
        if (row === 7) { const d = document.createElement('div'); d.className = 'gap'; ptable.appendChild(d); continue; }
        if (!z) { const d = document.createElement('div'); d.className = 'gap'; ptable.appendChild(d); continue; }
        const el = element(z);
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = el.sym;
        b.style.background = CAT_COLOR[el.cat];
        b.title = `${z} ${el.sym} ${el.zh}（${CAT_NAME[el.cat]}）`;
        b.setAttribute('aria-label', `原子序 ${z}，${el.zh} ${el.sym}，${CAT_NAME[el.cat]}`);
        b.setAttribute('aria-pressed', String(z === selectedZ));
        b.addEventListener('click', () => { selectedZ = z; refreshTable(); showElement(); drawTrend(); update(); });
        ptable.appendChild(b);
      }
    }
  }
  function refreshTable() {
    [...ptable.querySelectorAll('button')].forEach(b => {
      const z = Number(b.getAttribute('aria-label').match(/原子序 (\d+)/)[1]);
      b.setAttribute('aria-pressed', String(z === selectedZ));
    });
  }

  function showElement() {
    const el = element(selectedZ);
    const ie = IE1[selectedZ], r = COV_R[selectedZ], en = EN[selectedZ];
    einfo.innerHTML = `
      <strong style="font-size:1.05rem">${el.z} ${el.sym} ${el.zh}</strong>
      <span style="color:var(--ink-3)">（${el.period === 8 ? '第 6 週期・鑭系（f 區）' : `第 ${el.period} 週期，第 ${el.group} 族`}，${CAT_NAME[el.cat]}）</span><br>
      電子組態：<code>${el.config}</code><br>
      <span data-term="游離能">游離能</span> IE₁ = ${ie ? ie + ' kJ/mol' : '本教材未收錄'}　·
      共價半徑 = ${r ? r + ' pm' : '未收錄'}　·
      <span data-term="電負度">電負度</span> = ${en ?? '未收錄'}`;
  }

  function drawTrend() {
    const which = C ? C.values.trend : 'ie';
    const data = which === 'ie' ? IE1 : COV_R;
    const pts = [];
    for (let z = 1; z <= 86; z++) if (data[z]) pts.push([z, data[z]]);
    const ymax = Math.max(...pts.map(p => p[1])) * 1.12;
    trend.yLabel = which === 'ie' ? '第一游離能 (kJ/mol)' : '共價半徑 (pm)';
    trend.clear().setRange(0, 87, 0, ymax).axes({ xTicks: [2, 10, 18, 36, 54, 86], yTicks: 4 });
    trend.line(pts, { color: which === 'ie' ? PALETTE.ocean : PALETTE.leaf, width: 2 });
    // 標出惰性氣體（游離能的高峰）與鹼金屬（低谷）
    [2, 10, 18, 36, 54, 86].forEach(z => data[z] && trend.dot(z, data[z], { color: PALETTE.coralDeep, r: 3.4 }));
    [3, 11, 19, 37, 55].forEach(z => data[z] && trend.dot(z, data[z], { color: PALETTE.sun, r: 3.4 }));
    if (data[selectedZ]) {
      trend.dot(selectedZ, data[selectedZ], { color: PALETTE.leafDeep, r: 6, stroke: '#fff' });
      trend.label(selectedZ, data[selectedZ], element(selectedZ).sym, { dy: 10, color: PALETTE.leafDeep });
    }
    trend.legend([
      { label: '惰性氣體', color: PALETTE.coralDeep }, { label: '鹼金屬', color: PALETTE.sun },
    ], { x: 70, y: 22 });
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'eff', name: '理論光電轉換上限', unit: '%', min: 0, max: 35, digits: 1,
      better: 'high', good: 30, bad: 15, note: 'Shockley–Queisser 單接面極限（原則 #6）' },
    { key: 'save', name: '照明節能', unit: '%', min: 0, max: 100, digits: 0,
      better: 'high', good: 75, bad: 30, note: '相對白熾燈的耗電改善（原則 #6）' },
    { key: 'risk', name: '關鍵原料供應風險', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '稀土與稀有金屬的集中度與回收難度（原則 #1）' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    const orbOpts = Object.keys(ORB).map(k => ({ v: k, label: k.replace('z2', 'z²').replace('z3', 'z³'), title: ORB_LABEL[k] }));
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：原子軌域的機率密度點雲');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'orb', label: '軌域', value: '2pz', options: orbOpts },
        { type: 'check', key: 'nodes', label: '顯示節面與節球', value: true,
          hint: '黃色的球面／平面／錐面就是電子出現機率為零的地方。' },
        { type: 'check', key: 'phase', label: '用顏色區分波函數正負相位', value: true },
        { type: 'seg', key: 'trend', label: '週期趨勢圖', value: 'ie', options: [
          { v: 'ie', label: '第一游離能' }, { v: 'r', label: '共價半徑' },
        ] },
        { type: 'range', key: 'size', label: '點雲密度', min: 0.12, max: 0.6, step: 0.02, value: 0.28, unit: '' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'n', label: '主量子數 n', unit: '', digits: 0 },
        { key: 'l', label: '角量子數 ℓ', unit: '', digits: 0 },
        { key: 'nodes', label: '總節面數 (n−1)', unit: '個', digits: 0 },
        { key: 'rad', label: '徑向節面（節球）', unit: '個', digits: 0 },
        { key: 'ang', label: '角向節面', unit: '個', digits: 0 },
        { key: 'ez', label: '氫原子在此 n 的能階 E_n = −13.606/n²', unit: 'eV', digits: 3, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：能隙、光電材料與稀土回收');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'orb', label: '軌域（仍可觀察）', value: '3dz2', options: orbOpts },
        { type: 'check', key: 'nodes', label: '顯示節面與節球', value: false },
        { type: 'seg', key: 'mat', label: '光電材料', value: 'Si', options: Object.keys(BANDGAP).map(k => ({
          v: k, label: BANDGAP[k].zh.split(' ')[0], title: `${BANDGAP[k].zh}　能隙 ${BANDGAP[k].v} eV（${BANDGAP[k].type}能隙）`,
        })) },
        { type: 'seg', key: 'lamp', label: '照明技術', value: 'led', options: [
          { v: 'inc', label: '白熾燈', title: '約 15 lm/W，95% 的電變成熱' },
          { v: 'cfl', label: '省電燈泡', title: '約 60 lm/W，含汞' },
          { v: 'led', label: 'LED', title: '約 120 lm/W 以上，不含汞' },
        ] },
        { type: 'range', key: 'recy', label: '稀土回收率', min: 0, max: 90, step: 5, value: 1, unit: '%',
          hint: '全球稀土的實際回收率長期低於 1%——這是關鍵原料永續最大的破口。' },
        { type: 'seg', key: 'trend', label: '週期趨勢圖', value: 'ie', options: [
          { v: 'ie', label: '第一游離能' }, { v: 'r', label: '共價半徑' },
        ] },
        { type: 'range', key: 'size', label: '點雲密度', min: 0.12, max: 0.6, step: 0.02, value: 0.28, unit: '' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'eg', label: '能隙 E_g', unit: 'eV', digits: 2 },
        { key: 'lam', label: '吸收邊界波長', unit: 'nm', digits: 0 },
        { key: 'type', label: '能隙類型', unit: '', digits: 0 },
        { key: 'eff', label: '理論轉換上限', unit: '%', digits: 1 },
        { key: 'lm', label: '照明效率', unit: 'lm/W', digits: 0 },
        { key: 'kwh', label: '每年每盞省電', unit: 'kWh', digits: 1, wide: true },
      ]);
    }
    buildOrbital(); showElement(); drawTrend(); update();
  }

  function onChange(key, v) {
    if (key === 'orb' || key === 'nodes' || key === 'phase') buildOrbital();
    if (key === 'size') {
      world.children.forEach(o => { if (o.isPoints) o.material.size = v; });
    }
    if (key === 'trend') drawTrend();
    update();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    const O = ORB[C.values.orb];
    if (mode === 'classic') {
      const ang = O.l;
      const rad = O.n - 1 - O.l;
      // 氫原子能階 E_n = −13.606/n² eV（精確解）。多電子原子須考慮遮蔽，不能直接代 Z，故不在此推估。
      const E = -13.6057 / (O.n ** 2);
      readout({ n: O.n, l: O.l, nodes: O.n - 1, rad, ang, ez: E });
      ctx.setOverlay(
        `<b>${ORB_LABEL[C.values.orb]}</b><br>
         n = ${O.n}，ℓ = ${O.l}<br>
         徑向節面 ${rad} 個 + 角向節面 ${ang} 個 = ${O.n - 1} 個<br>
         <span style="color:#1E9EB3">■</span> ψ &gt; 0　<span style="color:#FF7A59">■</span> ψ &lt; 0`);
      gauge({ eff: 0, save: 0, risk: 0 },
        `軌域不是行星軌道，而是<strong>機率雲</strong>：每一個點代表「在這裡找到電子」的一次抽樣。
         注意顏色——藍與橘代表波函數的<strong>正負相位</strong>，這在 Ch8 談鍵結時就是「同相疊加成鍵、反相疊加反鍵」的關鍵。
         切到綠色情境，看這些能階怎麼決定太陽能電池與 LED 的效率。`);

    } else {
      const B = BANDGAP[C.values.mat];
      const lam = 1239.84 / B.v;                    // E(eV) → λ(nm)
      // Shockley–Queisser 曲線的簡化近似（在 1.34 eV 達 33.7% 的鐘形）
      const eff = Math.max(2, SHOCKLEY_QUEISSER.max_eff *
        Math.exp(-Math.pow((B.v - SHOCKLEY_QUEISSER.optimal_eV) / 0.62, 2)));
      const lm = { inc: 15, cfl: 60, led: 120 }[C.values.lamp];
      const hours = 1200;                            // 每年點燈時數
      const lumens = 800;                            // 一盞燈的光通量
      const kwh = (lumens / 15 - lumens / lm) * hours / 1000;
      const risk = 4.6 - C.values.recy / 90 * 2.6;

      readout({
        eg: B.v, lam, type: B.type + '能隙', eff, lm, kwh,
      });
      ctx.setOverlay(
        `<b>${B.zh}</b><br>能隙 ${B.v} eV → 吸收邊界 ${lam.toFixed(0)} nm<br>
         ${B.type}能隙｜理論轉換上限 ${eff.toFixed(1)}%`);
      gauge({ eff, save: (1 - 15 / lm) * 100, risk },
        C.values.mat === 'TiO2'
          ? `TiO₂ 的能隙 3.20 eV 對應 387 nm——只吃得到紫外光，只占太陽光約 4%。
             這就是 Ch12 光觸媒的先天限制，也是「可見光響應光觸媒」成為研究熱點的原因。`
          : (Math.abs(B.v - SHOCKLEY_QUEISSER.optimal_eV) < 0.25
            ? `✅ 這個能隙非常接近單接面太陽能電池的最佳值 ${SHOCKLEY_QUEISSER.optimal_eV} eV
               （Shockley–Queisser 極限 ${SHOCKLEY_QUEISSER.max_eff}%）。
               能隙太大 → 吸不到低能量的紅光；太小 → 高能量光子的能量浪費成熱。`
            : `能隙 ${B.v} eV 離最佳值 ${SHOCKLEY_QUEISSER.optimal_eV} eV 有段距離。
               ${B.v > SHOCKLEY_QUEISSER.optimal_eV ? '能隙太大，太陽光譜中大量的紅光與紅外光完全吸收不到。'
                 : '能隙太小，吸得到光但每個光子多餘的能量會變成熱而浪費掉。'}
               這就是為什麼<strong>選材料等於選能隙</strong>。`));
    }
  }

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildTable(); buildForScenario();
  stage.start(() => { });
  return { destroy() { stage.dispose(); trend.destroy(); } };
}
