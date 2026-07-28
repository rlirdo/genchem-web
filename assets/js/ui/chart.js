/* ==========================================================================
   ui/chart.js — 輕量 2D 繪圖（純 Canvas API，不依賴任何外部函式庫）
   提供折線、面積、長條、直方圖、散點、參考線與座標軸。
   老師若要改圖表顏色，改下面 PALETTE 即可。
   ========================================================================== */

export const PALETTE = {
  leaf: '#3FA34D', leafDeep: '#2E7D3A', ocean: '#1E9EB3', oceanDeep: '#14707F',
  sun: '#B87E00', coral: '#FF7A59', coralDeep: '#C6412A', ink: '#123B2E',
  grid: '#DCE9E2',
  // muted 同時用於刻度文字，因此取對白底 4.7:1 的深度以符合無障礙對比要求
  muted: '#5E7A6F',
};

export class Chart2D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts { pad:{l,r,t,b}, xLabel, yLabel, height }
   */
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.pad = Object.assign({ l: 46, r: 12, t: 14, b: 32 }, opts.pad || {});
    this.xLabel = opts.xLabel || '';
    this.yLabel = opts.yLabel || '';
    this.cssH = opts.height || 180;
    this.x0 = 0; this.x1 = 1; this.y0 = 0; this.y1 = 1;
    this.resize();
    // 容器寬度改變時自動重繪（由呼叫端負責重畫內容）
    this._ro = new ResizeObserver(() => { this.resize(); this.onResize && this.onResize(); });
    this._ro.observe(canvas.parentElement || canvas);
  }

  resize() {
    const parent = this.cv.parentElement;
    const w = Math.max(180, (parent ? parent.clientWidth : 320) - 0);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = this.cssH;
    this.cv.style.width = w + 'px';
    this.cv.style.height = this.cssH + 'px';
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setRange(x0, x1, y0, y1) { this.x0 = x0; this.x1 = x1; this.y0 = y0; this.y1 = y1; return this; }

  /* 座標換算：資料 → 畫布像素 */
  px(x) { return this.pad.l + (x - this.x0) / (this.x1 - this.x0) * (this.w - this.pad.l - this.pad.r); }
  py(y) { return this.h - this.pad.b - (y - this.y0) / (this.y1 - this.y0) * (this.h - this.pad.t - this.pad.b); }

  clear(bg) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, this.w, this.h); }
    return this;
  }

  /**
   * 畫座標軸與格線
   * opts: { xTicks:[值...] 或數量, yTicks, xFmt(v), yFmt(v), grid:true }
   */
  axes(opts = {}) {
    const c = this.ctx;
    const xt = Array.isArray(opts.xTicks) ? opts.xTicks : ticks(this.x0, this.x1, opts.xTicks || 5);
    const yt = Array.isArray(opts.yTicks) ? opts.yTicks : ticks(this.y0, this.y1, opts.yTicks || 4);
    const xFmt = opts.xFmt || (v => fmt(v));
    const yFmt = opts.yFmt || (v => fmt(v));

    c.save();
    c.font = '11px "Noto Sans TC", system-ui, sans-serif';
    c.strokeStyle = PALETTE.grid; c.lineWidth = 1;
    c.fillStyle = PALETTE.muted;

    if (opts.grid !== false) {
      yt.forEach(v => {
        const y = Math.round(this.py(v)) + .5;
        c.beginPath(); c.moveTo(this.pad.l, y); c.lineTo(this.w - this.pad.r, y); c.stroke();
      });
      xt.forEach(v => {
        const x = Math.round(this.px(v)) + .5;
        c.beginPath(); c.moveTo(x, this.pad.t); c.lineTo(x, this.h - this.pad.b); c.stroke();
      });
    }
    // 軸線
    c.strokeStyle = '#B9CFC4'; c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(this.pad.l, this.pad.t); c.lineTo(this.pad.l, this.h - this.pad.b);
    c.lineTo(this.w - this.pad.r, this.h - this.pad.b); c.stroke();

    // 刻度文字
    c.textAlign = 'center'; c.textBaseline = 'top';
    xt.forEach(v => c.fillText(xFmt(v), this.px(v), this.h - this.pad.b + 5));
    c.textAlign = 'right'; c.textBaseline = 'middle';
    yt.forEach(v => c.fillText(yFmt(v), this.pad.l - 6, this.py(v)));

    // 軸標題
    c.fillStyle = PALETTE.ink;
    if (this.xLabel) { c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(this.xLabel, this.w - this.pad.r, this.h - 2); }
    if (this.yLabel) {
      c.save(); c.translate(11, this.pad.t + 2); c.rotate(-Math.PI / 2);
      c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(this.yLabel, 0, 0); c.restore();
    }
    c.restore();
    return this;
  }

  /** pts: [[x,y], ...] */
  line(pts, opts = {}) {
    if (!pts || pts.length < 2) return this;
    const c = this.ctx;
    c.save();
    c.strokeStyle = opts.color || PALETTE.ocean;
    c.lineWidth = opts.width || 2;
    if (opts.dash) c.setLineDash(opts.dash);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    pts.forEach(([x, y], i) => i ? c.lineTo(this.px(x), this.py(y)) : c.moveTo(this.px(x), this.py(y)));
    c.stroke();
    c.restore();
    return this;
  }

  area(pts, color, baseY) {
    if (!pts || pts.length < 2) return this;
    const c = this.ctx;
    const yb = this.py(baseY ?? this.y0);
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(this.px(pts[0][0]), yb);
    pts.forEach(([x, y]) => c.lineTo(this.px(x), this.py(y)));
    c.lineTo(this.px(pts[pts.length - 1][0]), yb);
    c.closePath(); c.fill();
    c.restore();
    return this;
  }

  /** 長條圖 items:[{label, value, color}]，自動排版於 x 軸 */
  bars(items, opts = {}) {
    const c = this.ctx;
    const n = items.length;
    const areaW = this.w - this.pad.l - this.pad.r;
    const slot = areaW / n;
    const bw = slot * (opts.widthRatio || 0.56);
    c.save();
    c.font = '11px "Noto Sans TC", system-ui, sans-serif';
    items.forEach((it, i) => {
      const cx = this.pad.l + slot * (i + 0.5);
      const y = this.py(it.value), y0 = this.py(Math.max(this.y0, 0));
      c.fillStyle = it.color || PALETTE.leaf;
      const top = Math.min(y, y0), hgt = Math.abs(y0 - y);
      roundRect(c, cx - bw / 2, top, bw, Math.max(1, hgt), 5);
      c.fill();
      // 數值
      c.fillStyle = PALETTE.ink; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText(opts.fmt ? opts.fmt(it.value) : fmt(it.value), cx, top - 3);
      // 標籤
      c.fillStyle = PALETTE.muted; c.textBaseline = 'top';
      wrapText(c, it.label, cx, this.h - this.pad.b + 5, slot - 4, 12);
    });
    c.restore();
    return this;
  }

  /** 直方圖 counts: number[]（等寬），範圍用 setRange 的 x 軸 */
  hist(counts, opts = {}) {
    const c = this.ctx;
    const n = counts.length;
    const dx = (this.x1 - this.x0) / n;
    c.save();
    c.fillStyle = opts.color || 'rgba(30,158,179,.75)';
    for (let i = 0; i < n; i++) {
      if (!counts[i]) continue;
      const x = this.px(this.x0 + i * dx);
      const w = Math.max(1, this.px(this.x0 + (i + 1) * dx) - x - 1);
      const y = this.py(counts[i]);
      c.fillRect(x, y, w, this.py(this.y0) - y);
    }
    c.restore();
    return this;
  }

  dot(x, y, opts = {}) {
    const c = this.ctx;
    c.save();
    c.fillStyle = opts.color || PALETTE.coral;
    c.beginPath(); c.arc(this.px(x), this.py(y), opts.r || 3.5, 0, Math.PI * 2); c.fill();
    if (opts.stroke) { c.strokeStyle = opts.stroke; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
    return this;
  }

  vline(x, opts = {}) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = opts.color || PALETTE.coral; c.lineWidth = opts.width || 1.5;
    c.setLineDash(opts.dash || [5, 4]);
    const px = this.px(x);
    c.beginPath(); c.moveTo(px, this.pad.t); c.lineTo(px, this.h - this.pad.b); c.stroke();
    if (opts.label) {
      c.setLineDash([]); c.fillStyle = opts.color || PALETTE.coral;
      c.font = '11px "Noto Sans TC", system-ui, sans-serif';
      c.textAlign = px > this.w * .6 ? 'right' : 'left'; c.textBaseline = 'top';
      c.fillText(opts.label, px + (px > this.w * .6 ? -4 : 4), this.pad.t + 2);
    }
    c.restore();
    return this;
  }

  hline(y, opts = {}) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = opts.color || PALETTE.muted; c.lineWidth = opts.width || 1.5;
    c.setLineDash(opts.dash || [5, 4]);
    const py = this.py(y);
    c.beginPath(); c.moveTo(this.pad.l, py); c.lineTo(this.w - this.pad.r, py); c.stroke();
    if (opts.label) {
      c.setLineDash([]); c.fillStyle = opts.color || PALETTE.muted;
      c.font = '11px "Noto Sans TC", system-ui, sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'bottom';
      c.fillText(opts.label, this.pad.l + 4, py - 2);
    }
    c.restore();
    return this;
  }

  /** 在資料座標處寫字 */
  label(x, y, text, opts = {}) {
    const c = this.ctx;
    c.save();
    c.font = opts.font || '11px "Noto Sans TC", system-ui, sans-serif';
    c.fillStyle = opts.color || PALETTE.ink;
    c.textAlign = opts.align || 'center';
    c.textBaseline = opts.baseline || 'bottom';
    if (opts.bg) {
      const m = c.measureText(text);
      const px = this.px(x), py = this.py(y);
      c.fillStyle = opts.bg;
      roundRect(c, px - m.width / 2 - 4, py - 15, m.width + 8, 15, 4); c.fill();
      c.fillStyle = opts.color || '#fff';
    }
    c.fillText(text, this.px(x), this.py(y) - (opts.dy || 0));
    c.restore();
    return this;
  }

  /** 圖例 items:[{label,color}] */
  legend(items, opts = {}) {
    const c = this.ctx;
    c.save();
    c.font = '11px "Noto Sans TC", system-ui, sans-serif';
    c.textBaseline = 'middle';
    let x = opts.x ?? (this.pad.l + 6), y = opts.y ?? (this.pad.t + 8);
    items.forEach(it => {
      c.fillStyle = it.color;
      roundRect(c, x, y - 4, 14, 8, 3); c.fill();
      c.fillStyle = PALETTE.ink; c.textAlign = 'left';
      c.fillText(it.label, x + 19, y);
      const wdt = c.measureText(it.label).width + 30;
      if (opts.vertical) y += 15; else x += wdt;
    });
    c.restore();
    return this;
  }

  destroy() { this._ro && this._ro.disconnect(); }
}

/* ---------- 小工具 ---------- */
export function ticks(a, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n);
  return out;
}
export function fmt(v) {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1).replace('e', '×10^');
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function wrapText(c, text, cx, y, maxW, lh) {
  const words = String(text).split('');
  let line = '', lines = [];
  for (const ch of words) {
    if (c.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((L, i) => c.fillText(L, cx, y + i * lh));
}
