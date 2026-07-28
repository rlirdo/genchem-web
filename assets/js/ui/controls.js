/* ==========================================================================
   ui/controls.js — 控制面板元件產生器（滑桿 / 選項群 / 開關 / 按鈕）與即時數據讀出
   所有控制項都自動帶 aria-label 並可用鍵盤操作。
   ========================================================================== */

import { setNum } from '../core.js';

/**
 * 建立一組控制項
 * @param {HTMLElement} host
 * @param {Array} defs 控制項定義
 *   { type:'range', key, label, min, max, step, value, unit, digits, hint }
 *   { type:'seg',   key, label, value, options:[{v,label,title}] }
 *   { type:'check', key, label, value, hint }
 *   { type:'button',key, label, variant }
 * @param {Function} onChange (key, value, allValues) => void
 * @returns {{values:Object, set:Function, el:Object}}
 */
export function buildControls(host, defs, onChange) {
  host.innerHTML = '';
  const values = {};
  const el = {};

  defs.forEach(def => {
    if (def.type === 'range') {
      values[def.key] = def.value;
      const f = document.createElement('div');
      f.className = 'field';
      const id = 'c_' + def.key + '_' + Math.random().toString(36).slice(2, 6);
      const digits = def.digits ?? (def.step < 1 ? String(def.step).split('.')[1]?.length || 1 : 0);
      f.innerHTML = `
        <div class="field-top">
          <label for="${id}">${def.label}</label>
          <span class="field-val"><span class="num" data-val>${Number(def.value).toFixed(digits)}</span>${def.unit ? ' ' + def.unit : ''}</span>
        </div>
        <input id="${id}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${def.value}"
               aria-label="${def.label}${def.unit ? '，單位 ' + def.unit : ''}">
        ${def.hint ? `<div style="font-size:var(--fs-xs);color:var(--ink-3)">${def.hint}</div>` : ''}`;
      const input = f.querySelector('input');
      const valEl = f.querySelector('[data-val]');
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        values[def.key] = v;
        setNum(valEl, v, digits, false);
        input.setAttribute('aria-valuetext', `${v} ${def.unit || ''}`);
        onChange && onChange(def.key, v, values);
      });
      host.appendChild(f);
      el[def.key] = input;

    } else if (def.type === 'seg') {
      values[def.key] = def.value;
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = `<div class="field-top"><label>${def.label}</label></div>`;
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', def.label);
      def.options.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.dataset.v = o.v;
        if (o.title) b.title = o.title;
        b.setAttribute('aria-pressed', String(o.v === def.value));
        b.setAttribute('aria-label', `${def.label}：${o.title || o.label}`);
        b.addEventListener('click', () => {
          values[def.key] = o.v;
          seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === String(o.v))));
          onChange && onChange(def.key, o.v, values);
        });
        seg.appendChild(b);
      });
      f.appendChild(seg);
      host.appendChild(f);
      el[def.key] = seg;

    } else if (def.type === 'check') {
      values[def.key] = !!def.value;
      const f = document.createElement('div');
      f.className = 'field';
      const id = 'c_' + def.key + '_' + Math.random().toString(36).slice(2, 6);
      f.innerHTML = `<label class="check" for="${id}">
          <input id="${id}" type="checkbox" ${def.value ? 'checked' : ''} aria-label="${def.label}">
          <span>${def.label}</span></label>
        ${def.hint ? `<div style="font-size:var(--fs-xs);color:var(--ink-3);margin-left:1.6rem">${def.hint}</div>` : ''}`;
      const input = f.querySelector('input');
      input.addEventListener('change', () => {
        values[def.key] = input.checked;
        onChange && onChange(def.key, input.checked, values);
      });
      host.appendChild(f);
      el[def.key] = input;

    } else if (def.type === 'button') {
      const f = document.createElement('div');
      f.className = 'field';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sm ' + (def.variant || 'ghost');
      b.textContent = def.label;
      b.setAttribute('aria-label', def.label);
      b.style.width = '100%';
      b.addEventListener('click', () => onChange && onChange(def.key, true, values));
      f.appendChild(b);
      host.appendChild(f);
      el[def.key] = b;

    } else if (def.type === 'html') {
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = def.html;
      host.appendChild(f);
      el[def.key] = f;
    }
  });

  /** 由程式設定某個控制項的值（會同步 UI，但不觸發 onChange）*/
  function set(key, v) {
    const target = el[key];
    if (!target) return;
    values[key] = v;
    if (target.tagName === 'INPUT' && target.type === 'range') {
      target.value = v;
      const valEl = target.closest('.field').querySelector('[data-val]');
      if (valEl) valEl.textContent = Number(v).toFixed(valEl.textContent.split('.')[1]?.length || 0);
    } else if (target.tagName === 'INPUT' && target.type === 'checkbox') {
      target.checked = !!v;
    } else if (target.classList && target.classList.contains('seg')) {
      target.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === String(v))));
    }
  }

  return { values, set, el };
}

/* ==========================================================================
   即時數據讀出
   defs: [{ key, label, unit, digits, wide }]
   回傳 update({key: value, ...})
   ========================================================================== */
export function buildReadouts(host, defs) {
  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'readouts';
  const map = {};
  defs.forEach(d => {
    const box = document.createElement('div');
    box.className = 'ro' + (d.wide ? ' wide' : '');
    box.innerHTML = `<span class="k">${d.label}</span>
      <span class="v"><span class="num" data-v>—</span>${d.unit ? `<span class="u">${d.unit}</span>` : ''}</span>`;
    grid.appendChild(box);
    map[d.key] = { el: box.querySelector('[data-v]'), digits: d.digits ?? 2, box };
  });
  host.appendChild(grid);

  return function update(obj) {
    for (const k in obj) {
      const m = map[k];
      if (!m) continue;
      const v = obj[k];
      if (typeof v === 'number' && Number.isFinite(v)) setNum(m.el, v, m.digits);
      else if (typeof v === 'string' && v.includes('<')) m.el.innerHTML = v;   // 允許少量標記（例如色塊）
      else m.el.textContent = v;
    }
  };
}

/* ==========================================================================
   情境切換（傳統製程 ↔ 綠色化學）
   ========================================================================== */
export function buildScenarioSwitch(host, opts, onChange) {
  const sw = document.createElement('div');
  sw.className = 'scenario-switch';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', '情境切換：傳統製程或綠色化學情境');
  const labels = {
    classic: opts?.classicLabel || '🏭 傳統情境',
    green: opts?.greenLabel || '🌿 綠色化學情境',
  };
  let cur = opts?.value || 'classic';
  ['classic', 'green'].forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.scenario = k;
    b.textContent = labels[k];
    b.setAttribute('aria-pressed', String(k === cur));
    b.setAttribute('aria-label', labels[k].replace(/^[^\w一-龥]+/, ''));
    b.addEventListener('click', () => {
      if (cur === k) return;
      cur = k;
      sw.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.scenario === k)));
      onChange && onChange(k);
    });
    sw.appendChild(b);
  });
  host.appendChild(sw);
  return { get value() { return cur; } };
}
