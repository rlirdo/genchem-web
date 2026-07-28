/* ==========================================================================
   elements.js — 週期表資料（Z = 1–86）
   電子組態以 Aufbau 順序程式產生，並套用已知的例外（Cr、Cu、Pd、Au…）。
   游離能、共價半徑、電負度存放在 constants.js，這裡只放符號、名稱與位置。
   ========================================================================== */

/* [符號, 中文名, 週期, 族(1–18)]；鑭系放在第 8 列、錒系第 9 列（本站只到 Rn） */
export const ELEMENTS = [
  ['H', '氫', 1, 1], ['He', '氦', 1, 18],
  ['Li', '鋰', 2, 1], ['Be', '鈹', 2, 2], ['B', '硼', 2, 13], ['C', '碳', 2, 14],
  ['N', '氮', 2, 15], ['O', '氧', 2, 16], ['F', '氟', 2, 17], ['Ne', '氖', 2, 18],
  ['Na', '鈉', 3, 1], ['Mg', '鎂', 3, 2], ['Al', '鋁', 3, 13], ['Si', '矽', 3, 14],
  ['P', '磷', 3, 15], ['S', '硫', 3, 16], ['Cl', '氯', 3, 17], ['Ar', '氬', 3, 18],
  ['K', '鉀', 4, 1], ['Ca', '鈣', 4, 2], ['Sc', '鈧', 4, 3], ['Ti', '鈦', 4, 4],
  ['V', '釩', 4, 5], ['Cr', '鉻', 4, 6], ['Mn', '錳', 4, 7], ['Fe', '鐵', 4, 8],
  ['Co', '鈷', 4, 9], ['Ni', '鎳', 4, 10], ['Cu', '銅', 4, 11], ['Zn', '鋅', 4, 12],
  ['Ga', '鎵', 4, 13], ['Ge', '鍺', 4, 14], ['As', '砷', 4, 15], ['Se', '硒', 4, 16],
  ['Br', '溴', 4, 17], ['Kr', '氪', 4, 18],
  ['Rb', '銣', 5, 1], ['Sr', '鍶', 5, 2], ['Y', '釔', 5, 3], ['Zr', '鋯', 5, 4],
  ['Nb', '鈮', 5, 5], ['Mo', '鉬', 5, 6], ['Tc', '鎝', 5, 7], ['Ru', '釕', 5, 8],
  ['Rh', '銠', 5, 9], ['Pd', '鈀', 5, 10], ['Ag', '銀', 5, 11], ['Cd', '鎘', 5, 12],
  ['In', '銦', 5, 13], ['Sn', '錫', 5, 14], ['Sb', '銻', 5, 15], ['Te', '碲', 5, 16],
  ['I', '碘', 5, 17], ['Xe', '氙', 5, 18],
  ['Cs', '銫', 6, 1], ['Ba', '鋇', 6, 2],
  ['La', '鑭', 8, 3], ['Ce', '鈰', 8, 4], ['Pr', '鐠', 8, 5], ['Nd', '釹', 8, 6],
  ['Pm', '鉕', 8, 7], ['Sm', '釤', 8, 8], ['Eu', '銪', 8, 9], ['Gd', '釓', 8, 10],
  ['Tb', '鋱', 8, 11], ['Dy', '鏑', 8, 12], ['Ho', '鈥', 8, 13], ['Er', '鉺', 8, 14],
  ['Tm', '銩', 8, 15], ['Yb', '鐿', 8, 16], ['Lu', '鎦', 8, 17],
  ['Hf', '鉿', 6, 4], ['Ta', '鉭', 6, 5], ['W', '鎢', 6, 6], ['Re', '錸', 6, 7],
  ['Os', '鋨', 6, 8], ['Ir', '銥', 6, 9], ['Pt', '鉑', 6, 10], ['Au', '金', 6, 11],
  ['Hg', '汞', 6, 12], ['Tl', '鉈', 6, 13], ['Pb', '鉛', 6, 14], ['Bi', '鉍', 6, 15],
  ['Po', '釙', 6, 16], ['At', '砈', 6, 17], ['Rn', '氡', 6, 18],
];

