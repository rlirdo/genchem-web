/* ==========================================================================
   core.js — 全站共用功能
   ‧ 導覽列與麵包屑
   ‧ 學習進度（localStorage，key 前綴 genchem_）
   ‧ 環形進度條
   ‧ 教師模式 / 減少動態效果 / 音效 三個開關
   ‧ 葉片粒子（自製 canvas confetti）
   ‧ 程式生成的自然背景（山稜線、漂浮葉片與氣泡、水波光斑）
   ‧ 數值滾動顯示
   ========================================================================== */

import { CHAPTERS, STAGES, getChapter, getStage, chaptersInStage, neighbours } from '../data/chapters.js';
import { initGlossary } from '../data/glossary.js';

/* ---------- 路徑：讓 chapters/ 子資料夾底下的頁面也能正確連回上層 ---------- */
export const BASE = location.pathname.includes('/chapters/') ? '../' : './';

/* ==========================================================================
   1. localStorage：學習進度與偏好設定
   ========================================================================== */
const PREFIX = 'genchem_';

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }   // 無痕模式或被停用時安靜退回預設值
}
function lsSet(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
}

export const Progress = {
  /** 取得所有已完成章節的 id 陣列 */
  all() { return lsGet('done', []); },
  isDone(id) { return this.all().includes(id); },
  mark(id, done = true) {
    const set = new Set(this.all());
    done ? set.add(id) : set.delete(id);
    lsSet('done', [...set]);
    window.dispatchEvent(new CustomEvent('genchem:progress', { detail: { id, done } }));
  },
  /** 某階段的完成度 0–1 */
  stageRatio(stageId) {
    const list = chaptersInStage(stageId);
    if (!list.length) return 0;
    const done = list.filter(c => this.isDone(c.id)).length;
    return done / list.length;
  },
  stageCount(stageId) {
    const list = chaptersInStage(stageId);
    return { done: list.filter(c => this.isDone(c.id)).length, total: list.length };
  },
  siteRatio() {
    const done = CHAPTERS.filter(c => this.isDone(c.id)).length;
    return CHAPTERS.length ? done / CHAPTERS.length : 0;
  },
  /** 測驗成績（每章一筆）*/
  saveQuiz(id, score, total) { const q = lsGet('quiz', {}); q[id] = { score, total, at: Date.now() }; lsSet('quiz', q); },
  getQuiz(id) { return lsGet('quiz', {})[id] || null; },
  reset() { lsSet('done', []); lsSet('quiz', {}); location.reload(); },
};

export const Prefs = {
  get teacher() { return lsGet('teacher', false); },
  set teacher(v) { lsSet('teacher', !!v); document.body.classList.toggle('teacher-mode', !!v); },
  get reduceMotion() { return lsGet('reduceMotion', false); },
  set reduceMotion(v) { lsSet('reduceMotion', !!v); document.body.classList.toggle('reduce-motion', !!v); },
  get sound() { return lsGet('sound', false); },
  set sound(v) { lsSet('sound', !!v); },
};

/* 是否應該關掉動畫（系統設定或使用者自己關的）*/
export function motionOff() {
  return Prefs.reduceMotion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ==========================================================================
   2. 音效（用 Web Audio 即時合成，不需要音檔）
   ========================================================================== */
let audioCtx = null;
export function beep(type = 'ok') {
  if (!Prefs.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    const freq = { ok: 880, good: 1174.7, bad: 220, tick: 660 }[type] || 660;
    o.frequency.setValueAtTime(freq, now);
    if (type === 'good') o.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);
    if (type === 'bad') o.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.15);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.start(now); o.stop(now + 0.28);
  } catch (e) { /* 瀏覽器不支援就算了 */ }
}

/* ==========================================================================
   3. 導覽列
   ========================================================================== */
export function buildNav(container) {
  const el = container || document.querySelector('[data-nav]');
  if (!el) return;
  el.className = 'nav';
  el.innerHTML = `
    <a class="brand" href="${BASE}index.html">
      <span class="logo" aria-hidden="true"></span>
      <span><b>普通化學互動自學</b><br><span>General Chemistry · 綠色化學版</span></span>
    </a>
    <span class="spacer"></span>
    <div class="nav-tools">
      <button class="toggle-chip" data-pref="teacher" aria-pressed="false"
              aria-label="切換教師模式，顯示公式與參數"><span aria-hidden="true">👩‍🏫</span><span class="lbl">教師模式</span></button>
      <button class="toggle-chip" data-pref="reduceMotion" aria-pressed="false"
              aria-label="切換減少動態效果"><span aria-hidden="true">🍃</span><span class="lbl">減少動態</span></button>
      <button class="toggle-chip" data-pref="sound" aria-pressed="false"
              aria-label="切換音效"><span aria-hidden="true">🔊</span><span class="lbl">音效</span></button>
    </div>`;

  el.querySelectorAll('[data-pref]').forEach(btn => {
    const key = btn.dataset.pref;
    const sync = () => btn.setAttribute('aria-pressed', String(!!Prefs[key]));
    sync();
    btn.addEventListener('click', () => { Prefs[key] = !Prefs[key]; sync(); beep('tick'); });
  });
}

