/* ==========================================================================
   constants.js — 全站化學數據集中管理
   老師若要修改／補充數值，只要改這個檔案，各章模擬會自動吃到新值。
   每一組數據都附 source 欄位；不確定的數值以 approx: true 標註，
   頁面會自動在數字後面加上「≈（概略值）」而不是假裝精確。
   ========================================================================== */

/* ---------- 通用物理常數（CODATA 2018）---------- */
export const CONST = {
  R_J: 8.314462618,        // 氣體常數 J/(mol·K)
  R_Latm: 0.08205736608,   // 氣體常數 L·atm/(mol·K)
  R_Lbar: 0.083144626,     // 氣體常數 L·bar/(mol·K)
  NA: 6.02214076e23,       // 亞佛加厥數 /mol
  kB: 1.380649e-23,        // 波茲曼常數 J/K
  h: 6.62607015e-34,       // 普朗克常數 J·s
  c: 2.99792458e8,         // 光速 m/s
  e: 1.602176634e-19,      // 基本電荷 C
  Rydberg_J: 2.1798723611e-18, // 氫原子里德伯能量 J
  F: 96485.33212,          // 法拉第常數 C/mol
};

/* ---------- Ch1：金屬密度與堆積 ----------
   密度為 20 °C 之值；晶格常數為室溫 X 光繞射值。
   source: CRC Handbook of Chemistry and Physics, 97th ed. */
export const METALS = {
  Au: { zh: '金',  M: 196.967, rho: 19.30, lattice: 'FCC', a_pm: 407.8, r_pm: 144, apf: 0.74,
        color: 0xFFC93C, note: '面心立方，最密堆積' },
  Al: { zh: '鋁',  M: 26.982,  rho: 2.70,  lattice: 'FCC', a_pm: 405.0, r_pm: 143, apf: 0.74,
        color: 0xBFD3DB, note: '面心立方，輕金屬代表' },
  Fe: { zh: '鐵',  M: 55.845,  rho: 7.87,  lattice: 'BCC', a_pm: 286.7, r_pm: 126, apf: 0.68,
        color: 0x9AA4AD, note: '體心立方（α-Fe），堆積較鬆' },
  Ti: { zh: '鈦',  M: 47.867,  rho: 4.51,  lattice: 'HCP', a_pm: 295.1, r_pm: 147, apf: 0.74,
        color: 0xCFC6BC, note: '六方最密堆積，比強度高' },
};

/* Ch1 綠色化學：輕量化材料（同體積質量比較 → 車輛減重 → 油耗與 CO₂）*/
export const LIGHTWEIGHT = {
  Fe:   { zh: '鋼（低碳鋼）', rho: 7.85, approx: false },
  Al:   { zh: '鋁合金 6061',  rho: 2.70, approx: false },
  CFRP: { zh: '碳纖維複材 CFRP', rho: 1.55, approx: true }, // 隨纖維含量 1.5–1.6 g/cm³
  Mg:   { zh: '鎂合金 AZ91',  rho: 1.81, approx: true },
};
export const FUEL_CO2 = {
  gasoline_kg_per_L: 2.31,   // 汽油燃燒 CO₂ 排放係數 kg-CO₂/L（IPCC 缺省值換算）
  // 經驗法則：整車減重 10% → 油耗改善約 6–8%（取 7% 為中位）
  weightToFuelPct: 0.7,      // 每減重 1% → 省油 0.7%
};

/* 花蓮在地岩石密度（在地連結）*/
export const HUALIEN_ROCKS = {
  marble:    { zh: '大理岩（方解石為主）', rho_lo: 2.60, rho_hi: 2.80, approx: true },
  serpentine:{ zh: '蛇紋岩',              rho_lo: 2.50, rho_hi: 2.60, approx: true },
  nephrite:  { zh: '台灣玉（閃玉）',       rho_lo: 2.90, rho_hi: 3.03, approx: true },
};