/* 元素分類（決定卡片顏色）*/
export function category(z, group, period) {
  if (period === 8) return 'lanth';
  if ([2, 10, 18, 36, 54, 86].includes(z)) return 'noble';
  if (group === 1 && z !== 1) return 'alkali';
  if (group === 2) return 'alkaline';
  if (group >= 3 && group <= 12) return 'transition';
  if (z === 1) return 'nonmetal';
  if ([5, 14, 32, 33, 51, 52, 84, 85].includes(z)) return 'metalloid';
  if ([6, 7, 8, 9, 15, 16, 17, 34, 35, 53].includes(z)) return 'nonmetal';
  return 'postmetal';
}

export const CAT_COLOR = {
  alkali: '#FFD9C2', alkaline: '#FFEFC2', transition: '#D6E9F5',
  postmetal: '#E4E9E6', metalloid: '#D9F0DE', nonmetal: '#CFEBE0',
  noble: '#E7DCF5', lanth: '#F5DCE9',
};
export const CAT_NAME = {
  alkali: '鹼金屬', alkaline: '鹼土金屬', transition: '過渡金屬',
  postmetal: '後過渡金屬', metalloid: '類金屬', nonmetal: '非金屬',
  noble: '惰性氣體', lanth: '鑭系（稀土）',
};

/* ---------- 電子組態 ---------- */
const ORDER = [
  ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10],
  ['4p', 6], ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10],
  ['6p', 6], ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6],
];
/* 已知的 Aufbau 例外（以完整價層寫出）source: CRC Handbook 97th ed. */
const EXCEPTIONS = {
  24: '[Ar] 3d⁵ 4s¹', 29: '[Ar] 3d¹⁰ 4s¹',
  41: '[Kr] 4d⁴ 5s¹', 42: '[Kr] 4d⁵ 5s¹', 44: '[Kr] 4d⁷ 5s¹', 45: '[Kr] 4d⁸ 5s¹',
  46: '[Kr] 4d¹⁰', 47: '[Kr] 4d¹⁰ 5s¹',
  57: '[Xe] 5d¹ 6s²', 58: '[Xe] 4f¹ 5d¹ 6s²', 64: '[Xe] 4f⁷ 5d¹ 6s²',
  78: '[Xe] 4f¹⁴ 5d⁹ 6s¹', 79: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹',
};
const NOBLE = { 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = n => String(n).split('').map(c => SUP[c]).join('');

/** 完整電子組態（Aufbau 順序，含例外）*/
export function configuration(z) {
  if (EXCEPTIONS[z]) return EXCEPTIONS[z];
  let left = z;
  const parts = [];
  for (const [orb, cap] of ORDER) {
    if (left <= 0) break;
    const n = Math.min(cap, left);
    parts.push([orb, n]);
    left -= n;
  }
  // 用最接近的惰性氣體簡寫
  let coreZ = 0, coreSym = '';
  for (const k of [54, 36, 18, 10, 2]) {
    if (z > k) { coreZ = k; coreSym = NOBLE[k]; break; }
  }
  if (!coreZ) return parts.map(([o, n]) => o + sup(n)).join(' ');
  let acc = 0;
  const outer = [];
  for (const [orb, n] of parts) {
    if (acc >= coreZ) outer.push([orb, n]);
    acc += n;
  }
  // 依慣例以主量子數 n（其次 ℓ）排序書寫，例如寫成 [Xe] 4f⁴ 6s² 而非 6s² 4f⁴
  const lIdx = { s: 0, p: 1, d: 2, f: 3 };
  outer.sort((a, b) => (Number(a[0][0]) - Number(b[0][0])) || (lIdx[a[0][1]] - lIdx[b[0][1]]));
  return `[${coreSym}] ` + outer.map(([o, n]) => o + sup(n)).join(' ');
}

/** 價電子數（主族用族數，過渡金屬用 (n-1)d + ns）*/
export function valence(z, group) {
  if (group <= 2) return group;
  if (group >= 13) return group - 10;
  return '（過渡金屬，d 電子參與鍵結）';
}

/** 由原子序取得基本資料 */
export function element(z) {
  const e = ELEMENTS[z - 1];
  if (!e) return null;
  const [sym, zh, period, group] = e;
  return { z, sym, zh, period, group, cat: category(z, group, period), config: configuration(z) };
}
