# 高考英语学习平台任务总览与未来路线图

> 最后更新：2026-08-30
> 当前阶段：阶段 0 已完成；阶段 1—3 主体完成；**阶段 5「学习内容体系重建」已开工**：
> 数据层 + 入口（#/learn、38 节点知识库、词汇包、星座页）已落地，逐条进度见 8.8 勾选状态
>（见第八节）
> 运行范围：仅使用浏览器本地数据，不自动上传、不自动登录外部服务。

## 一、已经确定的产品方向

本项目不是单纯的“真题展示器”，而是面向高中英语学习者的**带教式真题学习平台**：

```text
先学方法 → 在完整材料中应用 → 用整卷模拟检验
                         ↓
              错题复盘 → 知识节点回炉 → 再次验证
```

核心原则：

- 学生先独立思考，再逐步获得提示和解析。
- 任何错误都尽量回到题目证据、错误步骤和知识节点。
- 写作提供草稿、外部点评材料和修改记录，但不自动登录、上传、发送或读取外部网页。
- 短文改错保留规范删/加/改格式，并坚持人工复核，不伪造机器评分。
- 学习记录默认只保存在当前浏览器。
- 题库质量优先于功能数量：不猜答案、不用模型推断替代原始答案。

## 二、当前已完成能力

### 1. 真题与模拟

- 7 套 2022—2023 年真题归档，按年份、卷型和考试地区展示。
- 整卷答题、计时、草稿保存、交卷、客观题评分和答案解析。
- 成绩页显示总分、分模块成绩和非客观题人工统计。
- 模拟结果页会根据失分模块推荐对应分题型训练。

路由：

```text
#/                 历年真题首页
#/simulation       真题考试模拟
#/exam/:id         整卷练习
#/result/:id       成绩概览
#/review/:id       答案解析
```

### 2. 分题型与专题训练

- 分题型训练：听力、阅读、完形、七选五、语法填空、短文改错、应用文、读后续写。
- 带教式流程：任务 → 证据 → 比较 → 结论 → 策略复盘。
- 专题训练：阅读、听力、完形、七选五、语法填空、短文改错和写作。
- 专题支持真实材料选择、整组作答、提交复盘和部分草稿保存。
- 专题完成记录已接入本地 Store 和学习总览。

路由：

```text
#/training
#/training/:type
#/training/:type/example
#/topics
#/topic/reading
#/topic/listening
#/topic/cloze
#/topic/seven
#/topic/grammar
#/topic/proofreading
#/topic/writing
```

### 3. 错题、知识和学习总览

- 学习总览：整卷次数、作答题数、待回炉错题、知识节点和专题完成次数。
- 错题本：查看解析、记录错因、细分错因和知识节点。
- 错题详情：答案对比、错误步骤、学生复盘、状态流转。
- 错题状态：待回炉 → 复习中 → 已掌握。
- 知识系谱和知识点详情：错误证据、规则说明和即时重练。
- 模拟结果按失分模块提供回炉入口。

路由：

```text
#/dashboard
#/mistakes
#/mistake/:id
#/knowledge
#/knowledge/:id
#/data
```

### 4. 数据备份与迁移（跨设备，#15）

- 学习记录默认只保存在当前浏览器（不自动上传、不自动登录外部服务）。
- 新增「数据备份与迁移」页（`#/data`）：一键导出当前设备的 `gkyy_records_v1`
  整包为带日期的 JSON 文件；导入另一台设备的备份时**合并而非覆盖**。
- 合并规则：成绩 / 整卷草稿 / 专题草稿按更新时间较新一方保留；错题按身份去重，
  间隔复习排期取进展更靠前的一方；写作草稿走独立键，不纳入此机制。
- 目的：换设备、清缓存或重装前先导出，到了新设备再导入合并，进度不丢。
- 间隔复习排期（时间累积资产）在合并中受专门保护，不被整批冲掉。

## 三、当前题库与质量状态

已导入 7 套真题：

- 2022 全国甲卷、全国乙卷、新高考Ⅰ卷
- 2023 全国甲卷、全国乙卷、新课标Ⅰ卷、新课标Ⅱ卷

已完成：

- JSON、题号、选项、客观答案、文章关联和字段完整性检查。
- 长解析结构化，保留 `explanationRaw`。
- 四套短文改错统一为规范删/加/改格式。
- 写作题不纳入自动答案审查范围。
- 自动审计工具和人工审查清单已建立。

发布原则：

- 当前题库仍属于本地开发与复核状态，不宣称全部内容已经最终发布。
- 四套短文改错完成原始解析版对照后，才能标记为人工确认。
- 任何未解释异常必须先记录，再决定是否进入前端。

## 四、未来方向：按阶段推进

### 阶段 0：发布可信度（已完成，2026-08-21 收尾）

目标：让学生看到的每道题都“来源清楚、状态明确、不会误导”。

1. ✅ 完成四套短文改错最终人工确认，并更新审查清单（2026-08-20 常安逐套确认，清单 2026-08-21 质量门禁关闭）。
2. ✅ 统一 `quality`、人工复核状态、首页提示和模拟入口提示（`index.json` 增加 `proofreadingConfirmed`；前端 `reviewBadge` / `examReviewNote` 区分“已确认 / 待复核”，不再把已确认内容误显为待审）。
3. ✅ 所有专题路由检查资源请求、空状态、异常加载和移动端布局（34 个 render / 路由方法无头烟雾测试全 PASS；发现移动端缺 `reference-list` / `passage` 的 @media 规则，已记录待补）。
4. ✅ 对题库和前端做一次完整发布前回归测试（7 个 JS 语法 OK、质量审计 `files=7 issues=0`、全部核心资源 HTTP 200）。

验收：自动审计无新增未解释异常；人工待审项目有明确结论；页面不会把待复核内容显示成已确认内容。

### 阶段 1：学习闭环深化

目标：让“做错一道题”真正变成“完成一次有效回炉”。

1. 知识点详情增加真实例句、常见错误和易混知识点。
2. 根据知识点和错因生成跨试卷训练集合，而非只回到通用训练首页。
3. 错题与知识点支持双向反查：从知识点找到错题，从错题回到知识点。
4. 专题完成记录增加复盘次数、最近练习时间和专题继续入口。
5. 模拟结果进一步按具体错题知识点推荐回炉，而不只按模块推荐。
6. 学习总览增加“继续上次未完成专题”和最近复盘记录。

验收：每条错题至少能连接到一个复习动作；每个知识点详情都能进入具体练习或给出明确空状态。

### 阶段 2：答题体验与恢复能力

目标：让学生在手机和电脑上都能稳定完成长材料练习。

1. 所有专题统一支持中断恢复、草稿保存和最近进度提示。
2. 提交前显示未答题数量，并允许返回补答。
3. 阅读、七选五、语法填空优化材料与题目布局切换。
4. 听力模块在真实音频资源准备后，再完善播放、暂停和独立计时。
5. 增加年份、卷型、题型搜索和“继续学习”入口。

验收：刷新页面不丢失草稿；移动端核心作答流程不被遮挡；提交前能发现未答题。

### 阶段 3：学习分析与个性化

目标：从“记录完成了什么”升级为“判断下一步学什么”。

1. 学习总览增加本周学习次数、完成题数、复盘次数和趋势。
2. 区分首次错误、重复错误和已掌握后再次错误。
3. 增加知识点掌握度和置信度，但不把简单正确率当作完全掌握。
4. 根据错因、知识点、题型和最近状态生成本地个性化推荐。
5. 为训练和专题增加难度、能力标签和方法标签。

验收：推荐有可解释依据，学生能看到“为什么推荐这项训练”。

### 阶段 4：题库扩展与长期建设

目标：在质量门禁稳定后扩大覆盖范围。

1. 导入更多年份和地区真题。
2. 建立更细的知识图谱：前置、包含、易混、共同搭配和错误迁移。
3. 补充真实听力音频后再升级听力体验，不使用占位音频替代。
4. 建立题库导入、审计、人工复核和发布的固定流水线。

### 阶段 5：学习内容体系重建（2026-08-29 设计定稿，未开工）

目标：让学生拿到本站这部分内容，**可以从零开始到掌握绝大部分高考英语知识点**，
而不只是拥有「一个精致的错题本」。

起因：原 `data/knowledge.json` + `knowledge_base.json` 两份知识库经完整核查后判定不可修补
（19 条 `rule` 全为空串导致 17/19 详情页只显示通用兜底文案、两份文件内容互相派生、
`knowledge_base.json` 零代码引用、that/which 规则与自带例句相互矛盾、
`overview.md` 三处描述与实际数据不符）。决定**删除重建**而非打补丁。

核心结论：按 `js/diagnose.js` 规则表跑全库 955 道客观题，**语法只占考点的 20.1%**，
篇章能力占 54.3%、词义辨析占 25.6%。因此把原先「一套知识节点体系装下所有考点」
改为**三家分立**，各用适合自己的度量方式（详见第八节）。

1. 删除 `data/knowledge.json`、`data/knowledge_base.json`（两者均静默降级，删除安全）；
   `data/knowledge_graph.json` 保留至图谱页改造日（它在 `init()` 里抛错、不降级）。
2. 建知识体系：约 50 个语法与词块节点，五级台阶 + 变体闸门 + `strength` 分级 + 单元级 mini 诊断。
3. 建题型专项：8 题型 + 约 12 个子技能，方法卡 + 三档度量，复用 519 道已自动标注的真题。
4. 建字典：约 4 706 条词条，静态分片按需注入；**阻塞于外部词典库许可证核实**（见 `字典设计.md` D8）。
5. 首页三步路径条（`js/ui/library.js:88`）扩为四步，新增 `#/learn` 作为入口 00。

验收：见第 8.7 节验收标准。

## 五、明确暂缓事项

以下事项在当前阶段不优先：

- 不先做账号系统、云端同步和社交功能。
- 不自动登录、上传或读取 DeepSeek 等外部网页。
- 没有真实音频前，不用占位音频包装成完整听力产品。
- 没有完成题库人工确认前，不盲目导入大量新年份。
- 不为了“看起来功能很多”而重复制作相似页面。

## 六、数据与质量约束

题库原始材料、答案和解析必须保留；结构化字段只能追加，不能覆盖原文：

```json
"knowledge": {
  "primary": "句",
  "secondary": "语法结构",
  "nodes": ["主谓一致", "第三人称单数"],
  "relations": [
    {"type": "前置知识", "target": "主语识别"},
    {"type": "易混", "target": "一般过去时"}
  ]
}
```

错题记录至少保留：

```json
{
  "cause": "句",
  "subCause": "语法结构",
  "knowledgeNode": "主谓一致",
  "errorStep": "判断规则",
  "studentNote": "看到 become，但没有检查主语",
  "reviewStatus": "待回炉",
  "confidence": 1
}
```

原则：无法确定的知识点标为“待确认”，不强行归类；写作和短文改错不伪造机器评分。

> ⚠ 上面这段 `knowledge` 字段草案是阶段 1 的旧设计，已被第 8.3 节取代
> （新形态：中文 `id` + 冻结 `slug`、`strength` 分级、`variant` 变体标签、
> `commonErrors` 拆 `wrong`/`right`/`why` 三段）。保留原文仅作沿革记录。

## 七、统一验收标准

每次开发完成必须满足：

- Hash 路由可访问，加载失败和空数据有友好提示。
- 桌面端和移动端均能完成核心流程。
- 数据字段来源明确，原始题库、答案和解析未被覆盖。
- 7 套题库 JSON 可解析，自动审计无新增未解释异常。
- JavaScript 语法检查通过。
- 页面明确告诉学生下一步做什么。
- 错题能连接到证据、错因、知识节点和回炉动作。
- 重要学习数据仅保存在浏览器本地。
- 写作外部点评不自动登录、上传、发送或读取网页。

