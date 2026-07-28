/* ==========================================================================
   sim/ch03.js — Ch3 化學計量
   模組 A（3D + 拖曳）：把分子拖進反應器，找出限量試劑
   模組 B（綠色）：原子經濟性計算器，兩條合成路徑並排比較 AE 與 E-factor

   化學說明：
   限量試劑判定＝比較每個反應物的「莫耳數 ÷ 係數」，最小者先用完。
   原子經濟性 AE = 目標產物分子量 / 所有反應物分子量總和 × 100%
   E-factor = 廢棄物質量 / 產物質量
   ========================================================================== */

import { createStage, THREE, atom, bond, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { ATOMIC_MASS, IBUPROFEN, EFACTOR_BENCH } from '../../data/constants.js';

/* ---------- 反應資料庫 ---------- */
const RXN = {
  ammonia: {
    zh: 'N₂ + 3H₂ → 2NH₃（哈柏法合成氨）',
    reactants: [{ f: 'N2', coef: 1, zh: 'N₂' }, { f: 'H2', coef: 3, zh: 'H₂' }],
    products: [{ f: 'NH3', coef: 2, zh: 'NH₃' }],
  },
  methane: {
    zh: 'CH₄ + 2O₂ → CO₂ + 2H₂O（甲烷完全燃燒）',
    reactants: [{ f: 'CH4', coef: 1, zh: 'CH₄' }, { f: 'O2', coef: 2, zh: 'O₂' }],
    products: [{ f: 'CO2', coef: 1, zh: 'CO₂' }, { f: 'H2O', coef: 2, zh: 'H₂O' }],
  },
};

/* 分子式 → 原子組成 */
const FORMULA = {
  N2: { N: 2 }, H2: { H: 2 }, NH3: { N: 1, H: 3 },
  CH4: { C: 1, H: 4 }, O2: { O: 2 }, CO2: { C: 1, O: 2 }, H2O: { H: 2, O: 1 },
};
const MW = f => Object.entries(FORMULA[f]).reduce((s, [el, n]) => s + ATOMIC_MASS[el] * n, 0);

/* 分子的 3D 幾何（單位為任意教學尺度，鍵角取真實值）*/
const GEOM = {
  N2:  [['N', [-0.55, 0, 0]], ['N', [0.55, 0, 0]]],
  H2:  [['H', [-0.36, 0, 0]], ['H', [0.36, 0, 0]]],
  O2:  [['O', [-0.6, 0, 0]], ['O', [0.6, 0, 0]]],
  NH3: [['N', [0, 0.18, 0]], ['H', [0.85, -0.2, 0]], ['H', [-0.42, -0.2, 0.74]], ['H', [-0.42, -0.2, -0.74]]],
  CH4: [['C', [0, 0, 0]], ['H', [0.63, 0.63, 0.63]], ['H', [-0.63, -0.63, 0.63]],
        ['H', [-0.63, 0.63, -0.63]], ['H', [0.63, -0.63, -0.63]]],
  CO2: [['C', [0, 0, 0]], ['O', [-1.0, 0, 0]], ['O', [1.0, 0, 0]]],
  H2O: [['O', [0, 0.12, 0]], ['H', [0.76, -0.48, 0]], ['H', [-0.76, -0.48, 0]]],  // 鍵角 104.5°
};

const ES = {
  H: 0xF2F6F4, C: 0x4A5B54, N: 0x4C7DE0, O: 0xFF6B5B,
};
const ER = { H: 0.20, C: 0.30, N: 0.29, O: 0.28 };

function makeMolecule(f, grey = false) {
  const g = new THREE.Group();
  const pts = GEOM[f];
  const centre = new THREE.Vector3(...pts[0][1]);
  pts.forEach(([el, p], i) => {
    const s = atom(ER[el] * (grey ? 0.85 : 1), grey ? 0xC8D3CD : ES[el], 16,
      { roughness: .35, metalness: .05, opacity: grey ? 0.45 : 1 });
    s.position.set(...p);
    g.add(s);
    if (i > 0) g.add(bond(centre, new THREE.Vector3(...p), 0.055, grey ? 0xD6DEDA : 0xC3D2CB));
  });
  // 雙原子分子：直接連
  if (pts.length === 2) { /* 上面已連 */ }
  return g;
}

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.8, 9.5], fov: 45, minDistance: 4, maxDistance: 22,
    ariaLabel: '反應器 3D 畫面，顯示反應物與產物分子',
  });
  let group = new THREE.Group();
  stage.scene.add(group);

  let mode = ctx.scenario;
  let C = null, readout = null;
  let counts = { a: 4, b: 6 };            // 使用者投入的分子數
  let rxnKey = 'ammonia';
  let reacted = false;

  /* ================= 下方：拖曳投料盤（傳統情境）／長條圖（綠色情境） ================= */
  function buildSub() {
    ctx.subEl.innerHTML = mode === 'classic' ? `
      <div style="display:flex;gap:.9rem;flex-wrap:wrap;align-items:flex-start">
        <div>
          <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.25rem">
            🧲 拖曳投料：把分子拖進中間的反應器</div>
          <canvas id="tray" width="360" height="150"
            style="border-radius:12px;background:#fff;border:1px solid var(--line);touch-action:none;cursor:grab"
            aria-label="拖曳投料盤，可把反應物分子拖進反應器"></canvas>
        </div>
        <div style="flex:1 1 240px;min-width:220px">
          <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.3rem">反應前後莫耳數表</div>
          <div id="mole-table"></div>
        </div>
      </div>` : `
      <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.25rem">
        📊 兩條合成路徑並排比較（布洛芬 ibuprofen）</div>
      <canvas id="aebar" aria-label="原子經濟性與 E-factor 長條圖"></canvas>`;
  }

  /* ---- 拖曳投料盤 ---- */
  let tray, tctx, dragging = null;
  function initTray() {
    tray = ctx.subEl.querySelector('#tray');
    if (!tray) return;
    tctx = tray.getContext('2d');
    const R = RXN[rxnKey];
    const slots = [
      { key: 'a', x: 55, y: 42, color: '#4C7DE0', label: R.reactants[0].zh },
      { key: 'b', x: 55, y: 108, color: '#3FA34D', label: R.reactants[1].zh },
    ];
    const reactor = { x: 265, y: 75, r: 52 };

    function draw() {
      const c = tctx;
      c.clearRect(0, 0, 360, 150);
      // 反應器
      c.beginPath(); c.arc(reactor.x, reactor.y, reactor.r, 0, Math.PI * 2);
      c.fillStyle = dragging ? '#E3F4E6' : '#EAF6FF'; c.fill();
      c.strokeStyle = '#1E9EB3'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#14707F'; c.font = '600 12px "Noto Sans TC",system-ui'; c.textAlign = 'center';
      c.fillText('反應器', reactor.x, reactor.y - reactor.r + 16);
      c.font = '700 15px "Noto Sans TC",system-ui'; c.fillStyle = '#123B2E';
      c.fillText(`${R.reactants[0].zh} × ${counts.a}`, reactor.x, reactor.y + 2);
      c.fillText(`${R.reactants[1].zh} × ${counts.b}`, reactor.x, reactor.y + 22);
      // 投料槽
      slots.forEach(s => {
        c.beginPath(); c.arc(s.x, s.y, 22, 0, Math.PI * 2);
        c.fillStyle = s.color; c.globalAlpha = .9; c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#fff'; c.font = '700 13px "Noto Sans TC",system-ui'; c.textAlign = 'center';
        c.fillText(s.label, s.x, s.y + 5);
        c.fillStyle = '#5E7A6F'; c.font = '11px "Noto Sans TC",system-ui';
        c.fillText('拖我 →', s.x, s.y + 36);
      });
      if (dragging) {
        c.beginPath(); c.arc(dragging.x, dragging.y, 18, 0, Math.PI * 2);
        c.fillStyle = dragging.color; c.globalAlpha = .75; c.fill(); c.globalAlpha = 1;
      }
    }

    const pos = e => {
      const r = tray.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (360 / r.width), y: (e.clientY - r.top) * (150 / r.height) };
    };
    tray.addEventListener('pointerdown', e => {
      const p = pos(e);
      const s = slots.find(s => Math.hypot(p.x - s.x, p.y - s.y) < 26);
      if (s) { dragging = { ...s, x: p.x, y: p.y }; tray.setPointerCapture(e.pointerId); draw(); }
    });
    tray.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = pos(e); dragging.x = p.x; dragging.y = p.y; draw();
    });
    tray.addEventListener('pointerup', e => {
      if (!dragging) return;
      const p = pos(e);
      if (Math.hypot(p.x - reactor.x, p.y - reactor.y) < reactor.r) {
        counts[dragging.key] = Math.min(24, counts[dragging.key] + 1);
        C.set(dragging.key === 'a' ? 'na' : 'nb', counts[dragging.key]);
        reacted = false;
        rebuild();
      }
      dragging = null; draw();
    });
    tray.addEventListener('pointercancel', () => { dragging = null; draw(); });
    // 鍵盤替代方案（無障礙）：Enter / 空白鍵各加一個
    tray.tabIndex = 0;
    tray.addEventListener('keydown', e => {
      if (e.key === 'Enter') { counts.a = Math.min(24, counts.a + 1); C.set('na', counts.a); reacted = false; rebuild(); }
      if (e.key === ' ') { e.preventDefault(); counts.b = Math.min(24, counts.b + 1); C.set('nb', counts.b); reacted = false; rebuild(); }
    });
    draw();
    initTray.draw = draw;
  }

  /* ---- 綠色情境長條圖 ---- */
  let aeChart = null;
  function initAeChart() {
    const cv = ctx.subEl.querySelector('#aebar');
    if (!cv) return;
    aeChart = new Chart2D(cv, { height: 190, pad: { l: 46, r: 12, t: 18, b: 44 }, yLabel: '數值' });
    aeChart.onResize = drawAeChart;
  }

  function routeNumbers() {
    const kg = C.values.kg;                          // 目標產量 kg
    const route = C.values.route;                    // 'boots' | 'bhc'
    const recycle = C.values.recycle;                // 綠色路線是否回收乙酸
    const d = IBUPROFEN[route];
    let ae = d.atomEconomy;
    if (route === 'bhc' && recycle) ae = d.atomEconomyRecycle;
    const ef = route === 'bhc' && recycle ? 0.06 : d.eFactor;
    const waste = kg * ef;                           // 廢棄物 kg
    const feed = kg + waste;                         // 投入物料 kg（質量守恆的粗估）
    const energy = route === 'boots' ? 100 : (recycle ? 42 : 55);   // 相對能耗（步驟數與分離次數）
    return { kg, route, d, ae, ef, waste, feed, energy, steps: d.steps };
  }

  function drawAeChart() {
    if (!aeChart || mode !== 'green') return;
    const n = routeNumbers();
    const boots = IBUPROFEN.boots, bhc = IBUPROFEN.bhc;
    const bhcAE = C.values.recycle ? bhc.atomEconomyRecycle : bhc.atomEconomy;
    const bhcEF = C.values.recycle ? 0.06 : bhc.eFactor;
    aeChart.clear().setRange(0, 4, 0, 110).axes({ yTicks: 5, xTicks: [], grid: true });
    aeChart.bars([
      { label: 'Boots\n原子經濟性 %', value: boots.atomEconomy, color: n.route === 'boots' ? PALETTE.coral : '#E3CFC8' },
      { label: 'BHC\n原子經濟性 %', value: bhcAE, color: n.route === 'bhc' ? PALETTE.leaf : '#CFE3D4' },
      { label: 'Boots\nE-factor×20', value: boots.eFactor * 20, color: n.route === 'boots' ? PALETTE.coralDeep : '#E3CFC8' },
      { label: 'BHC\nE-factor×20', value: bhcEF * 20, color: n.route === 'bhc' ? PALETTE.leafDeep : '#CFE3D4' },
    ], { fmt: v => v.toFixed(1) });
    aeChart.label(2, 105, '原子經濟性越高越好；E-factor 越低越好（此處 ×20 以便同圖比較）',
      { color: PALETTE.muted });
  }

  /* ================= 3D 內容 ================= */
  function clearGroup() {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    stage.scene.remove(group);
    group = new THREE.Group();
    stage.scene.add(group);
  }

  /** 依莫耳比計算限量試劑與產物 */
  function stoich() {
    const R = RXN[rxnKey];
    const [r1, r2] = R.reactants;
    const e1 = counts.a / r1.coef, e2 = counts.b / r2.coef;
    const ext = Math.floor(Math.min(e1, e2));                 // 可完成的反應次數
    const limiting = e1 < e2 ? 0 : (e2 < e1 ? 1 : -1);        // -1 表示恰好完全反應
    const used = [ext * r1.coef, ext * r2.coef];
    const left = [counts.a - used[0], counts.b - used[1]];
    const prod = R.products.map(p => ({ ...p, n: ext * p.coef }));
    return { R, ext, limiting, used, left, prod };
  }

  function layout(items) {
    // 把分子排成整齊的網格
    const per = Math.ceil(Math.sqrt(items.length)) || 1;
    return items.map((it, i) => {
      const r = Math.floor(i / per), c = i % per;
      return { ...it, x: (c - (per - 1) / 2) * 1.5, y: -(r - 0.5) * 1.5 };
    });
  }

  function buildClassic() {
    const s = stoich();
    const R = s.R;
    const showProducts = reacted;

    const addSet = (f, n, x0, grey) => {
      const arr = [];
      for (let i = 0; i < n; i++) arr.push({ f });
      layout(arr).forEach(it => {
        const m = makeMolecule(f, grey);
        m.position.set(x0 + it.x, it.y + 0.4, 0);
        m.userData.spin = 0.4 + Math.random() * 0.6;
        group.add(m);
      });
    };

    if (!showProducts) {
      addSet(R.reactants[0].f, counts.a, -2.6, false);
      addSet(R.reactants[1].f, counts.b, 2.6, false);
      const t1 = textSprite(`${R.reactants[0].zh} × ${counts.a}`, { scale: 0.009 });
      t1.position.set(-2.6, 2.9, 0); group.add(t1);
      const t2 = textSprite(`${R.reactants[1].zh} × ${counts.b}`, { scale: 0.009 });
      t2.position.set(2.6, 2.9, 0); group.add(t2);
    } else {
      let x = -3.4;
      s.prod.forEach(p => { addSet(p.f, p.n, x, false); x += 3.4; });
      // 過量剩餘物（灰色）
      R.reactants.forEach((r, i) => {
        if (s.left[i] > 0) { addSet(r.f, s.left[i], x, true); x += 3.4; }
      });
      const t = textSprite(
        s.prod.map(p => `${p.zh} × ${p.n}`).join('　') +
        (s.left.some(v => v > 0) ? '　｜剩餘（灰）：' +
          R.reactants.map((r, i) => s.left[i] > 0 ? `${r.zh} × ${s.left[i]}` : '').filter(Boolean).join('、') : ''),
        { scale: 0.008 });
      t.position.set(0, 2.9, 0); group.add(t);
    }
  }

  function buildGreen() {
    // 用兩堆方塊表示「進到產物的原子」與「變成廢棄物的原子」
    const n = routeNumbers();
    const total = 1;
    const good = n.ae / 100, bad = 1 - good;

    const mk = (h, color, x, label) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, Math.max(0.08, h * 4), 1.5),
        new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .1 })
      );
      m.position.set(x, Math.max(0.04, h * 2) - 1.4, 0);
      group.add(m);
      const t = textSprite(label, { scale: 0.0075 });
      t.position.set(x, Math.max(0.2, h * 4) - 1.1, 0);
      group.add(t);
    };
    mk(good, 0x3FA34D, -1.6, `進入產物 ${(good * 100).toFixed(1)}%`);
    mk(bad, 0xFF7A59, 1.6, `變成廢棄物 ${(bad * 100).toFixed(1)}%`);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 40),
      new THREE.MeshStandardMaterial({ color: 0xE7F3EC, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.42; group.add(floor);

    const title = textSprite(n.route === 'boots' ? 'Boots 傳統路線（6 步）' : `BHC 觸媒路線（3 步）${C.values.recycle ? '＋乙酸回收' : ''}`,
      { scale: 0.0095 });
    title.position.set(0, 3.1, 0); group.add(title);
  }

  function rebuild() {
    clearGroup();
    if (mode === 'classic') buildClassic(); else buildGreen();
    update();
    if (initTray.draw) initTray.draw();
    drawAeChart();
  }

  /* ================= 莫耳數表 ================= */
  function renderTable() {
    const host = ctx.subEl.querySelector('#mole-table');
    if (!host) return;
    const s = stoich(), R = s.R;
    const rows = [
      ...R.reactants.map((r, i) => ({
        zh: r.zh, before: counts[i ? 'b' : 'a'], change: -s.used[i], after: s.left[i],
        limiting: s.limiting === i,
      })),
      ...s.prod.map(p => ({ zh: p.zh, before: 0, change: +p.n, after: p.n, product: true })),
    ];
    host.innerHTML = `
      <table class="data">
        <thead><tr><th>物種</th><th>反應前</th><th>變化量</th><th>反應後</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${r.zh}${r.limiting ? ' 🔴' : ''}</td>
            <td>${r.before}</td>
            <td>${r.change > 0 ? '+' : ''}${r.change}</td>
            <td class="${r.limiting ? 'limiting' : (!r.product && r.after > 0 ? 'excess' : '')}">${r.after}</td>
          </tr>`).join('')}</tbody>
      </table>
      <p style="font-size:var(--fs-xs);color:var(--ink-3);margin:.4rem 0 0">
        🔴 = 限量試劑（先用完，決定產量）；灰底 = 過量剩餘。單位為「分子個數」，換成莫耳只要同乘 6.022×10²³。</p>`;
  }

  /* ================= 面板 ================= */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'ae', name: '原子經濟性', unit: '%', min: 0, max: 100, digits: 1,
      better: 'high', good: 80, bad: 45, note: '反應物原子有多少比例進到目標產物（原則 #2）' },
    { key: 'energy', name: '能耗（相對值）', unit: '', min: 0, max: 100, digits: 0,
      better: 'low', good: 45, bad: 80, note: '以傳統路線為 100 的相對製程能量（原則 #6）' },
    { key: 'ef', name: 'E-factor', unit: 'kg 廢/kg 產', min: 0, max: 3, digits: 3,
      better: 'low', good: 0.3, bad: 1.2, note: '每 1 kg 產品同時產生幾 kg 廢棄物（原則 #1）' },
  ]);

  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：把分子投進反應器，找出限量試劑');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'rxn', label: '選擇反應', value: rxnKey, options: [
          { v: 'ammonia', label: 'N₂ + 3H₂', title: 'N₂ + 3H₂ → 2NH₃ 哈柏法合成氨' },
          { v: 'methane', label: 'CH₄ + 2O₂', title: 'CH₄ + 2O₂ → CO₂ + 2H₂O 甲烷燃燒' },
        ] },
        { type: 'range', key: 'na', label: '反應物 1 分子數', min: 0, max: 24, step: 1, value: counts.a, unit: '個' },
        { type: 'range', key: 'nb', label: '反應物 2 分子數', min: 0, max: 24, step: 1, value: counts.b, unit: '個' },
        { type: 'button', key: 'react', label: '▶ 開始反應', variant: '' },
        { type: 'button', key: 'reset', label: '↺ 回到反應前' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'lim', label: '限量試劑', unit: '', digits: 0 },
        { key: 'ext', label: '可反應次數', unit: '次', digits: 0 },
        { key: 'yield1', label: '主產物生成', unit: '個', digits: 0 },
        { key: 'leftA', label: '剩餘反應物 1', unit: '個', digits: 0 },
        { key: 'leftB', label: '剩餘反應物 2', unit: '個', digits: 0 },
        { key: 'massChk', label: '質量守恆檢查', unit: 'u', digits: 2, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：原子經濟性計算器（布洛芬的兩條合成路徑）');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'route', label: '合成路徑', value: 'boots', options: [
          { v: 'boots', label: 'Boots 傳統（6 步）', title: '1960 年代的六步驟合成，使用化學計量的 AlCl₃' },
          { v: 'bhc', label: 'BHC 觸媒（3 步）', title: '1990 年代 BHC 公司的三步驟催化合成，獲美國總統綠色化學挑戰獎' },
        ] },
        { type: 'check', key: 'recycle', label: '回收副產物乙酸再利用', value: false,
          hint: 'BHC 路線的唯一副產物是乙酸，回收後原子經濟性可達 99%。' },
        { type: 'range', key: 'kg', label: '目標產量', min: 100, max: 5000, step: 100, value: 1000, unit: 'kg' },
        { type: 'range', key: 'price', label: '廢棄物處理成本', min: 5, max: 120, step: 5, value: 40, unit: '元/kg',
          hint: '把環境成本換算成錢，綠色路線的優勢會更明顯。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'steps', label: '反應步驟數', unit: '步', digits: 0 },
        { key: 'ae', label: '原子經濟性', unit: '%', digits: 1 },
        { key: 'waste', label: '產生廢棄物', unit: 'kg', digits: 0 },
        { key: 'feed', label: '需投入物料', unit: 'kg', digits: 0 },
        { key: 'cost', label: '廢棄物處理成本', unit: '元', digits: 0 },
        { key: 'save', label: '相對傳統路線省下', unit: '元', digits: 0, wide: true },
      ]);
    }
    buildSub();
    if (mode === 'classic') { initTray(); } else { initAeChart(); }
    rebuild();
  }

  function onChange(key, v) {
    if (key === 'rxn') { rxnKey = v; reacted = false; buildForScenario(); return; }
    if (key === 'na') { counts.a = v; reacted = false; }
    if (key === 'nb') { counts.b = v; reacted = false; }
    if (key === 'react') { reacted = true; ctx.celebrate(); }
    if (key === 'reset') { reacted = false; }
    rebuild();
  }

  /* ================= 數值更新 ================= */
  function update() {
    if (mode === 'classic') {
      const s = stoich(), R = s.R;
      const limName = s.limiting < 0 ? '恰好完全反應' : R.reactants[s.limiting].zh;
      // 質量守恆檢查：反應前後總原子質量（u）
      const massBefore = counts.a * MW(R.reactants[0].f) + counts.b * MW(R.reactants[1].f);
      const massAfter = s.prod.reduce((t, p) => t + p.n * MW(p.f), 0)
        + s.left[0] * MW(R.reactants[0].f) + s.left[1] * MW(R.reactants[1].f);

      readout({
        lim: limName, ext: s.ext, yield1: s.prod[0].n,
        leftA: s.left[0], leftB: s.left[1],
        massChk: massAfter,
      });
      ctx.setOverlay(`<b>${R.zh}</b><br>${reacted ? '反應後' : '反應前'}
        ｜前後總質量 ${massBefore.toFixed(2)} → ${massAfter.toFixed(2)} u`);
      renderTable();

      // 這個反應本身的原子經濟性（目標產物 / 全部反應物）
      const totalR = R.reactants.reduce((t, r) => t + r.coef * MW(r.f), 0);
      const ae = R.products[0].coef * MW(R.products[0].f) / totalR * 100;
      const wasteMass = totalR - R.products[0].coef * MW(R.products[0].f);
      const ef = wasteMass / (R.products[0].coef * MW(R.products[0].f));
      gauge({ ae, energy: rxnKey === 'ammonia' ? 92 : 30, ef },
        rxnKey === 'ammonia'
          ? `合成氨的<span data-term="原子經濟性">原子經濟性</span>是 <strong>100%</strong>——所有反應物原子都進到 NH₃。
             但它的能耗極高（450 °C、200 atm），提醒我們：<strong>原子經濟性好 ≠ 整體就綠</strong>，還要看能源（原則 #6）。`
          : `燃燒的「目標產物」若定義為 CO₂，AE 為 ${ae.toFixed(1)}%，其餘變成水。
             真正的問題不是原子經濟性，而是產物 CO₂ 本身就是溫室氣體——這在 Ch5、Ch6 會再處理。`);

    } else {
      const n = routeNumbers();
      const bootsEF = IBUPROFEN.boots.eFactor;
      const cost = n.waste * C.values.price;
      const bootsCost = n.kg * bootsEF * C.values.price;
      readout({
        steps: n.steps, ae: n.ae, waste: n.waste, feed: n.feed,
        cost, save: Math.max(0, bootsCost - cost),
      });
      ctx.setOverlay(`<b>${n.d.zh}</b><br>${n.steps} 個步驟｜AE ${n.ae.toFixed(1)}%<br>E-factor ${n.ef.toFixed(2)}`);
      gauge({ ae: n.ae, energy: n.energy, ef: n.ef },
        n.route === 'boots'
          ? `Boots 路線每做 1 kg 布洛芬要丟掉 <strong>${bootsEF.toFixed(2)} kg</strong> 廢棄物，
             而且用掉化學計量的 AlCl₃（用完就變廢鹽）。切到 BHC 路線比比看。`
          : `BHC 路線把 AlCl₃ 換成<span data-term="催化劑">催化劑</span>（HF、Raney Ni、Pd），
             步驟從 6 步縮到 3 步。${C.values.recycle
               ? '回收乙酸後原子經濟性達 <strong>99%</strong>——幾乎沒有原子被浪費。'
               : '再勾選「回收乙酸」看看能推到多高。'}`);
    }
  }

  /* ================= 情境切換 ================= */
  ctx.onScenario(v => {
    mode = v;
    stage.camera.position.set(0, 1.8, mode === 'classic' ? 9.5 : 8.5);
    stage.controls.target.set(0, 0, 0); stage.controls.update();
    buildForScenario();
  });

  buildForScenario();
  stage.start(() => {
    group.children.forEach(o => { if (o.userData.spin) o.rotation.y += 0.006 * o.userData.spin; });
  });

  return { destroy() { stage.dispose(); aeChart && aeChart.destroy(); } };
}
