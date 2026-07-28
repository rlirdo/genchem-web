/* ==========================================================================
   ui/gauges.js — 綠色指標儀表板
   每章右側面板固定顯示，隨學生操作即時變動。
   defs: [{ key, name, unit, min, max, digits, better:'high'|'low',
            good, bad,           // 判定好壞的門檻（依 better 方向）
            note }]
   ========================================================================== */

import { setNum } from '../core.js';

export function buildGauges(host, defs, opts = {}) {
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'gauges';
  const map = {};

  defs.forEach(d => {
    const g = document.createElement('div');
    g.className = 'gauge';
    g.innerHTML = `
      <div class="g-top">
        <span class="g-name">${d.name}</span>
        <span class="g-val"><span class="num" data-v>—</span>${d.unit ? ' ' + d.unit : ''}</span>
      </div>
      <div class="g-bar" role="progressbar" aria-label="${d.name}"
           aria-valuemin="${d.min}" aria-valuemax="${d.max}" aria-valuenow="${d.min}">
        <div class="g-fill"></div>
      </div>
      ${d.note ? `<div class="g-note">${d.note}</div>` : '<div class="g-note"></div>'}`;
    box.appendChild(g);
    map[d.key] = {
      def: d,
      num: g.querySelector('[data-v]'),
      val: g.querySelector('.g-val'),
      fill: g.querySelector('.g-fill'),
      bar: g.querySelector('.g-bar'),
      note: g.querySelector('.g-note'),
    };
  });

  const verdict = document.createElement('div');
  verdict.className = 'green-verdict';
  verdict.setAttribute('aria-live', 'polite');
  verdict.textContent = opts.verdict || '調整左邊的參數，看看綠色指標怎麼變。';
  box.appendChild(verdict);
  host.appendChild(box);

  /** 依 better 方向決定顏色等級 */
  function grade(d, v) {
    if (d.better === 'low') {
      if (v <= d.good) return 'good';
      if (v >= d.bad) return 'bad';
      return 'mid';
    }
    if (v >= d.good) return 'good';
    if (v <= d.bad) return 'bad';
    return 'mid';
  }

  /**
   * 更新指標
   * @param {Object} obj  { key: number, ... }
   * @param {string} verdictText 底部一句話總評（可省略）
   */
  return function update(obj, verdictText) {
    for (const k in obj) {
      const m = map[k];
      if (!m) continue;
      const d = m.def;
      const v = Number(obj[k]);
      if (!Number.isFinite(v)) { m.num.textContent = obj[k]; continue; }
      setNum(m.num, v, d.digits ?? 1);
      // 對數刻度（適合 Ksp、殘留濃度這種跨數量級的指標）
      let pct;
      if (d.log) {
        const lo = Math.log10(Math.max(d.min, 1e-12)), hi = Math.log10(Math.max(d.max, 1e-11));
        pct = (Math.log10(Math.max(v, 1e-12)) - lo) / (hi - lo) * 100;
      } else {
        pct = (v - d.min) / (d.max - d.min) * 100;
      }
      pct = Math.max(0, Math.min(100, pct));
      const g = grade(d, v);
      m.fill.style.width = pct.toFixed(1) + '%';
      m.fill.className = 'g-fill ' + g;
      m.val.className = 'g-val g-' + g;
      m.bar.setAttribute('aria-valuenow', v.toFixed(d.digits ?? 1));
      m.bar.setAttribute('aria-valuetext', `${v.toFixed(d.digits ?? 1)} ${d.unit || ''}`);
      if (d.noteFn) m.note.textContent = d.noteFn(v);
    }
    if (verdictText !== undefined) verdict.innerHTML = verdictText;
  };
}

/* ---------- 三個標準指標的預設定義，各章可直接取用或改寫 ---------- */
export const GAUGE_ATOM_ECONOMY = {
  key: 'ae', name: '原子經濟性', unit: '%', min: 0, max: 100, digits: 1,
  better: 'high', good: 80, bad: 45,
  note: '反應物原子有多少比例進到目標產物（原則 #2）',
};
export const GAUGE_ENERGY = {
  key: 'energy', name: '能耗（相對值）', unit: '', min: 0, max: 100, digits: 0,
  better: 'low', good: 25, bad: 70,
  note: '以該章傳統製程為 100 的相對能量投入（原則 #6）',
};
export const GAUGE_EFACTOR = {
  key: 'ef', name: 'E-factor', unit: 'kg 廢棄物/kg 產物', min: 0, max: 30, digits: 2,
  better: 'low', good: 1, bad: 10,
  note: '每做出 1 kg 產品同時產生幾 kg 廢棄物（原則 #1）',
};
export const GAUGE_CARBON = {
  key: 'co2', name: '碳排', unit: 'kg CO₂e', min: 0, max: 100, digits: 1,
  better: 'low', good: 20, bad: 60,
  note: '相對碳足跡（原則 #6）',
};
export const GAUGE_TOXICITY = {
  key: 'tox', name: '毒性等級', unit: '/5', min: 0, max: 5, digits: 1,
  better: 'low', good: 1.5, bad: 3.5,
  note: '1 = 幾乎無害；5 = 高毒性（原則 #3）',
};
export const GAUGE_WATER = {
  key: 'water', name: '水耗', unit: '相對值', min: 0, max: 100, digits: 0,
  better: 'low', good: 25, bad: 70,
  note: '製程用水的相對量（原則 #5）',
};