/* ---------- Ch2：Rutherford 散射 / 都市採礦 ---------- */
export const RUTHERFORD = {
  foil_thickness_nm: 400,      // Geiger–Marsden 使用約 0.4 µm 金箔
  nucleus_r_fm: 7.3,           // Au-197 核半徑 ≈ 1.25·A^(1/3) fm
  atom_r_pm: 144,              // 金原子半徑
  // 核與原子半徑比 ≈ 1 : 20000
};
export const URBAN_MINING = {
  // 金含量：電路板 vs 原生金礦
  pcb_g_per_t: 250,   approx: true,   // 廢電路板 200–350 g Au/公噸
  ore_g_per_t: 3,     approx: true,   // 原生金礦 1–5 g Au/公噸
  cyanide:   { zh: '氰化法',   energy: 100, toxicity: 5, recovery: 95, days: 1 },
  bioleach:  { zh: '生物瀝濾', energy: 30,  toxicity: 1, recovery: 70, days: 14, approx: true },
};

/* ---------- Ch3：化學計量 / 原子經濟性 ---------- */
export const ATOMIC_MASS = {
  H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974,
  S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Ti: 47.867, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904,
  Ag: 107.868, I: 126.904, Ba: 137.327, Pt: 195.084, Au: 196.967, Hg: 200.592, Pb: 207.2,
  Cd: 112.414,
};

/* 布洛芬（ibuprofen）兩條合成路線 —— 綠色化學的經典教材案例
   source: Cann & Connelly, "Real World Cases in Green Chemistry" (ACS, 2000);
           BHC/Hoechst Celanese 製程獲 1997 美國總統綠色化學挑戰獎 */
export const IBUPROFEN = {
  boots: { zh: 'Boots 傳統路線', steps: 6, atomEconomy: 40.0, eFactor: 1.50,
           reagents: '化學計量的 AlCl₃、乙酸酐、乙氧基乙酸乙酯…',
           waste: '大量無機鹽（AlCl₃ 水解）與有機副產物' },
  bhc:   { zh: 'BHC 觸媒路線', steps: 3, atomEconomy: 77.4, atomEconomyRecycle: 99.0, eFactor: 0.29,
           reagents: 'HF（可回收溶劑兼觸媒）、Raney Ni、Pd 觸媒、CO',
           waste: '乙酸為唯一副產物且可回收再利用' },
  approx: false,
};

/* Sheldon E-factor 產業基準值 source: R. A. Sheldon, Green Chem., 2007, 9, 1273 */
export const EFACTOR_BENCH = [
  { zh: '石化業',     lo: 0.1,  hi: 1,    },
  { zh: '大宗化學品', lo: 1,    hi: 5,    },
  { zh: '精細化學品', lo: 5,    hi: 50,   },
  { zh: '製藥業',     lo: 25,   hi: 100,  },
];

/* ---------- Ch4：溶解度積與放流水標準 ---------- */
/* Ksp 為 25 °C 值；硫化物的 Ksp 各文獻差異極大，標為概略值。
   source: CRC Handbook 97th ed. / Zumdahl, Chemistry 10e Appendix */
export const KSP = {
  AgCl:     { v: 1.8e-10, approx: false, zh: 'AgCl' },
  AgBr:     { v: 5.4e-13, approx: false, zh: 'AgBr' },
  AgI:      { v: 8.5e-17, approx: false, zh: 'AgI' },
  BaSO4:    { v: 1.1e-10, approx: false, zh: 'BaSO₄' },
  CaCO3:    { v: 3.4e-9,  approx: false, zh: 'CaCO₃' },
  PbCl2:    { v: 1.7e-5,  approx: false, zh: 'PbCl₂' },
  PbSO4:    { v: 2.5e-8,  approx: false, zh: 'PbSO₄' },
  PbS:      { v: 3e-28,   approx: true,  zh: 'PbS' },
  CuS:      { v: 6e-37,   approx: true,  zh: 'CuS' },
  ZnS:      { v: 2e-25,   approx: true,  zh: 'ZnS' },
  'Pb(OH)2':{ v: 1.4e-20, approx: true,  zh: 'Pb(OH)₂' },
  'Cu(OH)2':{ v: 2.2e-20, approx: true,  zh: 'Cu(OH)₂' },
  'Cd(OH)2':{ v: 7.2e-15, approx: true,  zh: 'Cd(OH)₂' },
  'Fe(OH)3':{ v: 2.8e-39, approx: true,  zh: 'Fe(OH)₃' },
};
/* 台灣「放流水標準」重金屬最大限值（mg/L），部分業別另有更嚴規定 */
export const EFFLUENT_TW = {
  Pb: 1.0, Cu: 3.0, Zn: 5.0, Cd: 0.03, Cr: 2.0, Ni: 1.0,
  source: '行政院環境保護署（現環境部）放流水標準，一般業別',
};

