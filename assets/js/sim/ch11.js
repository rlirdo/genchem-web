/* ==========================================================================
   sim/ch11.js — Ch11 溶液的性質
   模組 A（3D）：液面微觀視角——溶質佔據表面阻礙蒸發 → 蒸氣壓下降（拉午耳定律）
   模組 B（3D）：半透膜兩側，水分子雙向穿越、溶質被擋 → 滲透壓 π = MRT，可加壓觸發逆滲透
   綠色情境：海水淡化——RO 與蒸餾的能耗比較、濃鹽水與零液體排放

   化學說明：
     拉午耳定律 P = X_溶劑 · P°
     滲透壓 π = i·M·R·T（i 為凡特荷夫因子；NaCl 完全解離時 i ≈ 2）
     逆滲透：外加壓力 > π 時，水由濃側被推向稀側
   ========================================================================== */

import { createStage, THREE, atom, glassBox, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { SOLUTION, DESAL, CONST } from '../../data/constants.js';

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 1.4, 10], fov: 44, minDistance: 4, maxDistance: 24,
    ariaLabel: '溶液蒸發與滲透的 3D 模擬',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;
  const world = new THREE.Group();
  stage.scene.add(world);

  let waters = [], solutes = [], membrane = null, level = { L: 0, R: 0 };

  function clearWorld() {
    for (let i = world.children.length - 1; i >= 0; i--) {
      const o = world.children[i];
      o.traverse?.(x => x.geometry && x.geometry.dispose());
      world.remove(o);
    }
    waters = []; solutes = []; membrane = null;
  }

  const W = 8, H = 4.6, D = 2.4;      // 容器尺寸

  function buildScene() {
    clearWorld();
    world.add(glassBox(W, H, D, 0x1E9EB3));
    const isOsm = C.values.module === 'osmosis' || mode === 'green';

    if (isOsm) {
      // 半透膜（中間）
      membrane = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, H * 0.86, D * 0.94),
        new THREE.MeshPhysicalMaterial({ color: 0x3FA34D, transparent: true, opacity: 0.32, roughness: .3 })
      );
      world.add(membrane);
      const t = textSprite('半透膜（只讓水通過）', { scale: 0.0068 });
      t.position.set(0, H / 2 + 0.35, 0); world.add(t);
      world.add(place('稀溶液／淡水側', -W / 4, -H / 2 - 0.45));
      world.add(place('濃溶液／海水側', W / 4, -H / 2 - 0.45));
    } else {
      const t = textSprite('液面：溶質擋住水分子逃逸的位置', { scale: 0.0068 });
      t.position.set(0, H / 2 + 0.35, 0); world.add(t);
    }

    const NW = stage.quality === 'low' ? 90 : 170;
    for (let i = 0; i < NW; i++) {
      const m = atom(0.13, 0x1E9EB3, 8, { emissive: 0x1E9EB3, emissiveIntensity: .25 });
      m.userData = { v: new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(1.1), gas: false };
      resetPos(m, isOsm ? (i % 2 ? 1 : -1) : 0);
      world.add(m); waters.push(m);
    }
    const NS = Math.round(C.values.conc * 26);
    for (let i = 0; i < NS; i++) {
      const m = atom(0.24, 0xFF7A59, 10, { roughness: .3 });
      m.userData = { v: new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(0.5) };
      resetPos(m, isOsm ? 1 : 0);
      world.add(m); solutes.push(m);
    }
  }
  function rnd() { return (Math.random() - .5) * 2; }
  function place(text, x, y) { const s = textSprite(text, { scale: 0.0065 }); s.position.set(x, y, 0); return s; }
  function resetPos(m, side) {
    const x = side === 0 ? (Math.random() - .5) * W * .9
      : side < 0 ? -W / 2 + Math.random() * (W / 2 - 0.2) : 0.2 + Math.random() * (W / 2 - 0.4);
    m.position.set(x, -H / 2 + Math.random() * H * .78, (Math.random() - .5) * D * .8);
  }

  /* ---------------- 下方圖表 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-t>📈 拉午耳定律曲線</div>
    <canvas id="rc" aria-label="蒸氣壓與莫耳分率關係圖"></canvas>`;
  const rc = new Chart2D(ctx.subEl.querySelector('#rc'), {
    height: 190, pad: { l: 56, r: 14, t: 14, b: 34 },
    xLabel: '溶劑莫耳分率 X_水', yLabel: '蒸氣壓 (torr)',
  });
  rc.onResize = drawChart;

  /** 目前溶液的物理量 */
  function props() {
    const M = C.values.conc;                             // 溶質莫耳濃度 (mol/L)
    const T = C.values.T + 273.15;
    // 凡特荷夫因子 i：一個化學式單位解離成幾個粒子
    const i = { glucose: 1, NaCl: 2, CaCl2: 3, brackish: 2, deep: 2 }[C.values.solute] ?? 1;
    const osm = i * M;                                   // 滲透莫耳濃度
    const pi = osm * CONST.R_Latm * T;                   // atm
    // 蒸氣壓下降：以 1 L 水 ≈ 55.5 mol 估算莫耳分率
    const Xs = osm / (osm + 55.5);
    const Pw = SOLUTION.P_water_25 * (1 - Xs);
    const dTb = SOLUTION.Kb_water * osm;
    const dTf = SOLUTION.Kf_water * osm;
    return { M, osm, i, pi, Xw: 1 - Xs, Pw, dTb, dTf, T };
  }

  function drawChart() {
    if (mode === 'green') { drawDesal(); return; }
    const p = props();
    rc.xLabel = '溶劑莫耳分率 X_水'; rc.yLabel = '蒸氣壓 (torr)';
    rc.clear().setRange(0, 1, 0, SOLUTION.P_water_25 * 1.15).axes({ xTicks: 4, yTicks: 4 });
    rc.line([[0, 0], [1, SOLUTION.P_water_25]], { color: PALETTE.ocean, width: 3 });
    rc.hline(SOLUTION.P_water_25, { color: PALETTE.muted, dash: [4, 4], label: `純水 P° = ${SOLUTION.P_water_25} torr（25 °C）` });
    rc.dot(p.Xw, p.Pw, { color: PALETTE.coralDeep, r: 6, stroke: '#fff' });
    rc.label(p.Xw, p.Pw, `目前 ${p.Pw.toFixed(2)} torr`, { dy: 12, color: PALETTE.coralDeep });
    rc.label(0.28, SOLUTION.P_water_25 * 0.45, '蒸氣壓下降只跟「粒子數」有關，與溶質是什麼無關',
      { color: PALETTE.muted, align: 'left' });
  }

  function drawDesal() {
    const p = props();
    const applied = C.values.press;
    const rec = C.values.recovery;
    const ro = roEnergy(applied, rec);
    rc.xLabel = ''; rc.yLabel = 'kWh / m³ 產水';
    const mx = Math.max(14, ro * 1.4);
    rc.clear().setRange(0, 4, 0, mx).axes({ xTicks: [], yTicks: 5 });
    rc.bars([
      { label: '理論最小分離功', value: DESAL.thermodyn_min, color: PALETTE.muted },
      { label: '你設定的 RO', value: ro, color: PALETTE.leaf },
      { label: '實務 RO 廠', value: DESAL.RO.kWh_per_m3, color: PALETTE.leafDeep },
      { label: '多級閃化蒸餾', value: DESAL.MSF.kWh_per_m3, color: PALETTE.coralDeep },
    ], { fmt: v => v.toFixed(2) });
    rc.hline(DESAL.thermodyn_min, { color: PALETTE.muted, dash: [4, 4] });
  }

  /** RO 能耗（教學用簡化模型）：主要為加壓功，含 92% 泵效率與能量回收 */
  function roEnergy(bar, recPct) {
    const rec = Math.max(0.05, recPct / 100);
    const eta = 0.80;                       // 泵＋馬達總效率
    const erd = 0.95;                       // 能量回收裝置效率
    // 1 bar 加壓 1 m³ 進料 = 100 kJ = 0.02778 kWh
    const feed = 1 / rec;                   // 每產 1 m³ 淡水要加壓多少 m³ 進料
    const gross = bar * 0.02778 * feed / eta;
    const recovered = bar * 0.02778 * (feed - 1) * erd * 0.9;
    return Math.max(0.5, gross - recovered) + 0.35;      // +前處理與後處理
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'energy', name: '產水能耗', unit: 'kWh/m³', min: 0, max: 16, digits: 2,
      better: 'low', good: 4, bad: 10, note: '每產出 1 立方公尺淡水所需電力（原則 #6）' },
    { key: 'rec', name: '產水回收率', unit: '%', min: 0, max: 70, digits: 0,
      better: 'high', good: 45, bad: 20, note: '進料海水有多少變成淡水（原則 #1）' },
    { key: 'brine', name: '濃鹽水鹽度', unit: 'g/kg', min: 30, max: 110, digits: 1,
      better: 'low', good: 55, bad: 85, note: '排放濃鹽水的鹽度，過高會衝擊底棲生態' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    if (mode === 'classic') {
      ctx.setStageTitle('模組 A／B：蒸氣壓下降與滲透壓');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'module', label: '模組', value: 'vapor', options: [
          { v: 'vapor', label: 'A · 蒸氣壓下降', title: '溶質佔據液面，阻礙水分子蒸發' },
          { v: 'osmosis', label: 'B · 滲透與逆滲透', title: '半透膜兩側的水分子淨流動' },
        ] },
        { type: 'seg', key: 'solute', label: '溶質', value: 'NaCl', options: [
          { v: 'glucose', label: '葡萄糖（i = 1）', title: '不解離的分子型溶質' },
          { v: 'NaCl', label: 'NaCl（i ≈ 2）', title: '解離成 Na⁺ 與 Cl⁻，粒子數加倍' },
          { v: 'CaCl2', label: 'CaCl₂（i ≈ 3）', title: '解離成 1 個 Ca²⁺ 與 2 個 Cl⁻' },
        ] },
        { type: 'range', key: 'conc', label: '溶質濃度', min: 0, max: 2, step: 0.05, value: 0.5, unit: 'mol/L' },
        { type: 'range', key: 'T', label: '溫度', min: 5, max: 60, step: 1, value: 25, unit: '°C' },
        { type: 'range', key: 'press', label: '外加壓力（模組 B）', min: 0, max: 80, step: 1, value: 0, unit: 'bar',
          hint: '壓力超過滲透壓時，水會被「逆著」推回淡水側——這就是逆滲透。' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'i', label: '凡特荷夫因子 i', unit: '', digits: 0 },
        { key: 'osm', label: '滲透莫耳濃度', unit: 'osmol/L', digits: 3 },
        { key: 'Pw', label: '溶液蒸氣壓', unit: 'torr', digits: 2 },
        { key: 'dP', label: '蒸氣壓下降', unit: 'torr', digits: 2 },
        { key: 'pi', label: '滲透壓 π = iMRT', unit: 'atm', digits: 2 },
        { key: 'flow', label: '目前淨水流', unit: '', digits: 0, wide: true },
        { key: 'dTb', label: '沸點上升', unit: '°C', digits: 3 },
        { key: 'dTf', label: '凝固點下降', unit: '°C', digits: 3 },
      ]);
    } else {
      ctx.setStageTitle('綠色情境：海水淡化——把滲透壓變成工程參數');
      C = buildControls(ctx.hostControls, [
        { type: 'seg', key: 'solute', label: '水源', value: 'NaCl', options: [
          { v: 'NaCl', label: '海水（35 g/kg）', title: '滲透壓約 27 atm' },
          { v: 'brackish', label: '半鹹水（5 g/kg）', title: '滲透壓低很多，能耗也低' },
          { v: 'deep', label: '花蓮深層海水', title: '取自 600–800 m，低溫、潔淨、富含礦物質' },
        ] },
        { type: 'range', key: 'press', label: '施加壓力', min: 5, max: 90, step: 1, value: 55, unit: 'bar',
          hint: '必須大於滲透壓才會產水；但壓力越高，能耗越大。' },
        { type: 'range', key: 'recovery', label: '產水回收率', min: 10, max: 65, step: 1, value: 45, unit: '%',
          hint: '回收率越高，剩下的濃鹽水越鹹，滲透壓也越高，需要的壓力隨之上升。' },
        { type: 'range', key: 'T', label: '水溫', min: 5, max: 35, step: 1, value: 25, unit: '°C' },
        { type: 'range', key: 'conc', label: '進料鹽度換算濃度', min: 0.1, max: 1.2, step: 0.05, value: 0.6, unit: 'mol/L',
          hint: '海水約 0.6 mol/L NaCl（35 g/kg）。' },
        { type: 'range', key: 'demand', label: '每日產水需求', min: 100, max: 50000, step: 100, value: 5000, unit: 'm³' },
      ], onChange);
      readout = buildReadouts(ctx.hostReadout, [
        { key: 'pi', label: '進料滲透壓 π', unit: 'atm', digits: 2 },
        { key: 'net', label: '淨驅動壓力', unit: 'bar', digits: 2 },
        { key: 'energy', label: 'RO 能耗', unit: 'kWh/m³', digits: 2 },
        { key: 'msf', label: '蒸餾法能耗', unit: 'kWh/m³', digits: 1 },
        { key: 'brine', label: '濃鹽水鹽度', unit: 'g/kg', digits: 1 },
        { key: 'daily', label: '每日總用電', unit: 'MWh', digits: 2, wide: true },
        { key: 'save', label: '相對蒸餾法省電', unit: '%', digits: 1, wide: true },
      ]);
    }
    buildScene(); drawChart(); update();
  }

  function onChange(key) {
    if (key === 'module' || key === 'conc') buildScene();
    drawChart(); update();
  }

  /* ---------------- 數值 ---------------- */
  function update() {
    const p = props();
    if (mode === 'classic') {
      const net = C.values.press - p.pi * 1.01325;
      readout({
        i: p.i, osm: p.osm, Pw: p.Pw, dP: SOLUTION.P_water_25 - p.Pw, pi: p.pi,
        flow: C.values.module === 'vapor' ? '（本模組不適用）'
          : (net > 0.5 ? '⬅ 逆滲透：水被推向淡水側'
            : net < -0.5 ? '➡ 自然滲透：水流向濃溶液側' : '⚖ 接近平衡'),
        dTb: p.dTb, dTf: -p.dTf,
      });
      ctx.setOverlay(
        C.values.module === 'vapor'
          ? `<b>蒸氣壓下降</b><br>純水 ${SOLUTION.P_water_25} torr → 溶液 ${p.Pw.toFixed(2)} torr<br>
             溶質粒子占據液面 ${(1 - p.Xw) * 100 > 0 ? ((1 - p.Xw) * 100).toFixed(2) : 0}%`
          : `<b>滲透壓 π = ${p.pi.toFixed(2)} atm</b>（${(p.pi * 1.01325).toFixed(1)} bar）<br>
             外加 ${C.values.press} bar → 淨壓力 ${net.toFixed(1)} bar<br>
             ${net > 0.5 ? '逆滲透中' : net < -0.5 ? '自然滲透中' : '接近平衡'}`);
      gauge({ energy: 0, rec: 0, brine: 35 },
        `<span data-term="依數性">依數性</span>只看<strong>粒子數</strong>，不看粒子是什麼。
         把溶質從葡萄糖（i = 1）換成 CaCl₂（i ≈ 3），濃度完全不變，
         蒸氣壓下降與滲透壓卻變成三倍——因為 1 個 CaCl₂ 解離成 3 個粒子。
         切到綠色情境，看這個 π 怎麼變成海水淡化廠的電費。`);

    } else {
      const piBar = p.pi * 1.01325;
      const rec = C.values.recovery / 100;
      // 濃縮後的平均滲透壓（教學用簡化：以進料與濃水的對數平均）
      const cf = 1 / (1 - rec);
      const piAvg = piBar * Math.log(cf) / rec;
      const net = C.values.press - piAvg;
      const energy = net > 0 ? roEnergy(C.values.press, C.values.recovery) : NaN;
      const salIn = C.values.solute === 'brackish' ? 5 : 35;
      const brine = salIn * cf;
      const daily = Number.isFinite(energy) ? energy * C.values.demand / 1000 : 0;
      const save = Number.isFinite(energy) ? (1 - energy / DESAL.MSF.kWh_per_m3) * 100 : 0;

      readout({
        pi: p.pi, net, energy: Number.isFinite(energy) ? energy : '壓力不足，無法產水',
        msf: DESAL.MSF.kWh_per_m3, brine, daily, save,
      });
      ctx.setOverlay(
        `<b>${C.values.solute === 'deep' ? '花蓮深層海水' : C.values.solute === 'brackish' ? '半鹹水' : '海水'}</b><br>
         滲透壓 ${p.pi.toFixed(1)} atm｜施加 ${C.values.press} bar<br>
         ${net > 0 ? `✅ 淨驅動壓力 ${net.toFixed(1)} bar，產水中` : '❌ 壓力低於滲透壓，完全無法產水'}`);
      gauge({ energy: Number.isFinite(energy) ? energy : 16, rec: C.values.recovery, brine },
        net <= 0
          ? `❌ 施加壓力還不到滲透壓（${piAvg.toFixed(1)} bar），一滴水都出不來。
             這就是滲透壓從課本走進工程的第一課：<strong>它是一道必須先跨過的門檻。</strong>`
          : (C.values.recovery > 55
            ? `⚠ 回收率拉到 ${C.values.recovery}% 時，濃鹽水鹽度升到 <strong>${brine.toFixed(0)} g/kg</strong>
               （海水本身是 35）。高鹽度濃排水會沉在海底、衝擊底棲生態，
               而且濃側滲透壓上升又推高了能耗。<strong>零液體排放（ZLD）</strong>就是為了解決這個問題——
               把濃鹽水繼續濃縮到析出固體鹽，代價是更多能量。`
            : `目前 RO 能耗 <strong>${energy.toFixed(2)} kWh/m³</strong>，
               而多級閃化蒸餾約 ${DESAL.MSF.kWh_per_m3} kWh/m³，
               熱力學理論最小值則是 ${DESAL.thermodyn_min} kWh/m³。
               RO 之所以取代蒸餾成為主流，正是因為它<strong>不需要把水汽化</strong>——
               只要把水擠過膜就好（原則 #6）。試著把壓力調到剛好高於滲透壓，看能耗能壓到多低。`));
    }
  }

  /* ---------------- 動畫 ---------------- */
  stage.start(({ dt }) => {
    const p = props();
    const isOsm = C.values.module === 'osmosis' || mode === 'green';
    const piBar = p.pi * 1.01325;
    const net = (mode === 'green' ? C.values.press : C.values.press) - piBar;
    const drift = isOsm ? Math.max(-1, Math.min(1, -net / 30)) : 0;   // >0：往濃側；<0：往淡側

    waters.forEach(m => {
      const u = m.userData;
      m.position.addScaledVector(u.v, dt * 1.6);
      // 滲透造成的整體漂移
      if (isOsm) m.position.x += drift * dt * 0.9;
      // 邊界
      if (Math.abs(m.position.x) > W / 2 - .15) { m.position.x = Math.sign(m.position.x) * (W / 2 - .15); u.v.x *= -1; }
      if (Math.abs(m.position.z) > D / 2 - .15) { m.position.z = Math.sign(m.position.z) * (D / 2 - .15); u.v.z *= -1; }
      // 液面：溶質佔據表面 → 蒸發機率下降
      const surf = -H / 2 + H * .78;
      if (m.position.y > surf) {
        const escapeP = (p.Xw) * (0.25 + C.values.T / 120);
        if (Math.random() < escapeP * dt * 2.4) { m.position.y = surf + 0.9; u.v.y = 0.9; }
        else { m.position.y = surf; u.v.y = -Math.abs(u.v.y); }
      }
      if (m.position.y > H / 2 - .2) { m.position.y = -H / 2 + .2; u.v.set(rnd(), rnd(), rnd()).multiplyScalar(1.1); }
      if (m.position.y < -H / 2 + .15) { m.position.y = -H / 2 + .15; u.v.y *= -1; }
    });

    solutes.forEach(m => {
      const u = m.userData;
      m.position.addScaledVector(u.v, dt * 0.8);
      // 溶質被半透膜擋住
      if (isOsm && m.position.x < 0.25) { m.position.x = 0.25; u.v.x = Math.abs(u.v.x); }
      if (Math.abs(m.position.x) > W / 2 - .3) { m.position.x = Math.sign(m.position.x) * (W / 2 - .3); u.v.x *= -1; }
      if (Math.abs(m.position.z) > D / 2 - .3) { m.position.z = Math.sign(m.position.z) * (D / 2 - .3); u.v.z *= -1; }
      const top = -H / 2 + H * .78;
      if (m.position.y > top) { m.position.y = top; u.v.y = -Math.abs(u.v.y); }
      if (m.position.y < -H / 2 + .3) { m.position.y = -H / 2 + .3; u.v.y *= -1; }
    });
  });

  ctx.onScenario(v => { mode = v; buildForScenario(); });
  buildForScenario();
  return { destroy() { stage.dispose(); rc.destroy(); } };
}
