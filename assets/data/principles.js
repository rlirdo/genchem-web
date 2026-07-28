/* ==========================================================================
   principles.js — 綠色化學十二原則（Anastas & Warner, 1998）
   chapters 欄位標出哪些章節有涵蓋該原則，首頁的「十二原則互動索引」會用到。
   ========================================================================== */

export const PRINCIPLES = [
  { no: 1,  zh: '預防廢棄物',       en: 'Prevention',
    desc: '寧可從源頭不產生廢棄物，也不要事後再處理。',
    chapters: ['ch03', 'ch04', 'ch12', 'ch15'] },
  { no: 2,  zh: '原子經濟性',       en: 'Atom Economy',
    desc: '設計合成路徑時，讓反應物的原子盡可能全部進到最終產物裡。',
    chapters: ['ch03', 'ch13'] },
  { no: 3,  zh: '低毒性合成',       en: 'Less Hazardous Chemical Syntheses',
    desc: '合成方法應盡量不使用、也不產生對人與環境有毒的物質。',
    chapters: ['ch02', 'ch04', 'ch14'] },
  { no: 4,  zh: '設計更安全的化學品', en: 'Designing Safer Chemicals',
    desc: '在保有功能的前提下，把產品的毒性降到最低。',
    chapters: ['ch08', 'ch14'] },
  { no: 5,  zh: '更安全的溶劑與助劑', en: 'Safer Solvents and Auxiliaries',
    desc: '盡量不用輔助物質（溶劑、分離劑）；必須用時要選無害的，例如水與超臨界 CO₂。',
    chapters: ['ch04', 'ch05', 'ch11'] },
  { no: 6,  zh: '能源效率設計',     en: 'Design for Energy Efficiency',
    desc: '認清能源使用的環境與經濟成本，盡量在常溫常壓下進行反應。',
    chapters: ['ch05', 'ch06', 'ch11', 'ch12', 'ch13'] },
  { no: 7,  zh: '使用可再生原料',   en: 'Use of Renewable Feedstocks',
    desc: '技術與經濟可行時，原料應取自可再生資源而非化石資源。',
    chapters: ['ch06', 'ch08'] },
  { no: 8,  zh: '減少衍生物',       en: 'Reduce Derivatives',
    desc: '盡量避免保護基、暫時性修飾等額外步驟，因為它們會消耗試劑並產生廢棄物。',
    chapters: ['ch03'] },
  { no: 9,  zh: '催化',             en: 'Catalysis',
    desc: '選擇性高的催化劑優於化學計量試劑。',
    chapters: ['ch12', 'ch13', 'ch06'] },
  { no: 10, zh: '可分解性設計',     en: 'Design for Degradation',
    desc: '化學產品在功能結束後應能分解成無害物質，不在環境中累積。',
    chapters: ['ch08', 'ch12'] },
  { no: 11, zh: '即時分析防污染',   en: 'Real-time Analysis for Pollution Prevention',
    desc: '發展即時、製程中的監測方法，在有害物質生成前就控制住。',
    chapters: ['ch01', 'ch02', 'ch14'] },
  { no: 12, zh: '本質安全的化學',   en: 'Inherently Safer Chemistry for Accident Prevention',
    desc: '選用能把火災、爆炸、洩漏風險降到最低的物質與型態。',
    chapters: ['ch05', 'ch13', 'ch15'] },
];

/* 依章節代碼取回涵蓋的原則清單 */
export function principlesOf(chapterId) {
  return PRINCIPLES.filter(p => p.chapters.includes(chapterId));
}

/* 依原則編號取回章節代碼 */
export function chaptersOf(no) {
  const p = PRINCIPLES.find(x => x.no === no);
  return p ? p.chapters : [];
}
