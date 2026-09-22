# 设计优化规格（DESIGN_OPTIMIZATION）

> 本文取代并修正 `DESIGN_PLAN.md` 中基于项目**副本**误判的结论（"双 CSS 冲突/60% 死代码"为误报）。
> 所有结论均来自对 `E:\Desk\高考英语网站` **真实代码**的核对：`index.html`、`css/*.css`、`js/render.js`、`js/exam.js`。
> 约束：**不引入任何额外技术栈**（纯静态 HTML + CSS + 原生 JS），仅做设计层增强与缺陷修复。

---

## 0. 设计上下文（已确认，非凭代码推断）

| 项 | 内容 |
|---|---|
| 目标用户 | 高三学生（主）、英语教师、自学者 |
| 使用场景 | 限时刷题 / 答案解析 / 错题复盘 / 分题型训练 / 知识图谱 |
| 品牌调性 | 学术、可信、进取；既有"分区配色"体系（试卷蓝 / 平台青 / 题库蓝 / 训练锈红） |
| 技术约束 | 纯静态前端；5 个 CSS 按分区职责拆分（合理架构，不应合并） |

---

## 1. 技术与设计体检评分（Impeccable /audit 框架，0–20）

| # | 维度 | 得分 | 关键发现 |
|---|---|---|---|
| 1 | 无障碍 A11y | **2/4** | `--ink-3` 灰对比度仅 ~3.17:1 失败；全局无 `:focus-visible`；无跳转链接；移动端答题卡被 `display:none` 隐藏致导航丢失 |
| 2 | 性能 Perf | **3/4** | 静态资源、过渡多用 transform/opacity；无明显重排 |
| 3 | 响应式 Responsive | **2/4** | 移动端答题卡（进度+跳题）整块消失；`exam-layout` 在 style/app 双定义 |
| 4 | 主题 Theming | **2/4** | token 存在但部分硬编码；约 40 行 `.card-*` 死代码（render 从不输出）；无暗色 |
| 5 | 反模式 Anti-Pattern | **3/4** | 非 AI slop，是务实学术工具；细节有提升空间 |
| **合计** | | **12/20** | **Acceptable（需显著打磨）** |

**正面发现（需保留）**：选项用原生 `<label><input type=radio>` → 键盘可达（方向键/空格/回车），这是良好实践；分区配色体系清晰；试卷页 `.paper` 排版有"卷面"质感。

---

## 2. 六大维度的设计提升点（证据 → 原则 → 明确要求）

### 维度 A：视觉风格统一与精细化（色彩 / 字体 / 间距 / 图标）

**A1 [P1] 中性灰对比度不达标（证据：`--ink-3:#8a919f` 用于全部 meta/说明/计数）**
- 原则（color-and-contrast）：浅灰文字 on 白 = No.1 无障碍失败；正文需 ≥4.5:1。
- 要求：将 `--ink-3` 由 `#8a919f`(3.17:1) 调整为 `#5b6472`(≈5.99:1)，同时保持"次级"观感。所有依赖 `--ink-3` 的文本（`.brand-sub/.exam-meta/.hero-stat span/.progress/.card-legend/.timer-label` 等）自动受益。

**A2 [P2] 缺乏品牌记忆点与"成就"语义色**
- 原则：70-20-10 + 用一处克制的高辨识色做"成就"母题。
- 要求：保留分区蓝/青/锈红，新增 `--gold:#b8821b` 仅用于**分数、印章、优秀态、星级**，不与主蓝争夺注意力。例：`.result-score` 数字描金边、`.score-badge` 高分用金。

**A3 [P2] 字体无品牌识别、缺展示字体**
- 原则（typography）：避免 Inter/Roboto 等隐形默认；标题用有性格的衬线/展示体，正文用可靠 sans；字体数 ≤2–3。
- 要求：
  - `--serif` 增加 `"Noto Serif SC"` 候选，强化中文衬线卷面感：`"Songti SC","Noto Serif SC",Georgia,"Times New Roman",serif`。
  - 分数/印章用 `--display`（同衬线但更重，或大字号 `clamp()`），制造视觉锚点。
  - 可选渐进增强：通过 `@import` 引入 `Fraunces`/`Noto Serif SC`，**必须**保留系统衬线兜底栈，离线不崩。

**A4 [P2] 间距无节奏、魔法数字泛滥**
- 原则：以行高(1.6×15px≈24px)为基准建立间距阶梯；减少相邻尺寸过近造成的层级模糊。
- 要求：在 `:root` 建立 `--sp-1..--sp-8`(4/8/12/16/24/32/48/64) 与 `--r-sm/md/lg/pill`(8/12/16/999)，逐步替换散落像素值（如 `.paper{padding:44px 52px}`→`var(--sp-7) var(--sp-8)`）。

