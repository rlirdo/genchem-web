/* ==========================================================================
   assets/js/sim/ch01-ar.js — Ch1 專用的 AR 內容與 HUD
   （AR 引擎本身在 assets/js/ar/ar-stage.js，與本章無關、可被其他章重用）

   AR 場景內容：
     ‧ 邊長 0.15 m 的半透明立方體＝固定體積 V（15 cm 立方 = 3375 cm³）
     ‧ 內部依所選金屬的晶格（Au/Al = FCC、Fe = BCC、Ti = HCP 近似）填入球體
     ‧ 立方體上方一片面向相機的資訊牌（Sprite + CanvasTexture）
     ‧ 綠色化學模式：左 Al（輕量化車件）／右 Fe（傳統鋼製車件），並排比較減重與減碳

   ★ 誠實標註：畫面上的球體是「取樣示意」，總數上限 400 顆；
     真實的原子數由 N = ρV/M × N_A 計算後顯示在資訊牌上（10²⁶ 量級）。
     兩者的比例（放大倍率）也會標示出來，不讓學生誤以為看到的就是真實顆數。
   ========================================================================== */

import * as THREE from 'three';
import { METALS, LIGHTWEIGHT, FUEL_CO2, CONST } from '../../data/constants.js';

/* ---------------- 常數 ---------------- */
export const CUBE_M = 0.15;                       // AR 立方體邊長（公尺）
const CUBE_CM = CUBE_M * 100;                     // = 15 cm
const V_CM3 = CUBE_CM ** 3;                       // = 3375 cm³
export const MAX_SPHERES = 400;                   // 效能保護：球體總數上限
const TI_C_PM = 468.3;                            // Ti 的 c 軸（HCP）

/* 車輛換算的基準假設（與桌機版 sim/ch01.js 的綠色情境一致，方便對照）
   來源：白車身結構體積 0.04 m³（一般乘用車 0.03–0.05）、整車 1400 kg、
        基準油耗 8.0 L/100km、減重 1% → 省油 0.7%（減重 10% → 省油 6–8% 之中位）、
        汽油 2.31 kg CO₂/L（由 IPCC 缺省排放因子與汽油密度換算）、年行駛 15,000 km */
const CAR = {
  bodyVol_m3: 0.04, mass_kg: 1400, baseFuel_L100: 8.0,
  km_per_year: 15000, co2_per_L: FUEL_CO2.gasoline_kg_per_L,
  weightToFuelPct: FUEL_CO2.weightToFuelPct,
};

/* ==========================================================================
   晶格幾何
   （與 sim/ch01.js 內的同名函式邏輯相同；該處定義在 init() 內部無法匯出，
     為了不重構既有程式碼，這裡保留一份獨立實作。修改晶格資料請改 data/constants.js）
   ========================================================================== */
function cellInfo(sym) {
  const m = METALS[sym];
  const a = m.a_pm / 1000;                                     // nm
  if (m.lattice === 'FCC') return { dims: [a, a, a], basis: [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]] };
  if (m.lattice === 'BCC') return { dims: [a, a, a], basis: [[0, 0, 0], [.5, .5, .5]] };
  const c = TI_C_PM / 1000;                                    // HCP（Ti）：以正交超晶胞近似，內含 4 顆原子
  return { dims: [a, Math.sqrt(3) * a, c], basis: [[0, 0, 0], [.5, .5, 0], [.5, 1 / 6, .5], [0, 2 / 3, .5]] };
}

/** 在球體預算內，決定每軸要畫幾個晶胞（效能保護：n³ × Z ≤ budget）*/
function cellsWithinBudget(sym, budget) {
  const Z = cellInfo(sym).basis.length;
  const n = Math.floor(Math.cbrt(budget / Z));
  return Math.max(2, n);                                       // 至少 2×2×2，否則看不出堆積
}

/** 該金屬填滿 0.15 m 立方時的真實物理量 */
export function cubeFacts(sym, rhoOverride) {
  const m = METALS[sym];
  const rho = rhoOverride ?? m.rho;                            // g/cm³
  const mass_g = rho * V_CM3;
  const mol = mass_g / m.M;
  const atoms = mol * CONST.NA;
  return { sym, zh: m.zh, rho, mass_g, mol, atoms, V_cm3: V_CM3, d: mass_g / V_CM3 };
}

/* ==========================================================================
   3D 元件
   ========================================================================== */

/** 半透明立方體外框（代表固定體積 V）*/
function makeCubeShell(edge, color) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(edge, edge, edge),
    new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity: 0.07, roughness: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(edge, edge, edge)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  g.add(glass, edges);
  return g;
}

