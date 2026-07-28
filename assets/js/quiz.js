/* ==========================================================================
   quiz.js — 共用小測驗元件
   支援三種題型：
     single : 單選     { type:'single', q, options:[], answer: 索引, hint, explain, green }
     multi  : 多選     { type:'multi',  q, options:[], answer:[索引...], hint, explain, green }
     match  : 拖曳配對 { type:'match',  q, left:[], right:[], answer:[右邊索引...], hint, explain, green }
   規則（依規格）：答錯只給提示，不直接給答案；答對放葉片粒子動畫。
   green: true 代表這是綠色化學／永續判斷題（會顯示綠葉標記，並計入綠色占比）。
   ========================================================================== */

import { leafBurst, beep, Progress, motionOff } from './core.js';

const CSS_ID = 'quiz-inline-style';
const STYLE = `
.quiz { display: flex; flex-direction: column; gap: 1rem; }
.quiz-head { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
.quiz-head .q-score { font-family: var(--font-num); font-weight:700; color: var(--leaf-deep); }
.q-item { border:1px solid var(--line); border-radius: var(--r); padding: .9rem 1rem; background:#fff; }
.q-item.correct { border-color: var(--leaf); background: var(--leaf-soft); }
.q-item.wrong   { border-color: var(--coral); background: var(--coral-soft); }
.q-num { font: 700 var(--fs-xs)/1 var(--font-num); color:#fff; background: var(--ocean);
         padding:.25rem .5rem; border-radius:6px; margin-right:.45rem; }
.q-title { font-weight:700; margin:0 0 .6rem; line-height:1.6; }
.q-green { font-size: var(--fs-xs); background: var(--leaf-soft); color: var(--leaf-deep);
           border:1px solid rgba(63,163,77,.35); padding:.12rem .5rem; border-radius:999px; margin-left:.35rem;
           font-weight:700; white-space:nowrap; }
.q-opts { display:flex; flex-direction:column; gap:.4rem; margin-bottom:.7rem; }
.q-opt { display:flex; align-items:flex-start; gap:.55rem; padding:.5rem .65rem; border-radius: var(--r-sm);
         border:1.5px solid var(--line); cursor:pointer; background:#fff; font-size: var(--fs-sm); line-height:1.55;
         transition: border-color .16s, background .16s; }
.q-opt:hover { border-color: var(--ocean); background: rgba(30,158,179,.05); }
.q-opt input { margin-top:.28rem; width:17px; height:17px; accent-color: var(--leaf); flex:none; cursor:pointer; }
.q-opt.is-correct { border-color: var(--leaf); background: var(--leaf-soft); }
.q-opt.is-wrong   { border-color: var(--coral); background: var(--coral-soft); }
.q-actions { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
.q-fb { font-size: var(--fs-sm); margin-top:.6rem; padding:.55rem .75rem; border-radius: var(--r-sm); line-height:1.6; }
.q-fb.ok   { background: var(--leaf-soft); color: var(--leaf-deep); border-left:4px solid var(--leaf); }
.q-fb.no   { background: var(--coral-soft); color: var(--coral-deep); border-left:4px solid var(--coral); }
.q-fb[hidden] { display:none; }
/* 拖曳配對 */
.q-match { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-bottom:.7rem; }
.q-col { display:flex; flex-direction:column; gap:.4rem; }
.q-col h5 { margin:0 0 .1rem; font-size: var(--fs-xs); color: var(--ink-3); }
.m-item { padding:.5rem .6rem; border:1.5px solid var(--line); border-radius: var(--r-sm);
          background:#fff; font-size: var(--fs-sm); cursor:pointer; text-align:left; font-family:inherit;
          transition: border-color .16s, background .16s, transform .16s; line-height:1.5; }
.m-item:active { transform: scale(.97); }
.m-item.sel { border-color: var(--sun); background: var(--sun-soft); }
.m-item.paired { border-color: var(--ocean); background: var(--ocean-soft); }
.m-item .tagno { font: 700 var(--fs-xs)/1 var(--font-num); color: var(--ocean-deep); margin-right:.35rem; }
.m-item.is-correct { border-color: var(--leaf); background: var(--leaf-soft); }
.m-item.is-wrong { border-color: var(--coral); background: var(--coral-soft); }
.q-final { padding:.9rem 1rem; border-radius: var(--r); font-weight:700; }
.q-final.pass { background: var(--leaf-soft); color: var(--leaf-deep); }
.q-final.tryagain { background: var(--sun-soft); color: var(--sun-deep); }
@media (max-width: 560px) { .q-match { grid-template-columns: 1fr; } }
`;

