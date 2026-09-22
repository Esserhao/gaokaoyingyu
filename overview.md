# 本轮完成概览：全站栏目重构（方案三 · 主导航）

> 日期：2026-09-02 · 经现状盘点图 + 三选一可视化对比，用户选定方案三/搜索并入查词/知识域重命名，词组闪卡位置由 AI 定夺（词域下拉 + 生词本页平级链接）。

## 改动模块与改进原因

### 1. `js/ui/base.js` —— 新增全站主导航（核心）
- 新增 `SITE_NAV_DOMAINS`（学/练/错/词/工具五域）+ `siteNav()`：`details/summary` 原生下拉，零 JS、键盘可用；按 hash 前缀正则高亮当前域。
- `header()` 与 `referenceHeader()` 输出末尾追加导航 → 全站 49 个内容页获得常驻导航。
- **原因**：原首页报头 11 项工具平铺无分组，知识域 3 项命名相近难分辨，词汇域 4 个功能散布且词组闪卡完全无入口；主导航一次收编所有入口，低频管理项（数据备份）归入工具域。

### 2. `js/ui/library.js` —— 首页去重
- 删除 11 项平铺 home-tools 工具链与 exam-category 导航条（同页 6 个重复入口）；「N 套真题」计数迁入历年真题栏目标题；四步路径保留为学习叙述卡。
- **原因**：导航条与路径卡指向完全相同的页面，重复入口徒增视觉噪音；计数信息不丢失。

### 3. 知识域重命名（消歧）
- 知识系谱→**错题溯源**（mistakes.js 页面/标题/4 处链接、dashboard.js）
- 知识星图→**知识点星图**（knowledge-graph.js）
- 分台阶学习→**知识台阶**（mistakes.js、insights.js、knowledge-graph.js、library.js 路径卡）
- **原因**：三个「知识」开头的栏目学生无法区分；新名直述功能。路由与函数名未动。

### 4. `js/ui/word.js` —— 搜索并入 + 词组闪卡补口
- 查词页底部新增「用全站搜索 →」（#/search 路由保留，进工具域下拉）；生词本页头新增「词组闪卡」平级链接。
- **原因**：报头删「搜索」后仍需可发现路径；4,487 条词组闪卡此前只能从词条卡绕进，断层修复。

### 5. `css/components.css` —— 导航样式（P-38 合规）
- `.site-nav` 组件段：激活域整块底色 + inset 底部 2px 强调（非左竖线）；菜单 1px 线框无投影（铅字印刷）；720px 断点菜单就地展开、触控目标 44px。

### 6. 死代码清理（冗余样式收敛）
- 删除 `css/reference.css` / `responsive.css` 中失效的 `.home-tools`、`.exam-category`、`.category-label/active/count`（`.category-training` 类从未有过样式）。
- 删除 `css/style.css` 中 18 个零引用死令牌：`night-0/1/2`、`rel-syn/near/ant/suf-ink`、`blue-soft/line`、`gold-line`、`dur-fast/base/slow`、`shadow-0/1/2`、`r-xs`、`sp-0`，全仓残留 0。

## 未改动（明确豁免）
- 答题页（examBar）与同义词星空（沉浸画布）不渲染主导航，保持作答/探索沉浸。
- 所有路由、函数名、业务逻辑、数据层零改动；无新依赖。

## 验证
- 8 个改动 JS `node --check` 全绿。
- **53 路由**无头 dump 全渲染、`suspiciously empty: none`；抽查 #/、#/learn、#/knowledge、#/knowledge-graph、#/word、#/words、#/exam 等关键路由的导航高亮与重命名落点全部正确。
- 死令牌删除后与基线零差异；audit_ui 间距/字号越界 0。
- 快照基线重置为 53 路由（旧基线留档 `.work/snap-rev-pre-sitenav.json`）。

## 收尾三件（同日完成）
- **#64 视觉对比**：清空 Chrome profile 后重拍 18 张 after 截图，与 before 逐页 md5 全部 CHANGED——确认视觉变化真实落地、无缓存假象；基线留档 `shots/before` + `shots/after`。
- **#56 临时产物清理**：`.work` 从 ~200M 降至 20M。删除 Chrome profile（178M）、38 个探针 HTML、24 个一次性脚本、18 个旧数据备份、5 个历史快照、试卷拆解中间产物；保留护栏五件套（domdump/savesnap/cmp_snap/shoot/audit_ui）、现行基线与留档基线、全部 backup_* 备份、数据生成器。
- **#57 技能沉淀**：新增用户级技能 `css-refactor-guardrail`（量化审计 → 令牌化归一 → 死代码扫描 → 栏目重构范式 → 无头护栏验证全流程与踩坑清单）。

任务列表 69 项全部完成，无遗留。
