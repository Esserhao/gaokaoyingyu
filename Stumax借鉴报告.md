# Stumax 借鉴报告 —— shanghai-gaokao-english-os 深读结论

> 2026-09-04 深读（仓库快照克隆于 `.work/stumax-ref/`，273 个文件，最后提交 2026-07-30）。
> 结论先行：**它与我们同题材、异路线**。它是「规则/SOP/训练协议」站，不是题库站。
> 全仓库没有一道可做的真题（刻意只存链接与元数据），核心资产是**记录口径与方法论**。
> 值得抄的是三套口径 + 两张表；技术栈、内容体系均不建议搬。

---

## 一、它是什么

**Stumax：上海高考英语解题操作系统**，本地优先训练工作台。

| 维度 | 现状 |
|---|---|
| 形态 | Astro 静态站（GitHub Pages 在线版）+ Python 校验/统计脚本 + IndexedDB 本地记录（无账号无后端无云同步） |
| 内容 | 8 个模块（语法词汇语篇/完形/阅读/概要写作/中译英/情境写作/听说/整卷），每模块四件套：map / SOP / 速查卡 / 训练闭环（`docs/handbook/2027/<模块>/`） |
| 数据 | `data/` 下规则 8 个 JSON（共 40+ 条「规则」）、错误阶段分类表、主观题量表 3 份、来源登记表、考试结构表 |
| 记录 | 5 张 CSV 契约模板（attempts / revisions / subjective-reviews / full-paper-budget / reading-attempts），Web 与 Python 统计**口径对齐**（`metric-parity` 测试锁死） |
| 质量 | Python unittest + Vitest + Playwright 三层测试、CHANGELOG 版本化、发布校验脚本——工程成熟度高于个人项目平均 |
| 版本 | `2027.1.0-PROVISIONAL`，规则全部 PROVISIONAL（未做上海真题冻结验证，作者如实声明） |

**它的立身之本**（README「信任边界」）：每条建议可追溯、可反驳、可测试、可撤回。
AI 可以找反例查逻辑，**不能把未知答案改成官方答案**；未经授权的试卷不进仓库。

## 二、与我们项目的根本差异

| | Stumax | 我们（高考英语真题在线） |
|---|---|---|
| 内容核心 | 方法论：规则 + SOP + 训练协议 | 数据：16 套真题 + 12 万词库 + 50 知识节点 |
| 上海卷特有模块 | 概要写作 / 中译英 / 听说（35 分） | 全国卷题型（七选五 / 语法填空 / 短文改错 / 读后续写） |
| 记录载体 | CSV 契约 + Python 汇总 | localStorage + 导出导入 JSON |
| 信任模型 | 规则三态 + 答案四态 + 来源登记 | verified 灰标 + source 字段 |
| 技术栈 | Astro + Playwright + PWA | 无构建顺序 script + 无头护栏 |

结论：**内容体系不可搬**（题型不同、且它是「无题库」设计，我们是「有题库」设计）；
**口径与表格可搬**——它把「作答记录怎么记才不会自欺」想得比我们细。

## 三、逐项评估

### A 级：值得抄，成本可控、直接增强现有功能

**A1. 错题「最早错误阶段」过程归因**（源自 `data/taxonomies/error-stages.json`）
- 它的做法：每个题型定义 8–11 个**过程阶段**（阅读：PROMPT 题干理解 → LOCATE 定位 → PARSE 句意 → INTEGRATE 整合 → INFER 推断 → COMPARE 比较 → EXECUTE 执行 → TIME 用时），错题复盘时只能选一个「最早出错的阶段」；且明令「『粗心』不是诊断」——漏看 except 是 PROMPT，有证据涂错格是 EXECUTE，没停损是 TIME。
- 我们的差距：错题已有**知识归因**（cause/subCause/knowledgeNode，diagnose.js 自动归类），但缺**过程归因**——「这题错在哪个环节」回答不了。两者正交：知识点归因答「缺什么知识」，过程归因答「哪个动作坏了」。
- 怎么抄：给 mistake 加 `errStage` 字段（错因编辑器里加一排阶段按钮，按题形给阶段集：阅读/完形/语法填空/七选五各一套全国卷口径，阶段定义直接改写自它的表）；错题溯源页加「错误阶段频次」聚合（现有 kdCauseFreq 同款版式）；打印已含错题整条，无额外工作。数据模型向后兼容（旧记录无此字段 = 未归类，不进统计分母）。

