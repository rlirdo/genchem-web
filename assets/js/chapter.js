/* ==========================================================================
   chapter.js — 第 3 階層「章節頁」的統一骨架
   每個 chapters/chXX.html 只要提供「內容」，版面、導覽、進度、分頁都由這裡產生。

   用法（在章節頁的 <script type="module"> 裡）：
     import { mountChapter } from '../assets/js/chapter.js';
     import { init } from '../assets/js/sim/ch01.js';
     mountChapter({ id:'ch01', stageTitle:'…', init, quiz:[…], sources:[…] });

   章節頁需準備的 HTML：
     <main id="main" data-chapter></main>
     <template id="tpl-concept"> …觀念解說… </template>
     <template id="tpl-green">   …綠色化學／在地連結… </template>
   ========================================================================== */

import { initPage, Progress, BASE, leafBurst, beep } from './core.js';
import { getChapter, getStage, neighbours } from '../data/chapters.js';
import { principlesOf } from '../data/principles.js';
import { renderQuiz } from './quiz.js';
import { buildScenarioSwitch } from './ui/controls.js';
import { initGlossary } from '../data/glossary.js';

export async function mountChapter(cfg) {
  const ch = getChapter(cfg.id);
  if (!ch) { console.error('[chapter] 找不到章節設定：', cfg.id); return; }
  const stage = getStage(ch.stage);
  const nb = neighbours(cfg.id);
  const principles = principlesOf(cfg.id);

  document.title = `Ch${ch.no} ${ch.zh}｜普通化學互動自學`;

  /* ---------- 站台外框（導覽列、麵包屑、背景、頁尾）---------- */
  initPage({
    floaters: 8,
    crumbs: [
      { t: '首頁', href: 'index.html' },
      { t: stage.short, href: stage.file },
      { t: `Ch${ch.no} ${ch.zh}` },
    ],
  });

  const main = document.querySelector('[data-chapter]') || document.querySelector('#main');
  main.className = 'wrap';

  /* ---------- 標題區 ---------- */
  const head = document.createElement('header');
  head.className = 'ch-head';
  head.innerHTML = `
    <h1>Ch${ch.no}｜${ch.zh}</h1>
    <p class="ch-en-title">${ch.en}　·　主題：${ch.topic}</p>
    <div class="ch-tags">
      <span class="badge-green">🌿 ${ch.green}</span>
      ${principles.map(p => `<span class="principle-tag">原則 #${p.no} ${p.zh}</span>`).join('')}
    </div>`;
  main.appendChild(head);

  /* ---------- 主工作區：舞台 + 控制面板 ---------- */
  const wrapMain = document.createElement('div');
  wrapMain.className = 'ch-main';
  wrapMain.innerHTML = `
    <section class="stage-box" aria-label="互動舞台">
      <div class="stage-bar">
        <span class="stage-title" data-stage-title>${cfg.stageTitle || '互動舞台'}</span>
        <span class="spacer"></span>
        <span data-scenario-host></span>
      </div>
      <div class="stage-canvas" data-stage>
        <div class="stage-overlay" data-overlay hidden></div>
        ${cfg.hint ? `<div class="stage-hint">${cfg.hint}</div>` : ''}
      </div>
      <div class="stage-sub" data-sub ${cfg.sub === false ? 'hidden' : ''}></div>
      <p class="sim-disclaimer">⚠ ${cfg.disclaimer || '本模擬為教學示意，採用簡化模型，非量子力學／分子動力學的精確解。'}</p>
    </section>

    <aside class="panel" data-panel aria-label="控制面板與即時數據">
      <div class="panel-card ctrl">
        <h3>操作參數</h3>
        <div data-controls></div>
      </div>
      <div class="panel-card readout">
        <h3>即時數據</h3>
        <div data-readout></div>
      </div>
      <div class="panel-card green">
        <h3>🌿 綠色指標儀表板</h3>
        <div data-gauge></div>
      </div>
      ${cfg.panelExtra || ''}
    </aside>`;
  main.appendChild(wrapMain);

  /* 窄螢幕：控制面板變底部抽屜 */
  const panel = wrapMain.querySelector('[data-panel]');
  const drawerBtn = document.createElement('button');
  drawerBtn.className = 'btn drawer-toggle';
  drawerBtn.type = 'button';
  drawerBtn.innerHTML = '🎛 控制面板';
  drawerBtn.setAttribute('aria-expanded', 'false');
  drawerBtn.setAttribute('aria-controls', 'ch-panel');
  panel.id = 'ch-panel';
  drawerBtn.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    drawerBtn.setAttribute('aria-expanded', String(open));
    drawerBtn.innerHTML = open ? '✕ 收合面板' : '🎛 控制面板';
  });
  document.body.appendChild(drawerBtn);

  /* ---------- 分頁 ---------- */
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  tabs.innerHTML = `
    <div class="tab-btns" role="tablist" aria-label="章節內容分頁">
      <button role="tab" id="tb-1" aria-controls="tp-1" aria-selected="true">① 觀念解說</button>
      <button role="tab" id="tb-2" aria-controls="tp-2" aria-selected="false">② 綠色化學／在地連結</button>
      <button role="tab" id="tb-3" aria-controls="tp-3" aria-selected="false">③ 挑戰測驗</button>
    </div>
    <div class="tab-panels">
      <div class="tab-panel" role="tabpanel" id="tp-1" aria-labelledby="tb-1" tabindex="0"></div>
      <div class="tab-panel" role="tabpanel" id="tp-2" aria-labelledby="tb-2" tabindex="0" hidden></div>
      <div class="tab-panel" role="tabpanel" id="tp-3" aria-labelledby="tb-3" tabindex="0" hidden></div>
    </div>`;
  main.appendChild(tabs);

  const tplConcept = document.getElementById('tpl-concept');
  const tplGreen = document.getElementById('tpl-green');
  if (tplConcept) tabs.querySelector('#tp-1').append(tplConcept.content.cloneNode(true));
  if (tplGreen) {
    const p2 = tabs.querySelector('#tp-2');
    if (principles.length) {
      const pl = document.createElement('div');
      pl.className = 'principle-list';
      pl.innerHTML = principles.map(p =>
        `<span class="principle-tag" title="${p.desc}">原則 #${p.no} ${p.zh}（${p.en}）</span>`).join('');
      p2.appendChild(pl);
    }
    p2.append(tplGreen.content.cloneNode(true));
  }
  if (cfg.quiz && cfg.quiz.length) renderQuiz(tabs.querySelector('#tp-3'), cfg.id, cfg.quiz);

  const tabBtns = [...tabs.querySelectorAll('[role="tab"]')];
  tabBtns.forEach((b, i) => {
    b.addEventListener('click', () => selectTab(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabBtns.length) % tabBtns.length;
        selectTab(n); tabBtns[n].focus();
      }
    });
  });
  function selectTab(i) {
    tabBtns.forEach((b, j) => {
      b.setAttribute('aria-selected', String(i === j));
      tabs.querySelector('#tp-' + (j + 1)).hidden = i !== j;
    });
  }

  /* ---------- 資料來源 ---------- */
  if (cfg.sources && cfg.sources.length) {
    const src = document.createElement('div');
    src.className = 'sources';
    src.innerHTML = `<h4>本章化學數據來源</h4><ol>${cfg.sources.map(s => `<li>${s}</li>`).join('')}</ol>
      <p style="margin-top:.4rem">標示「≈」者為文獻區間之代表值或教學用概略值，非單一權威數字。</p>`;
    main.appendChild(src);
  }

  /* ---------- 底部導覽 + 標記完成 ---------- */
  const foot = document.createElement('nav');
  foot.className = 'ch-foot-nav';
  foot.setAttribute('aria-label', '章節導覽');
  foot.innerHTML = `
    ${nb.prev ? `<a class="btn ghost" href="${BASE}chapters/${nb.prev.id}.html">← Ch${nb.prev.no} ${nb.prev.zh}</a>`
              : `<a class="btn ghost" href="${BASE}${stage.file}">← 回章節牆</a>`}
    <span class="spacer"></span>
    <span class="done-state" data-done-state aria-live="polite"></span>
    <button class="btn" type="button" data-done-btn></button>
    <span class="spacer"></span>
    ${nb.next ? `<a class="btn ocean" href="${BASE}chapters/${nb.next.id}.html">Ch${nb.next.no} ${nb.next.zh} →</a>`
              : `<a class="btn ocean" href="${BASE}index.html">回首頁 →</a>`}`;
  main.appendChild(foot);

  const doneBtn = foot.querySelector('[data-done-btn]');
  const doneState = foot.querySelector('[data-done-state]');
  function syncDone() {
    const d = Progress.isDone(cfg.id);
    doneBtn.textContent = d ? '↩ 取消完成標記' : '✓ 標記為已完成';
    doneBtn.className = 'btn ' + (d ? 'ghost' : '');
    doneState.textContent = d ? '這一章已完成 🌿' : '';
  }
  doneBtn.addEventListener('click', () => {
    const next = !Progress.isDone(cfg.id);
    Progress.mark(cfg.id, next);
    syncDone();
    if (next) {
      const r = doneBtn.getBoundingClientRect();
      leafBurst(r.left + r.width / 2, r.top, 34);
      beep('good');
    }
  });
  syncDone();

  /* ---------- 啟動模擬 ---------- */
  const stageEl = wrapMain.querySelector('[data-stage]');
  const subEl = wrapMain.querySelector('[data-sub]');
  const overlayEl = wrapMain.querySelector('[data-overlay]');
  const scenarioHost = wrapMain.querySelector('[data-scenario-host]');
  const hostControls = wrapMain.querySelector('[data-controls]');
  const hostReadout = wrapMain.querySelector('[data-readout]');
  const hostGauge = wrapMain.querySelector('[data-gauge]');

  let scenarioCb = null;
  const sw = buildScenarioSwitch(scenarioHost, cfg.scenario || {}, (v) => scenarioCb && scenarioCb(v));

  const ctx = {
    chapter: ch,
    stageEl, subEl, overlayEl,
    hostControls, hostReadout, hostGauge,
    get scenario() { return sw.value; },
    onScenario(cb) { scenarioCb = cb; },
    setStageTitle(t) { wrapMain.querySelector('[data-stage-title]').textContent = t; },
    /** 在舞台右上角顯示一段即時文字（傳 null 隱藏）*/
    setOverlay(html) {
      if (html == null) { overlayEl.hidden = true; return; }
      overlayEl.hidden = false; overlayEl.innerHTML = html;
    },
    /** 慶祝動畫（達成目標時呼叫）*/
    celebrate(el) {
      const r = (el || stageEl).getBoundingClientRect();
      leafBurst(r.left + r.width / 2, r.top + r.height / 2, 30);
      beep('good');
    },
  };

  try {
    if (typeof cfg.init === 'function') await cfg.init(ctx);
  } catch (err) {
    console.error('[chapter] 模擬啟動失敗：', err);
    stageEl.innerHTML = `<div style="padding:1.4rem;color:#C6412A;font-size:.9rem">
      3D 舞台載入失敗：${err.message}<br>
      請確認 <code>assets/vendor/three.module.js</code> 存在，或改用支援 WebGL 的瀏覽器。</div>`;
  }

  // 內容裡的名詞小卡（分頁內容是後來插進去的，要再掃一次）
  initGlossary(document);

  // 3D 效能不足時提示已自動降級
  stageEl.addEventListener('stage:degrade', () => {
    const tip = document.createElement('div');
    tip.className = 'stage-hint';
    tip.style.left = 'auto'; tip.style.right = '.7rem'; tip.style.bottom = '.6rem';
    tip.textContent = '⚙ 偵測到效能較低，已自動降低畫質';
    stageEl.appendChild(tip);
    setTimeout(() => tip.remove(), 6000);
  });

  return ctx;
}
