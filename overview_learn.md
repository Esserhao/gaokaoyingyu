# 分台阶学习 UI（#/learn）

让重建后的 38 个高考英语知识点可被学生**主动浏览**、看到**学习台阶（level）**、**自评掌握度**并做**进度追踪**——把「知识库」真正变成可用、可跟进的学习工具。

## 怎么用
打开 `index.html` → 首页右上「分台阶学习」，或直接访问 `#/learn`。
- 顶部进度条 + 图例实时显示：已掌握 / 有点思路 / 有点模糊 / 未开始 的计数。
- 全部 38 个知识点按 4 大分类（语法·句法 / 语法·词法 / 词汇·用法 / 写作·表达）分组陈列，每张卡片带 **level 徽标**（基础=绿 / 进阶=蓝 / 挑战=琥珀）、一句话摘要、标签。
- 每张卡片三个自评按钮：**有点模糊 / 有点思路了 / 掌握**。点一下即刻高亮、进度同步刷新，**不整页重渲染**（不会滚回顶部）。
- 顶部难度筛选 chips（全部 / 基础 / 进阶 / 挑战）按台阶过滤。
- 每张卡片「详解 →」跳到原知识点详情页（`#/knowledge/<id>`，例句/常见错误/易混点）。
- 自评数据落在 `localStorage` 的 `gkyy_records_v1` 整包 `kbMastery` 字段，**刷新/换设备（#15 导入）都不丢**，导入时按「当前设备已填优先」合并。

## 改动文件
| 文件 | 改动 |
|---|---|
| `js/store.js` | 新增 `getKBMastery()` / `saveKBMastery(nodeId, level)`；`mergeData` 增加 `kbMastery` 分支 + `syncMergeMastery`（当前设备优先） |
| `js/ui/mistakes.js` | 新增 `UI.learn(filter)` / `UI.learnNode(n,m)` / `UI.refreshLearnCounters()` |
| `js/app.js` | `EXACT_ROUTES` 加 `'/learn'`；`ACTIONS` 加 `'kb-mastery'`；`click` 加 `data-learn-filter` 筛选 |
| `css/learn.css` | 新页面专属样式（复用全站 design token，仅定义新增类名） |
| `js/ui/library.js` | 首页右上加「分台阶学习」入口 |
| `index.html` | 引入 `css/learn.css` |
| `.work/domdump.html` | 护栏路由表加入 `#/learn` |

## 验证结果
- **语法**：4 个改动 JS 文件全部 `node --check` 通过。
- **护栏**：38 路由 DOM 快照比对，仅 `#/` 因「新增导航链接」触发差异，**其余 37 路由逐字节零回归**；`#/learn` 渲染正常（33KB，含全部预期类名）。
- **交互**：点「掌握」→ 按钮 `is-active` + `localStorage.kbMastery` 持久化 + 顶部进度 0→1，全部符合预期。
- 含 `#/learn` 的快照已设为 `snap-rev.json` 基线。

## 过程中的关键教训（已写入项目 MEMORY.md）
`js/ui/*.js` 用 `Object.assign(UI, {...})` 把多个页面方法挂到同一个 `UI` 上——**任一处语法错误会让整块解析失败，导致 `UI.knowledge`/`UI.mistakes` 等全部 undefined，所有依赖它们的路由渲染成「页面加载失败」错误页**。而护栏的 `suspiciously empty` 只拦 <80 字符，154 字符的错误页会漏过；若 base/new 两份都用坏代码生成，还会「伪零回归」。**正确流程：改完 JS 先 `node --check` 全绿，再跑无头 dump；比对后抽查新路由确实渲染出真实内容。**