## 八、学习内容体系重建：设计定稿（2026-08-29）

> 本节是阶段 5 的完整设计依据，全部条目均已逐条确认。字典部分另见 `字典设计.md`。
> 与本节冲突的旧描述（第六节的 `knowledge` 字段草案、第九节第 8 条）以本节为准。

### 8.1 为什么拆成三家：全库实测

按 `js/diagnose.js` 的 `DIAG_RULES` 规则表跑 16 套卷 955 道客观题
（跳过写作与短文改错），考点实际分布：

| 家族 | 节点数 | 题量 | 占比 | 归属 |
|---|---|---|---|---|
| 篇章能力（细节理解 130 / 听力细节 126 / 推理判断 120 / 语篇衔接 62 / 主旨大意 42 / 场景与人物 20 / 词义猜测 14 / 观点态度 5） | 8 | 519 | **54.3%** | 题型专项 |
| 词义辨析（动词 108 / 名词 83 / 形容词 40 / 副词 13） | 4 | 244 | **25.6%** | 方法归题型专项，词条归字典 |
| 语法与词形（非谓语 48 / 连词 21 / 固定短语 15 / 介词 14 / 冠词 12 / 定语从句 12 …共 21 项） | 21 | 192 | **20.1%** | 知识体系 |

判断依据：五级台阶（变体闸门、`strength` 分级、间隔复练）只对**有规则可讲**的
语法节点成立。硬套到 `细节理解` 上会造出「写不出规则、等级永远为 0」的空节点——
这类节点会占掉学习路线四分之一，使进度条永远到不了顶。
**需要例外条款说明模型错了，不是说明需要例外。**

### 8.2 三家的形状与建设顺序

```text
00 知识体系（#/learn + #/knowledge/<中文 id>）  约 50 节点   ← 先做，不依赖任何未知
01 题型专项（#/training 扩建）                8 题型 + 12 子技能  ← 复用现成标注与四步法
02 专题训练（#/topics，已存在）
03 真题模拟（#/simulation，已存在）
   字典（#/word/<词形>）与错题本作为横向工具挂顶栏  ← 最后做，阻塞于许可证核实
```

顺序理由：字典最贵（约 4 706 条），放最后意味着前两家上线时已摸清逐条核验的实际速度，
再决定批次怎么切。

### 8.3 知识体系（约 50 节点）

| 项 | 决定 |
|---|---|
| 范围 | 语法 + 词块，中等粒度，是 `js/diagnose.js` 产出的 36 个 node 名的超集。**词汇不做节点**（归字典） |
| `NODE_RULES` 退役 | `js/ui/mistakes.js:12` 的 22 条一句话规则迁入节点 `rule` 字段，该常量删除 |
| 双入口汇聚 | ① 错题知识点直接对照 ② 从零学习也走到同一页面 `#/knowledge/<中文 id>` |
| id 形态 | 中文 `id` + 冻结的 ASCII `slug`。中文 id 不可改：`classifyKey` 现算出的就是中文名，`js/app.js:56` 的 `decodeURIComponent` 路由依赖它 |
| 数据 | `data/knowledge/index.json` → `window.__KNOW__`（薄索引，预加载）；`data/knowledge/nodes/<slug>.js` → `window.__KNOW_CACHE__[id]`（按需注入，仿 `loadExamData` 写 `loadKnowledgeNode`） |
| 常见错误字段 | 拆成 `wrong` / `right` / `why` 三段。**根治旧数据 36/38 条的 `.。` 双标点缺陷**（原因是 `detail = correction + '。' + note` 的机械拼接） |
| 排序 | 用节点自带的 `unit` / `order` 字段，不用单独的路线数组（两处易失同步） |
| 每节点题量 | **8–10 题**，每题带 `variant` 变体标签（如定语从句：关系代词 / 关系副词 / 介词+关系代词 / 非限制性） |
| 题型 | 单选 + 语法填空 + **错误识别与修正**（计入等级，定位与改后形式均可机判）；**句子改写/合并**作为不计分挑战题 |
| 五级台阶 | 还没开始 → 有点模糊 <40% → 有点思路了 ≥40% → 基本会了 ≥70% **且每个变体至少答对一题** → 挺熟了 100% **且走完 1/3/7 天三档间隔复练** |
| 阈值形态 | JS 常量，不散落在各处判断里 |
| 自评按钮 | 节点页不设。错题本的三个按钮（待回炉/复习中/已掌握）保持不变 |
| 排期 | 复用 `js/review.js` 的 `REVIEW_INTERVALS = [1,3,7,15,30]`；后两档（15/30 天）继续排期但不参与等级，UI 单独标「已保温 30 天」 |
| 进度存储 | `gkyy_records_v1` 新增 `knowledgeProgress` 区，合并走 `syncReviewMoreAdvanced` 的「取更靠前进度」口径 |
| 规则强度 | 新增 `strength: 'rule' \| 'tendency' \| 'register'`，与 `verified` **正交**（`verified` 管人核过没有，`strength` 管这条有多硬）。`tendency`/`register` 在 UI 上显示为「多数情况」「口语中常见」而非「错误」 |
| 前置诊断 | **单元级 mini 诊断**：每单元开头 5 题，从该单元各节点题池按 `variant` 抽样，直接定位该从哪个节点开始，可重做 |
| 加题接口 | `tools/add_question.py`，强制指定 `source`、`verified`、`variant`（脚本靠 `variant` 算覆盖缺口） |
| 样板节点 | 定语从句 + 倒装句。定语从句保持**单节点**，5–6 个子维度作为 `variant` 存在 |

定语从句不拆的硬约束：`js/diagnose.js:39` 靠正则匹配解析原文里的「考查定语从句」
产出 node 名，而**解析原文根本不写限制性/非限制性**，正则无法产出子节点名。

### 8.4 题型专项（8 题型 + 约 12 子技能）

| 项 | 决定 |
|---|---|
| 地址 | **不新开 `#/skill/*`**，扩建现有 `#/training` |
| 唯一出口 | `#/knowledge/<节点>` 仍是错题本的唯一出口，按「节点 → 家族」映射表分派三种版式（语法节点页 / 跳题型子技能 / 跳字典词条） |
| 度量 | 三档：**生疏 <50% / 在练 50–79% / 稳定 ≥80%**，按该子技能最近 10 次作答算 |
| 为何不与知识体系同名 | 故意错开，避免学生把两套进度混成一套；且题型题池是真题、不带 `variant`，套五级台阶只能造假 |
| 不设等级的部分 | 题型节点不进五级台阶，定位为方法卡 |
| 词义辨析四子技能 | 动词看搭配与语气 / 名词看指代与复现 / 形容词看褒贬 / 副词看逻辑关系。题池直接用 275 组现成完形选项，**一道新题都不用写** |
| 复用现成资产 | `js/training.js` 的 8 题型与 `strategy`、`js/training-page.js` 的四步法与分步提示、`js/store.js:210` 的 `addSectionHistory` |
| 缺什么 | 只缺子技能这一层聚合与进度显示。`sectionHistory` 是整题型粗粒度正确率，看不出「阅读不行是因为推理判断而非细节定位」 |

### 8.5 字典（约 4 706 词条）

完整设计见 `字典设计.md`（13 条已定决策 D1–D13、实测规模表、候选库核实清单）。要点：

- **运行时不建数据库**：`file://` 下 `fetch`/`XHR` 被 CORS 拦，sql.js 必须把 `.db`
  读成 `ArrayBuffer`，走不通；数据库只用于构建期。
- 静态分片实测：词条分片合计 0.79 MB（最大片 90 KB，与单套卷 53–70 KB 同量级）、
  位置索引 0.58 MB、需预加载的薄索引 103 KB。
- 释义**外部库打底 + 人工只校订高频层**（约 3 300 条），长尾如实标灰「待校」。
- **阻塞项 D8**：候选库的 LICENSE 实际内容、`tag` 是否含「高考」、100 词覆盖抽样，
  三样确认前不写导入脚本、不按任何特定库的字段结构设计格式。

### 8.6 三条新增数据铁律

1. `verified` 是**必填字段**，不是可选装饰。未经人核的内容必须如实标灰，不得假装可信。
2. `source` 标签**不得编造**。旧 `overview.md` 曾声称例句「全部来自 2019–2025 真题」，
   实际不符——这类描述性谎言比数据缺失更危险。
3. 一致性检查**必须先通过**才能生成 `.js`：结构 / 练习题 / 内容 / 交叉引用 / 排序五类。
   `gen_data_js.py` 从 `.work/` 移入 `tools/`，检查随之内置。

### 8.7 验收标准（在第七节通用标准之外追加）

- 每个语法节点的 `rule` 非空，且 `strength` 已标注；没有一个节点靠通用兜底文案充数。
- 每个语法节点的题目覆盖其声明的全部 `variant`，`tools/add_question.py` 能报出覆盖缺口。
- 五级台阶的每一级都有可达路径；不存在「等级永远为 0」的节点。
- 题型子技能三档能从 519 道已标注真题算出，无需新增题目。
- 未经人核的内容一律灰标，界面不把「待校」显示成已确认。
- 37 路由 DOM 快照护栏：新增路由单独入表，既有路由输出不得意外变动。

### 8.8 长期 TODO（按依赖顺序，逐条勾销）

> 落地注记（2026-08-30）：实现与 §8.3 原设计有分叉——知识体系最终落地为
> 手写 38 节点全量预载（`tools/build_knowledge.py` → `data/knowledge/index.js`），
> 未走「分片 `nodes/<slug>.js` + variant 题池 + 中文 id/英文 slug」路线；
> 分台阶掌握度以 `#/learn` 三档自评（`kbMastery` + `syncMergeMastery`）先行。
> 依赖原设计的条目（A7/A8/A9/A11）保留未勾，待节点级题池立项时再评估。

