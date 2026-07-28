/* ==========================================================================
   sim/ch12.js — Ch12 化學反應動力學
   模組 A（3D）：碰撞理論——自己瞄準角度與動能發射，撞對了才反應
   模組 B（2D）：反應座標圖，催化劑即時把活化能山丘壓低並產生中間態
   綠色情境：四種催化條件並排（無催化 / 重金屬 / 仿生酵素 / 光觸媒 TiO₂）

   化學說明：
   碰撞理論的三個條件——(1) 要碰到 (2) 動能 ≥ 活化能 Ea (3) 取向要對。
   由 Arrhenius 式，能量足夠的碰撞比例 = exp(−Ea / RT)；
   再乘上取向因子 p，即為有效碰撞分率。
   ========================================================================== */

import { createStage, THREE, atom, bond, textSprite } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';
import { Chart2D, PALETTE } from '../ui/chart.js';
import { KINETICS_SCEN, CONST, TIO2_PHOTOCAT } from '../../data/constants.js';

const TOL_DEG = 40;          // 取向容許角（教學用；真實體系的取向因子隨反應而異）

/* 教學放大倍率 —— 為什麼需要它？
   真實反應在 350 K、Ea = 120 kJ/mol 時，能量足夠的碰撞比例約 10⁻¹⁸，
   也就是「連發一兆次也看不到一次成功」。為了讓學生在幾秒內看得到事件，
   自動連發模式把抽出來的分子動能乘上這個倍率（等效於把 RT 放大）。
   面板同時列出「真實尺度」的分率，讓學生知道被放大了多少。 */
const TEACH_BOOST = 12;

/** 科學記號格式：0.0000000038 → 3.8×10⁻⁹ */
function sci(v, digits = 2) {
  if (!Number.isFinite(v) || v === 0) return '0';
  if (v >= 1 && v < 1e5) return Number(v.toFixed(2)).toLocaleString('en-US');
  if (v >= 0.001 && v < 1) return v.toPrecision(3);
  const s = v.toExponential(digits);
  const [m, e] = s.split('e');
  const sup = String(Number(e)).replace(/-/g, '⁻')
    .replace(/0/g, '⁰').replace(/1/g, '¹').replace(/2/g, '²').replace(/3/g, '³')
    .replace(/4/g, '⁴').replace(/5/g, '⁵').replace(/6/g, '⁶').replace(/7/g, '⁷')
    .replace(/8/g, '⁸').replace(/9/g, '⁹');
  return `${m}×10${sup}`;
}

