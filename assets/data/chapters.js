/* ==========================================================================
   chapters.js — 全站章節目錄
   要新增一章：在下面 CHAPTERS 陣列加一筆，再建立 chapters/chXX.html
                與 assets/js/sim/chXX.js 即可，導覽與進度會自動接上。
   ========================================================================== */

export const STAGES = [
  {
    id: 'stage1',
    file: 'stage1.html',
    zh: '第一階段：基礎化學與原子分子結構',
    short: '第一階段',
    en: 'Foundations, Atoms & Bonding',
    range: 'Ch 1–Ch 8',
    desc: '從量測與莫耳出發，一路走到原子內部的軌域與化學鍵。用 3D 看見物質為什麼長這樣。',
    theme: 'leaf',
  },
  {
    id: 'stage2',
    file: 'stage2.html',
    zh: '第二階段：溶液、動力學與平衡',
    short: '第二階段',
    en: 'Solutions, Kinetics & Equilibrium',
    range: 'Ch 11–Ch 15',
    desc: '溶液怎麼運作、反應為什麼有快有慢、平衡如何自我調節，以及緩衝溶液的守門機制。',
    theme: 'ocean',
  },
];

export const CHAPTERS = [
  /* ---------------- 第一階段 ---------------- */
  { id: 'ch01', no: 1, stage: 'stage1',
    zh: '化學基礎', en: 'Chemical Foundations',
    see: '切換 Au／Al／Fe／Ti，在同體積盒子裡看原子怎麼堆、密度怎麼變。',
    topic: '微觀密度的粒子模型；精密度 vs 準確度',
    green: '輕量化減碳、花蓮岩石密度' },

  { id: 'ch02', no: 2, stage: 'stage1',
    zh: '原子、分子與離子', en: 'Atoms, Molecules, and Ions',
    see: '親手射 α 粒子打金箔，看它大多穿透、少數被彈回來。',
    topic: 'Thomson 與 Rutherford 的原子模型之爭',
    green: '都市採礦與生物瀝濾' },

  { id: 'ch03', no: 3, stage: 'stage1',
    zh: '化學計量', en: 'Stoichiometry',
    see: '拖曳分子配反應，找出誰是限量試劑，並比較兩條合成路線的原子經濟性。',
    topic: '限量試劑與莫耳守恆',
    green: '原子經濟性與 E-factor（本章綠色化學核心）' },

  { id: 'ch04', no: 4, stage: 'stage1',
    zh: '水溶液反應與溶液計量', en: 'Types of Chemical Reactions & Solution Stoichiometry',
    see: '看 NaCl 晶體被水分子一顆一顆剝離，再自己配一杯沉澱反應。',
    topic: '電解質解離與沉澱反應的微觀動態',
    green: '重金屬廢水處理與花蓮水質' },

  { id: 'ch05', no: 5, stage: 'stage1',
    zh: '氣體', en: 'Gases',
    see: '幾百顆分子在盒子裡亂撞，溫度一拉高速率分布就整個變形。',
    topic: '分子動力論與理想氣體的偏離',
    green: '溫室氣體 GWP 與碳捕捉' },

  { id: 'ch06', no: 6, stage: 'stage1',
    zh: '熱化學', en: 'Thermochemistry',
    see: '斷鍵時畫面轉冷、成鍵時轉暖，順便用鍵能算出 ΔH。',
    topic: '吸熱與放熱的鍵結重組能量圖',
    green: '燃料碳排比較與花蓮再生能源' },

  { id: 'ch07', no: 7, stage: 'stage1',
    zh: '原子結構與週期性', en: 'Atomic Structure and Periodicity',
    see: '把 s／p／d／f 軌域轉一圈，切開節面看看電子不會出現在哪裡。',
    topic: '3D 原子軌域的空間幾何與週期趨勢',
    green: '光電材料能隙與稀土回收' },

  { id: 'ch08', no: 8, stage: 'stage1',
    zh: '化學鍵基本概念', en: 'Bonding: General Concepts',
    see: '拖著兩顆原子靠近再拉開，勢能曲線會跟著你的手畫出來。',
    topic: '勢能曲線、偶極矩與晶格能',
    green: '仿生黏著與可分解塑膠' },

  /* ---------------- 第二階段 ---------------- */
  { id: 'ch11', no: 11, stage: 'stage2',
    zh: '溶液的性質', en: 'Properties of Solutions',
    see: '溶質擋住水面讓蒸氣壓掉下來；加壓到超過滲透壓就把海水擠成淡水。',
    topic: '依數性、蒸氣壓下降與滲透壓',
    green: '海水淡化能耗與花蓮深層海水' },

  { id: 'ch12', no: 12, stage: 'stage2',
    zh: '化學反應動力學', en: 'Chemical Kinetics',
    see: '自己瞄準角度發射分子，撞對了才會反應；加催化劑後山丘立刻矮一截。',
    topic: '碰撞理論與活化能障礙',
    green: '酵素與光觸媒催化（本章綠色比重最高）' },

  { id: 'ch13', no: 13, stage: 'stage2',
    zh: '化學平衡', en: 'Chemical Equilibrium',
    see: '平衡不是停止：分子還在兩邊來回跑，只是速率相等了。',
    topic: '動態平衡與勒沙特列原理',
    green: '哈柏法 vs 固氮酶、海洋酸化' },

  { id: 'ch14', no: 14, stage: 'stage2',
    zh: '酸與鹼', en: 'Acids and Bases',
    see: '兩杯同濃度的酸並排，弱酸大多還沒解離，強酸幾乎全跑光。',
    topic: '質子轉移與強／弱酸解離度',
    green: '酸雨、海洋酸化與天然指示劑' },

  { id: 'ch15', no: 15, stage: 'stage2',
    zh: '酸鹼平衡與緩衝溶液', en: 'Acid–Base Equilibria',
    see: '一滴一滴加鹼，緩衝溶液像海綿把質子接住，pH 幾乎不動。',
    topic: '緩衝機制與滴定曲線',
    green: '血液與海洋的天然緩衝、農地酸化' },
];

/* ---------- 查詢工具 ---------- */
export function getChapter(id) {
  return CHAPTERS.find(c => c.id === id) || null;
}
export function chaptersInStage(stageId) {
  return CHAPTERS.filter(c => c.stage === stageId);
}
export function getStage(stageId) {
  return STAGES.find(s => s.id === stageId) || null;
}
/* 上一章 / 下一章（跨階段連續）*/
export function neighbours(id) {
  const i = CHAPTERS.findIndex(c => c.id === id);
  return {
    prev: i > 0 ? CHAPTERS[i - 1] : null,
    next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : null,
  };
}