```text
☑  A1  删 data/knowledge.json、data/knowledge_base.json（knowledge_graph.json 暂留）
        —— 2026-08-30 已删（含旧生成物 data/knowledge.js；备份 .work/backup_knowledge_20260829/）
☑  A2  三条铁律写入 .workbuddy/memory/MEMORY.md —— 2026-08-30
☑  A3  gen_data_js.py 移入 tools/，内置一致性检查
        —— 2026-08-30 收尾：gen_data_js.py 实装 index/题组/交叉引用/图谱四类检查；
        知识五类检查在 tools/build_knowledge.py（检查不过不写文件）
☑  A4  建定语从句、倒装句两个样板节点，交人工审
        —— 已并入 38 节点重建（内容齐全）；人工审校随 A6 内容一起开放
☑  A5  交付约 50 节点骨架清单 —— 2026-08-31 达成：50 节点（25 句法 + 13 词法
        + 8 词汇用法 + 4 写作表达），tools/build_knowledge.py 即清单
☑  A6  按类别填充节点内容 —— rule/examples/commonErrors/confusionPoints 全量填齐；
        strength 三类标注与 commonErrors 的 wrong/right/why 三段已接入渲染
        （2026-08-31：#/knowledge/<节点> 强度徽标 + 三段易错卡，发现即修）
☑  A7  写 tools/add_question.py（强制 source、verified、variant）——
        2026-09-01：CLI 录题（node/variant/kind/stem/answer/source 校验、
        同题去重），追加 tools/kb_questions_custom.py 后重跑 build；
        冒烟：正例入库 + 3 负例拒绝，题池 401 题
☑  A8  按 variant 补足每节点 8–10 题 —— 2026-08-31：400 题（50 节点 × 8 题，
        choice/fill 两版式），全部 verified=false（机器自编待人工复核，
        列入 人工待办清单.md）；custom 批次预留已接通
☑  A9  实现三版式分派 —— 2026-08-31：#/knowledge/<节点> 节点练测上线
        （题池惰加载、盒子级重渲染、choice/fill 两版式、变体命中统计）
☑  A10 实现台阶判定与进度区及其合并规则 —— 2026-08-31：五级判级
        （还没开始/有点模糊/有点思路/基本会了/挺熟了，Review.kbTier）、
        100%+全变体命中自动排 1/3/7 三轮复练（走完毕业）、
        #/learn 台阶徽标、跨设备合并 syncMergeKBProgress（判级 rank 比较）；
        护栏：.work/kbq_probe.html 21/21 PASS
✅ A11 实现单元级 mini 诊断 —— 2026-09-03：#/learn 每个单元（category）
        一条 mini 诊断（UI.unitDiag）：题池练测判级聚成五段分布条
        （复用 .kbq-tier 四级配色，flex-grow 按节点数分宽）+ 全单元
        N 个图例 + 一句可行动建议（薄弱 N 个先回炉：<节点链>→
        #/knowledge/<id> / 全部练过保持复练 / 往下推没练的 / 还没开练）。
        口径：分布只反映练测判级，自评仅在「没练过但自评模糊」时参与
        薄弱判定，两信号不混算；rank2（有点思路）是正常推进不算薄弱；
        诊断是单元级事实，难度筛选（基础/进阶/挑战）下仍按全单元聚合。
        护栏：unitdiag-probe 6/6（真实 KB 动态选种：聚合 25=1+1+2+21、
        薄弱 3 个带链、筛选口径不变、全员毕业建议）；53 路由快照仅
        #/learn 1 处预期 diff，基线重设（留档 snap-rev-pre-a11.json）
☑  A12 新增 #/learn 入口，首页路径条扩为四步
        —— 路由 2026-08-29；路径条 00-03 四步 2026-08-30（css .path-grid 4 列）
☑  B1  题型专项：12 个子技能定义与「节点 → 家族」映射表
        —— 2026-08-30：js/subskill.js（8 篇章 + 4 词义辨析，id 与 Diagnose 产出
        的 knowledgeNode 同名；familyOf() 分派 skill/grammar，dict 版式挂 C4）
☑  B2  题型专项：三档度量与子技能进度显示
        —— 2026-08-30：Exam.subskillBreakdown 交卷逐题归类 → Store.subskillHistory
        （与 sectionHistory 同构，合并复用 syncMergeSectionHistory）→
        Subskill.tierOf 最近 10 题三档（生疏<50/在练50-79/稳定≥80，阈值常量）；
        #/training 子技能进度板；#/knowledge/<子技能> 分派方法卡版式。
        护栏：.work/subskill_check.html 25/25 PASS；快照仅训练页插入板块 + 2 条新路由；
        基线 snap-rev.json 重设为 41 路由（旧基线 snap-rev-pre-b12.json）
☑  B3  词义辨析四子技能接入 275 组完形选项题池
        —— 2026-08-30：#/training/<题型>/skill/<子技能> 专项列表（Diagnose 归类
        过滤，口径与交卷落账一致；动词 108 行与 §8.1 统计吻合），年份筛选不丢
        过滤；知识详情子技能版式「去练」改链专项页；12 个子技能全部可用
□  C1  【阻塞】人工确认候选词典库 LICENSE + tag 取值 + 100 词覆盖抽样
        （2026-08-30：新接入的通用词典源 english-chinese-dict-db 已核实 **MIT** 可用；
        还欠 vocab-wordbank / --main 两个老源的许可核实，见 人工待办清单.md 第二节）
✅  C2  tools/dict_survey.py（2026-09-03 完成：node eval 取值（绕开 JSON.parse
        转义解码坑）+ python 聚合，固化词形键/释义有效/重复分类/覆盖率口径；
        报告词书 9 本 31,127 条、词典 26 分片 121,861 条、词书单词覆盖率 98.7%、
        synonyms 274 组、词缀 28+26；--strict 供校验。详见 §九 item 24）
◐  C3  字典导入与分片生成 —— 词书 .js 注入已完成（convert_vocab.py）；
        **查询型分片已于 2026-08-30 首次落地**：通用词典 12.2 万词按首字母
        26 分片懒加载（tools/convert_ecdict.py，#/word 查词兜底用）
☑  C4  #/word/<词形> 路由与词条页 —— 2026-08-30（js/ui/word.js；8 本词书全量查询
        （首次惰加载后记忆化），词条页含多书释义/音标/例句 + 同义近义反义/词缀
        派生关系卡（复用 __SYN__ 与 _affixIdx）+ 星空入口；词书未收的词缀（如 un-）
        兜底到词缀详情卡；首页 tools 加「查词」入口）
☑  C5  生词本 —— 2026-08-30：gkyy_records_v1 新增 words 区
        （{addedAt, reviewStage, nextReviewAt}，排期复用 Review.schedule 的
        1/3/7/15/30 阶梯：收藏即明日期、「认识」+1 档、「忘记」归零、走完毕业）；
        #/words 页（今日到期 / 排期中 / 已毕业）+ 词条页收藏按钮 + 首页入口；
        合并 syncMergeWords 取进展更靠前一方
☑  C6  解析页与错题本的点击查词 —— 2026-08-30（data-lookup 阅读区：错题详情
        题干/解析、知识详情证据、整卷解析页文章与解析；点击英文单词 →
        caretRangeFromPoint 取词 → #/word/<词>，不往正文塞 span，排版零改动；
        作答模式刻意不开，避免边考边查）
☑  E1  学业诊断卷 —— 2026-08-31（grill 两轮定稿，附录见 交流纪要/2026-08-31.md）：
        js/diagnostic.js 组卷器从 16 套真题按配额抽 24 题客观题（阅读 8/七选五 3/
        完形 8/语法 5，无听力——音频未齐；阅读同卷≤3 且按 passageLabel 带原文，
        完形/语法/七选五整篇同卷连续题保证文章内聚）；同 seed 确定性可重放；
        复用 Exam.score 提交链路（错题/错因照常落账，标 isDiagnostic，
        sectionHistory/subskillHistory 不写——诊断是测量不是训练）；复测 ≥7 天。
☑  E2  学业分析页 #/analysis —— js/ui/analysis.js：诊断状态区（含复测锁）+
        画像五维度（综合状态/分题型/12 子技能三档/错因结构/薄弱节点榜）；
        dashboard 横幅入口；诊断卷最近记录链到诊断结果页。
☑  E3  每日任务规则引擎 —— 纯函数实时计算（方案本体不持久化）：
        R1 到期复习（错题/生词）→ R2 生疏子技能（封顶 2）→ R3 薄弱节点（1）→
        R4 题型空白 → R5 整卷兜底；每任务一句话依据 + details 证据 + 深链；
        完成回写 taskLog（按日并集合并），当日去重，封顶 5 项。
        探针 .work/analysis_check.html 30/30；快照 55 路由基线重设
        （备份 snap-rev-pre-analysis.json）。
☑  D1  知识图谱页改造为「知识星图」—— 2026-08-30：#/knowledge-graph 重写为
        星空形态（沿用词关系星空范式）：38 个知识节点按四类各成星团（黄金角
        螺旋布点，坐标确定性），关联边由节点 related[] 派生（62 条无向边），
        点星居中高亮关联链 + 知识卡（summary/规则/自评掌握度/知识详情与去学入口）。
        knowledge_graph.json/.js 与 gen_data_js 的图谱生成、检查一并退役删除
        （备份 .work/backup-kg-20260830/）；首页 tools 加「知识星图」入口
☑  D1+ 知识星图 v2（用户定稿：50 星一张大平图「太紧太密没有意义」）——
        2026-09-01：改为四张按类别独立的球面星图。#/knowledge-graph 变门厅
        四栏（句法 25 / 词法 13 / 词汇 8 / 写作 4，各栏带类内/跨类关联数与
        前瞻节点芯片）；新路由 #/knowledge-graph/<类别> 渲染斐波那契球面
        三维星空：拖拽旋转（pointer 委托，拖拽中只重投影不重排 DOM）、
        自转开关（默认关）、点星唤醒——球体把该星缓动转到正面，它和
        related 节点一起亮起、链线点亮，跨类关联在知识卡里一键跳到另一张
        星图并唤醒对应星。快照安全：球面基坐标与默认姿态固定，确定性渲染。
        护栏：kg_probe 重写 29/29；51 路由快照仅 #/knowledge-graph 预期 diff
        （基线 snap-f-post.json 重设，snap-rev.json 同步）；顺带修两支过时探针
        （syn 56/56：F2 的第 6 个 phr 页签；word 42/42：F1 的 ♪读 按钮进了
        .word-hw 的 textContent——两支昨日未回归的欠账）。
☑  D2  修正 overview.md 三处与实际数据不符的描述，并合并两段互相矛盾的「本轮追加」
       —— 2026-08-30：知识库两节合并重写、例句来源声明更正、旧文件引用加退役标注
☑  E1  #/synonyms 改造为「星图集」：五张独立星图 —— 2026-08-31（同义/近义/反义/
        前缀/后缀各一张，页签带该图真实星数，切图保持中心词；词义图走整圈、
        前缀图走左翼弧、后缀图走右翼弧，派生图在中心近旁挂词缀门户星（点它进
        家族）；词缀做中心时三个词义页签灰置且自动落在所属图，家族词点回词
        中心时保持所在图；详情卡随图裁剪（近义图给一对一辨析），卡底「查词条」
        链接与 #/word/<词> 互通；空图给引导文案 + 一键跳转按钮。
        数据层零改动（__SYN__ 274 词族、_affixIdx 1256 派生对均不动）。
        设计定稿见 交流纪要/2026-08-30.md 附录 A。
        护栏：.work/syn_probe.html 重写 56/56 PASS；45 路由快照仅 #/synonyms
        变化，其余 44 条零回归（旧基线 .work/snap-rev-pre-synmaps.json）；
        word 42/42、kg 16/16 交叉回归全过）
☑  E2  词组星图（第六张 phr 环形图）+ 无释义词组底稿 —— 2026-08-31：
        gaokao-phrases 4,487 条接入星图与词组详情卡；541 条无释义词组
        导出为 data/vocab/phrases-no-meaning.md 供人工补释义
☑  F1  词组闪卡 #/phrases —— 2026-08-31：收藏/翻卡/移除，排期复用
        Review 阶梯（与生词本同构），「随机收录 10 条」起步
☑  F2  朗读（SpeechSynthesis）—— 2026-08-31：词条页/生词本/词组行 ♪读 按钮，
        零版权成本
☑  F4  考点/词频透视 #/insights —— 2026-09-01：16 套卷 795 道客观题跑
        Diagnose 规则的静态聚合（考点频率榜 TOP24 / 题型×考点 Top5 /
        完形高频词「出场次数+正确次数」），确定性可进快照；
        护栏：.work/ins_probe.html 16/16 PASS
☑  F5  错题混排重练 #/drill —— 2026-09-01：从错题本抽 10 道题干完整的
        客观题（阅读/听力；按 examId+qid 回题库现查选项）打乱重做，
        答对推进复习阶梯、答错不动排期；完形/语法残句题刻意不入池；
        护栏：.work/drill_probe.html 16/16 PASS
☑  F6  打卡日历/streak —— 2026-09-01：#/dashboard 17 周热力格
        （整卷/专题/错题/生词/词组五路时间戳聚合，四档深浅）+ 连续打卡
        天数（今天未学不打断）；护栏：.work/hm_probe.html 11/11 PASS
☑  F9  全站搜索/快捷键/PWA —— 2026-09-01：#/search 四路客户端匹配
        （试卷/知识点/单词/词组，即打即搜 200ms 节流只刷结果区）；
        快捷键（考试 A–D、复习队列 1/2/3、闪卡空格翻面、/ 跳搜索，
        输入聚焦时让路）；manifest.json + SVG 图标（file:// 下自动忽略，
        http(s) 部署后可安装；Service Worker 因 file:// 不可用而刻意不做；
        深色模式因 CSS 硬编码色值暂缓，建议另立项目）；
        护栏：.work/f9_probe.html 14/14 PASS
✅ G1  无释义词组补录导入工具（2026-09-03：tools/import_no_meaning_phrases.py——
        --worksheet 生成 data/vocab/phrases-supplement.tsv 工作表（541 行，
        词组/级别/来源/建议释义（AI，未核实）/释义（人工填写）五列，刷新保留
        已填内容）；541 条 AI 建议释义已全部预填（.work/g1_suggest_data*.py），
        供人工逐条核对后抄入「释义」列；--import 全量校验（与 detail 重复/
        表内词形重复/噪音句清洗后为空/含制表符换行，任何一处不过即中止
        零写入），通过后并入 phrases-detail.json（msrc 如实标「人工补录」）
        → 重生成 gaokao-phrases.js（修正 clean_phrases.py 写旧名 phrases.js
        的遗留）→ 同步 index.js total → 底稿移除已导入行并更新计数 → 刷新
        工作表；--stats 只读统计、--dry-run 空跑。护栏：沙箱自测 3/3（dry-run
        零写入 / 问题行拦截 / 五文件联动含排序·噪音清洗·溯源字段），真实数据
        零改动（4487 条不变）。下一步是人工核对释义列后正式导入。
✅ G2  分数折算面板（2026-09-03：#/dashboard 新增「分数折算」panel——
        各题型「累计答对÷累计作答」× 该卷制卷面满分求和；波动区间 =
        每节最近 3 次最低/最高单次正确率分别折算求和（单次时区间坍缩
        不显示）；卷制按最近一次整卷记录的 format 取（legacy 客观 115
        分口径 / new），分值表来自 data/exams/*.json 全 16 卷核对（同
        format 各节分值一致）；主观题无自动正确率不折算，面板如实标注
        未计入；文案全程「折算」不出现「预测」。顺手修两个 records 键
        相关 bug：① record 体内没有 examId 字段（exam.submit 落账不带），
        仪表盘「最近学习」行的 #/result/<id> 链接一直是空的——改从
        entries 键取卷号；② dashScoreBand 原读 r.examId 恒 undefined，
        卷制永远落 legacy 兜底——同法修正。护栏：scoreprobe 5/5（手算
        期望值：legacy 45 分区间 42–48、分行 21/30 与 24/30、新高考
        切换 50 分、26.3/37.5）；53 路由快照仅 #/dashboard 1 处预期
        diff，基线重设（留档 snap-rev-pre-g2.json）。
✅ G3  打印/PDF 导出（2026-09-03：css/print.css 全 @media print 规则——
        隐藏 site-nav/topbar/按钮/排期标签/交互提示/summary，@page A4
        margin 15/13mm，纸白墨黑，.mistake-item 整条防跨页断裂；三页加
        「打印」按钮（data-action=print-page，错题本/复习队列仅在有条目
        时出现）→ App.runPrint()：details 先全部展开（CSS 无法强制展开
        closed details）→ 生词本经 UI._wordLookupAll 并发查释义注入
        .print-meaning（屏幕 display:none，打印显示；查不到留白当自测）
        → window.print() 阻塞返回后还原折叠状态并撤掉注入，DOM 与打印
        前一致；Ctrl+P 直接打印同样兜底（details 维持折叠，答案对比行在
        折叠外不受影响）。护栏：node --check 3 文件全绿；53 路由快照恰
        3 处预期 diff（三页打印按钮），基线 snap-rev.json 重设（留档
        snap-rev-pre-print.json）；探针 printprobe 7/7（样式挂载/@media
        规则/按钮渲染/释义注入/屏幕隐藏/幂等/details 展开还原）；无头
        --print-to-pdf 三路由 PDF 文本断言：按钮与导航零上纸，词+释义、
        题干+答案对比、解析正文均上纸）
```