function ensureStyle() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID; s.textContent = STYLE;
  document.head.appendChild(s);
}

const eq = (a, b) => a.length === b.length && a.every(v => b.includes(v));

/**
 * 建立測驗
 * @param {HTMLElement} host 容器
 * @param {string} chapterId 章節代碼（用來存成績）
 * @param {Array} questions 題目陣列
 */
export function renderQuiz(host, chapterId, questions) {
  ensureStyle();
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'quiz';

  const greenCount = questions.filter(q => q.green).length;
  const head = document.createElement('div');
  head.className = 'quiz-head';
  head.innerHTML = `
    <h3 style="margin:0">挑戰測驗</h3>
    <span class="badge-green">🌿 綠色化學題 ${greenCount}/${questions.length}</span>
    <span class="spacer" style="flex:1"></span>
    <span class="q-score" aria-live="polite">已答對 0 / ${questions.length}</span>`;
  wrap.appendChild(head);

  const state = questions.map(() => ({ done: false, tries: 0 }));
  const scoreEl = head.querySelector('.q-score');

  const refreshScore = () => {
    const n = state.filter(s => s.done).length;
    scoreEl.textContent = `已答對 ${n} / ${questions.length}`;
    if (n === questions.length) {
      Progress.saveQuiz(chapterId, n, questions.length);
      final.hidden = false;
      final.className = 'q-final pass';
      final.textContent = `🎉 全部答對！你已經掌握這一章的重點，記得回到上方按「標記為已完成」。`;
      const r = final.getBoundingClientRect();
      leafBurst(r.left + r.width / 2, r.top + 20, 40);
      beep('good');
    }
  };

  questions.forEach((q, qi) => wrap.appendChild(buildQuestion(q, qi, state, refreshScore)));

  const final = document.createElement('div');
  final.className = 'q-final'; final.hidden = true; final.setAttribute('role', 'status');
  wrap.appendChild(final);

  host.appendChild(wrap);
  return wrap;
}