export async function init(ctx) {
  const stage = createStage(ctx.stageEl, {
    cameraPos: [0, 0.5, 12], fov: 42, minDistance: 5, maxDistance: 26,
    ariaLabel: '碰撞理論 3D 舞台：反應物分子與入射粒子',
  });
  let mode = ctx.scenario;
  let C = null, readout = null;

  /* ---------------- 3D 物件 ---------------- */
  const world = new THREE.Group();
  stage.scene.add(world);

  const A = atom(0.55, 0x4C7DE0, 22);          // 分子 A–B 的 A 端
  const B = atom(0.45, 0xFF6B5B, 22);          // A–B 的 B 端（被攻擊的一端）
  const Cat = atom(0.42, 0x3FA34D, 22);        // 入射粒子 C
  A.position.set(-0.75, 0, 0);
  B.position.set(0.35, 0, 0);
  const ab = bond(A.position, B.position, 0.12, 0xB9CFC4);
  world.add(A, B, Cat, ab);

  const lblAB = textSprite('A–B（反應物分子）', { scale: 0.0075 });
  lblAB.position.set(-0.2, 1.3, 0); world.add(lblAB);
  const lblC = textSprite('C', { scale: 0.0075 });
  world.add(lblC);

  // 瞄準線
  const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const aim = new THREE.Line(aimGeo, new THREE.LineDashedMaterial({ color: 0x1E9EB3, dashSize: .25, gapSize: .18 }));
  world.add(aim);

  // 活化能「門檻圈」：能量夠時發亮
  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.045, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.55 })
  );
  world.add(ringMesh);

  /* ---------------- 模擬狀態 ---------------- */
  const S = {
    flying: false, t: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    result: null, resultT: 0,
    shots: 0, hits: 0,
    auto: false, autoTimer: 0,
    lastAngle: 0, lastKE: 0,
  };

  function currentScen() {
    if (mode === 'classic') return C.values.cat === 'metal' ? KINETICS_SCEN.metal : KINETICS_SCEN.none;
    return KINETICS_SCEN[C.values.cat] || KINETICS_SCEN.none;
  }

  function fire(angleDeg, keVal) {
    const rad = angleDeg * Math.PI / 180;
    const R = 7.2;
    S.pos.set(Math.cos(rad) * R, Math.sin(rad) * R, 0);
    const dir = S.pos.clone().negate().normalize();
    const speed = 2.2 + Math.sqrt(Math.max(0, keVal)) * 0.42;
    S.vel.copy(dir).multiplyScalar(speed);
    S.flying = true; S.result = null;
    S.lastAngle = angleDeg; S.lastKE = keVal;
    S.shots++;
  }

  /** 從 Maxwell–Boltzmann 分布抽一個分子動能（3D，平均 = 1.5RT）*/
  function sampleKE(T_K) {
    // 用 Gamma(3/2, kT) 的簡易抽樣：E = -RT(ln u1 + ln u2 · cos²θ)
    const u1 = Math.random(), u2 = Math.random();
    const RT = CONST.R_J * T_K / 1000;    // kJ/mol
    const E = -RT * (Math.log(u1) + Math.log(u2) * Math.cos(Math.PI / 2 * Math.random()) ** 2);
    return E * TEACH_BOOST;      // 教學放大（見檔案上方說明）
  }

  /* ---------------- 反應座標圖 ---------------- */
  ctx.subEl.innerHTML = `
    <div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:.2rem" data-rc-title>
      📉 反應座標圖：活化能山丘</div>
    <canvas id="rc" aria-label="反應座標能量圖"></canvas>`;
  const rc = new Chart2D(ctx.subEl.querySelector('#rc'), {
    height: 200, pad: { l: 52, r: 14, t: 16, b: 34 },
    xLabel: '反應座標 →', yLabel: '位能 (kJ/mol)',
  });
  rc.onResize = drawRC;

  /** 產生一條反應座標曲線；catalysed = true 時畫成「兩座小山＋中間態」*/
  function profile(Ea, dH, catalysed) {
    const pts = [];
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      let y;
      if (!catalysed) {
        y = Ea * Math.exp(-((x - 0.5) ** 2) / (2 * 0.11 ** 2)) + dH * (1 / (1 + Math.exp(-(x - 0.5) / 0.09)));
      } else {
        // 兩個較小的能障，中間夾一個中間態（能量比反應物略高）
        const inter = Ea * 0.42;
        const h1 = Ea * Math.exp(-((x - 0.32) ** 2) / (2 * 0.075 ** 2));
        const h2 = (Ea * 0.92) * Math.exp(-((x - 0.68) ** 2) / (2 * 0.075 ** 2));
        const plateau = inter * Math.exp(-((x - 0.5) ** 2) / (2 * 0.10 ** 2));
        y = Math.max(h1, h2, plateau) + dH * (1 / (1 + Math.exp(-(x - 0.5) / 0.09)));
      }
      pts.push([x, y]);
    }
    return pts;
  }

  function drawRC() {
    const dH = -55;                     // 教學用放熱反應
    const list = mode === 'green'
      ? [['none', PALETTE.coralDeep], ['metal', PALETTE.sun], ['enzyme', PALETTE.leaf], ['photo', PALETTE.ocean]]
      : [['none', PALETTE.coralDeep], ['metal', PALETTE.leaf]];
    const maxEa = Math.max(...list.map(([k]) => KINETICS_SCEN[k].Ea));
    rc.clear().setRange(0, 1, dH - 20, maxEa + 25)
      .axes({ xTicks: [0, .5, 1], xFmt: v => ({ 0: '反應物', 0.5: '過渡態', 1: '產物' })[v] ?? '', yTicks: 4 });
    rc.hline(0, { color: '#B9CFC4', dash: [3, 3] });

    const cur = C ? C.values.cat : 'none';
    list.forEach(([k, col]) => {
      const s = KINETICS_SCEN[k];
      const isCur = k === cur;
      rc.line(profile(s.Ea, dH, k !== 'none'), {
        color: col, width: isCur ? 3 : 1.6, dash: isCur ? null : [4, 4],
      });
      if (isCur) rc.label(0.5, s.Ea + dH * 0.5 + 8, `Ea = ${s.Ea} kJ/mol`, { color: col, bg: col });
    });
    rc.legend(list.map(([k, col]) => ({ label: KINETICS_SCEN[k].zh, color: col })),
      { x: 58, y: 26, vertical: true });
    rc.label(0.93, dH + 6, `ΔH = ${dH} kJ/mol（放熱）`, { color: PALETTE.muted, align: 'right' });
  }

  /* ---------------- 綠色指標 ---------------- */
  const gauge = buildGauges(ctx.hostGauge, [
    { key: 'energy', name: '能耗（相對值）', unit: '', min: 0, max: 110, digits: 0,
      better: 'low', good: 25, bad: 70, note: '以「無催化劑高溫路線」為 100（原則 #6）' },
    { key: 'ef', name: 'E-factor（副產物）', unit: 'kg 廢/kg 產', min: 0, max: 3.5, digits: 2,
      better: 'low', good: 0.6, bad: 2, note: '選擇性越差，副產物越多（原則 #1）' },
    { key: 'tox', name: '毒性／資源風險', unit: '/5', min: 0, max: 5, digits: 1,
      better: 'low', good: 1.5, bad: 3.5, note: '催化劑本身的毒性與稀有金屬耗用（原則 #3）' },
  ]);

  /* ---------------- 面板 ---------------- */
  function buildForScenario() {
    const catOptions = mode === 'classic'
      ? [{ v: 'none', label: '不加催化劑', title: '需要高溫才能翻過活化能山丘' },
         { v: 'metal', label: '加入催化劑', title: '傳統重金屬催化劑，降低活化能' }]
      : [{ v: 'none', label: '無催化', title: '350 °C，能耗高、選擇性差' },
         { v: 'metal', label: '重金屬催化', title: 'Pd/Pt/Cr 等，180 °C，活性好但有金屬殘留與稀有金屬耗用' },
         { v: 'enzyme', label: '仿生酵素', title: '常溫常壓水相、高選擇性' },
         { v: 'photo', label: '光觸媒 TiO₂', title: '以光子取代熱能驅動' }];

    ctx.setStageTitle(mode === 'classic'
      ? '模組 A：瞄準角度與動能，看碰撞成不成功'
      : '綠色情境：四種催化條件的活化能比一比');

    C = buildControls(ctx.hostControls, [
      { type: 'seg', key: 'cat', label: mode === 'classic' ? '催化劑' : '催化情境', value: 'none', options: catOptions },
      { type: 'range', key: 'angle', label: '攻擊角度 θ', min: 0, max: 180, step: 1, value: 12, unit: '°',
        hint: `θ = 0° 表示正對著 B 端撞上去。偏離超過 ${TOL_DEG}° 就算取向錯誤，分子會彈開。` },
      { type: 'range', key: 'ke', label: '入射動能', min: 5, max: 200, step: 1, value: 60, unit: 'kJ/mol',
        hint: '動能必須 ≥ 活化能 Ea 才可能翻過山丘。' },
      { type: 'range', key: 'T', label: '反應溫度', min: 250, max: 1200, step: 10, value: 600, unit: 'K',
        hint: `自動連發時，分子動能依此溫度的 Maxwell–Boltzmann 分布抽取，並乘上 ${TEACH_BOOST} 倍的教學放大係數（否則事件太罕見，看不到）。` },
      { type: 'button', key: 'fire', label: '🚀 發射一次', variant: '' },
      { type: 'check', key: 'auto', label: '自動連發（依溫度隨機抽動能與角度）', value: false },
      { type: 'button', key: 'clear', label: '↺ 清除統計' },
    ], onChange);

    readout = buildReadouts(ctx.hostReadout, [
      { key: 'Ea', label: '活化能 Ea', unit: 'kJ/mol', digits: 0 },
      { key: 'T', label: '溫度', unit: 'K', digits: 0 },
      { key: 'shots', label: '發射次數', unit: '次', digits: 0 },
      { key: 'hits', label: '成功反應', unit: '次', digits: 0 },
      { key: 'rate', label: '實測成功率', unit: '%', digits: 1 },
      { key: 'theory', label: `理論分率（模擬尺度，動能已放大 ${TEACH_BOOST} 倍）`, unit: '%', digits: 2, wide: true },
      { key: 'real', label: '真實尺度的有效碰撞分率', unit: '', digits: 0, wide: true },
      { key: 'k', label: '相對速率常數 k（以無催化 350 K 為 1）', unit: '倍', digits: 0, wide: true },
    ]);
    drawRC();
    update();
  }

  function onChange(key, v) {
    if (key === 'fire') { fire(C.values.angle, C.values.ke); }
    if (key === 'clear') { S.shots = 0; S.hits = 0; }
    if (key === 'auto') { S.auto = v; }
    if (key === 'cat') { S.shots = 0; S.hits = 0; drawRC(); }
    update();
  }

  /* ---------------- 數值更新 ---------------- */
  function update() {
    const s = currentScen();
    const T = C.values.T;
    const RT = CONST.R_J * T / 1000;
    const boltzReal = Math.exp(-s.Ea / RT);                       // 真實尺度：能量足夠的碰撞分率
    const boltzSim = Math.exp(-s.Ea / (RT * TEACH_BOOST));        // 模擬（放大）尺度
    const p = (2 * TOL_DEG) / 360;                                // 取向因子（教學用簡化）
    const rate = S.shots ? S.hits / S.shots * 100 : 0;
    // 相對速率常數：以「無催化、350 K」為 1
    const ref = Math.exp(-KINETICS_SCEN.none.Ea / (CONST.R_J * 350 / 1000));
    readout({
      Ea: s.Ea, T, shots: S.shots, hits: S.hits, rate,
      theory: boltzSim * p * 100,
      real: sci(boltzReal * p) + '（≈ 每 ' + sci(1 / (boltzReal * p), 1) + ' 次碰撞成功一次）',
      k: sci(boltzReal / ref),
    });
    ctx.setOverlay(
      `<b>${s.zh}</b><br>Ea = ${s.Ea} kJ/mol｜建議操作溫度 ${s.T_C} °C<br>` +
      (S.result === 'ok' ? '✅ 成功生成產物 A + B–C'
        : S.result === 'angle' ? '❌ 取向錯誤，彈開'
        : S.result === 'energy' ? '❌ 動能不足，翻不過山丘' : '準備發射…'));

    gauge({ energy: s.energy, ef: s.byproduct, tox: { none: 1.0, metal: 4.2, enzyme: 0.6, photo: 1.2 }[C.values.cat] ?? 1 },
      mode === 'classic'
        ? (C.values.cat === 'none'
          ? '沒有催化劑時，只能靠<strong>拉高溫度</strong>讓更多分子翻過山丘——溫度每升高，能耗與副反應同時上升。'
          : '催化劑提供了另一條路徑，Ea 由 120 降到 65 kJ/mol。切到綠色情境比較四種催化方式的代價。')
        : ({
          none: '無催化路線在 350 °C 運轉，能耗最高、選擇性最差（E-factor 3.0）。',
          metal: '重金屬催化把溫度降到 180 °C，但 Pd/Pt 是稀有金屬，且產品可能殘留金屬——原則 #9 達成，原則 #3 卻打折。',
          enzyme: `<span data-term="固氮酶">酵素</span>在 <strong>37 °C、水相</strong>就能工作，能耗只剩約 12%、副產物幾乎沒有。這是仿生化學最有力的論證（原則 #6 + #9 + #5）。`,
          photo: `<span data-term="光觸媒">光觸媒</span> TiO₂ 用<strong>光子</strong>取代熱能驅動反應（能隙 ${TIO2_PHOTOCAT.bandgap_eV} eV，需 ≤${TIO2_PHOTOCAT.lambda_nm} nm 的紫外光）。常溫常壓、觸媒可回收重複使用。`,
        })[C.values.cat]);
  }

  /* ---------------- 動畫迴圈 ---------------- */
  const AIM_TARGET = new THREE.Vector3(0.35, 0, 0);
  stage.start(({ dt }) => {
    const s = currentScen();
    const T = C.values.T;

    // 瞄準線（未飛行時顯示）
    if (!S.flying) {
      const rad = C.values.angle * Math.PI / 180;
      const p0 = new THREE.Vector3(Math.cos(rad) * 7.2, Math.sin(rad) * 7.2, 0);
      Cat.position.copy(p0);
      lblC.position.copy(p0).add(new THREE.Vector3(0, 0.85, 0));
      aimGeo.setFromPoints([p0, AIM_TARGET]);
      aim.computeLineDistances();
      aim.visible = true;
    } else {
      aim.visible = false;
      S.pos.addScaledVector(S.vel, dt * 3.2);
      Cat.position.copy(S.pos);
      lblC.position.copy(S.pos).add(new THREE.Vector3(0, 0.85, 0));

      const d = S.pos.distanceTo(AIM_TARGET);
      if (d < 0.9) {
        // 判定
        const okAngle = Math.abs(((S.lastAngle + 180) % 360) - 180) <= TOL_DEG;
        const okEnergy = S.lastKE >= s.Ea;
        if (okAngle && okEnergy) {
          S.result = 'ok'; S.hits++;
          if (S.hits % 5 === 0 && !S.auto) ctx.celebrate();
        } else S.result = okAngle ? 'energy' : 'angle';
        S.flying = false; S.resultT = 1.2;
        update();
      } else if (d > 14) { S.flying = false; }
    }

    // 成功後把 B 拉向 C 一小段時間，做出「B–C 生成」的視覺
    if (S.resultT > 0) {
      S.resultT -= dt;
      if (S.result === 'ok') {
        B.position.lerp(new THREE.Vector3(1.5, 0.4, 0), dt * 2.2);
        A.position.lerp(new THREE.Vector3(-2.4, -0.5, 0), dt * 2.0);
        Cat.position.lerp(new THREE.Vector3(2.3, 0.55, 0), dt * 2.2);
      } else {
        Cat.position.addScaledVector(S.vel.clone().negate(), dt * 1.4);
      }
      if (S.resultT <= 0) { A.position.set(-0.75, 0, 0); B.position.set(0.35, 0, 0); }
    } else if (!S.flying) {
      A.position.lerp(new THREE.Vector3(-0.75, 0, 0), dt * 6);
      B.position.lerp(new THREE.Vector3(0.35, 0, 0), dt * 6);
    }
    // 更新 A–B 鍵
    ab.position.copy(A.position).add(B.position).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(B.position, A.position);
    ab.scale.set(1, dir.length() / 1.1, 1);
    ab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    ab.visible = S.result !== 'ok' || S.resultT <= 0;

    // 門檻圈：動能夠就發亮
    const enough = (S.auto ? true : C.values.ke >= s.Ea);
    ringMesh.material.color.setHex(enough ? 0x3FA34D : 0xFF7A59);
    ringMesh.rotation.z += dt * 0.4;

    // 自動連發
    if (S.auto && !S.flying && S.resultT <= 0) {
      S.autoTimer -= dt;
      if (S.autoTimer <= 0) {
        S.autoTimer = 0.28;
        fire(Math.random() * 360 - 180, sampleKE(T));
      }
    }
  });

  /* ---------------- 情境切換 ---------------- */
  ctx.onScenario(v => {
    mode = v;
    S.shots = 0; S.hits = 0;
    buildForScenario();
  });

  buildForScenario();
  return { destroy() { stage.dispose(); rc.destroy(); } };
}