## 九、下一步执行顺序

> **人工待办已单独成文：`人工待办清单.md`**（知识库审校 / 词典许可 C1 /
> 听力音频 / 题库遗留 / 发布前放行，全部可勾选、可分批做）。机器侧只做下面这些。

```text
1. ✅ P0：完成短文改错人工确认与发布状态统一（2026-08-21 收尾）
2. ✅ P0：做全站路由、空状态、移动端回归测试（2026-08-21 收尾）
3. ✅ P1：知识点真实例句与跨试卷即时重练（2026-08-21 完成）
4. ✅ P1：专题继续学习与最近复盘记录（继续入口已完成，复盘次数/时间统计已完成，2026-08-21）
5. ✅ P2：所有专题中断恢复与提交前未答提醒（已完成）
6. ✅ P2：学习总览趋势和继续学习入口（继续入口已完成，趋势图已完成，2026-08-21）
7. P3：扩大题库与建立长期导入流水线（待做）
8. ◐ P3：建立知识点知识库（19 个核心知识点已建，自动抓取 + 待人工审核，2026-08-21）
9. ✅ P2：错题跨设备导出/导入（#15，2026-08-22 完成：#/data 路由、导出下载、导入合并、排期保护护栏）
10. ✅ P2：主观题判分自评表（#14，2026-08-22 完成：写作四维度自评+词数+备注自动恢复、短文改错逐项自评+汇总+重开横幅）
11. ✅ 分题型得分数据（能力概览按题型聚合历史正确率，2026-08-23 完成：store.addSectionHistory/getSectionHistory、exam.submit 写入、dashboard 六行分题型、sectioncheck 护栏 11/11、37 路由快照仅 #/dashboard diff）
12. ✅ 代码层面优化（2026-08-23 晚：store 缓存+try/catch+saveDraft 防抖、exam.submit 保护、knowledge-graph 兜底、training/topic fetch 并行、UI.countAnswered/eqAnswer/referenceHeader/classifyKey 去重；37 路由快照 IDENTICAL、sectioncheck 11/11）
13. ✅ 阶段 5 数据层收尾（2026-08-30：勾销 A1/A2/A3/A12/D2——退役知识文件删除（备份保留）、数据铁律写入 MEMORY.md、tools/gen_data_js.py 与 tools/build_knowledge.py 内置一致性检查、首页路径条扩为四步、overview.md 矛盾章节合并与来源声明更正；知识数据按分类重排并修复 2 处 related 悬空引用。另修复一处数据流隐患：8/25 的短文改错规范格式 modelAnswer 只改在生成 .js、未回写 JSON 源，重跑生成器即被冲掉——已将 7 套甲/乙卷规范格式回写 JSON（`.work/port_proof_format.py`），JSON 重新成为唯一事实源。护栏：node --check 全绿、39 路由快照仅 #/（路径条）有意变化、exam_check 16/16 通过、基线 snap-rev.json 已重设。下一项：B1 题型子技能定义与映射表）
14. ✅ 题型子技能 B1+B2（2026-08-30：12 个子技能定义与节点→家族映射落在 js/subskill.js；交卷逐题归类落账 subskillHistory 并接入导入合并；#/training 子技能进度板与 #/knowledge/<子技能> 方法卡版式上线。B3 词义辨析题池接入为下一项。顺带修复快照护栏的时序脆弱点：domdump 种子注入后补发 hashchange，消除对 profile 残留状态的依赖）
15. ✅ 星空升级 + 词缀多逻辑连接 + 查词模块（2026-08-30：#/synonyms 星座改真星空（星形星点/闪烁/链线/夜空底）；新增词缀派生第四种连接（词缀表 affixes.js × highschool 词书词形计算 1256 对，词缀本身可做中心展开家族）；C4/C6 查词上线——#/word 词条页（8 本词书+关系卡）与错题详情/知识详情/解析页点击查词（caretRangeFromPoint 取词，排版零改动）。护栏：探针 word 19/19 + syn 26/26 + subskill 25/25，基线重设为 43 路由（备份 snap-rev-pre-word.json）。剩余：B3、C2/C3/C5、D1、A5/A6 扩容）
16. ◐ 知识节点练测闭环 A5–A10（2026-08-31 至 09-01：50 节点题池 400+1 题、#/knowledge/<节点> 练测+五级判级+1/3/7 间隔复练、#/learn 台阶徽标、A7 录题工具；护栏 kbq 21/21、ins 16/16、drill 16/16、hm 11/11、f9 14/14。剩余：题池人工复核（人工待办清单）、A11 单元 mini 诊断、G1–G3 见 §8.8）
```
17. ✅ 星图集 v3：单词星图对齐知识星图形态（2026-09-01：#/synonyms 改门厅六栏
        （每栏 = 一张关系图，带当前中心词的真实星数与跳链）+ 单图页
        #/synonyms/<map> 三维球面星空——斐波那契布点 + 深度投影，中心词
        faceRot 固定转正面，点星唤醒换中心、词缀门户星进家族、二阶关联半亮
        + 细虚线（参考 ai-knowledge-graph degrees=2，仅词义图），拖拽旋转
        （指针委托 + 拖后点击抑制）与自转开关与知识星图同套交互；门厅探索框/
        词条页 word-syn/词缀芯片提交后由 synCenter 自动跳到对应单图页（惰索引
        就绪后重定向，flash_probe 词组流不变）。v1 语义全保留：中心词跨图保持、
        词缀中心词义页签灰置、详情卡随图裁剪、空图一键跳转、查词条互通。
        护栏：syn_probe 重写 68/68、flash 22/22、word 42/42、kg 29/29 回归全绿；
        52 路由快照重设基线（共同 51 路由仅 #/synonyms 预期 diff），两次 dump
        逐字节一致；截图 syn-gate.png / syn-sky.png 目检通过。顺带修
        _synCenterGo 里 st 未定义的重定向崩溃。）
18. ✅ 星图集第七图：形近（sim）——全词书并集词形索引（2026-09-02 凌晨：
        应「在星图里加入形近词（universe/universal/university、converse/
        conserve），把整个星图全联系起来」：新增 sim 关系图（粉 #f0a3c2），
        数据纯词形计算不编造关系——运行时对 8 本词书并集（7127 词）两两
        比对，「编辑距离 ≤2（<5 字母只认 ≤1）」或「共享 ≥6 字母词形核」
        才建对，邻居按（距离→字典序）截前 10（8 名额会把 quite/quiet 挤掉），
        ~2500 万对分片异步构建（700 词/片，setTimeout 让出主线程，构建完才
        赋 _formIdx 并兑现 _formReady）。接入：门厅七栏/单图页签（词缀中心
        灰置扩展到 sim）/球面环星与连线/详情卡形近块/词条页形近芯片。
        synCenter 收录校验放行 _formIdx 里的词（converge/refugee 这类只在
        词书、无词条的易混词才能点亮）。词库未收的 converse 不造假入图
        （探针断言）。护栏：syn_probe **80/80**（+conserve→converge/observe、
        converse 缺席、quite/quiet 对称断言），flash 22/22、word 42/42、
        kg 29/29、drill 16/16、phr 13/13（v2 旧选择器修到 v3 口径）回归全绿；
        53 路由快照（+#/synonyms/sim，syn 路由 sleep 6000）两次 dump 逐字节
        一致，共同 52 路由 4 处 diff 全预期（门厅七栏/syn 页签/word/happy
        形近块/dashboard 热力图日期滚动），基线 snap-f-post.json 重设
        （snap-rev.json 同步）；截图 syn-gate.png（七栏）/ syn-sim.png
        （quiet 中心 10 一阶 +10 二阶粉星）目检通过。遗留：formbench
        实测构建 1.27s；converse 若日后收进词书会自动入图。）