/* ---------- Ch5：氣體 ---------- */
/* 凡得瓦常數 a (L²·bar/mol²)、b (L/mol) source: CRC Handbook 97th ed. */
export const VDW = {
  He:  { zh: '氦',   a: 0.0346, b: 0.02380, M: 4.003 },
  N2:  { zh: '氮氣', a: 1.370,  b: 0.0387,  M: 28.014 },
  O2:  { zh: '氧氣', a: 1.382,  b: 0.03186, M: 31.998 },
  CO2: { zh: '二氧化碳', a: 3.640, b: 0.04267, M: 44.009 },
  CH4: { zh: '甲烷', a: 2.283,  b: 0.04278, M: 16.043 },
  H2O: { zh: '水蒸氣', a: 5.536, b: 0.03049, M: 18.015 },
};
/* 全球暖化潛勢 GWP-100（IPCC AR6 WG1 第七章，含氣候碳循環回饋）*/
export const GWP100 = {
  CO2: { v: 1,     zh: '二氧化碳 CO₂' },
  CH4: { v: 29.8,  zh: '甲烷 CH₄（化石來源）' },
  N2O: { v: 273,   zh: '一氧化二氮 N₂O' },
  SF6: { v: 25200, zh: '六氟化硫 SF₆' },
  source: 'IPCC AR6 WG1 (2021), Table 7.15',
};
/* 胺吸收法碳捕捉再生能耗（MEA 30 wt%）*/
export const CCS = {
  mea_GJ_per_tCO2: 3.7, approx: true,   // 文獻常見 3.5–4.0 GJ/t-CO₂
  advanced_GJ_per_tCO2: 2.4, approx: true,
  scCO2_Tc_C: 31.0, scCO2_Pc_bar: 73.8, // CO₂ 臨界點 304.13 K, 73.8 bar
};

/* ---------- Ch6：熱化學 ---------- */
/* 平均鍵能 (kJ/mol) — 注意：這是「平均值」，與特定分子的解離能略有差異
   source: Zumdahl, Chemistry 10e, Table 8.4 */
export const BOND_E = {
  'H-H': 432, 'C-H': 413, 'O-H': 467, 'N-H': 391, 'C-C': 347, 'C=C': 614, 'C≡C': 839,
  'O=O': 495, 'C=O': 799, 'C≡O': 1072, 'N≡N': 941, 'C-O': 358, 'Cl-Cl': 239, 'H-Cl': 427,
  'H-O': 467, 'C-N': 305, 'H-F': 565, 'F-F': 154, 'N=N': 418,
};
/* 標準生成焓 ΔH°f (kJ/mol, 298 K) source: NIST Chemistry WebBook / CRC 97th */
export const HF298 = {
  'CH4(g)': -74.6, 'CO2(g)': -393.5, 'H2O(g)': -241.8, 'H2O(l)': -285.8,
  'C2H5OH(l)': -277.6, 'C2H5OH(g)': -234.8, 'NH3(g)': -45.9, 'NO(g)': 91.3,
  'C8H18(l)': -250.1, 'H2(g)': 0, 'O2(g)': 0, 'N2(g)': 0, 'C(s,graphite)': 0,
  'CO(g)': -110.5, 'CH3OH(l)': -239.2,
};
/* 燃料比較（每莫耳燃燒熱、每公斤能量、燃燒 CO₂）*/
export const FUELS = {
  CH4:   { zh: '甲烷（天然氣）', M: 16.043, dHc: -890.8, nC: 1, bonds: { 'C-H': 4 }, o2: 2,
           note: '以液態水計；氣態水為 −802.3 kJ/mol' },
  C8H18: { zh: '辛烷（汽油代表）', M: 114.23, dHc: -5470, nC: 8, o2: 12.5, approx: true },
  C2H5OH:{ zh: '乙醇（生質酒精）', M: 46.068, dHc: -1366.8, nC: 2, o2: 3,
           note: '生質來源的 CO₂ 為短碳循環' },
  H2:    { zh: '氫氣', M: 2.016, dHc: -285.8, nC: 0, o2: 0.5,
           note: '燃燒產物只有水；碳排取決於製氫方式' },
};
/* 花蓮再生能源（在地連結）*/
export const HUALIEN_ENERGY = {
  hydro: { zh: '花蓮水力（銅門、清水、龍澗等電廠）', gCO2_per_kWh: 24, approx: true },
  geo:   { zh: '地熱（瑞穗、紅葉一帶潛能區）',       gCO2_per_kWh: 38, approx: true },
  coal:  { zh: '燃煤',                             gCO2_per_kWh: 820, approx: true },
  gas:   { zh: '天然氣複循環',                      gCO2_per_kWh: 490, approx: true },
  source: 'IPCC AR5 生命週期碳排中位數（gCO₂eq/kWh）',
};