function buildQuestion(q, qi, state, refreshScore) {
  const item = document.createElement('section');
  item.className = 'q-item';
  const gid = `q${qi}_${Math.random().toString(36).slice(2, 7)}`;

  const title = document.createElement('p');
  title.className = 'q-title';
  title.innerHTML = `<span class="q-num">Q${qi + 1}</span>${q.q}` +
    (q.green ? `<span class="q-green">🌿 綠色化學</span>` : '');
  item.appendChild(title);

  const fb = document.createElement('div');
  fb.className = 'q-fb'; fb.hidden = true; fb.setAttribute('role', 'status');

  let getAnswer, showResult;

  if (q.type === 'match') {
    const grid = document.createElement('div');
    grid.className = 'q-match';
    const colL = document.createElement('div'); colL.className = 'q-col';
    const colR = document.createElement('div'); colR.className = 'q-col';
    colL.innerHTML = `<h5>${q.leftTitle || '項目'}</h5>`;
    colR.innerHTML = `<h5>${q.rightTitle || '對應敘述'}</h5>`;

    const pairs = new Array(q.left.length).fill(-1);   // pairs[左索引] = 右索引
    let selL = -1;
    const lBtns = [], rBtns = [];

    const paint = () => {
      lBtns.forEach((b, i) => {
        b.classList.toggle('sel', selL === i);
        b.classList.toggle('paired', pairs[i] >= 0);
        const tag = b.querySelector('.tagno');
        tag.textContent = pairs[i] >= 0 ? String.fromCharCode(65 + pairs[i]) : '·';
      });
      rBtns.forEach((b, j) => b.classList.toggle('paired', pairs.includes(j)));
    };

    q.left.forEach((txt, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'm-item';
      b.innerHTML = `<span class="tagno">·</span>${txt}`;
      b.setAttribute('aria-label', `左側項目 ${i + 1}：${txt}。先選這個，再點右側對應的敘述。`);
      b.addEventListener('click', () => { selL = (selL === i ? -1 : i); paint(); });
      lBtns.push(b); colL.appendChild(b);
    });
    q.right.forEach((txt, j) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'm-item';
      b.innerHTML = `<span class="tagno">${String.fromCharCode(65 + j)}</span>${txt}`;
      b.setAttribute('aria-label', `右側敘述 ${String.fromCharCode(65 + j)}：${txt}`);
      b.addEventListener('click', () => {
        if (selL < 0) { fb.hidden = false; fb.className = 'q-fb no'; fb.textContent = '請先點左邊的項目，再點右邊要配對的敘述。'; return; }
        // 同一個右邊選項只能被用一次
        const used = pairs.indexOf(j); if (used >= 0) pairs[used] = -1;
        pairs[selL] = j; selL = -1; paint();
      });
      rBtns.push(b); colR.appendChild(b);
    });
    paint();
    grid.append(colL, colR);
    item.appendChild(grid);

    getAnswer = () => pairs.slice();
    showResult = (ok) => {
      lBtns.forEach((b, i) => {
        b.classList.remove('is-correct', 'is-wrong');
        if (pairs[i] < 0) return;
        b.classList.add(pairs[i] === q.answer[i] ? 'is-correct' : 'is-wrong');
      });
      if (ok) lBtns.forEach(b => { b.disabled = true; }), rBtns.forEach(b => { b.disabled = true; });
    };
    var check = () => pairs.every((v, i) => v === q.answer[i]);
    var isBlank = () => pairs.some(v => v < 0);

  } else {
    const multi = q.type === 'multi';
    const opts = document.createElement('div');
    opts.className = 'q-opts';
    opts.setAttribute('role', multi ? 'group' : 'radiogroup');
    opts.setAttribute('aria-label', q.q.replace(/<[^>]+>/g, ''));
    const inputs = [];
    q.options.forEach((txt, i) => {
      const lab = document.createElement('label');
      lab.className = 'q-opt';
      lab.innerHTML = `<input type="${multi ? 'checkbox' : 'radio'}" name="${gid}" value="${i}"
                        aria-label="選項 ${String.fromCharCode(65 + i)}"><span>(${String.fromCharCode(65 + i)}) ${txt}</span>`;
      opts.appendChild(lab);
      inputs.push(lab.querySelector('input'));
    });
    item.appendChild(opts);

    getAnswer = () => inputs.map((el, i) => el.checked ? i : -1).filter(i => i >= 0);
    showResult = (ok) => {
      const ans = multi ? q.answer : [q.answer];
      inputs.forEach((el, i) => {
        const lab = el.closest('.q-opt');
        lab.classList.remove('is-correct', 'is-wrong');
        if (el.checked) lab.classList.add(ans.includes(i) ? 'is-correct' : 'is-wrong');
        if (ok) el.disabled = true;
      });
    };
    var check = () => {
      const picked = getAnswer();
      const ans = multi ? q.answer.slice() : [q.answer];
      return eq(picked, ans);
    };
    var isBlank = () => getAnswer().length === 0;
  }

  const actions = document.createElement('div');
  actions.className = 'q-actions';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn sm'; btn.textContent = '檢查答案';
  const hintBtn = document.createElement('button');
  hintBtn.type = 'button'; hintBtn.className = 'btn sm ghost'; hintBtn.textContent = '給我提示';
  actions.append(btn, hintBtn);
  item.append(actions, fb);

  hintBtn.addEventListener('click', () => {
    fb.hidden = false; fb.className = 'q-fb no';
    fb.innerHTML = `💡 <strong>提示：</strong>${q.hint || '再回頭看看上面的互動舞台，調整參數觀察數字怎麼變。'}`;
  });

  btn.addEventListener('click', () => {
    if (isBlank()) {
      fb.hidden = false; fb.className = 'q-fb no'; fb.textContent = '還沒作答喔，先選一個答案再檢查。';
      return;
    }
    state[qi].tries++;
    const ok = check();
    showResult(ok);
    fb.hidden = false;
    if (ok) {
      state[qi].done = true;
      item.classList.add('correct'); item.classList.remove('wrong');
      fb.className = 'q-fb ok';
      fb.innerHTML = `✅ <strong>答對了！</strong>${q.explain || ''}`;
      btn.disabled = true; hintBtn.disabled = true;
      const r = btn.getBoundingClientRect();
      leafBurst(r.left + r.width / 2, r.top, 18);
      beep('ok');
      refreshScore();
    } else {
      item.classList.add('wrong');
      fb.className = 'q-fb no';
      fb.innerHTML = `❌ <strong>還沒對，再試一次。</strong>` +
        `<br>💡 提示：${q.hint || '回到互動舞台調整參數，看看哪個數值真的變了。'}` +
        (state[qi].tries >= 3 && q.explain2 ? `<br>🔎 再想想：${q.explain2}` : '');
      beep('bad');
    }
  });

  return item;
}