/* ---------- 麵包屑 ----------
   用法：buildCrumbs(el, [{t:'首頁', href:'index.html'}, {t:'第一階段', href:'stage1.html'}, {t:'Ch3 化學計量'}]) */
export function buildCrumbs(container, items) {
  const el = container || document.querySelector('[data-crumbs]');
  if (!el) return;
  el.className = 'crumbs';
  el.setAttribute('aria-label', '麵包屑導覽');
  el.innerHTML = items.map((it, i) => {
    const last = i === items.length - 1;
    const node = last || !it.href
      ? `<span class="cur"${last ? ' aria-current="page"' : ''}>${it.t}</span>`
      : `<a href="${BASE}${it.href}">${it.t}</a>`;
    return (i ? '<span class="sep" aria-hidden="true">›</span>' : '') + node;
  }).join('');
}

/* ==========================================================================
   4. 環形進度條
   ========================================================================== */
export function ring(ratio, size = 56, opts = {}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, ratio)));
  const wrap = document.createElement('span');
  wrap.className = 'ring' + (opts.theme === 'ocean' ? ' ocean' : '');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', opts.label || `完成度 ${Math.round(ratio * 100)}%`);
  wrap.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="6"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="6"
              stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
    </svg>
    <span class="ring-txt">${opts.text ?? Math.round(ratio * 100) + '%'}</span>`;
  return wrap;
}

/* ==========================================================================
   5. 數值滾動顯示
   ========================================================================== */
export function setNum(el, value, digits = 2, animate = true) {
  if (!el) return;
  const target = Number(value);
  const txt = Number.isFinite(target) ? target.toFixed(digits) : String(value);
  if (!animate || motionOff()) { el.textContent = txt; return; }

  const from = parseFloat(el.textContent.replace(/[^\d.\-]/g, ''));
  // 先把最終值寫進去，動畫只是「補上過程」；
  // 這樣即使分頁被瀏覽器凍結（requestAnimationFrame 不跑），數字仍然是正確的。
  el.textContent = txt;
  if (!Number.isFinite(from) || !Number.isFinite(target) || Math.abs(target - from) < 1e-9) return;
  cancelAnimationFrame(el._numRaf);
  const t0 = performance.now(), dur = 260;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);              // easeOutCubic
    el.textContent = (from + (target - from) * e).toFixed(digits);
    if (k < 1) el._numRaf = requestAnimationFrame(step);
    else el.textContent = txt;
  };
  el._numRaf = requestAnimationFrame(step);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* ==========================================================================
   6. 葉片粒子（自製 confetti）
   ========================================================================== */
let confCanvas = null, confParticles = [], confRaf = 0;
export function leafBurst(x, y, count = 26) {
  if (motionOff()) return;
  if (!confCanvas) {
    confCanvas = document.createElement('canvas');
    confCanvas.id = 'confetti-canvas';
    confCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(confCanvas);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  confCanvas.width = innerWidth * dpr; confCanvas.height = innerHeight * dpr;
  confCanvas.style.width = innerWidth + 'px'; confCanvas.style.height = innerHeight + 'px';
  const ctx = confCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#3FA34D', '#7ED08A', '#1E9EB3', '#FFC93C', '#A8DFA0'];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 7;
    confParticles.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 3,
      rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .28,
      w: 7 + Math.random() * 8, h: 4 + Math.random() * 5,
      c: colors[(Math.random() * colors.length) | 0], life: 1,
    });
  }
  if (!confRaf) confRaf = requestAnimationFrame(confStep);
}
function confStep() {
  const ctx = confCanvas.getContext('2d');
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  confParticles = confParticles.filter(p => p.life > 0);
  for (const p of confParticles) {
    p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy;
    p.rot += p.vr; p.life -= 0.012;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    // 葉片形狀：兩段二次貝茲曲線
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, 0);
    ctx.quadraticCurveTo(0, -p.h, p.w / 2, 0);
    ctx.quadraticCurveTo(0, p.h, -p.w / 2, 0);
    ctx.fill();
    ctx.restore();
  }
  if (confParticles.length) { confRaf = requestAnimationFrame(confStep); }
  else { confRaf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

/* ==========================================================================
   7. 程式生成的自然背景
   ========================================================================== */
export function buildAmbient(opts = {}) {
  if (document.querySelector('.ambient')) return;
  const amb = document.createElement('div');
  amb.className = 'ambient';
  amb.setAttribute('aria-hidden', 'true');

  // --- 山稜線：用亂數產生三層折線（中央山脈 / 海岸山脈的層次感）---
  const ridge = (seed, h, color) => {
    const w = 1440, pts = [];
    let rnd = seed;
    const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
    for (let x = 0; x <= w; x += 60) {
      pts.push([x, h - (rand() * h * 0.55 + h * 0.12)]);
    }
    let d = `M0,${h + 40} L${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      d += ` Q${x0.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`;
    }
    d += ` L${w},${h + 40} Z`;
    return `<svg viewBox="0 0 ${w} ${h + 40}" preserveAspectRatio="none" width="100%" height="${h + 40}">
              <path d="${d}" fill="${color}"/></svg>`;
  };

  amb.innerHTML = `
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
    <div class="ridge r3">${ridge(101, 240, '#1E9EB3')}</div>
    <div class="ridge r2">${ridge(577, 190, '#3FA34D')}</div>
    <div class="ridge r1">${ridge(913, 130, '#2E7D3A')}</div>`;

  // --- 漂浮葉片與氣泡 ---
  if (!motionOff()) {
    const n = opts.floaters ?? 14;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'flo';
      const size = 8 + Math.random() * 16;
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.animationDuration = (22 + Math.random() * 26).toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * 40).toFixed(1) + 's';
      const isLeaf = i % 3 !== 0;
      s.innerHTML = isLeaf
        ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
             <path d="M12 2C6 6 3 11 4 18c7 1 12-2 16-8-3-4-5-6-8-8z" fill="#3FA34D" opacity=".55"/>
             <path d="M4 18C8 13 12 9 18 6" stroke="#2E7D3A" stroke-width="1.1" opacity=".5"/>
           </svg>`
        : `<svg width="${size}" height="${size}" viewBox="0 0 24 24">
             <circle cx="12" cy="12" r="9" fill="none" stroke="#1E9EB3" stroke-width="1.6" opacity=".5"/>
             <circle cx="9" cy="9" r="2.4" fill="#ffffff" opacity=".7"/>
           </svg>`;
      amb.appendChild(s);
    }
  }
  document.body.appendChild(amb);
}

/* ==========================================================================
   8. 頁尾
   ========================================================================== */
export function buildFooter(container, extra = '') {
  const el = container || document.querySelector('[data-footer]');
  if (!el) return;
  el.className = 'site-foot';
  el.innerHTML = `
    ${extra}
    <p>大學普通化學互動自學 WebUI ｜ 章節架構參考 Zumdahl <i>Chemistry</i>；內容以綠色化學十二原則與花蓮在地案例重新設計。</p>
    <p>所有模擬皆為<strong>教學示意</strong>，非量子力學或分子動力學的精確解。數值來源見各章「資料來源」。</p>
    <p><button class="toggle-chip" id="reset-progress" aria-label="清除本機學習進度">🗑 清除本機學習進度</button></p>`;
  const btn = el.querySelector('#reset-progress');
  if (btn) btn.addEventListener('click', () => {
    if (confirm('確定要清除這台裝置上的所有學習進度與測驗成績嗎？')) Progress.reset();
  });
}

/* ==========================================================================
   9. 初始化（每頁只要呼叫一次 initPage()）
   ========================================================================== */
export function initPage(opts = {}) {
  document.body.classList.toggle('teacher-mode', Prefs.teacher);
  document.body.classList.toggle('reduce-motion', Prefs.reduceMotion);

  // 跳到主要內容
  if (!document.querySelector('.skip-link')) {
    const sk = document.createElement('a');
    sk.className = 'skip-link'; sk.href = '#main'; sk.textContent = '跳到主要內容';
    document.body.prepend(sk);
  }

  if (opts.ambient !== false) buildAmbient(opts);
  buildNav();
  if (opts.crumbs) buildCrumbs(null, opts.crumbs);
  buildFooter(null, opts.footerExtra || '');
  initGlossary(document);
  return { CHAPTERS, STAGES, getChapter, getStage, chaptersInStage, neighbours };
}

/* 讓沒有用 module 的地方（例如老師臨時貼的 script）也能取用 */
window.GenChem = { Progress, Prefs, leafBurst, setNum, ring, beep, BASE };