/* ---------- Ch7：週期性 ---------- */
/* 第一游離能 IE₁ (kJ/mol)，索引 = 原子序。null 代表本教材未收錄（不杜撰）
   source: CRC Handbook 97th ed. */
export const IE1 = {
  1:1312, 2:2372, 3:520, 4:899, 5:801, 6:1086, 7:1402, 8:1314, 9:1681, 10:2081,
  11:496, 12:738, 13:578, 14:787, 15:1012, 16:1000, 17:1251, 18:1521,
  19:419, 20:590, 21:633, 22:659, 23:651, 24:653, 25:717, 26:762, 27:760, 28:737,
  29:745, 30:906, 31:579, 32:762, 33:947, 34:941, 35:1140, 36:1351,
  37:403, 38:549, 39:600, 40:640, 41:652, 42:684, 43:702, 44:710, 45:720, 46:804,
  47:731, 48:868, 49:558, 50:709, 51:834, 52:869, 53:1008, 54:1170,
  55:376, 56:503, 57:538, 72:659, 73:761, 74:770, 75:760, 76:840, 77:880, 78:870,
  79:890, 80:1007, 81:589, 82:716, 83:703, 84:812, 86:1037,
};
/* 共價半徑 (pm) source: Cordero et al., Dalton Trans., 2008, 2832 */
export const COV_R = {
  1:31, 2:28, 3:128, 4:96, 5:84, 6:76, 7:71, 8:66, 9:57, 10:58,
  11:166, 12:141, 13:121, 14:111, 15:107, 16:105, 17:102, 18:106,
  19:203, 20:176, 21:170, 22:160, 23:153, 24:139, 25:139, 26:132, 27:126, 28:124,
  29:132, 30:122, 31:122, 32:120, 33:119, 34:120, 35:120, 36:116,
  37:220, 38:195, 39:190, 40:175, 41:164, 42:154, 43:147, 44:146, 45:142, 46:139,
  47:145, 48:144, 49:142, 50:139, 51:139, 52:138, 53:139, 54:140,
  55:244, 56:215, 57:207, 72:175, 73:170, 74:162, 75:151, 76:144, 77:141, 78:136,
  79:136, 80:132, 81:145, 82:146, 83:148, 84:140, 85:150, 86:150,
};
/* 鮑林電負度 source: CRC Handbook 97th ed. */
export const EN = {
  1:2.20, 3:0.98, 4:1.57, 5:2.04, 6:2.55, 7:3.04, 8:3.44, 9:3.98,
  11:0.93, 12:1.31, 13:1.61, 14:1.90, 15:2.19, 16:2.58, 17:3.16,
  19:0.82, 20:1.00, 26:1.83, 29:1.90, 30:1.65, 35:2.96, 53:2.66, 79:2.54, 82:2.33,
};
/* 半導體／光電材料能隙 (eV) source: Sze, Physics of Semiconductor Devices; 各材料常見值 */
export const BANDGAP = {
  Si:      { v: 1.12, zh: '矽 Si（結晶）', type: '間接' },
  GaAs:    { v: 1.42, zh: '砷化鎵 GaAs', type: '直接' },
  CdTe:    { v: 1.50, zh: '碲化鎘 CdTe', type: '直接' },
  CIGS:    { v: 1.15, zh: 'CIGS 銅銦鎵硒', type: '直接', approx: true },
  perovsk: { v: 1.55, zh: '鈣鈦礦 MAPbI₃', type: '直接', approx: true },
  TiO2:    { v: 3.20, zh: '二氧化鈦（銳鈦礦）', type: '間接' },
  GaN:     { v: 3.40, zh: '氮化鎵 GaN（藍光 LED）', type: '直接' },
};
export const SHOCKLEY_QUEISSER = { optimal_eV: 1.34, max_eff: 33.7 }; // 單接面理論上限

