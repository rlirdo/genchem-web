/* ==========================================================================
   sim/ch02.js — Ch2 原子、分子與離子
   模組 A（3D）：Geiger–Marsden 金箔實驗。α 粒子射向金箔，多數穿透、極少數大角度反彈
   模組 B（2D）：偏折角分布直方圖（用大量虛擬粒子統計，比例為真實比例）
   對照組：Thomson 布丁模型 → 幾乎不可能出現大角度偏折
   綠色情境：都市採礦——氰化法 vs 生物瀝濾

   物理說明（Rutherford 散射，單次散射近似）：
     最近接近距離 d₀ = Z₁Z₂e² / (4πε₀E)
     散射角與碰撞參數 b 的關係：tan(θ/2) = d₀ / (2b)
     偏折超過 θ 的機率 P(Θ>θ) = n·t·π·(d₀/2)²·cot²(θ/2)
     （n 為原子數密度、t 為箔片厚度）
   ========================================================================== */

import { createStage, THREE, atom, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { RUTHERFORD, URBAN_MINING, METALS, CONST } from '../../data/constants.js';

/* 金的原子數密度 n = ρ·N_A / M （/m³） */
const N_AU = METALS.Au.rho * 1e6 * CONST.NA / METALS.Au.M;   // g/cm³ → g/m³ → atoms/m³
const K_COULOMB_MeVfm = 1.43996;                             // e²/(4πε₀) = 1.44 MeV·fm

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 3.2, 11], fov: 46, minDistance: 4, maxDistance: 30,
    ariaLabel: 'α 粒子射向金箔的 3D 散射實驗',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  /* ---------------- 統計 ---------------- */
  const BINS = 36;                     // 每 5° 一格
  let hist = new Array(BINS).fill(0);
  let stat = { total: 0, straight: 0, small: 0, mid: 0, back: 0 };

  function resetStat() { hist = new Array(BINS).fill(0); stat = { total: 0, straight: 0, small: 0, mid: 0, back: 0 }; }

  /** 依模型抽一個偏折角（度）*/
  function sampleAngle() {
    const E = C.values.energy;                        // MeV
    const t_m = C.values.thick * 1e-9;                // nm → m
    if (C.values.model === 'thomson') {
      // 布丁模型：正電荷均勻散開，最大偏折角約 0.02°（教科書量級）
      return Math.abs(gauss()) * 0.02;
    }
    const d0_fm = 2 * 79 * K_COULOMB_MeVfm / E;       // α (Z=2) 打 Au (Z=79)
    const d0_m = d0_fm * 1e-15;
    const K = N_AU * t_m * Math.PI * (d0_m / 2) ** 2; // = P(Θ>90°)
    const thMin = 0.5 * Math.PI / 180;
    const Pmin = K / Math.tan(thMin / 2) ** 2;        // P(Θ > 0.5°)
    if (Math.random() > Math.min(1, Pmin)) return Math.random() * 0.5;   // 幾乎直行
    const r = Math.random();
    const th = 2 * Math.atan(Math.tan(thMin / 2) / Math.sqrt(r));
    return Math.min(180, th * 180 / Math.PI);
  }
  function gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }

  function tally(deg) {
    stat.total++;
    if (deg < 1) stat.straight++;
    else if (deg < 10) stat.small++;
    else if (deg < 90) stat.mid++;
    else stat.back++;
    hist[Math.min(BINS - 1, Math.floor(deg / 5))]++;
  }

  /* ---------------- 3D：金箔與粒子 ---------------- */
  let foil = null, beam = [];
  const MAX_TRACKS = 46;

  function buildFoil() {
    const g = new THREE.Group();
    // 金箔：三層原子（示意，不按真實比例——真實箔片約 1000 層原子）
    const geo = new THREE.SphereGeometry(0.16, 12, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xFFC93C, roughness: .3, metalness: .7 });
    const step = 0.42, nx = 13, ny = 9, nz = 3;
    const inst = new THREE.InstancedMesh(geo, mat, nx * ny * nz);
    const d = new THREE.Object3D();
    let i = 0;
    for (let x = 0; x < nz; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nx; z++) {
      d.position.set((x - 1) * step, (y - (ny - 1) / 2) * step, (z - (nx - 1) / 2) * step);
      d.updateMatrix(); inst.setMatrixAt(i++, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);

    // 原子核（極小的紅點）——強調核與原子的尺度差
    const nucGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const nucMat = new THREE.MeshBasicMaterial({ color: 0xC6412A });
    const nuc = new THREE.InstancedMesh(nucGeo, nucMat, nx * ny * nz);
    i = 0;
    for (let x = 0; x < nz; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nx; z++) {
      d.position.set((x - 1) * step, (y - (ny - 1) / 2) * step, (z - (nx - 1) / 2) * step);
      d.updateMatrix(); nuc.setMatrixAt(i++, d.matrix);
    }
    nuc.instanceMatrix.needsUpdate = true;
    g.add(nuc);

    const t = textSprite('金箔（示意：3 層原子）', { scale: 0.008 });
    t.position.set(0, 2.4, 0); g.add(t);
    return g;
  }

  function spawn() {
    const deg = sampleAngle();
    tally(deg);
    if (C.values.onlyBig && deg < 20) return null;         // 慢動作只追蹤大角度事件
    if (beam.length >= MAX_TRACKS) return null;
    const y0 = (Math.random() - .5) * 2.6, z0 = (Math.random() - .5) * 3.4;
    const p = {
      deg,
      pos: new THREE.Vector3(-7, y0, z0),
      dir: new THREE.Vector3(1, 0, 0),
      scattered: false,
      mesh: atom(0.11, deg >= 90 ? 0xC6412A : deg >= 10 ? 0xFF7A59 : 0x1E9EB3, 10,
        { emissive: deg >= 90 ? 0xC6412A : 0x1E9EB3, emissiveIntensity: .6 }),
      trail: null, pts: [],
    };
    world.add(p.mesh);
    if (C.values.trail) {
      const geo = new THREE.BufferGeometry().setFromPoints([p.pos.clone(), p.pos.clone()]);
      p.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: deg >= 90 ? 0xC6412A : deg >= 10 ? 0xFF7A59 : 0x9CC9D6, transparent: true, opacity: .75,
      }));
      world.add(p.trail);
      p.pts = [p.pos.clone()];
    }
    beam.push(p);
    return p;
  }

  function killParticle(p) {
    world.remove(p.mesh);
    p.mesh.geometry.dispose();
    if (p.trail) { world.remove(p.trail); p.trail.geometry.dispose(); }
  }

  /* ---------------- 綠色情境的 3D ---------------- */
  function buildMiningScene() {
    const src = C.values.src;                     // 'pcb' | 'ore'
    const grade = src === 'pcb' ? URBAN_MINING.pcb_g_per_t : URBAN_MINING.ore_g_per_t;
    // 礦源堆（方塊）與回收出來的金塊（大小 ∝ 金含量）
    const pile = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 1.7, 5),
      new THREE.MeshStandardMaterial({ color: src === 'pcb' ? 0x4A7C59 : 0x9A8B7A, roughness: .9 })
    );
    pile.position.set(-3.1, -0.7, 0); world.add(pile);
    world.add(placeLabel(src === 'pcb' ? '廢電路板（都市礦山）' : '原生金礦石', -3.1, 1.0));

    const r = Math.cbrt(grade / 250) * 0.85;
    const gold = new THREE.Mesh(
      new THREE.IcosahedronGeometry(Math.max(0.12, r), 1),
      new THREE.MeshStandardMaterial({ color: 0xFFC93C, roughness: .18, metalness: .9 })
    );
    gold.position.set(3.1, -0.4, 0); world.add(gold);
    world.add(placeLabel(`每公噸可得 ${grade} g 金`, 3.1, 1.0));

    // 中間的製程箱
    const proc = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({
        color: C.values.proc === 'cyanide' ? 0xFF7A59 : 0x3FA34D, roughness: .4,
        transparent: true, opacity: .85,
      })
    );
    proc.position.set(0, -0.3, 0); proc.userData.spin = 1; world.add(proc);
    world.add(placeLabel(C.values.proc === 'cyanide' ? '氰化法浸出' : '生物瀝濾（微生物冶金）', 0, 1.0));

    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 40),
      new THREE.MeshStandardMaterial({ color: 0xE7F3EC, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.55; world.add(floor);
  }
  function placeLabel(text, x, y) {
    const s = textSprite(text, { scale: 0.0072 });
    s.position.set(x, y, 0); return s;
  }

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      if (o.geometry) o.geometry.dispose();
      world.remove(o);
    }
    beam = []; foil = null;
  }

  /* ---------------- 直方圖 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-sub-title>
      📊 偏折角分布（比例為真實比例，以大量虛擬粒子統計）</div>
    <canvas id="hist" aria-label="偏折角分布直方圖"></canvas>`;
  const chart = new Chart2D(ctx.subEl.querySelector('#hist'), {
    height: 180, pad: { l: 56, r: 14, t: 14, b: 34 },
    xLabel: '偏折角 θ (°)', yLabel: '粒子數（對數）',
  });
  chart.onResize = drawChart;

  function drawChart() {
    if (mode !== 'classic') { drawMiningChart(); return; }
    const maxV = Math.max(1, ...hist);
    const logMax = Math.log10(maxV) + 0.4;
    chart.clear().setRange(0, 180, 0, Math.max(1, logMax))
      .axes({ xTicks: [0, 45, 90, 135, 180], yTicks: 4, yFmt: v => v < 0.05 ? '1' : '10^' + v.toFixed(0) });
    chart.hist(hist.map(v => v > 0 ? Math.log10(v) + 0.001 : 0),
      { color: C && C.values.model === 'thomson' ? 'rgba(255,122,89,.8)' : 'rgba(30,158,179,.8)' });
    chart.vline(90, { color: PALETTE.coralDeep, label: '>90° 為「反彈」' });
    if (C && C.values.model === 'thomson') {
      chart.label(90, logMax * 0.62,
        'Thomson 布丁模型：全部集中在 0° 附近，永遠不會反彈', { color: PALETTE.coralDeep });
    }
  }

  function drawMiningChart() {
    const P = URBAN_MINING[C.values.proc === 'cyanide' ? 'cyanide' : 'bioleach'];
    const O = URBAN_MINING.cyanide, B = URBAN_MINING.bioleach;
    chart.xLabel = ''; chart.yLabel = '相對值';
    chart.clear().setRange(0, 6, 0, 110).axes({ xTicks: [], yTicks: 5 });
    chart.bars([
      { label: '氰化法\n能耗', value: O.energy, color: PALETTE.coralDeep },
      { label: '生物瀝濾\n能耗', value: B.energy, color: PALETTE.leafDeep },
      { label: '氰化法\n毒性×20', value: O.toxicity * 20, color: PALETTE.coral },
      { label: '生物瀝濾\n毒性×20', value: B.toxicity * 20, color: PALETTE.leaf },
      { label: '氰化法\n回收率 %', value: O.recovery, color: '#E3CFC8' },
      { label: '生物瀝濾\n回收率 %', value: B.recovery, color: '#CFE3D4' },
    ], { fmt: v => v.toFixed(0) });
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'energy', name: '能耗（相對值）', unit: '', min: 0, max: 110, digits: 0,
      better: 'low', good: 35, bad: 80, note: '以氰化法為 100 的相對能量投入（原則 #6）' },
    { key: 'tox', name: '毒性等級', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '製程藥劑與廢液的危害程度（原則 #3）' },
    { key: 'eff', name: '資源效率', unit: 'g 金/公噸', min: 0, max: 260, digits: 1,
      better: 'high', good: 100, bad: 10, note: '每處理一公噸物料實際回收到的金（原則 #1）' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A：α 粒子撞金箔（Geiger–Marsden 實驗）');
      ctx.subEl.querySelector('[data-sub-title]').textContent = '📊 偏折角分布（比例為真實比例，以大量虛擬粒子統計）';
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'model', label: '原子模型', value: 'rutherford', options: [
          { v: 'rutherford', label: 'Rutherford 核式', title: '正電荷集中在極小的原子核' },
          { v: 'thomson', label: 'Thomson 布丁', title: '正電荷均勻散布在整顆原子中' },
        ] },
        { type: 'range', key: 'rate', label: '每秒發射粒子數', min: 0, max: 4000, step: 50, value: 800, unit: '個/秒' },
        { type: 'range', key: 'energy', label: 'α 粒子能量', min: 2, max: 12, step: 0.5, value: 5, unit: 'MeV',
          hint: '能量越高，最近接近距離越小 → 需要更近才會大角度偏折。' },
        { type: 'range', key: 'thick', label: '金箔厚度', min: 100, max: 3000, step: 50, value: 400, unit: 'nm',
          hint: 'Geiger 與 Marsden 用的是約 400 nm（0.4 µm）的金箔。' },
        { type: 'check', key: 'onlyBig', label: '慢動作：只追蹤 >20° 的偏折事件', value: false,
          hint: '真實比例下大角度事件極罕見，勾這裡才看得到；統計圖仍是真實比例。' },
        { type: 'check', key: 'trail', label: '顯示粒子軌跡', value: true },
        { type: 'button', key: 'clear', label: '↺ 清除統計' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'total', label: '累計發射', unit: '個', digits: 0 },
        { key: 'straight', label: '幾乎直行 (<1°)', unit: '%', digits: 2 },
        { key: 'small', label: '小角偏折 1–10°', unit: '%', digits: 2 },
        { key: 'mid', label: '中角 10–90°', unit: '%', digits: 3 },
        { key: 'back', label: '反彈 >90°', unit: '個', digits: 0 },
        { key: 'ratio', label: '反彈比例', unit: '', digits: 0, wide: true },
        { key: 'd0', label: '最近接近距離 d₀', unit: 'fm', digits: 1, wide: true },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：都市採礦——同樣要拿到金，兩條路差多少？');
      ctx.subEl.querySelector('[data-sub-title]').textContent = '📊 氰化法 vs 生物瀝濾：能耗、毒性與回收率';
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'src', label: '金的來源', value: 'pcb', options: [
          { v: 'pcb', label: '廢電路板', title: '都市礦山：每公噸約 200–350 g 金' },
          { v: 'ore', label: '原生金礦石', title: '每公噸約 1–5 g 金' },
        ] },
        { type: 'seg', key: 'proc', label: '提取製程', value: 'cyanide', options: [
          { v: 'cyanide', label: '氰化法', title: '以氰化物錯合溶出金，快但劇毒' },
          { v: 'bio', label: '生物瀝濾', title: '利用微生物代謝物溶出金，慢但低毒' },
        ] },
        { type: 'range', key: 'tons', label: '處理量', min: 1, max: 500, step: 1, value: 100, unit: '公噸' },
        { type: 'range', key: 'days', label: '可接受的處理天數', min: 1, max: 40, step: 1, value: 14, unit: '天',
          hint: '生物瀝濾需要時間讓微生物工作；時間不夠回收率會下降。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'grade', label: '原料含金量', unit: 'g/公噸', digits: 0 },
        { key: 'gold', label: '實際回收金', unit: 'g', digits: 1 },
        { key: 'rec', label: '回收率', unit: '%', digits: 1 },
        { key: 'energy', label: '相對能耗', unit: '', digits: 0 },
        { key: 'waste', label: '需處理廢料', unit: '公噸', digits: 1 },
        { key: 'cmp', label: '相當於開採原生礦', unit: '公噸', digits: 0, wide: true },
      ]);
    }
    clearWorld();
    resetStat();
    if (mode === 'classic') { foil = buildFoil(); world.add(foil); } else buildMiningScene();
    drawChart();
    update();
  }

  function onChange(key) {
    if (key === 'clear') { resetStat(); drawChart(); }
    if (key === 'model' || key === 'energy' || key === 'thick') { resetStat(); drawChart(); }
    if (key === 'src' || key === 'proc') { clearWorld(); buildMiningScene(); drawChart(); }
    update();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    if (mode === 'classic') {
      const E = C.values.energy;
      const d0 = 2 * 79 * K_COULOMB_MeVfm / E;
      const t = Math.max(1, stat.total);
      readout({
        total: stat.total,
        straight: stat.straight / t * 100,
        small: stat.small / t * 100,
        mid: stat.mid / t * 100,
        back: stat.back,
        ratio: stat.back ? `約 1 / ${Math.round(stat.total / stat.back).toLocaleString()}` : '尚未出現',
        d0,
      });
      ctx.setOverlay(
        `<b>${C.values.model === 'thomson' ? 'Thomson 布丁模型' : 'Rutherford 核式模型'}</b><br>
         α ${E} MeV｜金箔 ${C.values.thick} nm<br>
         金核半徑 ≈ ${RUTHERFORD.nucleus_r_fm} fm　原子半徑 ${RUTHERFORD.atom_r_pm} pm<br>
         核 : 原子 ≈ 1 : ${Math.round(RUTHERFORD.atom_r_pm * 1000 / RUTHERFORD.nucleus_r_fm).toLocaleString()}`);
      // 這一模組的綠色指標沿用「分析方法」的角度：同位素／散射分析屬於非破壞性檢測
      gauge({ energy: 18, tox: 0.5, eff: 0 },
        `散射分析是<strong>非破壞性檢測</strong>：不用溶解樣品、不產生化學廢液就能知道材料裡有什麼。
         這正是原則 #11「即時分析防污染」的精神。切到綠色情境，看看同樣要拿到金，兩條路差多少。`);

    } else {
      const src = C.values.src;
      const grade = src === 'pcb' ? URBAN_MINING.pcb_g_per_t : URBAN_MINING.ore_g_per_t;
      const isCy = C.values.proc === 'cyanide';
      const P = isCy ? URBAN_MINING.cyanide : URBAN_MINING.bioleach;
      // 生物瀝濾的回收率隨可用天數上升（一階飽和），氰化法一天內就到位
      const days = C.values.days;
      const rec = isCy ? P.recovery : P.recovery * (1 - Math.exp(-days / 6));
      const gold = grade * C.values.tons * rec / 100;
      const waste = C.values.tons * (1 - 0.002);
      // 要拿到同樣多的金，需要開採多少原生礦？
      const cmp = gold / (URBAN_MINING.ore_g_per_t * URBAN_MINING.cyanide.recovery / 100);

      readout({ grade, gold, rec, energy: P.energy, waste, cmp });
      ctx.setOverlay(
        `<b>${src === 'pcb' ? '廢電路板' : '原生金礦石'}｜${isCy ? '氰化法' : '生物瀝濾'}</b><br>
         含金 ${grade} g/公噸（概略值）<br>
         ${isCy ? '製程約 1 天' : `培養 ${days} 天`}`);
      gauge({ energy: P.energy, tox: P.toxicity, eff: grade * rec / 100 },
        isCy
          ? `氰化法快、回收率高（95%），但氰化物<strong>劇毒</strong>，且尾礦壩一旦潰決會造成重大污染
             （1999 年羅馬尼亞 Baia Mare 事件是著名案例）。這是原則 #3 與 #12 的反面教材。`
          : `<span data-term="生物瀝濾">生物瀝濾</span>用微生物代謝物取代劇毒藥劑，能耗只剩約 30%、毒性等級由 5 降到 1。
             代價是<strong>慢</strong>——把「可接受的處理天數」拉到 30 天以上，回收率才追得上來。
             這是典型的綠色化學權衡：用時間換毒性。`);
    }
  }

  /* ---------------- 動畫 ---------------- */
  let acc = 0;
  stage.start(({ dt }) => {
    if (mode !== 'classic') {
      world.children.forEach(o => { if (o.userData.spin) o.rotation.y += dt * 0.6; });
      return;
    }
    // 依速率補充粒子：先做統計（虛擬粒子），再視情況產生看得見的軌跡
    acc += C.values.rate * dt;
    const n = Math.floor(acc); acc -= n;
    for (let i = 0; i < n; i++) {
      if (beam.length < MAX_TRACKS && (i % Math.max(1, Math.floor(C.values.rate / 40)) === 0)) spawn();
      else { tally(sampleAngle()); }
    }
    if (n > 0) { drawChart(); update(); }

    for (let i = beam.length - 1; i >= 0; i--) {
      const p = beam[i];
      p.pos.addScaledVector(p.dir, dt * 9);
      if (!p.scattered && p.pos.x >= 0) {
        p.scattered = true;
        const th = p.deg * Math.PI / 180;
        const phi = Math.random() * Math.PI * 2;
        p.dir.set(Math.cos(th), Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi)).normalize();
        if (p.trail) p.pts.push(p.pos.clone());
      }
      p.mesh.position.copy(p.pos);
      if (p.trail) {
        const pts = [...p.pts, p.pos.clone()];
        p.trail.geometry.setFromPoints(pts);
      }
      if (p.pos.length() > 13) { killParticle(p); beam.splice(i, 1); }
    }
  });

  ctx.onScenario(v => {
    mode = v;
    stage.camera.position.set(0, mode === 'classic' ? 3.2 : 2.4, mode === 'classic' ? 11 : 10);
    stage.controls.target.set(0, 0, 0); stage.controls.update();
    buildForScenario();
  });

  buildForScenario();
  return { destroy() { stage.dispose(); chart.destroy(); } };
}