**A5 [P2] 无图标体系，按钮纯文字**
- 原则：图标提升扫读效率与可操作性；用内联 SVG（无构建依赖）。
- 要求：在 `index.html` 注入一组 `<svg><symbol>`（check/arrow/clock/list/close/star），定义 `.icon{width:1em;height:1em;vertical-align:-.125em}`；为"交卷/返回/答题卡/计时"等按钮加图标。仅作**装饰**，可访问名由按钮文本承担。

### 维度 B：布局结构与信息层级

**B1 [P2] 死代码与重复规则污染层级**
- 证据：`render.js` 输出 `.answer-sheet/.sheet-dot/.done`，而 `style.css` 另有一套 `.card-panel/.answer-card/.card-grid/.card-cell/.mobile-card-btn`（约 40 行）**从未被渲染**；`.exam-layout` 在 style/app 双定义（app 在后覆盖）。
- 要求：删除 `style.css` 中未被 emit 的 `.card-*`/`.mobile-card-btn` 规则；`.exam-layout` 仅保留一份（保留 app.css 的 `max-width:1240px` 版，删 style.css 旧版）。

**B2 [P3] 结果页信息层级可强化**
- 要求：`.result-score` 用 `clamp(40px,8vw,64px)` + 金色描边形成锚点；`.section-bars` 增加"你的得分/满分"双行标注，弱化装饰、突出对比。

### 维度 C：响应式与多端适配（P0 缺陷）

**C1 [P0] 移动端答题卡完全消失（阻断刷题导航）**
- 证据：`app.css @media(max-width:800px){.answer-sheet{display:none}}`，且全站**无**打开答题卡的按钮 → 手机上无法看进度、无法跳题。
- 原则（responsive）：不可依赖 hover；移动端不得隐藏关键功能；触控目标 ≥44px；用 `env(safe-area-inset-*)` 处理刘海。
- 要求（落地方案，见第 4 节实现）：
  - 答题卡改为**底部抽屉**：`@media(max-width:800px){.answer-sheet{position:fixed;inset:auto 0 0 0;transform:translateY(100%);transition:transform .3s var(--ease-out);max-height:80vh;border-radius:16px 16px 0 0}.answer-sheet.open{transform:translateY(0)}}`
  - 新增浮动按钮 `.mobile-sheet-btn`（固定右下，≥44px）+ 遮罩 `.sheet-scrim`；`render.js` 注入按钮，`js/ui-sheet.js` 用**事件委托**（一次绑定，抗重渲染）切换 `.open`/`show` 与 `aria-expanded`，Esc 关闭。
  - `index.html` 的 viewport 补 `viewport-fit=cover`；底部安全区 `padding-bottom:max(18px,env(safe-area-inset-bottom))`。

**C2 [P3] `grid2` 选项在窄屏塌为单列良好，但触控目标偏小**
- 要求：移动端 `.opt/.option` 内边距提到 `10px 14px`，确保整行 ≥44px 可点。

### 维度 D：用户操作流程与引导提示

**D1 [P1] 错题本 `myAnswer` 键名错误（影响复盘流程）**
- 证据：`js/exam.js` 记录错题用 `this.answers[q.id]`，应为 `${s.key}-${q.id}`（与 render 的键一致）→ 错题本对比里 `myAnswer` 恒为 `undefined`。
- 要求：修正键名；在错题本 `cmp` 区明确呈现"你的答案 / 正确答案 / 解析"三段，强化引导式复盘。

**D2 [P2] 交卷/计时缺乏状态引导**
- 要求：`.timer-time.danger`（剩 <5min）由红字升级为**红字+轻微脉冲**（见维度 F，尊重 reduced-motion）；交卷弹窗(`modal`)增加"未作答 N 题"的明确计数与"仍要交卷/继续作答"双选项，避免误操作。

**D3 [P2] 首次使用无引导（空状态已有 `.empty-state`，但缺下一步引导）**
- 要求：空状态（错题本/收藏）除文案外，给出**主行动按钮**（如"去做一套真题"）与渐进式示例，而非仅一句提示。

### 维度 E：动效与微交互

**E1 [P2] 缓动曲线随意、无统一令牌**
- 原则（motion）：不用 `ease`；用 `cubic-bezier(0.16,1,0.3,1)`(expo-out) 入场、`(0.65,0,0.35,1)`(in-out) 切换；时长 100/300/500 法则。
- 要求：在 `:root` 加 `--ease-out/--ease-in-out`，将 `.opt/.paper-card/.exam-card/.modal` 的 `transition` 改为引用令牌；选项选中用 120ms，抽屉/弹窗用 300ms。

**E2 [P3] 缺乏有意义的状态反馈**
- 要求：选项选中/判分正确·错误用颜色+图标（✓/✗）双通道（不仅靠颜色，照顾色盲）；判分后 `.q-block` 可加 200ms 淡入解析。