/* ---------- Ch8：化學鍵 ---------- */
/* 雙原子分子的鍵長 (pm)、解離能 (kJ/mol)、偶極矩 (D)
   source: CRC Handbook 97th ed.; NIST Diatomic Spectral Database */
export const DIATOMIC = {
  'H-H':  { zh: 'H₂',  r0: 74,  De: 436, mu: 0,    dEN: 0,    a: 'H',  b: 'H'  },
  'H-Cl': { zh: 'HCl', r0: 127, De: 431, mu: 1.08, dEN: 0.96, a: 'H',  b: 'Cl' },
  'H-F':  { zh: 'HF',  r0: 92,  De: 565, mu: 1.83, dEN: 1.78, a: 'H',  b: 'F'  },
  'Na-Cl':{ zh: 'NaCl（氣態分子）', r0: 236, De: 412, mu: 9.00, dEN: 2.23, a: 'Na', b: 'Cl' },
  'Cl-Cl':{ zh: 'Cl₂', r0: 199, De: 239, mu: 0,    dEN: 0,    a: 'Cl', b: 'Cl' },
};
/* NaCl 的 Born–Haber 循環 (kJ/mol) source: Zumdahl, Chemistry 10e, §8.5 */
export const BORN_HABER_NACL = [
  { zh: 'Na(s) → Na(g) 昇華',        v: +107 },
  { zh: 'Na(g) → Na⁺(g) + e⁻ 游離',  v: +496 },
  { zh: '½Cl₂(g) → Cl(g) 解離',      v: +122 },
  { zh: 'Cl(g) + e⁻ → Cl⁻(g) 電子親和', v: -349 },
  { zh: 'Na⁺(g) + Cl⁻(g) → NaCl(s) 晶格能', v: -787 },
];
export const BORN_HABER_SUM = -411; // = ΔH°f(NaCl, s)
/* 可分解性設計（原則 #10）*/
export const POLYMERS = {
  PE:  { zh: '聚乙烯 PE',  bond: 'C–C 主鏈', hydrolyzable: false, halfLife: '數百年以上', approx: true },
  PLA: { zh: '聚乳酸 PLA', bond: '酯鍵 –COO–', hydrolyzable: true,
         halfLife: '工業堆肥 3–6 個月', approx: true },
  PHA: { zh: '聚羥基烷酸酯 PHA', bond: '酯鍵 –COO–', hydrolyzable: true,
         halfLife: '海水中 1–2 年（可生物降解）', approx: true },
};

/* ---------- Ch11：溶液性質 ---------- */
export const SOLUTION = {
  Kb_water: 0.512,  // 沸點上升常數 °C/m
  Kf_water: 1.86,   // 凝固點下降常數 °C/m
  P_water_25: 23.76, // 25 °C 水的飽和蒸氣壓 torr
  seawater_salinity: 35,     // g/kg
  seawater_osm_M: 1.10, approx: true, // 總滲透莫耳濃度 ≈1.1 osmol/L
  // 海水滲透壓 π = MRT ≈ 1.10 × 0.08206 × 298 ≈ 26.9 atm ≈ 27 bar
};
export const DESAL = {
  RO:        { zh: '逆滲透 RO', kWh_per_m3: 3.5, approx: true, recovery: 45, note: '含前處理與能量回收裝置 3–4 kWh/m³' },
  MSF:       { zh: '多級閃化蒸餾 MSF', kWh_per_m3: 12, approx: true, recovery: 20, note: '含熱能換算之等效電力 10–15 kWh/m³' },
  thermodyn_min: 1.06, // 35 g/kg、50% 回收率下之理論最小分離功 kWh/m³
  source: 'Elimelech & Phillip, Science 333, 712 (2011)',
};