19. ✅ 全站主导航（siteNav）与栏目重构（2026-09-02：五域 学/练/错/词/工具，details/summary 原生
    下拉零 JS，按 hash 前缀正则高亮，knowledge(?!-graph) 消歧；header()/referenceHeader()/星图
    render() 末尾常驻，答题页 examBar 与 #/synonyms 星空豁免。首页删 11 项平铺 home-tools 与
    exam-category 导航条（同页 6 个重复入口），「N 套真题」计数迁入历年真题栏目标题；知识域重命名
    知识系谱→错题溯源、知识星图→知识点星图、分台阶学习→知识台阶（15 处落点，路由/函数名不动）；
    查词页并「用全站搜索 →」，生词本页补「词组闪卡」平级链接（修复 4487 条数据无报头入口）；
    components.css 新增 .site-nav（P-38 合规整块底色+inset 底 2px），删 .home-tools/.exam-category/
    .category-* 死规则与 style.css 18 个零引用死令牌（night/rel-ink/dur/shadow/r-xs/sp-0，残留 0）。
    护栏：8 个改动 JS node --check 全绿；53 路由 dump 全渲染无空页，抽查导航高亮与重命名落点全对；
    截图 before/after 18 页逐页 md5 全 CHANGED（profile 清空防伪一致）；audit 间距/字号 0；
    基线 snap-rev.json 重设 53 路由（留档 snap-rev-pre-sitenav.json）；.work 清理 200M→20M；
    技能沉淀 css-refactor-guardrail。）
19. ✅ UX 体验审查修订：15 项缺陷全部修复（2026-09-03：审查报告
        `用户体验审查报告.md` 按 P0–P3 列 15 项，当日按五批修完——
        ①计时三件事：开考时刻落 Store.saveExamClock 挂钟续算（刷新/隔天
        接着走）、5 分钟/1 分钟两档 toast 预警（WARN_AT+_warned 去重）、
        tick 里 toggle urgent 红色（且只认练习页 [data-exam-timer]，
        防跨页劫持解析页计时器）；②存储失败可见化：_save() 置
        writeFailed，App.afterRender() 每轮渲染补挂红色警示条（可跳导出），
        成绩页红字说明；③热键收紧：hotkey() 补排除
        a/button/summary/[role=button]/[tabindex]，空格不再劫持按钮；
        ④防护与反馈：清空错题 10 秒撤销条（undoBar+restoreMistakes）、
        addWord 放宽正则收词组+失败 toast、查词页补「查询」按钮、
        考试中 beforeunload 挽留；⑤文案与信息：首页草稿横幅+试卷行
        三态（继续作答·已答 N 题/上次 X 分·重做/开始练习）、导入拆
        预览→确认两步（_pendingImport+import-confirm/cancel）、错误页
        中文兜底+技术细节折叠、无记录成绩页 UI.noRecord 说明页、
        主观题独立「参考范文」块、试卷行省份超 3 个折叠（UI.regionText）。
        新组件样式集中在 css/components.css 末尾「UX 修订组件」段
        （全令牌化，P-38 合规）。护栏：.work/uxfix.html 修复断言 15/15
        PASS；.work/uxregress.html 既有交互回归 9/9 PASS（考试 e2e/
        kb-mastery/learn 筛选/错题状态/错因编辑器/syn-explore/word-search/
        phr-known/export）；53 路由快照比对 8 处 diff 逐条核对均为预期
        改动，基线 snap-rev.json 重设（留档 snap-rev-pre-uxfix.json）。）
20. ✅ G3 打印/PDF 导出（2026-09-03：错题本/复习队列/生词本三页「打印」
        按钮 → App.runPrint()——details 先全部展开（CSS 无法强制展开
        closed details）→ 生词本 injectWordMeanings 并发查释义注入
        .print-meaning（屏幕隐藏、纸上显示，查不到留白当自测）→
        window.print() 返回后还原折叠并撤注入，DOM 与打印前一致；
        Ctrl+P 直接打印同走 css/print.css 兜底。纸面原则：导航/按钮/
        排期标签/交互提示/summary 全隐，@page A4，纸白墨黑，
        .mistake-item 整条防跨页断裂。护栏：53 路由快照恰 3 处预期
        diff，基线重设（留档 snap-rev-pre-print.json）；printprobe
        7/7；无头 --print-to-pdf 三路由 PDF 文本断言（.work/
        printpreview.html 壳：错题本/复习队列/生词本）按钮与导航
        零上纸、词+释义与题干+答案均上纸。）
21. ✅ G2 分数折算面板（2026-09-03：#/dashboard「分数折算」——各题型
        历史正确率 × 卷面满分求和，近 3 次最低/最高正确率折出波动区间，
        卷制随最近整卷记录的 format 切换（legacy/new 两套分值口径，来自
        data/exams 全 16 卷核对），主观题如实标注未计入，文案只「折算」
        不「预测」。顺手修 records 键两 bug：record 体内无 examId 字段，
        最近学习行 #/result 链接一直为空（改从 entries 键取）；折算卷制
        原读 r.examId 恒 undefined 落 legacy 兜底。护栏：scoreprobe 5/5
        手算断言；53 路由快照仅 #/dashboard 1 处预期 diff，基线重设
        （留档 snap-rev-pre-g2.json）。）
22. ✅ A11 单元 mini 诊断（2026-09-03：#/learn 每单元一条诊断——练测
        判级五段分布条 + 可行动建议（薄弱节点带 #/knowledge 回炉链）。
        自评仅在「没练过但自评模糊」时参与薄弱判定，两信号不混算；
        难度筛选下诊断仍按全单元聚合。护栏：unitdiag-probe 6/6；
        53 路由快照仅 #/learn 1 处预期 diff，基线重设（留档
        snap-rev-pre-a11.json）。至此 §8.3 知识练测闭环 A1–A12 全部勾销。）
23. ✅ G1 无释义词组补录导入工具（2026-09-03：tools/import_no_meaning_phrases.py
        + 工作表 data/vocab/phrases-supplement.tsv（541 行，AI 建议释义全部预填，
        人工核对后填「释义」列再 --import）。全量校验不过即中止零写入；通过后
        五处联动：detail（msrc 标「人工补录」）→ gaokao-phrases.js（修正
        clean_phrases.py 写旧名 phrases.js 的遗留）→ index.js total → 底稿移除
        已导入行 → 工作表刷新。护栏：沙箱自测 3/3；真实数据零改动。详见 §8.8 G1。）
24. ✅ C2 词库统计口径固化（2026-09-03：tools/dict_survey.py，四段报告：词书
        （index.js 声明 vs 实际条数/去重/无释义/例句音标覆盖）、通用词典
        （分片计数/多词条目/词书覆盖率 98.7%）、词组（底稿剩余 541 待补录/陈旧行
        检测）、关系表（synonyms 274/词缀 54）+ 一致性检查（--strict 退出码 1）。
        口径入 docstring：词形键 lower+strip+rstrip('.')、释义「无」算无释义、
        重复分「跨来源同义重复（无害）」vs「释义冲突（需人工裁决）」——当前挖出
        词组书 4 个异表述冲突（no sooner...than 等四组，初判为同义兼容表述）
        与 michael「no」1 个。node -e 取值绕开 JSON.parse 转义坑；SOURCES.md
        复现方式已同步指向本工具。词书数据零改动，站点文件未动无快照需求。）
25. ✅ E1–E3 学业分析 MVP（2026-09-03：grill 两轮定稿见 交流纪要/2026-08-31.md
        附录 B。E1 js/diagnostic.js 组卷器——16 套真题配额抽 24 题客观题
        （阅读 8/七选五 3/完形 8/语法 5，无听力；阅读同卷≤3 按 passageLabel
        带原文，其余整篇同卷连续题），同 seed 确定性可重放，复用 Exam.score
        链路标 isDiagnostic（sectionHistory/subskillHistory 不写——诊断是测量
        不是训练），复测 ≥7 天锁；E2 js/ui/analysis.js #/analysis 画像五维度
        + 诊断状态区（复测灰置）；E3 规则引擎纯函数实时出每日任务 3~5 项
        （R1 到期复习/R2 生疏子技能封顶 2/R3 薄弱节点/R4 题型空白/R5 整卷兜底，
        一句话依据 + details 证据 + 深链），完成回写 taskLog（syncMergeTaskLog
        按日并集），dashboard 横幅入口 + 诊断记录最近学习链适配。
        探针 .work/analysis_check.html 30/30；快照 55 路由基线重设
        （snap-rev-pre-analysis.json）。）
26. ✅ 页面逻辑优化 C1–C4（2026-09-05：参考站 zhenti.burningvocabulary.cn
        设计信息拆解 + 学生视角差距分析见 交流纪要/2026-09-05.md 附录 C。
        C1 主题三态——css/themes.css 只覆盖变量层（html.theme-day 白昼 /
        html.theme-night 夜间，AA 对比度按行内注释校准），index.html 头部内联
        脚本首帧预置防闪底色，base.js themeToggle/themeLabel 挂顶栏与首页
        reference-header，app.js 'theme-cycle' 循环并落 localStorage.gkyy_theme；
        星图门厅「纸面变体」关系色夜间自动换亮变体。C2 整卷卷面模式——
        exam-page.js exam() 拆出 examSection()：多篇阅读按 passageLabel
        「原文→该篇题目」真卷分组流（.passage-flow/.passage-group，对不上号
        的题收尾兜底不丢题），单原文节与无原文节维持原结构，卷头 .exam-head
        居中衬线 + 报头双线（不杜撰卷名文案），原文两端对齐。C4 交卷承接——
        整卷结果页 result-actions 补「看看学业分析 →」（错题溯源页已有节点
        聚合跳练，无需重做）。C3 真题考频——tools/build_examfreq.py 离线统计
        16 套卷面（原文>题干>选项，选项须 ≥4 词）7,500 词目，常规屈折归并
        （所有格归并/复数-ed-ing-er-est-ly/去e/CVC双写/y→i；不规则漏计入
        meta.rule），3,141 词命中、产出 data/examfreq.js 973KB，词条页
        word.js _freqReady() 按需注入（同 dict 分片懒加载模式，不进首屏），
        主词条卡后渲染「真题考频」区（N 套 M 次 + ≤2 条真题原句深链到
        #/review/<id>）；C5 听力对照视图待人工音频，未做。护栏：
        .work/c1c2c3_check.html 24/24，analysis_check 30/30 回归，
        print/score/unitdiag 探针全过，55 路由快照重设基线
        （snap-rev-pre-c1c2c3.json；50 路由差异=顶栏主题按钮 + 考试/词条/
        结果页结构变化，剥按钮后仅 6 路由有预期结构 diff、题目数零丢失）。）
27. ✅ 提升空间第二轮 D1–D4（2026-09-05：提案见 交流纪要/2026-09-05.md
        附录 D，全部吃现有数据。D1 首页今日方案——diagnostic.js 收拢
        inputFromStore/dayKey 共享构建器（rules 保持纯函数，首页与
        #/analysis 同口径同 taskDone 集合），dashboard 有整卷记录时把
        每日任务前 3 项渲染成「今天的方案」区（taskCardHtml 从 analysis.js
        抽出共用），无记录保持诊断横幅；analysis-task-done 改 app.route()
        就地重渲染，两页勾选都不跳页。D2 生词本考频——words() 异步化
        （await _freqReady），到期/排期队列按真题出现次数降序（平手按到期
        先后），行内第 4 列「真题 N 卷」徽标（空数据零宽占位）。D3 词组
        闪卡同款徽标（FREQ.phrases 键=token 序列，对不上静默降级）。
        D4 生成器补精度——build_examfreq.py：不规则变化表约 120 条
        （was/went/made/took/found/children…，better/worse 两可形式不收）、
        复数 f/fe→ves、词组 2–5 token 连续 n-gram 匹配（省略号/括号模式
        条目跳过）落 __EXAM_FREQ__.phrases；重生成 3,145 词目 + 565 词组
        1.13MB（go 152/16 卷含 went，according to 14 卷）。
        护栏：.work/d1_check.html 17/17，analysis_check 30/30 +
        c1c2c3 24/24 + print/score/unitdiag 回归全绿；55 路由快照仅
        #/dashboard 1 处预期 diff（横幅→今日方案），基线重设
        （snap-rev-pre-d1.json）。）