**E3 [P1] 缺失 `prefers-reduced-motion`（无障碍硬要求）**
- 要求：全局
  ```css
  @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
  ```
  保留进度条/焦点环等功能性状态（仅去空间位移）。

### 维度 F：无障碍（对比度 / 可读性 / 键盘导航）

**F1 [P1] 焦点环缺失（证据：仅 `.grammar-input input:focus` 有 box-shadow，全局无 `:focus-visible`）**
- 原则（interaction）：绝不 `outline:none` 无替代；键盘焦点需 2–3px、偏移、≥3:1 对比、全站一致。
- 要求：
  ```css
  :focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:4px}
  /* 金/深色区用金环 */
  .result-actions :focus-visible,.mobile-sheet-btn:focus-visible{outline-color:var(--gold)}
  ```

**F2 [P2] 跳转链接 / 语义结构**
- 要求：`<body>` 顶部加 `Skip to main content`(`.skip-link`，聚焦时显现)；主内容区加 `id="main" role="main"`；试卷页 `h1`(卷名)→`h2`(part)→`h3`(question) 层级自洽（当前 `.part-title` 非标题标签，建议用 `<h2>`）。

**F3 [P2] 图表/状态不依赖颜色单一通道**
- 要求：`.bar-fill.low`(红)、`.opt.correct/.wrong` 除颜色外加图标/文字标签，满足色盲用户（8% 男性）。

**F4 [P3] 文本最小尺寸**
- 要求：正文保持 ≥15px（移动 16px）；`.q-score/.exam-meta` 等小字用 `--ink-2` 而非 `--ink-3` 以保证可读。

---

## 3. 落地优先级（P0→P3）

| 优先级 | 项 | 类型 | 工作量 |
|---|---|---|---|
| **P0** | C1 移动端答题卡抽屉 | CSS+少量JS | 中 |
| **P1** | A1 灰对比度、F1 焦点环、E3 reduced-motion、D1 myAnswer 键名 | 配置/JS | 小 |
| **P2** | A2 金色成就、A3 字体、A4 间距令牌、A5 图标、B1 死代码清理、D2/D3 引导、E1/E2 缓动与反馈、F2/F3/F4 | CSS | 中 |
| **P3** | B2 结果层级、C2 触控、细节打磨 | CSS | 小 |

---

## 4. 落地核查结果（2026-08-22 实测复核）

> 本节原先写作「本轮已落地实现」，逐条对代码复核后发现 **8 项里有 5 项当时并未真正生效**——
> 选择器写在 `design-system.css`，但 render 层不输出这些类名，或被更晚加载的规则/更高优先级的
> `display:none` 压掉。以下为实测结论与最终状态；所有对比度均按 sRGB 线性化计算，不作估算。

| 原条目 | 当时真实状态 | 现在 |
|---|---|---|
| A1 `--ink-3` 对比度 | 部分有效，但 `design-system.css` 里重复声明的令牌**遮蔽**了 `style.css` 刚校准的值 | 删除重复声明；`--ink-3` 定为 `#656c7c`（`#eef1f6` 上 4.65:1，白底 5.26:1） |
| A2 金色成就 | **完全失效**：挂在 render 从不输出的 `.result-score`，以及 `div.score-ring{stroke}`（stroke 对非 SVG 无效） | 改挂真实存在的 `.score-ring strong` / `.report-score b` / `.row-status strong` |
| A3 字体 | **有害**：`@import url(fonts.googleapis.com…)` 阻塞首屏，且该域在内地考生网络下常需等到 TCP 超时 | 删除 `@import`，统一用 `style.css` 的系统中文衬线栈；选择器收敛到 render 实际输出的类名 |
| A4 令牌 | 有效 | 保留 |
| F1 焦点环 | **不达标**：金色环在页面底色 `#eef1f6` 上仅 2.97:1、在蓝色按钮上仅 1.84:1，低于非文本 3:1 | 改用 `--focus-ring:#0b1220`，实测蓝 3.03 / 青 4.47 / 锈 3.67 / 金 3.42 / 绿 3.46 / 红 3.43，全部达标 |
| E3 reduced-motion | 有效 | 保留 |
| B1 死代码清理 | **未清**：`.opts.grid2`/`.result-score`/`.best-score b`/`.score-badge.high`/`.exam-card`/`.modal`/`.opt`/`.q-stem` 等仍在 | 已逐条核对 render 输出后删除 |
| C1 移动抽屉 | **在任何手机上都不可能出现**：`app.css` 的 `@media(max-width:800px){.answer-sheet{display:none}}` 从未被覆盖，抽屉样式全作用在一个不存在的盒子上 | 抽屉分支补 `display:block`；现可开合、点题号自动收起、Esc 关闭并归还焦点、遮罩变暗、锁背景滚动 |