/* ---------- Ch12：動力學 ---------- */
/* 活化能情境（教學用代表值，實際隨反應系統而異）*/
export const KINETICS_SCEN = {
  none:    { zh: '無催化劑',        Ea: 120, T_C: 350, energy: 100, byproduct: 3,
             note: '需高溫推動，選擇性差' },
  metal:   { zh: '傳統重金屬催化',  Ea: 65,  T_C: 180, energy: 55,  byproduct: 1.4,
             note: 'Pd/Pt/Cr 等，活性好但金屬殘留與稀有金屬耗用' },
  enzyme:  { zh: '仿生酵素催化',    Ea: 35,  T_C: 37,  energy: 12,  byproduct: 0.3,
             note: '常溫常壓、水相、高選擇性' },
  photo:   { zh: '光觸媒 TiO₂',     Ea: 28,  T_C: 25,  energy: 8,   byproduct: 0.5,
             note: '以光子取代熱能驅動，需 UV/可見光' },
  approx: true,
};
export const ARRHENIUS_DEMO = { A: 1e13, note: '前指數因子取教學用代表值 10¹³ s⁻¹' };
export const TIO2_PHOTOCAT = {
  bandgap_eV: 3.20, lambda_nm: 387,   // 1240/3.20 ≈ 387 nm
  note: '銳鈦礦相；需波長 ≤387 nm 之紫外光激發',
};

/* ---------- Ch13：化學平衡 ---------- */
export const HABER = {
  dH: -92.2,            // N₂ + 3H₂ ⇌ 2NH₃，ΔH° = −92.2 kJ/mol
  Kp_298: 5.8e5, approx: true,
  Kp_773: 1.45e-5, approx: true,  // 約 500 °C
  industry_T_C: 450, industry_P_atm: 200,
  energy_GJ_per_tNH3: 30, approx_energy: true,   // 現代廠 28–35 GJ/t
  co2_t_per_tNH3: 1.9, approx_co2: true,         // 天然氣製程 1.6–2.4
  world_energy_pct: 1.5,  // 哈柏法約占全球能源使用 1–2%
  source: 'Smil, Enriching the Earth (2001); IEA Ammonia Technology Roadmap (2021)',
};
export const NITROGENASE = {
  T_C: 25, P_atm: 1,
  atp_per_N2: 16,       // N₂ + 8H⁺ + 8e⁻ + 16 ATP → 2NH₃ + H₂ + 16 ADP + 16 Pi
  note: '固氮酶含 FeMo 輔因子，常溫常壓固氮；能量以 ATP 形式支付',
};
export const OCEAN_CO2 = {
  pH_preindustrial: 8.21, pH_now: 8.10,
  H_increase_pct: 30,   // [H⁺] 增加約 26–30%
  co2_ppm_1750: 278, co2_ppm_2023: 419,
  source: 'IPCC AR6 WG1 §5.3；NOAA PMEL 海洋酸化計畫',
};

