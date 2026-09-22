# 词库数据来源说明（data/vocab/）

本目录收录高考英语词汇，作为未来「字典模块」的内容来源（规划见 2026-08-29 记忆：
词汇不并入语法知识点主体系，单独建设字典模块，支持点击翻译、同义/近义/同形词、单词在试卷中的出现位置）。

## 数据来源（三个 git 仓库的压缩包，位于 E:\Desk）

| 仓库（zip） | 收录内容 | 处理方式 |
| --- | --- | --- |
| `vocab-wordbank-main.zip` | `gaokao-3500` / `gaokao-24days` / `gaokao-core-20days` / `gaokao-michael` / `senior`（均为高考/高中词表，格式 `[[单词,音标,词性,释义],…]`） | 归一化为统一词条，并用 `--main` 高中词书的音标/例句回填补充 |
| `--main.zip` | `高中-乱序.db`(senior) / `初中-乱序.db`(junior) / `六级-乱序.db`(CET6)，SQLite 字段 `word,translate,phonetic,example,example_translate`（含音标+双语例句，最完整） | 转为统一词条；高中词书去重后 3740 条（原库 6008 行含大量重复词） |
| `my-English-Study-main.zip` | 仅 CET4/CET6/ab 专区的 HTML 页面 + 图片词表（`四级资料`/`六级资料`/`资料` 文件夹），**无高考专属结构化词汇** | 暂不收录（非高考核心、且为图片/HTML 形式，难以机器抽取） |

## 词条统一结构

```js
{ w, pos, ph, m, ex?, exCn? }
// w    单词（保留原文大小写）
// pos  词性 (n/vt/adj…)
// ph   音标（[…] 或 /…/）
// m    中文释义（已剥离词性前缀）
// ex   英文例句（仅 --main 来源提供）
// exCn 中文例句翻译（仅 --main 来源提供）
```

## 文件与全局变量约定（沿用本站 file:// 无 fetch 的 <script> 注入方式）

- `data/vocab/index.js` → `window.__VOCAB__ = { books:[…], load(id) }`
  - `load(id)` 惰性注入对应的 `data/vocab/<id>.js`，避免一次性加载全部词书。
- `data/vocab/<id>.js` → `window.__VOCAB_CACHE__['<id>'] = [ …词条… ]`
- `index.html` 已加入 `<script src="data/vocab/index.js"></script>`（在 `data-loader.js` 之前）。
- 各词书本体按需由 `await window.__VOCAB__.load('gaokao-3500')` 加载。

## 收录的词书清单（共 8 本）

| id | 级别 | 词条数 | 名称 |
| --- | --- | --- | --- |
| gaokao-michael | 高考 | 4377 | Michael老师高考词汇（词群速记） |
| gaokao-3500 | 高考 | 3865 | 高考核心 3500 词（已用高中词书回填例句） |
| highschool | 高考 | 3740 | 高中英语词汇（乱序·含音标与双语例句，最完整） |
| gaokao-24days | 高考 | 2527 | 24天突破高考大纲词汇 3500 |
| gaokao-core-20days | 高考 | 2410 | 20天背完高考核心词汇 |
| cet6 | 六级 | 3991 | 大学英语六级词汇（乱序·含音标与双语例句） |
| junior | 初中 | 1987 | 初中英语词汇（乱序·含音标与双语例句） |
| senior | 高中 | 3743 | 高中英语词汇（KyleBing） |

## 复现方式

转换脚本：`.work/convert_vocab.py`（从三个仓库解压后的临时目录读取源数据并生成本目录文件；
该脚本为一次性转换，源临时目录已清理，脚本不复存——词书数据以本目录现状为准）。
**统计盘点**：`python tools/dict_survey.py`（2026-09-03 起统计口径固化于此，
含词书/词典/词组/关系表计数、字段覆盖率、交叉覆盖与一致性检查；`--strict` 供校验）。

## 附加文件：affixes.js（词缀表，2026-08-30）

- `data/vocab/affixes.js` → `window.__AFFIX__ = { prefixes:[…], suffixes:[…] }`
  （28 个前缀 + 26 个后缀，含中文释义）。