/**
 * 依金屬的晶格在立方體內填球
 * @returns {{ mesh: THREE.InstancedMesh, spheres: number, magnification: number }}
 */
function makeAtomFill(sym, edge, budget) {
  const m = METALS[sym];
  const { dims, basis } = cellInfo(sym);
  const n = cellsWithinBudget(sym, budget);

  // 這 n×n×n 個晶胞的實際尺寸（nm）→ 放大到 AR 立方體的邊長
  const realDims = dims.map(d => d * n);                       // nm
  const scale = edge / Math.max(...realDims);                  // 公尺 / nm
  const rM = (m.r_pm / 1000) * scale;                          // 球體半徑（公尺），保留真實堆積比例

  const pts = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    basis.forEach(b => pts.push([(i + b[0]) * dims[0], (j + b[1]) * dims[1], (k + b[2]) * dims[2]]));
  }
  const half = realDims.map(d => d / 2);

  const geo = new THREE.SphereGeometry(1, 14, 12);
  const mat = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.3, metalness: 0.55 });
  const inst = new THREE.InstancedMesh(geo, mat, pts.length);
  const dummy = new THREE.Object3D();
  pts.forEach((p, i) => {
    dummy.position.set((p[0] - half[0]) * scale, (p[1] - half[1]) * scale, (p[2] - half[2]) * scale);
    dummy.scale.setScalar(rM);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;

  return { mesh: inst, spheres: pts.length, magnification: scale * 1e9, cells: n };
}

/**
 * 面向相機的資訊牌（Sprite + CanvasTexture）
 * @param lines [{ t:字串, s:'title'|'big'|'body'|'note', c:顏色 }]
 * @param opts  { widthM: 牌子在 AR 中的寬度（公尺）, bar: {ratio, label} }
 */
function makeBoard(lines, opts = {}) {
  const W = 640, PAD = 26;
  const lineH = { title: 46, big: 52, body: 34, note: 26 };
  const font = {
    title: '700 34px "Noto Sans TC", system-ui, sans-serif',
    big: '700 40px "Noto Sans TC", system-ui, sans-serif',
    body: '400 27px "Noto Sans TC", system-ui, sans-serif',
    note: '400 20px "Noto Sans TC", system-ui, sans-serif',
  };
  const barH = opts.bar ? 62 : 0;
  const H = PAD * 2 + lines.reduce((s, l) => s + lineH[l.s || 'body'], 0) + barH;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // 圓角白底（半透明，讓實景透一點出來但字仍清楚）
  const r = 26;
  c.fillStyle = 'rgba(255,255,255,.94)';
  c.beginPath();
  c.moveTo(r, 0); c.arcTo(W, 0, W, H, r); c.arcTo(W, H, 0, H, r);
  c.arcTo(0, H, 0, 0, r); c.arcTo(0, 0, W, 0, r); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(63,163,77,.55)'; c.lineWidth = 3; c.stroke();

  let y = PAD;
  c.textBaseline = 'top';
  lines.forEach(l => {
    const s = l.s || 'body';
    c.font = font[s];
    c.fillStyle = l.c || (s === 'note' ? '#5E7A6F' : s === 'title' ? '#2E7D3A' : '#123B2E');
    c.textAlign = l.align || 'left';
    const x = l.align === 'center' ? W / 2 : PAD;
    c.fillText(l.t, x, y);
    y += lineH[s];
  });

  // 由紅漸綠的比較長條
  if (opts.bar) {
    const bx = PAD, bw = W - PAD * 2, by = y + 8, bh = 26;
    const grad = c.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#C6412A'); grad.addColorStop(0.5, '#FFC93C'); grad.addColorStop(1, '#3FA34D');
    c.fillStyle = '#EDF3EF';
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = grad;
    c.fillRect(bx, by, bw * Math.max(0.02, Math.min(1, opts.bar.ratio)), bh);
    c.strokeStyle = 'rgba(18,59,46,.25)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
    if (opts.bar.label) {
      c.font = font.note; c.fillStyle = '#123B2E'; c.textAlign = 'center';
      c.fillText(opts.bar.label, W / 2, by + bh + 4);
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const wM = opts.widthM || 0.26;
  sp.scale.set(wM, wM * H / W, 1);
  sp.renderOrder = 10;
  return sp;
}

/* ==========================================================================
   對外：建立 AR 內容
   state = { metal:'Au'|'Al'|'Fe'|'Ti', green:boolean }
   ========================================================================== */
export function buildCh01ARContent(state) {
  const g = new THREE.Group();

  if (!state.green) {
    /* ---------- 一般模式：單一立方體 ---------- */
    const f = cubeFacts(state.metal);
    const fill = makeAtomFill(state.metal, CUBE_M, MAX_SPHERES);
    const shell = makeCubeShell(CUBE_M, 0x1E9EB3);
    shell.add(fill.mesh);
    shell.position.y = CUBE_M / 2;                 // 讓立方體「站」在偵測到的平面上
    g.add(shell);

    const board = makeBoard([
      { t: `${f.sym}　${f.zh}　（${METALS[state.metal].lattice}）`, s: 'title' },
      { t: `體積 V = ${V_CM3.toLocaleString()} cm³（15 cm 立方）`, s: 'body' },
      { t: `原子數 N ≈ ${f.atoms.toExponential(2).replace('e+', '×10^')} 顆`, s: 'body' },
      { t: `質量 m = ${f.mass_g.toLocaleString(undefined, { maximumFractionDigits: 0 })} g（${(f.mass_g / 1000).toFixed(1)} kg）`, s: 'body' },
      { t: `密度 d = m/V = ${f.d.toFixed(2)} g·cm⁻³`, s: 'big' },
      { t: `畫面球體 ${fill.spheres} 顆＝取樣示意（${fill.cells}×${fill.cells}×${fill.cells} 個晶胞，約放大 ${fill.magnification.toExponential(1).replace('e+', '×10^')} 倍）`, s: 'note' },
    ], { widthM: 0.30 });
    board.position.set(0, CUBE_M + 0.13, 0);
    g.add(board);

  } else {
    /* ---------- 綠色化學模式：Al（左）vs Fe（右），相距 0.25 m ---------- */
    const budget = Math.floor(MAX_SPHERES / 2);    // 兩個立方體平分球體預算
    const half = 0.25 / 2;

    const mk = (sym, x, rho, caption, tint) => {
      const fill = makeAtomFill(sym, CUBE_M, budget);
      const shell = makeCubeShell(CUBE_M, tint);
      shell.add(fill.mesh);
      shell.position.set(x, CUBE_M / 2, 0);
      g.add(shell);
      const mass = rho * V_CM3;
      const tag = makeBoard([
        { t: caption, s: 'title', align: 'center' },
        { t: `${(mass / 1000).toFixed(2)} kg`, s: 'big', align: 'center' },
        { t: `ρ = ${rho} g·cm⁻³`, s: 'note', align: 'center' },
      ], { widthM: 0.15 });
      tag.position.set(x, CUBE_M + 0.055, 0);
      g.add(tag);
      return { spheres: fill.spheres, mass };
    };

    const al = mk('Al', -half, LIGHTWEIGHT.Al.rho, 'Al 輕量化車件', 0x3FA34D);
    const fe = mk('Fe', +half, LIGHTWEIGHT.Fe.rho, 'Fe 傳統鋼製車件', 0xC6412A);

    /* ---- 換算：一個 0.15 m 立方 → 整車白車身 ---- */
    const cubes = CAR.bodyVol_m3 / (CUBE_M ** 3);              // ≈ 11.85 塊
    const dMass_g = fe.mass - al.mass;                          // 單塊質量差（g）
    const carSave_kg = dMass_g / 1000 * cubes;                  // 整車減重（kg）
    const pctLighter = carSave_kg / CAR.mass_kg * 100;          // 占整車質量比例
    const fuel_L100 = CAR.baseFuel_L100 * pctLighter * CAR.weightToFuelPct / 100;
    const co2_year = fuel_L100 * (CAR.km_per_year / 100) * CAR.co2_per_L;
    const reduceRatio = dMass_g / fe.mass;                      // 減重比例（0–1）

    const board = makeBoard([
      { t: '🌿 同體積比一比：換材料，車就變輕', s: 'title' },
      { t: `質量差　${dMass_g.toLocaleString(undefined, { maximumFractionDigits: 0 })} g（Al 比 Fe 輕 ${(reduceRatio * 100).toFixed(1)}%）`, s: 'body' },
      { t: `→ 每輛車減重　${carSave_kg.toFixed(0)} kg`, s: 'body' },
      { t: `→ 每 100 km 省油　${fuel_L100.toFixed(2)} L`, s: 'body' },
      { t: `→ 年 CO₂ 減排　${co2_year.toFixed(0)} kg`, s: 'big', c: '#2E7D3A' },
      { t: `假設：白車身 ${CAR.bodyVol_m3} m³（≈${cubes.toFixed(1)} 塊）、整車 ${CAR.mass_kg} kg、`, s: 'note' },
      { t: `基準油耗 ${CAR.baseFuel_L100} L/100km、減重 1%→省油 ${CAR.weightToFuelPct}%、汽油 ${CAR.co2_per_L} kg CO₂/L、年行駛 ${CAR.km_per_year.toLocaleString()} km`, s: 'note' },
    ], {
      widthM: 0.40,
      bar: { ratio: reduceRatio, label: `紅（鋼，重）→ 綠（鋁，輕）：減重 ${(reduceRatio * 100).toFixed(1)}%` },
    });
    board.position.set(0, CUBE_M + 0.19, 0);
    g.add(board);
  }

  return g;
}

/* ==========================================================================
   對外：建立 HUD（控制按鈕與說明），交給 ar-stage.js 疊在畫面上
   onChange(newState) 由呼叫端負責重建 AR 內容
   ========================================================================== */
export function buildCh01ARHud(state, onChange) {
  const hud = document.createElement('div');
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'AR 控制面板');

  const metals = Object.keys(METALS);             // Au / Al / Fe / Ti
  hud.innerHTML = `
    <div data-row="metal" style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.5rem">
      ${metals.map(k => `
        <button type="button" data-metal="${k}"
          aria-label="切換到${METALS[k].zh}"
          style="flex:1 1 auto;min-width:3.4rem;font:700 .82rem/1 inherit;padding:.5rem .4rem;
                 border-radius:999px;border:1.5px solid var(--line,#D9E8DF);cursor:pointer;
                 background:#fff;color:var(--ink-2,#3D5B50)">${k}<br>
          <span style="font-weight:400;font-size:.72rem">${METALS[k].zh}</span></button>`).join('')}
    </div>
    <button type="button" data-green
      aria-label="切換綠色化學：同體積比一比"
      style="width:100%;font:700 .84rem/1 inherit;padding:.6rem;border-radius:999px;border:0;
             cursor:pointer;background:var(--leaf,#3FA34D);color:#fff;margin-bottom:.45rem">
      🌿 綠色化學：同體積比一比</button>
    <div data-note style="font-size:.72rem;color:var(--ink-3,#5E7A6F);line-height:1.55"></div>`;

  const metalRow = hud.querySelector('[data-row="metal"]');
  const greenBtn = hud.querySelector('[data-green]');
  const note = hud.querySelector('[data-note]');

  function paint() {
    hud.querySelectorAll('[data-metal]').forEach(b => {
      const on = b.dataset.metal === state.metal && !state.green;
      b.style.background = on ? 'var(--ocean,#1E9EB3)' : '#fff';
      b.style.color = on ? '#fff' : 'var(--ink-2,#3D5B50)';
      b.style.borderColor = on ? 'var(--ocean,#1E9EB3)' : 'var(--line,#D9E8DF)';
      b.setAttribute('aria-pressed', String(on));
    });
    metalRow.style.opacity = state.green ? '.45' : '1';
    metalRow.style.pointerEvents = state.green ? 'none' : 'auto';
    greenBtn.style.background = state.green ? 'var(--leaf-deep,#2E7D3A)' : 'var(--leaf,#3FA34D)';
    greenBtn.textContent = state.green ? '↩ 回到單一金屬模式' : '🌿 綠色化學：同體積比一比';
    greenBtn.setAttribute('aria-pressed', String(state.green));

    note.innerHTML = state.green
      ? `<strong style="color:var(--leaf-deep,#2E7D3A)">綠色化學原則 #6 提升能源效率</strong>：
         同樣的體積換成密度較低的材料，整車變輕、油耗下降、碳排跟著下降。<br>
         資料來源：密度 CRC Handbook 97th ed.；減重 10%→省油 6–8%（取 7%）為汽車業經驗值；
         汽油 2.31 kg CO₂/L 由 IPCC 缺省排放因子換算。此處只計使用階段，未含材料製造的隱含碳
         （完整生命週期比較請看網頁版的綠色情境）。`
      : `立方體邊長 15 cm、體積 3375 cm³ 固定不變；換金屬只換「裡面裝什麼」。<br>
         畫面球體為<strong>取樣示意</strong>（上限 ${MAX_SPHERES} 顆），資訊牌上的原子數才是真實數量。<br>
         資料來源：原子量、密度、晶格常數、原子半徑皆取自 CRC Handbook of Chemistry and Physics, 97th ed.`;
  }

  hud.querySelectorAll('[data-metal]').forEach(b => {
    b.addEventListener('click', () => {
      if (state.green) return;
      state.metal = b.dataset.metal;
      paint(); onChange(state);
    });
  });
  greenBtn.addEventListener('click', () => {
    state.green = !state.green;
    paint(); onChange(state);
  });

  paint();
  return hud;
}