28. ✅ 提升空间第三轮 E1–E3（2026-09-05：提案见 交流纪要/2026-09-05.md
        附录 E。E1 错题重做卷——js/redo.js Redo.build 从整卷记录抽客观
        错题（reading/seven/cloze/grammar 四类，未作答按失分点一并重做），
        多篇阅读只保留被引用原文，id 固定 redo-<原卷号>不进题库；
        #/redo/<id> 组卷开考，openPaper 的 redo 分流先于 Exam.load
        （放后面会题库加载失败）；交卷带 isRedo/redoOf，跳过能力历史、
        不重收错题（addMistakes 无去重）；入口=结果页「错题重做 →」
        全对消失；dashboard 最近学习行适配 redo 前缀。E2 本卷考点词
        预读——生成器加每卷 top15 精简榜（本卷≥2 次/词长≥3/全语料卷次
        2–14 过滤基础词）产 data/examwords.js 3.3KB 急加载，做题页卷头
        「考前 2 分钟」折叠块芯片直达词条页。E3 做题页字号三档——
        examBar A－/A＋（解析模式同用），html.fs-lg/xl 首帧预置 +
        localStorage.gkyy_fs，边界置灰，只放大 .exam-content 文字。
        护栏：.work/e1e2_check.html 25/25，analysis 30/30 + c1c2c3
        24/24 + d1 17/17 + print/score/unitdiag 回归全绿；55 路由快照
        5 处预期 diff（3 exam+review 加字号钮与考点词块、result 加重做
        入口），基线重设（snap-rev-pre-e.json）。）
29. ✅ 提升空间第四轮 F1–F2（2026-09-05：提案见 交流纪要/2026-09-05.md
        附录 F。F1 学习周报——dashboard 热力图后新增「本周回顾」卡：
        本周（周一起）交卷/完成任务/新收生词词组/新错题计数 + 子技能
        判级变化芯片（上周一前的最近 10 题窗口 vs 当前窗口，同一把尺子
        Subskill.tierOf 喂过滤历史；进步 up 绿/退步 down amber，封顶 4+
        溢出计数）；空库给实话空态。时间颗粒度分工：热力图=哪天学了、
        今日方案=今天干嘛、本周回顾=这周变了什么。F2 解析缺口报告——
        新工具 tools/audit_explanations.py（口径与 exam-page 渲染一致：
        客观题 explanation/短文改错 points/写作 modelAnswer，--json +
        退出码可进护栏），首轮结论 987 题缺 140（85.8%）且全部是听力
        （7 套卷×20），其余题型 100% 齐全；结论与补录指引已写入
        人工待办清单.md 六-4。护栏：.work/f_check.html 8/8，analysis
        30/30 + e1e2 25/25 + d1 17/17 + c1c2c3 24/24 回归全绿；55 路由
        快照仅 #/dashboard 1 处预期 diff，基线重设（snap-rev-pre-f.json）。）
30. ✅ 提升空间第五轮 G1–G3（2026-09-05：提案见 交流纪要/2026-09-05.md
        附录 G。G1 星图考频星等——synonyms.js _freqScale 把词形真题卷次
        映射为星体 1.0–1.55 倍缩放 + 透明度加成，全部星种统一生效，
        _freqReady 懒加载就绪后整图重绘一次（同词缀/词组/形近回填模式），
        提示语加「星越大越亮＝真题出现越多」。G2 周报独立成页——
        _weeklyStats 收拢口径并补窗口上界（原只有下界，算上一周时把本周
        记录算进去、对比恒为持平）；首页卡片瘦身（前 3 条判级变化 +
        完整周报入口），#/weekly 整页：四块数字带与上周对比、判级变化
        全量行链到题型专项、分题型本周 vs 累计；主导航「学」域加
        学习周报；domdump 增至 56 路由。G3 题库扩容流水线——盘点发现
        tools/pipeline 六段流水线已存在（raw_text/parsed 各 20 份），
        断点在解析质量：①选项切分重写为字母状态机（旧行锚定正则把
        「A. xxx B. xxx」整行吞进 A，option_letter_mismatch 68→0）；
        ②新增 _parse_jiexi_batches 批式答案/解析捕获（【答案】1. B 批式
        行 +【N题详解】块按题号回填，范围扩 A–G）；③回填守卫客观节
        （写作/短文改错节内 qid 撞全局题号，writing_has_answer 21→0）；
        audit.py 支持 AUDIT_DIR 审计 parsed/ 中间产物；候选池审计
        134→51，剩余全是源文档层缺口（question_id_gap/answer_out_of_
        range/empty_stem），明细在 review_queue.md 等人工照单处理，
        审一条即可 publish 一套。护栏：.work/g_check.html 17/17，f 8/8 +
        e1e2 25/25 + analysis 30/30 + d1 17/17 + c1c2c3 24/24 回归全绿；
        56 路由快照 = 导航 1 项 + 3 处预期结构 diff（卡片入口链接、
        两张星图提示语），基线重设（snap-rev-pre-g2.json）。）
25. ✅ M1 做题方法规范·方案二（2026-09-07：源自 Stumax 深读报告。数据层
        data/methods/index.js → __METHODS__，5 客观题型 × 24 步，每步 =
        动作/禁止/卡住回退，全国卷题型重写、自著候选流程如实标注；
        #/methods 门厅 + 单卡 + 主导航「学」域入口；错题 errStage 标签
        （= step.id 共用词表）在列表编辑器与详情页两处可打点，错题本
        按阶段聚合（≥2 次才亮）直跳方法卡。护栏：methods-probe 9/9
        （含 chips 点击写入/取消、addMistakes 白名单持久化、聚合算术、
        详情页标签更新）；58 路由快照 diff 全归因：49=导航项、
        mistakes 两页=chips、dashboard=热力图日期漂移，基线重设
        （snap-rev-pre-m1.json）。方案三升级路径留档 方案三升级路线.md。
        踩坑：app.js click() 在 ACTIONS 分发处 if(!btn) return 提前拦截，
        无 data-action 的新控件分支必须放在该行之前（按钮不触发 change）。）
26. ✅ 上海专区（2026-09-07：用户拍板「主页单独列上海入口，真题和词汇另写
        界面」；真题=只搭框架+空态，词汇=导入官方词书。主页 #/ 新增
        「上海卷专区」入口区（sh-entry，四步路径卡之后）；#/shanghai 门厅
        + #/shanghai/exams 真题册（__SH_EXAMS__ 登记框架，papers 暂空 +
        收卷约定注释）+ #/shanghai/vocab 考纲词汇（__SH_VOCAB__，上海市
        教育考试院官网《英语词汇表》2019 版 PDF 解析 2075 条，verified=false
        未人核标灰；搜索+首字母筛选即打即搜，列表 120/600 封顶分页）。
        独立铁律：上海卷制式不同，禁复用 legacy/new 折算口径，不混入
        全国卷词书库；官方词表从 ability 起编（无 a/an、I 等）如实收录。
        护栏：shprobe 6/6；61 路由快照 diff 归因干净（#/ = sh-entry 区块
        一处，3 条新路由），基线重设（snap-rev-pre-sh.json）。解析管线
        .work/sh_vocab_parse.py（pypdf + 双栏交错修复 + 变体式词条），
        生成器 .work/sh_vocab_build.py。）
27. ✅ 高中生视角不足盘问落地·第一期 C+A 机器侧（2026-09-15，grill-me 拍板：
        先 C+A，B 写作/E 每日主线/F 手机端留下一轮）。
        C 上海词汇注册进主词库：sh-kaogang 重建为双全局（__VOCAB_CACHE__
        ['sh-kaogang'] 标准 {w,pos,m} 兼容字段 + __SH_VOCAB__ 丰富 defs，
        同数组单源），index.js 注册第 10 本书（verified:false）；查词命中
        上海考纲释义卡带「未人核」灰签；#/shanghai/vocab 行加「详情·收藏」
        链接接词条页（可收藏进生词本）。
        A-1 听力播放器：hasAudio&&audio 的卷（2021 甲/乙、新Ⅰ）听力节头部
        原生 <audio controls preload=none>；transcript 折叠 details
        （交卷复盘再看）。A-2 两级诚实标记：无 listening section 的 6 卷
        （2022 三套、2023 甲、2024 新Ⅱ、2025 新Ⅱ）卷行+做题页头部标
        「未收录听力部分」；有听力无音频标「暂无音频」且文字稿直接展开
        （此前两类卷都不渲染 transcript，无音频卷听力题没法做——隐性缺陷
        修复）。gen_data_js.py 派生 hasListening（卷子 sections 为真源）
        + hasAudio 音频存在性校验。护栏：listenprobe 6/6；61 路由快照
        8 处预期 diff + dashboard 热力图日历漂移，基线重设
        （snap-rev-pre-listen.json）。