**A2. 答案状态四层口径**（`key_status: official / human_adjudicated / third_party / unknown`）
- 它的做法：每条作答记录登记**答案本身的可信层级**；统计时 `unknown` 不进正确率分母、`third_party` 单列「练习指标」不与官方混算（`stumax_os/metrics.py` 硬编码执行，另有 web/python 口径一致性测试）。
- 我们的差距：我们的 `verified` 描述「内容有没有人核」，但没有对**答案来源**分层——16 套卷答案来源不一（官方 / 教辅 / 整理），G2 折算和成绩统计目前一视同仁。
- 怎么抄：data/exams 每卷加 `keyStatus` 字段（枚举同上，人工补录时顺手标）；`#/result` 与仪表盘统计里 third_party 卷的正确率单独标注「教辅答案」；unknown 不进跨卷聚合。这是纯口径升级，不动 UI 结构。

**A3. 整卷「时间预算 vs 实际」复盘**（`templates/full-paper-budget.csv`）
- 它的做法：每次整卷记录各模块 `planned_seconds / actual_seconds / items_completed`，把时间管理当独立训练项（错误阶段表里也有 TIME 阶段、整卷阶段表里有 BUDGET/ORDER/STOPLOSS）。
- 我们的差距：计时器 + 到点预警（UX 修订 3/4 项）已做「当下」，但**没有留下时间数据供复盘**——成绩页看不到「阅读花了 40 分钟 vs 预算 35」。
- 怎么抄：exam.submit 已有耗时总长；给 exam Bar 各 section 加「入段/出段」时间戳落账（Store 加 sectionTimings），成绩页渲染「实际 vs 建议预算」两列条形（建议预算来自 SCORE_FORMATS 同款常量表）。注意：只陈述不建议（P-38 式克制），预算列标注「参考值」。

### B 级：可考虑，等对应功能自然迭代时再带

- **B1. 主观题双评/分歧保留**（`subjective-reviews.csv` + `rubrics.json` 的 `review_protocol: {double_rating_recommended, retain_disagreement, ai_role: second_opinion_only}`）：我们自评表（P2）是单评。升级方向 = 自评后可让 AI 出「第二意见」，两者不一致时**保留分歧不平均**。量表版本化 + 「训练量表非官方」免责声明值得抄（我们的自评表也该加一行小字）。成本中等，等下次动主观题模块时一起做。
- **B2. 首次作答不可覆盖 + 订正≠迁移**：我们的错题重练/知识复练（1/3/7）已有间隔机制，但没有「首次答案 vs 订正答案」的区分。若日后做「错题重练正确率」统计，先抄它的 `is_unseen/is_delayed` 口径（重做已见题只算订正，间隔后的新题才算迁移），避免自欺数据。
- **B3. 来源登记字段补全**：它的 sources.json 每条有 `source_tier / license_status / redistribution / verification / accessed_at` 五字段，比我们 SOURCES.md 的叙述式登记更机器可查。零成本改进：下次动 SOURCES.md 时套这个字段格式。

### C 级：不建议搬

- **C1. Astro/PWA/Playwright 技术栈**：与我们「无构建、file:// 直开、顺序 script」的既定架构冲突，收益为零。
- **C2. 规则三态（PROVISIONAL/VALIDATED-SH/PERSONALIZED）全套流程**：冻结验证集、双人独立标注、预登记撤回条件——对面向单一用户的个人项目过重。我们 verified 两态够用，最多吸收「AI 不能改答案」进数据铁律（已基本覆盖：source 不得编造）。
- **C3. 规则/SOP 内容体系**：上海卷特有（概要/中译英/听说）。我们的知识点卡（rule/summary/常见错误/易混点）已是等价的「速查卡」形态。

## 四、若要落地：建议顺序

| 步骤 | 内容 | 改动面 | 护栏 |
|---|---|---|---|
| 1 | A2 答案状态口径 | data/exams 各卷 +1 字段（人工标注 A2 顺手做）、result/dashboard 统计 | 快照 #/result/#/dashboard 预期 diff |
| 2 | A3 时间预算复盘 | exam 计时 section 时间戳 + 成绩页两列条形 | scoreprobe 加时间断言 |
| 3 | A1 错误阶段归因 | mistakes 数据 +1 字段、错因编辑器 +阶段按钮、溯源页频次聚合 | 快照 #/mistakes 预期 diff + 专项探针 |

三步都向后兼容（旧记录缺字段 = 未归类，不进分母），可独立交付，互不阻塞。

## 五、不落地也值得留下的三句话

1. **「粗心」不是诊断**——把粗心拆成可观察动作（漏看否定=题干理解，涂错格=执行，没停损=用时），这句写进错题归因的 UI 文案最合适。
2. **订正不等于迁移**——重做已见题的正确率不算能力，间隔后的未见题才算。
3. **高信心错误优先处理**——有把握却做错的题比「不会的」更危险，因为觉察不到失败。
