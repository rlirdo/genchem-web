# 大學普通化學互動自學 WebUI（綠色化學版）

以 Zumdahl《Chemistry》章節架構重新設計的普通化學自學網站。
全站繁體中文（台灣用語），純前端、可離線開啟、可直接放上 GitHub Pages。

**核心特色**：每一章都提供「傳統製程／教科書情境」與「綠色化學情境」兩個
**都能互動**的模擬，右側固定一個隨操作即時變動的**綠色指標儀表板**，
並以綠色化學十二原則與花蓮在地案例貫穿全書。

---

## 目錄

- [快速開始](#快速開始)
- [檔案架構](#檔案架構)
- [三階層導覽](#三階層導覽)
- [如何新增一章](#如何新增一章)
- [如何修改色票與設計系統](#如何修改色票與設計系統)
- [如何修改化學數據](#如何修改化學數據)
- [如何部署到-github-pages](#如何部署到-github-pages)
- [無障礙與效能](#無障礙與效能)
- [驗收檢查結果](#驗收檢查結果)
- [授權與資料來源](#授權與資料來源)

---

## 快速開始

### 方式一：起一個本機伺服器（建議）

因為使用 ES Modules，直接雙擊 `index.html` 會被瀏覽器的 CORS 政策擋住。
請在專案資料夾內執行任一指令：

```bash
python -m http.server 8931
```

然後開啟 <http://localhost:8931>。

### 方式二：VS Code Live Server

安裝 Live Server 擴充套件 → 對 `index.html` 按右鍵 → Open with Live Server。

### 方式三：完全離線（隨身碟）

整個資料夾複製走即可。Three.js 已經**放在本機**
（`assets/vendor/three.module.js`，約 1.2 MB），不需要網路。
仍需依方式一或二起一個本機伺服器。

---

## 檔案架構

```
genchem-web/
├─ index.html                  第 1 階層：兩大階段入口 ＋ 綠色化學十二原則互動索引
├─ stage1.html                 第 2 階層：Ch1–Ch8 章節牆
├─ stage2.html                 第 2 階層：Ch11–Ch15 章節牆
├─ SPEC.md                     原始規格書
├─ README.md                   本檔案
├─ _selftest.html              （開發用）一次載入全部 16 頁並回報錯誤與元件數量；可自行刪除
│
├─ chapters/
│   ├─ ch01.html … ch08.html   第一階段 8 章
│   └─ ch11.html … ch15.html   第二階段 5 章
│
└─ assets/
    ├─ css/
    │   ├─ theme.css           設計系統：色票、字級、卡片、按鈕、動畫、無障礙
    │   └─ chapter.css         章節頁版型（舞台／控制面板／分頁／RWD 底部抽屜）
    ├─ data/
    │   ├─ chapters.js         13 章目錄（章名、一句話介紹、上下章）
    │   ├─ principles.js       綠色化學十二原則 ↔ 章節對應表
    │   ├─ elements.js         週期表資料（Z = 1–86，電子組態程式產生）
    │   ├─ glossary.js         名詞小卡字典（滑過即彈出解釋）
    │   └─ constants.js        ★ 所有化學數據集中在這裡，附來源與 approx 標記
    ├─ js/
    │   ├─ core.js             導覽列、麵包屑、進度（localStorage）、環形進度、
    │   │                      教師模式／減少動態／音效開關、葉片粒子、自然背景
    │   ├─ chapter.js          章節頁骨架產生器（版型、分頁、上下章、標記完成）
    │   ├─ stage-page.js       階段頁（章節卡片牆）產生器
    │   ├─ quiz.js             測驗元件（單選／多選／拖曳配對，答錯給提示）
    │   ├─ ui/
    │   │   ├─ controls.js     滑桿／選項群／開關／即時數據讀出／情境切換
    │   │   ├─ gauges.js       綠色指標儀表板
    │   │   ├─ chart.js        輕量 Canvas 2D 繪圖（折線／長條／直方圖／座標軸）
    │   │   └─ three-stage.js  Three.js 舞台樣板（相機、燈光、觸控、效能降級）
    │   └─ sim/
    │       ├─ ch01.js  密度與原子堆積 ＋ 射靶（精密度 vs 準確度）
    │       ├─ ch02.js  Rutherford 散射（含 Thomson 對照）
    │       ├─ ch03.js  限量試劑 ＋ 原子經濟性／E-factor 計算器
    │       ├─ ch04.js  溶解水合 ＋ 沉澱（含重金屬去除）
    │       ├─ ch05.js  分子動力論 ＋ 凡得瓦修正
    │       ├─ ch06.js  鍵能重組 ΔH ＋ 燃料碳排比較
    │       ├─ ch07.js  軌域點雲 ＋ 互動週期表
    │       ├─ ch08.js  勢能曲線 ＋ 偶極矩 ／ Born–Haber ／ 可分解性
    │       ├─ ch11.js  蒸氣壓下降 ＋ 滲透／逆滲透
    │       ├─ ch12.js  碰撞理論 ＋ 催化劑
    │       ├─ ch13.js  動態平衡 ＋ 勒沙特列
    │       ├─ ch14.js  強弱酸解離 ＋ 酸雨／海洋酸化
    │       └─ ch15.js  緩衝 ＋ 滴定曲線
    └─ vendor/
        ├─ three.module.js         Three.js r160（MIT 授權，本機副本以支援離線）
        └─ OrbitControls.js        Three.js 官方 addon
```

### 設計原則

1. **每章一檔**：`chapters/chXX.html` 只放「內容」（觀念文字、綠色化學文字、測驗題、資料來源），
   版面由 `assets/js/chapter.js` 產生。老師改文字不會動到程式邏輯。
2. **模擬與畫面解耦**：所有物理／化學計算放在 `assets/js/sim/chXX.js`，
   它只透過 `ctx` 這個介面拿到 DOM 容器，可以單獨測試與重用。
3. **每個章節頁都能單獨開啟**：即使上層頁面不存在也不會壞掉。
4. **化學數據集中管理**：全部在 `assets/data/constants.js`，且每一組都附 `source`。

---

## 三階層導覽

| 階層 | 檔案 | 內容 |
|---|---|---|
| 1 | `index.html` | 兩張大階段卡片（hover 浮起、分子圖示旋轉、環形完成度）＋ 綠色化學十二原則互動索引（點原則亮出涵蓋章節） |
| 2 | `stage1.html` / `stage2.html` | 該階段的章節卡片牆：章號、中英文章名、一句話「你會看到什麼」、綠色化學徽章、完成狀態、測驗成績 |
| 3 | `chapters/chXX.html` | 麵包屑 → 互動舞台（3D／2D）→ 控制面板 ＋ 即時數據 ＋ 綠色指標儀表板 → 三個分頁（觀念解說／綠色化學與在地連結／挑戰測驗）→ 上一章 / 下一章 / 標記為已完成 |

學習進度存在瀏覽器的 localStorage，key 前綴為 `genchem_`：

| key | 內容 |
|---|---|
| `genchem_done` | 已完成章節的 id 陣列 |
| `genchem_quiz` | 各章測驗成績 |
| `genchem_teacher` | 教師模式開關 |
| `genchem_reduceMotion` | 減少動態效果開關 |
| `genchem_sound` | 音效開關 |

頁尾有「🗑 清除本機學習進度」按鈕可重置。

---

## 如何新增一章

假設要新增「Ch9 共價鍵結：軌域」。

### 步驟 1：在目錄檔登記

編輯 `assets/data/chapters.js`，在 `CHAPTERS` 陣列中適當位置插入：

```js
{ id: 'ch09', no: 9, stage: 'stage1',
  zh: '共價鍵結：軌域', en: 'Covalent Bonding: Orbitals',
  see: '把兩個原子軌域疊起來，看鍵結軌域與反鍵軌域怎麼長出來。',
  topic: '混成軌域與分子軌域理論',
  green: '（在這裡寫這一章的綠色化學主題）' },
```

**上一章／下一章的連結會自動接上**，階段頁的卡片牆與進度環也會自動出現。

### 步驟 2（可選）：登記綠色化學原則

編輯 `assets/data/principles.js`，把 `'ch09'` 加進相關原則的 `chapters` 陣列。
首頁的十二原則索引與章節頁標題的原則標籤會自動更新。

### 步驟 3：寫模擬邏輯

新增 `assets/js/sim/ch09.js`，匯出一個 `init(ctx)` 函式：

```js
import { createStage, THREE } from '../ui/three-stage.js';
import { buildControls, buildReadouts } from '../ui/controls.js';
import { buildGauges } from '../ui/gauges.js';

export async function init(ctx) {
  // ctx 提供的東西：
  //   ctx.stageEl        3D／2D 舞台容器
  //   ctx.subEl          舞台下方區域（放圖表用）
  //   ctx.hostControls   控制面板容器
  //   ctx.hostReadout    即時數據容器
  //   ctx.hostGauge      綠色指標儀表板容器
  //   ctx.scenario       目前情境：'classic' 或 'green'
  //   ctx.onScenario(cb) 情境切換時的 callback
  //   ctx.setOverlay(html)   在舞台右上角顯示即時文字
  //   ctx.setStageTitle(t)   改舞台標題
  //   ctx.celebrate()        撒葉片粒子

  const stage = createStage(ctx.stageEl, { cameraPos: [0, 2, 9] });
  const C = buildControls(ctx.hostControls, [
    { type: 'range', key: 'x', label: '參數', min: 0, max: 10, step: 1, value: 5, unit: '' },
  ], onChange);
  const readout = buildReadouts(ctx.hostReadout, [{ key: 'y', label: '數值', unit: '' }]);
  const gauge = buildGauges(ctx.hostGauge, [ /* 至少三項 */ ]);

  function onChange() { update(); }
  function update() { readout({ y: C.values.x * 2 }); }

  ctx.onScenario(v => { /* 切換情境時重建 */ });
  update();
  stage.start(({ dt }) => { /* 每幀 */ });
  return { destroy() { stage.dispose(); } };
}
```

### 步驟 4：建立章節頁

複製 `chapters/ch08.html` 改名為 `ch09.html`，然後改三個地方：

1. `<title>` 與 `<meta name="description">`
2. 兩個 `<template>`（`tpl-concept`、`tpl-green`）裡的內容
3. 最下方 `mountChapter({ ... })` 的 `id`、`stageTitle`、`quiz`、`sources`，
   以及 `import { init } from '../assets/js/sim/ch09.js';`

**不需要**改任何版面 HTML／CSS。

### 測驗題的三種格式

```js
// 單選
{ type: 'single', green: true, q: '題目（可含 HTML）',
  options: ['A', 'B', 'C'], answer: 1,
  hint: '答錯時給的提示（不直接給答案）',
  explain: '答對後的說明', explain2: '答錯三次以上的追加提示' }

// 多選
{ type: 'multi', green: false, q: '…', options: [...], answer: [0, 2], hint: '…', explain: '…' }

// 拖曳配對（點左邊再點右邊即可配對，觸控與鍵盤都能操作）
{ type: 'match', green: true, q: '…',
  leftTitle: '項目', rightTitle: '對應敘述',
  left: ['甲', '乙', '丙'], right: ['A', 'B', 'C'],
  answer: [1, 0, 2],     // left[0] 對應 right[1]，依此類推
  hint: '…', explain: '…' }
```

`green: true` 會在題目旁顯示 🌿 標記，並計入「綠色化學題 n/m」的統計。
**依規格，每章至少一半的題目要標 `green: true`。**

---

## 如何修改色票與設計系統

所有顏色都是 CSS 變數，集中在 `assets/css/theme.css` 最上方的 `:root`：

```css
:root {
  --leaf:  #3FA34D;   /* 主色：葉綠 */
  --ocean: #1E9EB3;   /* 主色 2：七星潭海藍 */
  --sun:   #FFC93C;   /* 輔色：陽光金 */
  --coral: #FF7A59;   /* 強調／警示 */
  --paper: #F7FBF5;   /* 頁面底色 */
  --ink:   #123B2E;   /* 主文字 */
  ...
}
```

**改這 6 個值，全站配色就換了。**

- 名稱帶 `-deep` 的是「文字用的深色版本」，已針對白底調到對比 ≥ 4.5:1。
  換主色時請一併調整對應的 `-deep`，並用對比檢查工具驗證。
- 名稱帶 `-soft` 的是淺色底版本，用於徽章與提示框。
- 圖表（Canvas）的顏色另外定義在 `assets/js/ui/chart.js` 的 `PALETTE`，
  改色票時記得同步。

字體、圓角、陰影、動畫時間也都在同一段變數裡。

---

## 如何修改化學數據

**所有化學數據都在 `assets/data/constants.js`，一個檔案改完全站生效。**

範例：

```js
/* 平均鍵能 (kJ/mol) source: Zumdahl, Chemistry 10e, Table 8.4 */
export const BOND_E = {
  'H-H': 432, 'C-H': 413, 'O-H': 467, ...
};
```

檔案內的約定：

| 約定 | 意思 |
|---|---|
| 每組資料上方的註解 | 資料來源與適用條件（溫度、相態） |
| `approx: true` | 該值為文獻區間的代表值或教學用概略值，頁面會標示 |
| `source: '…'` | 直接寫在資料物件裡的來源字串 |
| 檔案最下方的 `SOURCES` | 常用來源的完整書目 |

> **重要原則**：不確定的數值一律標註為概略值，**不杜撰精確數字**。
> 例如金屬硫化物的 Ksp 各文獻差異可達數個數量級，本站一律標 `approx: true`。
> 教學用的模型參數（如 Morse 位能的形狀參數、動力學速率常數）也都明確標示為
> 「教學用取值」，並在頁面底部的免責說明中交代。

各章頁面底部的「本章化學數據來源」清單，寫在該章 HTML 的
`mountChapter({ sources: [...] })` 裡。

---

## 如何部署到 GitHub Pages

### 一、建立 repository 並上傳

```bash
cd genchem-web
git init
git add .
git commit -m "大學普通化學互動自學 WebUI 初版"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git push -u origin main
```

### 二、開啟 GitHub Pages

1. 進到 GitHub repository → **Settings** → 左側 **Pages**
2. **Source** 選 `Deploy from a branch`
3. **Branch** 選 `main`、資料夾選 `/ (root)`，按 **Save**
4. 等 1–2 分鐘，網址會是
   `https://<你的帳號>.github.io/<repo 名稱>/`

### 三、注意事項

- **本站全部使用相對路徑**，放在 repo 子目錄底下也能正常運作，不需要設定 base URL。
- `assets/vendor/three.module.js` 約 1.2 MB，GitHub Pages 完全容納得下
  （單檔上限 100 MB、站台上限 1 GB）。
- 若要改用 CDN 版的 Three.js（讓 repo 更小，但**失去離線能力**），
  把每個章節頁的 importmap 改成：

  ```html
  <script type="importmap">
  { "imports": {
      "three": "https://unpkg.com/three@0.160.1/build/three.module.js",
      "three/addons/controls/OrbitControls.js":
        "https://unpkg.com/three@0.160.1/examples/jsm/controls/OrbitControls.js"
  } }
  </script>
  ```

- 若要**自訂網域**，在專案根目錄新增一個 `CNAME` 檔案，內容寫你的網域即可。
- 更新內容只要再 `git add . && git commit && git push`，Pages 會自動重新部署。

---

## 無障礙與效能

### 無障礙

- 所有互動控制項都有 `aria-label`，滑桿另有 `aria-valuetext`。
- 分頁使用 `role="tablist"` / `role="tab"` / `role="tabpanel"`，支援左右方向鍵切換。
- 儀表板使用 `role="progressbar"` 與 `aria-valuenow`。
- 拖曳配對題同時支援**點擊配對**與**鍵盤操作**，不是只有滑鼠拖曳。
- 每頁最前面有「跳到主要內容」skip link。
- 焦點可見：`:focus-visible` 有 3px 高對比外框。
- 色彩對比：主要文字組合皆 ≥ 4.5:1（`--ink` 對白底 > 12:1，
  `--ink-3`／`--leaf-deep`／`--ocean-deep`／`--sun-deep`／`--coral-deep` 皆 ≥ 4.5:1）。
- **減少動態效果**：導覽列有開關，同時尊重系統的 `prefers-reduced-motion`。
  開啟後背景漂浮物、粒子動畫、數字滾動全部停用。

### 效能

- 3D 依裝置能力自動分級（`detectQuality()` 看 CPU 核心數、記憶體與螢幕尺寸），
  決定 antialias 與 pixel ratio 上限。
- 連續 90 幀平均低於 30 fps 時**自動降級**（pixelRatio 降為 1）並在畫面上提示。
- 粒子數上限：Ch5 分子動力論 ≤ 600 顆（規格要求）、Ch7 點雲依畫質 2600–9000 點、
  Ch2 可見軌跡 ≤ 46 條（統計則以大量虛擬粒子計算，不受此限）。
- 大量重複物件使用 `InstancedMesh`。
- 切換情境時會 `dispose()` 掉舊的 geometry／material，避免記憶體累積。
- 3D 畫布設 `touch-action: none`，手機單指旋轉、雙指縮放。

### RWD

- 桌機：左舞台 ＋ 右控制面板（360px）。
- < 980px：控制面板變成**底部抽屜**，右下角有浮動按鈕開合。
- < 700px：導覽列的開關只保留 emoji。
- 375px 寬實測**無水平溢出**。

---

## 驗收檢查結果

以 `_selftest.html` 一次載入全部 16 頁自動檢查（可自行開啟重跑）：

| 項目 | 結果 |
|---|---|
| 16 個頁面 Console 錯誤 | **0** |
| 每章綠色指標儀表板項目數 | 13 章皆為 **3 項** |
| 每章測驗題數 | 13 章皆為 **5 題** |
| 每章綠色化學測驗題數 | **3–4 題**（皆 ≥ 一半） |
| 每章情境切換（傳統 ↔ 綠色） | 13 章皆有，**兩邊都可互動** |
| 每章可調參數 | **5–13 個**（皆 ≥ 3） |
| 每章資料來源條目 | **5–8 條** |
| 375px 寬水平溢出 | **0 px** |

化學數值抽查（模擬輸出 vs 文獻值）：

| 章 | 檢查項 | 模擬值 | 文獻值 |
|---|---|---|---|
| Ch1 | Au / Al / Fe / Ti 密度 | 19.291 / 2.698 / 7.870 / 4.501 | 19.30 / 2.70 / 7.87 / 4.51 g/cm³ |
| Ch2 | α(5 MeV) 打 Au 的最近接近距離 d₀ | 45.5 fm | 2×79×1.44/5 = 45.5 fm |
| Ch3 | N₂ + 3H₂ → 2NH₃ 原子經濟性 | 100.0% | 100%（無副產物） |
| Ch5 | N₂ 在 300 K 的 v_rms | 517 m/s | √(3RT/M) = 517 m/s |
| Ch6 | CH₄ 燃燒 ΔH（生成焓法） | −802.5 kJ/mol | −802.3 kJ/mol |
| Ch7 | Si 能隙對應波長 | 1107 nm | 1239.84 / 1.12 = 1107 nm |
| Ch8 | NaCl 的 Born–Haber 總和 | −411 kJ/mol | ΔH°f(NaCl, s) = −411 kJ/mol |
| Ch11 | 1 M NaCl 的滲透壓（25 °C） | 48.93 atm | iMRT = 2×1×0.08206×298 = 48.9 atm |
| Ch14 | 0.1 M 醋酸的 pH 與解離度 | 2.88 / 1.33% | 教科書值 2.87 / 1.3% |
| Ch15 | 0.1 M 醋酸配 0.1 M NaOH 的當量點 pH | 8.72 | 教科書值 8.72 |

---

## 授權與資料來源

### 程式碼

本專案自行撰寫的部分可自由用於教學。
第三方元件：

- **Three.js r160** — MIT License，Copyright © 2010–2023 Three.js Authors
  （`assets/vendor/` 內為未修改的官方檔案）

### 化學數據

主要來源（完整清單見各章頁面底部與 `assets/data/constants.js`）：

- CRC Handbook of Chemistry and Physics, 97th ed. (2016–2017)
- NIST Chemistry WebBook, SRD 69
- CODATA 2018 基本物理常數建議值
- Zumdahl & Zumdahl, *Chemistry*, 10th ed. (Cengage)
- IPCC AR6 WG1 (2021)：GWP 與海洋酸化數據
- Anastas & Warner, *Green Chemistry: Theory and Practice* (Oxford, 1998)：十二原則
- R. A. Sheldon, *Green Chem.* 2007, 9, 1273：E-factor
- B. Cordero et al., *Dalton Trans.* 2008, 2832：共價半徑
- 中華民國環境部：放流水標準、酸雨定義

### 免責說明

所有模擬皆為**教學示意**，非量子力學或分子動力學的精確解。
各章頁面在互動舞台下方都有明確標註該章採用了哪些簡化。
教學用的模型參數（形狀參數、速率常數、相對能耗等）一律標示為
「教學用代表值」，用以呈現數量級關係，不應引用為實驗數據。