28. ✅ 写作增强·第一期 B1+B3（2026-09-19，续 27 的 grill-me 排期「B 写作闭环
        留下一轮」；本轮定范围＝接通自评 + 范文聚合页，B2 写作方法卡留后）。
        先纠一次事实：早先判「写作无闭环」是错的——js/topic.js 早有完整写作
        模块（任务卡→草稿→复制点评材料给 DeepSeek→复盘记录→三维度自评+
        词数核对，独立 localStorage 键）。本轮补的是三处真实断点：
        B1 整卷页写作题是死胡同（只有 textarea + 交卷后一份范文，写着「建议
        对着范文自己批改」却没有批改的地方，草稿还锁在答题答案键里）→
        exam-page.js 复盘态给「去写作专题自评·复盘」入口，跳到
        #/writing/<examId>/<sectionKey>；topic.js 新增 openWritingTask +
        takeOverDraft，专题草稿为空时把整卷里写的那篇作文接管过来并立刻
        落盘（只提示不落盘＝学生切走又丢）；已交卷的从 record.answers 取，
        进行中的从 Store.getDraft 取，优先级给进行中。只在复盘态给入口：
        考试进行中跳走等于把整卷丢下。
        B3 范文聚合页 #/writing/models（js/ui/writing.js + css/writing.css）：
        16 卷 25 篇（应用文 16 / 读后续写 9，覆盖率 100%）按年份倒序聚成
        一页，题型页签筛选 + 题干与范文全文搜索（hidden 切换不重建 DOM，
        展开状态与滚动不丢）+ 展开全部 + 词数与题目词数要求 + 细分类型
        （复用 Topic.writingType，与写作专题同口径）+ 每篇「对照自评」深链
        与回原卷解析链接。短文改错刻意不收：它的答案是把错处改对，性质是
        「改对几处」的自评题，不是可仿写结构的范文。
        ⚠ 踩坑：answerSource 只在试卷对象（data/exams/*.js）上，索引
        data/index.js 没有这个字段——从 meta 读会 25 篇全部误报「未标注
        出处」（已修，实测 17 篇有来源 / 8 篇如实标未标注，涉及 5 套无出处
        的卷）。Ctrl+P 打印：折叠的 details 在纸上不参与渲染，CSS 救不回来，
        故注册 beforeprint/afterprint 展开再还原（只认 .wm-card，注册一次）。
        护栏：writingprobe 27/27（含筛选/搜索/展开/两种接管/不二次覆盖/
        两处入口/打印钩子）；63 路由快照，61 条基线仅 3 处预期 diff
        （#/topic/writing 与 #/review/gk2021-jia 各一处新入口 + #/dashboard
        热力图日历漂移 9/15→9/19），基线重设 snap-rev-pre-writing.json。
        待办：范文无出处的 5 套卷补 answerSource；B2 写作方法卡（须先定
        写作步骤词表，会牵动 errStage 归因）；写作自评数据仍未进任何统计页。

--------------------------------------------------------------------------------

## 2026-09-19 · 双专家审查修复批次（P0×2 + P1×6 + P2×3，听力内容另案挂起）

> 来源：教师×前端双专家审查（会话内完成，报告见对话与
> 《能力提升与可视化方案.md》）。原则：先修「失信与误导」，再修「体验」。

**P0-2 得分趋势混满分口径（误导）**：exam.js 交卷记录补 examId + totalScore
随账落盘；dashboard.js dashTrend 纵轴从裸分改为得分率——改前 120 分制甲乙卷
与 150 分制新高考卷画同一条线，90/120（75%）与 90/150（60%）等高。旧记录无
totalScore、制式不可判，跳过并在副标题注明「N 条早期记录未计入」；趋势标签
改百分比 + title 显示裸分/满分。能力可视化方案（趋势线+滑动平均+同制式口径）
以此为前置。

**P0-1 听力文字稿虚假承诺（失信）**：exam-page.js examListenNote 的
「已附听力文字稿」分支改前只看 hasAudio，不看 transcript 是否存在——
13 套「无音频且文字稿为空」的卷照样承诺。现按四态渲染：未收录 / 有音频（不出条）/
无音频有稿（对照作答）/ 无音频无稿（如实说这 30 分没法练）。听力内容
（音频+文字稿）的联网采集已另案完成侦察并挂起，见《听力资源清单.md》§五。

**P1 加载**：index.html 39 个外部脚本全部加 defer（并行下载、执行顺序不变，
加载链依赖的正是顺序保证；sh-kaogang.js 226KB 移出急载，进上海相关页才注入）。
js/ui/shanghai.js 新增 shVocabReady()（照 examfreq/dict 的动态 script 模式），
门厅与词汇页 await；加载失败如实降级（门厅不出假计数，词汇页给重试指引，
不再渲染空的 0 词列表）。踩坑自纠：门厅词数拼接一度会输出「2075 词 词」，
已修。

**P1 可访问性**：a11y.js 路由换页后焦点迁移到 main（只认「页面标题变了」＝
真换页，局部重渲染不抢焦点，首屏不抢）；exam-page.js 三类输入控件补
aria-label（填空/作文/短改逐处），选择题 radio 组 aria-labelledby 指回题号
h3；themes.css 夜间 --ink-3 由 #8f8b82 提亮到 #9b978e（旧值对 paper-2 卡面
仅 ~4.1:1 不达 AA）。

**P1 写放大**：store.js saveTopicDraft 对齐 saveDraft 的防抖纪律（内存态立即
更新、400ms 写盘），clearTopicDraft 取消挂起写；app.js route() 真换页前与
beforeunload 调 Store.flushDraft() 收口——改前专题页每敲一键整包 stringify
落盘，且防抖窗口内的最后一次作答可能丢（flushDraft 此前实现过但无人调用）。

**P2 三件**：exam.js 计时归零自动交卷只在用户仍在考场（#/exam/…）时跳成绩页，
人在别处浏览不再被拽走（记录照常落账）；design-system.css .sheet-dot 用
::after 外扩 6px 补 44px 热区（视觉保持 32px 方格，不破坏既有 ⚠ 注释的
排除逻辑）。

**验证**：7 个改动 JS node --check 全绿；audit_ui.py 通过（余项均为既有豁免）；
新增 .work/smoke-20260919.js 桩测试 13/13（听力四态文案、得分率趋势排序与
跳过口径、防抖/flush/clear 竞态）；index.html 实测 39 defer + 0 平脚本；
exam_check 数据卷基线不变。快照基线未重跑（本轮改动面不含版式重构，待下批
变更后与下一批一起重设）。

**待办移交**：defer 后首屏体验与 53 路由建议跑一次真浏览器快照确认；service
worker（PWA 离线）与 CSS 重复选择器收敛两案维持挂起；听力内容按清单 §五人工
下载后接回。

--------------------------------------------------------------------------------

## 2026-09-19 · 复审回合 + 调研内容吸收（续上条）

> 前端专家对上批 9 文件改动做专项复审（defer 链路 / async 路由兼容 / 焦点迁移
> 触发面 / 防抖竞态 / 趋势口径 / 自动交卷路径六维核验），三处最高风险点验证
> 无破绽；抓出 3 个 P2、2 个 P3，当轮全部修复。教师侧同步盘点调研报告的
> 站内吸收度。

**复审修复**：① shanghai.js 两个 async 路由补「页面已切走」守卫——await
226KB 注入期间跳路由会拿旧页覆盖新页，现 await 后校验 location.hash 再渲染
（照 word.js _fillWord 先例）；shVocabReady 失败后清 _shVocabLoading 允许重试，
修掉「重进永远立刻失败」的缓存死局。② dashboard.js dashTrend 排除诊断卷/
重做卷（!isDiagnostic && !isRedo）——它们是测量不是训练，混进趋势线与全站
能力历史口径矛盾；legacy 计数同步排除。③ exam.js 自动交卷 off-page 分支：
注释「回考试页也会见到结果」失实（openPaper 会重开新一场），改为即时
UI.toast 告知「时间已到已自动交卷」，成绩指向学习总览。④ 两处陈旧注释同步
（index.html 脚本数 40→39；dashboard.js records 键 examId 的 2026-09-19 变化）。

**调研吸收度盘点（教师侧，对照《能力提升与可视化方案.md》）**：写作三维度
自评**已存在**（topic.js collectWritingSelfCheck：要点覆盖/连贯/准确+词数+备注）；
错题销号闭环**已存在**（mistakes.js「重做本节点 8 题，全对才算过」+ review.js
五轮阶梯）——测试效应两大项原架构已吸收。方法卡五张逐卡比对调研共识：
读题预测/同义改写定位/干扰项四手法/七选五衔接证据/完形复现核对/二选一分歧点
**均在场，判定不灌水增补**（增改需动 errStage 共用词表，收益不抵风险）。
实际新增吸收：诊断页须知补「混着做是故意的」交错练习说明句（analysis.js）。
方案文档已逐条标注 ⚑ 吸收状态；真正未启动的只剩②解析「定位↔替换」数据标注
（下一批内容工程）与①听力复盘闭环（仍被听力内容挂起阻塞）。

**验证**：4 个再改 JS node --check 全绿；桩测试扩至 15/15（新增诊断/重做卷
排除、空趋势占位）。复审代理独立回归（defer/懒加载可达性/audit_ui）全通过。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第二轮：B2 写作方法卡 + 趋势图防线（双审通过）

> 循环机制启用：修订 → 教师+前端双审并沟通确认方向 → 按共识修订。听力内容
> 仍按用户指示排除在外。

**修订（教师内容为主）**：data/methods/index.js 新增两张写作方法卡——
writing_app 五步（WA-SCAN 审题定体 / WA-POINTS 列点扩句 / WA-LINK 连句成章 /
WA-POLISH 语言升档 / WA-CHECK 格式与核对）、writing_cont 五步（WC-READ 读文
抓线 / WC-PLOT 两段定纲 / WC-SCENE 动作情绪落地 / WC-ECHO 收尾呼应 /
WC-POLISH 语言升档与核对）。依据：官方三维度评分（内容融洽/语言/结构）+
调研报告（应用文四步法、续写语言升级、评分档意识）。写作不机器判分、错题本
不收写作题 → 两卡**不进 errStage 归因词表**，头注释与门厅 note 如实标注
「流程参照，无归因标签」；34 个 step id 全库唯一，既有客观题 id 零改动。

**修订（前端小项）**：dashboard.js dashTrend 加均值虚线参考线（多卷时锚住
平均水平，防止单次波动被读成趋势）+ 图注「不同卷难度不同：比变化看走势，
别比单次分数」。

**双审与沟通**：前端专家五项审查全过——门厅 auto-fill 网格 7 卡排 3/3/1 无
破相；单卡路由 [\w-]+ 匹配下划线；errStage 隔离不可达性成立（写作题无
answer 进不了错题本 + stageLabel/stageSummary 前缀落空双降级）；均线坐标
y=60-avg/100*50 正确且 dots 盖在均线上方；回归三件（node --check /
audit_ui / smoke 15/15）全绿。教师自审提出两个内容补丁（WA-LINK 提示
「题目给开头句就接着写」、WC-SCENE fallback 补「词块用回原文（语言协同）」），
经前端确认渲染无碍后落入数据；.trend-note CSS 一行按前端建议补入
platform.css（选择器零冲突已核）。

**验证**：4 文件 node --check 全绿；smoke 15/15；audit_ui 无新增违例。
循环下一轮候选（按优先级）：① 解析「定位↔替换」标注试点（2024 两卷）；
② 写作自评数据进统计页；③ service worker（PWA 离线）——均不含听力内容。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第三轮：写作自评接入统计页（双审通过）

> 断链修复：写作专题底部的自评（要点/连贯/语言三档 + 词数）一直在存，
> 但没有任何统计页显示——学生打了分就沉进 localStorage。

**修订**：store.js 新增 Store.getWritingSelfChecks()——遍历
gaokao_writing_draft_* 独立键只读聚合（正则截取：sectionKey 含下划线不能
按 _ 切分；坏 JSON 单条跳过；localStorage 异常返回 []；确认零写入，唯一
写方仍是 topic.js）。dashboard.js 新增 dashWritingSelf 面板（dashTopicReview
之后）：只统计「自评过」的篇目，最近 3 条复用 topic-review-item 行样式
（卷名·类型 / 日期 / 维度中文 / 词数 / 回看→写作专题深链），按题型给词数
均值，加了**维度累计分布**（如「语言 基本1」——单条看当下，累计才回答
「哪一维反复待加强」，这是自评进统计页的核心教学价值）；写了没自评的以
「N 篇已写作未自评」提醒，不冒充数据；空态诚实。

**双审与沟通**：前端专家四项审查通过——16 个 examId × 2 sectionKey 程序化
验证正则零误切；#/writing/<examId>/<sectionKey> 路由命中且有诚实空态；
零反向写确认；audit_ui 对 .dash-note 无违例。抓出 2 个非阻塞项当轮修复：
① draft 非字符串时 .trim 抛错会塌整个聚合（外层 catch 返回空）→ 改
typeof 判断，脏数据只损失单条；② .topic-review-item small 无样式 → 补
ink-2/fs-xs。教师侧维度分布行经前端确认可放行并采纳 nowrap 分段优化
（折行只落在「 · 」边界）。

**验证**：store/dashboard node --check 全绿；smoke 扩至 26/26（新增聚合
倒序、带下划线键解析、自评标记、均值、未自评提醒、维度分布、脏 draft
容错、空态 8 类用例）；audit_ui 无新增违例。

**循环下一轮候选**：① 解析「定位↔替换」标注试点（2024 两卷，数据工程）；
② service worker（PWA 离线，http 部署后生效）；③ 子技能「最弱三项+建议
动作」文字结论（子技能数据已有，纯展示层）——均不含听力内容。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第四/五轮：PWA 离线 + 解析定位改写试点（合并双审通过）

> 不间断循环：第四轮（SW）与第五轮（定位标注试点）连续修订后合并送审。
> 候选③「子技能最弱三项面板」经复核判定**不建**：规则引擎 R2 已按正确率
> 升序取生疏子技能、带证据与深链渲染成任务卡（仪表盘「今日方案」直出），
> 任务卡比雷达图更可行动——方案文档已标注该形态判定。

**第四轮 PWA 离线**：新增 sw.js（gkyy-v1）——install 预缓存 shell 三文件 +
skipWaiting；activate 清旧代 + clients.claim；fetch 只拦同源 GET，导航网络
优先离线回退 index.html，其余同源资源 stale-while-revalidate。js/app.js
注册带协议守卫（file:// 双击主形态零行为变化，注册失败静默）。大文件
（词典分片、examfreq、上海考纲词）不预缓存，首次在线用过即入缓存。

**第五轮定位改写试点**：新增 data/loc/index.js——2024 新课标Ⅰ卷阅读 21-25
题的「from 原文表述 / to 选项改写 / rule 替换手法」（惯用语代直陈、具体列举
合成概括、行为证据推性格标签等）。有意与 verified 试卷 JSON 分文件：条目
verified:false，未人核内容不混入题库生成链（gen_data_js 不触碰该目录）；
人核一条并入一条试卷 JSON 并删条目，UI 灰签随之消失。js/ui/base.js 新增
locHtml(examId, qid)，挂整卷复盘（exam-page.js）与错题详情（mistakes.js）
两个主战场；css/app.css 加 .explanation-loc 虚线框与 .loc-unverified 灰签。

**双审**：前端专家五项审查——SW 抓出真问题：audio 元素 seek 触发 Range
请求，支持 Range 的托管回 206 分片，res.ok 会把 206 put 进缓存，后续命中
错位分片损坏播放。已按其修法落地：fetch 顶部 Range 请求放行、put 条件
收紧为 status===200 且 type==='basic'、后台刷新挂 e.waitUntil。locHtml 的
转义面（全 esc）、白名单字段（examId 与 qid 在 addMistakes 白名单）、时序
（defer 顺序）、生成链隔离四项全过；教师侧 5 条标注逐条对过既有 verified
解析的 evidence 与 answer 字段。

**验证**：6 文件 node --check 全绿；smoke 31/31（新增试点三件套渲染、灰签
在场与翻转消失、查无条目空串）；audit_ui 无新增违例（全部走 token）。

**循环下一轮候选**：① 定位标注扩卷（2023 与 2025 Ⅰ卷阅读，同口径）；
② 错题详情页「方法卡步骤」跳转直达率核查；③ 交流纪要补 2026-09-19 记录。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第六/七轮：标注扩卷 + 方法卡到步直达（双审通过，纪要成文）

**第六轮 定位标注扩卷**：data/loc/index.js 从 1 卷 5 条扩到 **3 卷 15 条**
（gk2024-xgk1 / gk2025-new1 / gk2023-xgk1 各阅读 21-25），覆盖替换手法：
图表总项/子项辨析、惯用语代直陈、同义替换、列举合成概括、价格表计算、
出发地与途经地分离、行为归纳性格、目的从结果反推。全部 verified:false，
头注释同步为「三卷各 21-25」。

**第七轮 方法卡「到步直达」**：核查结论——归因 chips 是写入按钮（正确），
但「看这套方法」与高频步骤聚合行**只到卡不到步**，方法卡头注释承诺的
「高频失败步骤直跳对应步骤」只兑现一半。落地：method-step 加 data-step-id；
stageChips（已归因时）与 stageSummary（每行）链接带 data-locstep；app.js
click 在 errstage 分支前接管：记 App._pendingStep 后照常走路由，hash 相同
（卡页内换步）则 preventDefault 就地滚动；methodCard 渲染后消费 pending，
UI.scrollToStep 滚动定位 + .method-step-hit 高亮 1.6s（reduced-motion 降级
与全站先例同构）。

**双审**：前端专家五项通过——三卷 15 条的键位/答案/原文引句逐条抽验与
试卷 JSON、passage 原文吻合；pending 状态机写入→消费闭环正确，抓出
renderError 不清 pending 的残留隐患（已补一行清理）与 data/loc 头注释
过时（已同步）；data-locstep 与 data-errstage 分属兄弟元素互不可达；
scrollIntoView 与全局 scroll-behavior 及 reduced-motion 双保险不打架；
回归全绿。1.6s 内重复触发的 timer 微瑕按复审意见记为可选打磨不动。

**验证**：改动文件 node --check 全绿；smoke 37/37（新增扩卷两卷可查、
归因区/聚合行 data-locstep、未归因不带、空 id 安全）；audit_ui 无新增违例。

**纪要**：交流纪要/2026-09-19.md 成文（用户指示、七轮产出、三项决定、
遗留清单），沿用「用户原话要点 + 产出 + 决定」惯例格式。

**循环下一轮候选**：① 定位标注铺满三卷阅读后半（26-35 题）与七选五；
② 错题详情与 #/training 联动核查（同到步思路）；③ 写作自评进学业分析页
（目前只在仪表盘）。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第八/九/十轮：分析页写作维度 + 联动核查 + 标注铺开（双审通过）

**第八轮 写作自评进学业分析页**：聚合口径收拢——js/ui/base.js 新增
UI.writingSelfFacts(list)（list 可传预取结果，测试与多面板复用同一次读取），
dashboard.dashWritingSelf 重构为纯消费事实层（输出逐字不变，smoke 兜底）；
analysis.js 画像加第六块 word-card「写作自评」：已自评篇数+均值+维度累计
分布+最近 3 篇 weak-node 深链，两分支空态诚实。踩坑自纠：重构首版
dashWritingSelf 忽略入参直接重读 Store，桩测试的空态断言当场抓住——
这正是「参数形同虚设」的设计味道，修正为 facts(list) 语义。

**第九轮 训练页联动核查（结论：健康无修改）**：错题详情两条链接
（#/training/<key>/example 空题回落 #/training；#/knowledge/<node> 经
familyOf 分派版式、未知节点有 NODE_RULES 兜底）对全部可产生错题的
sectionKey（cloze/grammar/listening/reading/seven）均可达；listening 落
example 页是无音频卷的正常文字版例题教学，不属联动缺陷。核查通过即产出，
不为改而改。

**第十轮 定位标注铺开**：data/loc/index.js 扩到三卷各阅读 21-30 共 30 条
（verified:false），新增手法覆盖：图表总项/子项、谚语匹配、让步转折定调、
价格表计算、概念具体化、构词语境猜义、引语立场概括等。头注释同步范围并
标注人核优先级（gk2025-new1#30 的 from 压缩幅度最大，复审标记优先核）。

**双审**：前端专家三批次通过——批次三全量跑 smoke 37/37 + esc 覆盖核对
（wordcount 建议包 esc，已照做）；批次四确认「健康无修改」成立并列出
listening example 页行为依据；批次五 30 条全量核验（超额于 6 条抽验）：
to 与 answer 30/30 一致，from 23 条逐字命中、7 条轻度压缩均可定位不误导，
人核优先项已标注。

**验证**：4 文件 node --check 全绿；smoke 37/37；audit_ui 无新增违例；
纪要（交流纪要/2026-09-19.md）已含本轮前内容，本轮补记于此。

**循环下一轮候选**：① 定位标注收尾三卷 31-35 题（+七选五 5 题/卷口径
另行确认）；② 纪要惯例核对（交流纪要 README 索引是否需要登记新文件）；
③ subskill 专项页与到步直达的联动（#/training/<key>/skill/<id> 页内方法
卡同样可吃 data-step-id）。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第十一/十二轮：标注收尾 + 纪要登记（双审通过，可收尾）

**第十一轮 定位标注收尾**：data/loc/index.js 新增三卷 31-35 共 15 条，
**三卷阅读 21-35 全部覆盖（45 条）**。新增手法：末段暗示（反读
shouldn't assume）、标题题找贯穿词（rush 首尾复现）、机制回译常识
（calcium carbonate = 水的硬度）、让步条件定位（even if 处是答案）、
态度题看转折后（Although 局限 → 转折后 Approving）、Even 让步强调等。
头注释更新为「全部覆盖」并保留人核优先级标注（gk2025-new1#30）。

**第十二轮 纪要登记 + 判定备案**：交流纪要/README.md「现有纪要」置顶登记
2026-09-19.md（纯加行，遵守「只增不改历史」约定，老条目零改动）；
README 摘要轮数口径经复审指出后由「七轮」校正为「十轮」。候选③
（subskill 专项页复用到步直达）判定**不做**并获前端架构确认：子技能 id
与方法卡 step.id 是两套词表、各答「弱在哪」与「怎么改」，硬造映射等于
捏造第三套口径；将来打通的正道是在数据层声明映射字段，而非页面胶水。

**双审**：45 条全量核验通过（to 与答案 45/45 一致、from 44 条逐字命中
+1 条图表题数据在卷面图中）；点名 5 条手法全对；纪要与 task.md 无事实
矛盾。微瑕两处已修：gk2025-new1#33 的 from 词中截断补省略号、README
轮数口径。

**验证**：data/loc node --check 绿；smoke 40/40（新增收尾三卷 31-35 可查
3 条断言）；纪要登记合规。

**循环状态**：定位标注内容线收尾（阅读全覆盖）；后续候选：① 七选五标注
口径确认后铺卷；② 定位标注并入试卷 JSON 的人核批次（依赖人工）；
③ 到步直达在训练页例题解析的复用评估。

--------------------------------------------------------------------------------

## 2026-09-19 · 循环第十三轮：词汇使用指南页 #/vocab-guide（双审通过）

> 起因：用户问「老师对单词记忆方面有没有指点」→ 教师作答（以测代背/跟间隔
> 走/考频定优先级/三条底线/两个坑）→ 用户拍板「跟着修」→ 指引落站。

**修订**：js/ui/word.js 新增 UI.vocabGuide()（同步渲染、无数据依赖）——四张
word-card：核心主张（测试效应 61%/40%【强】、间隔复习【强】）、功能对照
（收词→词条收藏 / 复习→生词本先回忆再看释义 / 定优先级→真题考频区 /
词组→闪卡两步走 / 织网→星空比较）、三条底线（新词 10–30/天【中】、到期
当天清、不抄写）、站内升级中（FSRS 厂商口径【中】、541 词组释义人工补核）。
阶梯天数动态取 Review.INTERVALS（FSRS 灰度时文案自动跟上）。证据分级小签
沿用《能力提升与可视化方案》口径；尾注声明「自著学习指引，非官方材料」。

**接线**：app.js EXACT_ROUTES 加 /vocab-guide；base.js 词域 re 与 items 收录
（下拉第 5 项）；生词本与词组闪卡页头各加「词汇指南」入口；css/word.css 加
.guide-do / .guide-evidence（初审自抓 999px 圆角违例，已改 --r-sm，audit
回到存量）。

**双审**：前端专家四项全过——路由与高亮正则生效、词域 5 项折行无挤爆；
插值无用户数据零注入面；文案数字逐一对过调研报告与人工待办清单（61%/40%、
8–10 次、10–30、20–30% 厂商口径、541 条全部如实）；阶梯动态拼接与 review.js
一致无硬编码漂移。回归 smoke 40/40、audit 无新增违例。

**验证**：5 文件 node --check 全绿（含复审补充发现的 phrases.js）；smoke
40/40；audit_ui 存量口径。

**循环下一轮候选**：① 定位标注人核批次（依赖人工）；② FSRS 灰度实施
（词汇闪卡先行）；③ 到步直达在训练页例题解析的复用评估。