- **来源：手写权威整理**（中学阶段教学的常规词缀，非词书抽取），供 `#/synonyms`
  星图集的**前缀图 / 后缀图**使用（2026-08-31 起五张图各讲一种关系，词缀派生
  占其中两张）。
- 派生关系不是本表声明的：页面运行时（`js/ui/synonyms.js` 的 `_buildAffixIndex`）
  把词缀表与 highschool 词书逐词比对，只有「去掉词缀后余下部分仍是词表中的词」
  才建立派生对（后缀含去 e / 去双写 / i↔y 三种安全拼写还原），词缀家族同样只收
  通过该检验的词。词形巧合（如 really 按 re- 配到 ally）不声明词义，只声明词形派生。

## 附加文件：gaokao-phrases.js（词组书，2026-08-31）

- `data/vocab/gaokao-phrases.js` → `window.__VOCAB_CACHE__['gaokao-phrases']`
  （4,487 条，词条结构 `{ w, m, ex?, exCn? }`，与词书词条一致但无音标/词性）。
- **来源**：`vocab-wordbank-main.zip` 内 lilinji《高考英语必背短语与词组》等 6 个
  XLSX（共 5,028 条），经 `tools/convert_phrases.py` 合并去重 + `tools/audit_phrases.py`
  质量审计（93% 首单词落在高中词书、89% 有释义、无模板垃圾）+
  `tools/clean_phrases.py` 清洗（剔除 541 条无释义、剥离语料例句混入释义的噪音）。
- 详细版（含 level/source 字段）另存 `data/vocab/phrases-detail.json` 备查。
- **用途**：`#/synonyms` 星图集第六张「词组图」（橙色，2026-08-31）。运行时
  （`js/ui/synonyms.js` 的 `_buildPhraseIndex`）按首单词建倒排索引：词中心展示
  以该词开头的常用词组；词组本身可做中心（kind='phrase'），展开同首词的兄弟
  词组，详情卡给释义与例句。关系只声明「共享首单词」，不编造别的关联。
- 注册表 `index.js` 里 file 字段必须与 id 一致（`gaokao-phrases.js`）——
  `load(id)` 按 id 拼路径，此前误写 `phrases.js` 导致懒加载 404（已修复）。

## 附加文件：dict.js + dict/（通用英汉词典，2026-08-30）

- `data/vocab/dict.js` → `window.__DICT__`（注册表 + 按首字母懒加载）；
  `data/vocab/dict/<a-z>.js` → `window.__DICT_CACHE__[<字母>]`（26 个分片）。
- **来源**：`english-chinese-dict-db-main.zip`（AsunDictionary，github Richasun），
  **MIT 许可**（© 2026 Richasun，汇编自多个开源词库）——**已核实可自由使用，含商用**。
  原 122,432 行，转换后保留 121,861 条（去掉无释义/非 a-z 词形/重音词头）。
- 字段映射：characters→w，char_yb→ph，char_trans→m（源内换行统一为中文分号），
  char_nums→f（语料频次，备用）。转换脚本 `tools/convert_ecdict.py`，
  中间档 `.work/ecdict_dump.sql`。
- **用途定位：查词兜底**。8 本精选词书未收的词（低频词、词形变化）在
  `#/word/<词>` 里由本词典补一行释义（来源徽标「通用词典（AsunDictionary）」）。
  主释义仍以精选词书优先；多义换行/释义质量以词书为准。

## 上海考纲词汇（sh-kaogang.js，2026-09-07 导入）
- 来源：上海市教育考试院官网《英语词汇表》公开 PDF（https://www.shmeea.edu.cn/download/20190926/07.pdf ，2019 版）。
- 2075 条；verified=false = 机器解析未人工逐条复核，界面已标灰。
- 解析管线：.work/sh_vocab_parse.py + .work/sh_vocab_build.py（pypdf 抽文本 → 词性/释义结构化，双栏交错与变体式词条已处理）。
- 注意：官方词表从 ability 起编，不含 a/an、I 等超基础功能词，为词表原貌非缺失。
