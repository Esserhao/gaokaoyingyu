# 高考英语真题在线 · 设计审计与优化方案（校正版）

> 校正说明：此前一份方案基于会话目录的**项目快照副本**撰写，结论有误（误判为"双 CSS 冲突 / 60% 死代码"）。
> 本版在 `E:\Desk\高考英语网站` 真实文件上重新审计，结论以本版为准。

---

## 一、真实架构现状（已核实）

站点入口 `index.html` 串联 **5 个 CSS**，是一套**"分区配色"模块化设计**（刻意而为，非冲突）：

| 文件 | 作用域 | 主色 |
|---|---|---|
| `css/style.css` | 试卷答题页 + 首页骨架（`.topbar`/`.paper`/`.opt`/`.result-*`） | 蓝 `#1a56db` |
| `css/app.css` | 应用框架 / 题库首页 / 试卷页头（`.exambar`/`.paper-card`/`.answer-sheet`） | 蓝 `#1a56db` |
| `css/platform.css` | 学习平台 / 写作 / 错题本 / 知识图谱 | 青 `#268b71` |
| `css/reference.css` | 题库档案页 | 蓝 `#2d67b1` |
| `css/training.css` | 分题型训练 / 讲义 | 锈红 `#b84c31` |

`render.js` 实际输出的关键类名（已 grep 核实）：`.exambar` `.brand-mark` `.answer-sheet` `.sheet-title` `.sheet-section` `.sheet-dot` `.paper-card` `.paper-grid` `.result-hero` `.section-bars` `.score-ring` 等。

**结论**：整体是自洽、有识别度的设计系统；不要做"全局单一蓝覆盖"，否则会破坏分区识别。

---

## 二、真实问题清单（按优先级）

### P0 — 移动端答题卡抽屉失效（功能性 Bug，必修）
- 现象：窄屏（≤960px）下答题卡无法打开。
- 根因：`style.css` 媒体查询瞄准 `.card-panel` / `.mobile-card-btn`，但 `render.js` 输出的是 `<aside class="answer-sheet">` 且**根本没有切换按钮**；`app.css` 媒体查询里 `.answer-sheet{display:none}` 收起后无入口。
- 影响：手机端做题看不到答题进度/无法跳题。

### P2 — `style.css` 首页卡片死代码
- `.exam-grid` / `.exam-card` 在 `style.css` 中定义，但 `render.js` 用的是 `app.css` 的 `.paper-grid` / `.paper-card`。
- 处理：删除 `style.css` 中未被引用的首页卡片块（约 25 行），或保留并改用之。建议直接删，减少维护歧义。

### P2 — 字体为系统字体，缺品牌质感
- 全站 `--serif`/`--sans` 用系统栈，试卷英文无衬线/中文无专属，识别度弱。
- 处理：升级字体栈（Source Serif 4 + Noto Sans SC），联网生效、离线回退，零风险。

### P3 — 跨分区缺统一"成就金"点缀
- 分数、印章、优秀态无统一高光色。建议引入 `--gold` 作为跨分区点缀（分数数字、品牌方印描边、答题卡网格纹理）。

### P3 — 顶栏两套（`.topbar` 首页 / `.exambar` 试卷页）
- 有意为之（不同页面氛围不同），可保留；若想统一品牌感，可让 `.brand-mark` 样式在两处保持一致。

---

## 三、交付物与落地

### 1. `css/design-system.css`（本次新增，叠加增强层）
- **不覆盖**任何分区配色；只在 `index.html` 的 `<link>` 列表**末尾**引入即生效。
- 提供：成就金变量 + 字体升级落地 + 答题卡网格记忆点 + 移动端答题卡抽屉修复（CSS 部分）+ 触控 ≥44px + `:focus-visible` 无障碍 + `prefers-reduced-motion` 降级。
- 引入方式：在 `index.html` 第 11 行后加
  `<link rel="stylesheet" href="css/design-system.css">`

### 2. 移动抽屉修复（CSS 已含，需配合 `render.js` 一处改动）
`design-system.css` 已写好 `.answer-sheet.open` 抽屉样式与 `.mobile-sheet-btn`。还需在 `render.js` 试卷页 markup 里：
- 在 `<aside class="answer-sheet">…</aside>` 之后加一个按钮：
  `<button class="mobile-sheet-btn" data-action="toggle-sheet">答题卡</button>`
- 在 `exam.js` 或 `app.js` 的事件处理里加：
  `if(action==='toggle-sheet') document.querySelector('.answer-sheet').classList.toggle('open');`
  （点击遮罩/选题后自动关闭可再加一行。）
> 该改动默认**不自动应用**，确认后我可一并改 `render.js` + `app.js`。

### 3. `assets/logo.svg`（本次新增）
- 蓝底白字"英"方印 + 金色内描边，呼应顶栏 `.brand-mark`，可作 favicon / 顶栏升级。

---

## 四、不建议做的事
- ❌ 不要用一个"全局 `--blue` 统一色"覆盖全站——会抹掉分区识别（青/蓝/锈红）。
- ❌ 不要删 `platform.css`/`reference.css`/`training.css`——它们是不同模块的必要样式。
- ❌ 不要把 `design-system.css` 写成"替代 style.css+app.css"——它是增强层，独立加载即可。

## 五、建议落地顺序
1. 引入 `design-system.css`（立即可见：金色分数、字体、答题卡纹理、无障碍）。
2. 应用移动抽屉 `render.js`+`app.js` 改动（修复 P0）。
3. 删除 `style.css` 死代码（P2，可选）。
4. 视情况统一 `.brand-mark`（P3，可选）。