/* ---------- Ch14 / Ch15：酸鹼 ---------- */
/* Ka 為 25 °C 值 source: CRC Handbook 97th ed. / Zumdahl Appendix */
export const ACIDS = {
  HCl:     { zh: '鹽酸 HCl',       Ka: 1e6,    strong: true,  approx: true, note: '強酸，Ka 極大（此值僅供模擬用）' },
  HNO3:    { zh: '硝酸 HNO₃',      Ka: 2.4e1,  strong: true,  approx: true },
  HSO4:    { zh: '硫酸氫根 HSO₄⁻', Ka: 1.2e-2, strong: false },
  H2SO3:   { zh: '亞硫酸 H₂SO₃',   Ka: 1.4e-2, strong: false, note: 'Ka1' },
  H3PO4:   { zh: '磷酸 H₃PO₄',     Ka: 7.5e-3, strong: false, note: 'Ka1' },
  HF:      { zh: '氫氟酸 HF',      Ka: 7.2e-4, strong: false },
  HNO2:    { zh: '亞硝酸 HNO₂',    Ka: 4.5e-4, strong: false },
  HCOOH:   { zh: '甲酸 HCOOH',     Ka: 1.8e-4, strong: false },
  lactic:  { zh: '乳酸',           Ka: 1.4e-4, strong: false },
  benzoic: { zh: '苯甲酸',         Ka: 6.4e-5, strong: false },
  CH3COOH: { zh: '醋酸 CH₃COOH',   Ka: 1.8e-5, strong: false },
  H2CO3:   { zh: '碳酸 H₂CO₃',     Ka: 4.3e-7, strong: false, note: 'Ka1；pKa₁ = 6.37' },
  H2CO3_2: { zh: '碳酸氫根 HCO₃⁻', Ka: 4.7e-11, strong: false, note: 'Ka2；pKa₂ = 10.33' },
  NH4:     { zh: '銨離子 NH₄⁺',    Ka: 5.6e-10, strong: false },
};
export const KW = 1.0e-14;
export const RAIN = {
  clean_pH: 5.6,        // 與大氣 CO₂ 平衡的乾淨雨水
  acid_rain_pH: 5.0,    // 台灣環保單位以 pH < 5.0 定義酸雨
  source: '環境部空氣品質監測網酸雨定義；乾淨雨水 pH 5.6 為 CO₂ 飽和理論值',
};
export const NATURAL_INDICATORS = {
  redCabbage: { zh: '紫甘藍（花青素）', range: 'pH 2 紅 → 4 粉 → 7 紫 → 9 藍綠 → 12 黃' },
  roselle:    { zh: '洛神花（花青素）', range: 'pH 1–3 鮮紅 → 中性偏紫 → 鹼性轉綠黃', approx: true },
  turmeric:   { zh: '薑黃素',          range: 'pH < 8 黃 → pH > 9 紅棕' },
};
export const BLOOD_BUFFER = {
  pH_lo: 7.35, pH_hi: 7.45, pKa1_body: 6.1,
  ratio: 20,  // 血液中 [HCO₃⁻]/[H₂CO₃] ≈ 20:1
  note: '體溫 37 °C 下 H₂CO₃/HCO₃⁻ 之表觀 pKa 為 6.1',
};
export const SOIL_BUFFER = {
  ideal_lo: 5.5, ideal_hi: 6.5,
  note: '多數作物適宜 pH 5.5–6.5；花蓮部分農地因長期施肥而酸化，需石灰資材調整',
  approx: true,
};

/* ==========================================================================
   資料來源總表 —— 各章頁尾會自動列出
   ========================================================================== */
export const SOURCES = {
  crc:    'CRC Handbook of Chemistry and Physics, 97th ed. (2016–2017)',
  nist:   'NIST Chemistry WebBook, SRD 69',
  zumdahl:'Zumdahl & Zumdahl, Chemistry, 10th ed. (Cengage)',
  codata: 'CODATA Internationally Recommended 2018 Values of the Fundamental Physical Constants',
  ipcc:   'IPCC AR6 WG1 (2021)',
  sheldon:'R. A. Sheldon, "The E factor: fifteen years on", Green Chem., 2007, 9, 1273',
  anastas:'Anastas & Warner, Green Chemistry: Theory and Practice (Oxford, 1998)',
  cordero:'B. Cordero et al., "Covalent radii revisited", Dalton Trans., 2008, 2832',
  epa_tw: '中華民國環境部（原行政院環保署）放流水標準／空氣品質監測資料',
  acs:    'ACS Green Chemistry Institute — Presidential Green Chemistry Challenge Awards',
};

/* 小工具：把數值加上「≈」標記（用於 approx: true 的資料）*/
export function fmtApprox(value, isApprox, digits = 2) {
  const n = typeof value === 'number' ? value.toFixed(digits) : value;
  return isApprox ? `≈${n}` : `${n}`;
}
