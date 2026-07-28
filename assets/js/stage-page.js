/* ==========================================================================
   stage-page.js — 第 2 階層「章節卡片牆」的共用邏輯
   stage1.html 與 stage2.html 都呼叫 mountStage('stage1' / 'stage2')。
   ========================================================================== */

import { initPage, Progress, ring, BASE } from './core.js';
import { getStage, chaptersInStage } from '../data/chapters.js';
import { principlesOf } from '../data/principles.js';

export function mountStage(stageId) {
  const s = getStage(stageId);
  if (!s) { console.error('[stage] 找不到階段：', stageId); return; }
  const list = chaptersInStage(stageId);
  const isS2 = stageId === 'stage2';

  document.title = `${s.zh}｜普通化學互動自學`;

  initPage({
    floaters: 12,
    crumbs: [{ t: '首頁', href: 'index.html' }, { t: s.short }],
  });

  const main = document.querySelector('#main');

  /* ---- 標題區 ---- */
  const head = document.createElement('header');
  head.style.cssText = 'padding:1.2rem 0 .4rem';
  const { done, total } = Progress.stageCount(stageId);
  head.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      <div style="flex:1 1 320px">
        <div style="font-size:var(--fs-xs);letter-spacing:.18em;text-transform:uppercase;font-weight:700;
                    color:var(--${isS2 ? 'ocean' : 'leaf'}-deep)">${s.range} · ${s.en}</div>
        <h1 style="margin:.2rem 0 .3rem">${s.zh}</h1>
        <p style="color:var(--ink-2);max-width:46rem">${s.desc}</p>
      </div>
      <div style="text-align:center">
        <span class="ring-slot"></span>
        <div style="font-size:var(--fs-sm);color:var(--ink-2);margin-top:.3rem">已完成 ${done} / ${total} 章</div>
      </div>
    </div>`;
  head.querySelector('.ring-slot').appendChild(
    ring(total ? done / total : 0, 72, { theme: isS2 ? 'ocean' : '', label: `${s.short}完成度` })
  );
  main.appendChild(head);

  /* ---- 章節卡片牆 ---- */
  const grid = document.createElement('div');
  grid.className = 'chapter-grid';
  grid.style.margin = '1.2rem 0 2rem';
  list.forEach(c => {
    const isDone = Progress.isDone(c.id);
    const quiz = Progress.getQuiz(c.id);
    const ps = principlesOf(c.id);
    const a = document.createElement('a');
    a.className = 'ch-card' + (isS2 ? ' s2' : '');
    a.href = BASE + 'chapters/' + c.id + '.html';
    a.setAttribute('aria-label',
      `第 ${c.no} 章 ${c.zh}（${c.en}）。${c.see} ${isDone ? '已完成。' : '尚未完成。'}`);
    a.innerHTML = `
      <span class="ch-no">Ch ${c.no}</span>
      <h3 class="ch-zh">${c.zh}</h3>
      <p class="ch-en">${c.en}</p>
      <p class="ch-see">👀 ${c.see}</p>
      <div class="ch-foot">
        <span class="badge-green" title="${ps.map(p => '原則 #' + p.no + ' ' + p.zh).join('、')}">🌿 ${c.green}</span>
        ${isDone ? '<span class="badge-done">✓ 已完成</span>' : '<span class="badge-todo">尚未開始</span>'}
        ${quiz ? `<span class="badge-local">📝 測驗 ${quiz.score}/${quiz.total}</span>` : ''}
      </div>`;
    grid.appendChild(a);
  });
  main.appendChild(grid);

  /* ---- 跨階段導覽 ---- */
  const nav = document.createElement('nav');
  nav.className = 'ch-foot-nav';
  nav.innerHTML = `
    <a class="btn ghost" href="${BASE}index.html">← 回首頁</a>
    <span class="spacer"></span>
    <a class="btn ${isS2 ? '' : 'ocean'}" href="${BASE}${isS2 ? 'stage1.html' : 'stage2.html'}">
      切換到${isS2 ? '第一階段（Ch1–Ch8）' : '第二階段（Ch11–Ch15）'} →</a>`;
  main.appendChild(nav);
}