**文档未提及、但实际存在的缺陷（本轮一并修复）**

1. 答题卡题号是 `<a href="#q-…">`，而本站为 hash 路由——点一下就落进 `location.hash`，路由匹配不到 `/exam/…` 即回落首页，**整场考试与已填答案当场销毁**。改为自行 `preventDefault` + 滚动聚焦，绝不写 hash。
2. 考试进行中答题卡圆点从不变绿、顶栏「已作答 n/72」从不变化（进度只在整页重渲染时计算）。新增 `App.syncSheet()`，就地更新，不重渲染，滚动位置与输入焦点均不丢失。
3. 解析模式无任何判分信号：`render.js` 输出 `.question.review/.wrong`、`.option.correct`，而**全站没有一条 CSS 匹配它们**。现已补齐，且不走颜色单通道——正解补「✓ 正确答案」、错选补「✗ 你选的」，色盲与灰度打印同样可读。
4. `#/training/<type>/example`（首页「分题型训练」卡片的落地页）**对每个题型都是白屏**：`Training.build()` 把 `meta` 挂在返回对象上而非每个 item 上，`showLesson` 解构后 `meta.name` 直接抛错。
5. `platform.css` 里裸的 `.option-letter` 规则（该文件在 `app.css` 之后加载）把试卷页的蓝色选项字母染成了平台青。已收窄为 `.topic-option .option-letter`。
6. `Store.addMistakes` 的字段白名单漏了 `sectionKey`，而 `render.js` 有 3 处读它来拼「回到对应训练」链接——该入口从来不出现，错题详情页的训练链接永远回落到 `reading`。
7. 首页与专题/例题页存在嵌套或多个 `<main>` landmark；试卷页 72 道题只有一个标题层级，读屏用户无法按题跳转。已改为单 landmark + `[1,2,3,3,…]` 标题大纲，并用 `MutationObserver` 在每次 SPA 重渲染后重贴 `#main`。

**验证方式（全部在真实浏览器中跑，非静态推断）**

- `smoke-test.html`：57 项断言，桌面 1200px 与手机 360px 双 iframe（媒体查询按各自视口计算）。最新 `DONE total=57 fail=0`。
- `contrast-audit.html`：遍历 22 条路由的渲染结果，按真实祖先背景链合成 `rgba`，并处理大字号豁免。最新 `AUDIT-DONE routes=22 violations=0`。
- `.work/a11y.html`：15 条路由的语义审计（landmark、标题层级跳级、按钮可访问名、输入标签、`lang`、重复 id）。最新 `A11Y-DONE fails=0`。
- `.work/visual.html`：25 项外观回归，确认语义化改造未改变视觉呈现。最新 `fail=0`。

> 注：headless 的虚拟时间不推进合成器动画，过渡中的值会冻结在起始帧。涉及位移的断言均先关掉 `transition` 再测——检验的是级联结果（真正修的东西），不依赖动画时钟。

---

## 5. 明确改进要求清单（开发执行用）

1. **对比度**：次级文字统一用 `--ink-3:#656c7c`。原文写的 `#5b6472` 未落地，且 `#6e7687` 在最深的浅色底 `#eef1f6` 上只有 4.03:1，不足 AA。
2. **焦点**：每个可交互元素必须 `:focus-visible` 可见环，且环色需在**所有分区底色与实心控件上**都 ≥3:1——单看白底会漏判。
3. **动效**：所有过渡引用 `--ease-out/--ease-in-out`，禁用裸 `ease`/`bounce`。
4. **移动答题卡**：≤800px 必须为可开合抽屉，禁止 `display:none` 隐藏。改这类规则时先确认自己的选择器**能压过更早文件里的 `display:none`**，否则整套样式作用在不可见盒子上。
5. **色彩语义**：金色仅用于成就/分数，不得扩散为主色。
6. **图标可访问性**：图标纯装饰，`aria-hidden`，真实含义在按钮文本。
7. **死代码**：render 未输出的 CSS 选择器一律删除。新增规则前先 grep render 层确认该类名真的会被输出。
8. **reduced-motion**：任何位移动画必须提供降级。
9. **判分信号不得依赖颜色单通道**：对错状态必须同时有文字或形状标记。
10. **禁止外链 Web 字体 / 阻塞式 `@import`**：目标用户网络环境下会拖垮首屏。
11. **本站是 hash 路由 SPA**：任何形如 `href="#…"` 的页内锚点都会被路由吞掉并回落首页。页内跳转必须 `preventDefault` 后自行滚动聚焦。
12. **改动后跑四套 harness**（smoke / contrast / a11y / visual），以渲染结果为准，不以选择器存在为准。

