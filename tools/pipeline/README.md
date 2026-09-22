# 题库导入审计发布流水线

## 架构总览

```
E:\Desk\题目\ (原始文件: doc/docx/pdf/mp3)
    │
    ▼
┌─────────────────────────────────────┐
│  Stage 1: scan_sources.py           │  扫描目录、识别年份/卷型/类型
│  产出: source_manifest.json         │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Stage 2: extract_content.py        │  从 doc/docx/pdf 抽取纯文本
│  产出: raw_text/<id>.txt            │  (保留段落结构)
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Stage 3: parse_exam.py             │  解析为标准 JSON 结构
│  产出: parsed/<id>.json             │  (题目/选项/答案/解析/段落)
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Stage 4: audit.py                  │  自动审计 (结构/字段/答案/异常)
│  产出: audit/<id>.audit.json        │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Stage 5: review_queue.py           │  生成人工审核队列 + 待确认项
│  产出: review_queue.md              │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Stage 6: publish.py                │  发布到 data/exams/ + 更新 index.json
│  产出: data/exams/<id>.json         │
└─────────────────────────────────────┘
```

## 使用方法

```bash
# 1. 扫描源文件
python tools/pipeline/scan_sources.py

# 2. 抽取内容 (依赖 python-docx / PyPDF2)
python tools/pipeline/extract_content.py

# 3. 解析为标准 JSON
python tools/pipeline/parse_exam.py

# 4. 自动审计
python tools/pipeline/audit.py

# 5. 生成审核队列
python tools/pipeline/review_queue.py

# 6. 发布 (人工审核通过后)
python tools/pipeline/publish.py --id gk2024-xkb1
```

## 审计规则

- 题号连续性检查
- 选项字母连续性 (A/B/C/D)
- 答案必须在选项范围内
- 阅读材料与题目关联完整性
- 短文改错 10 处格式规范
- 写作题不纳入自动判分
- 所有疑点记录到 audit.review_required 列表

## 当前状态（2026-09-05 附录 G3 更新）

- **已发布**：data/exams/ 16 套（2021–2026），audit 全绿。
- **候选池**：parsed/ 20 份（2020–2026 各卷原卷/解析版）。
- **本轮修复**（parse_exam.py）：
  1. 选项切分重写为字母状态机——旧行锚定正则把「A. xxx B. xxx C. xxx」
     整行吞进 A，选项大量丢失（option_letter_mismatch 68 → 0）；
  2. 新增批式答案/解析捕获 _parse_jiexi_batches——解析版 docx 的
     【答案】1. B 2. B 批式行与【N题详解】块按题号回填（如 2022 甲卷
     解析版回填 55 题）；范围扩到 A–G（七选五）；
  3. 回填只认客观节——写作/短文改错节内 qid 从 1 重计会撞全局题号，
     此前写作题被灌入阅读答案（writing_has_answer 21 → 0）。
- **审计现状**：候选池 134 → 51 问题。剩余全部是源文档层缺口：
  question_id_gap 21（docx 里题目缺失/排版断行）、answer_out_of_range 23
  （个别选项在源文件中丢失，如「C They lived…」缺点）、empty_stem 7。
  明细见 review_queue.md —— Stage 5 人工审核照单处理。
- **发布前还差**：①候选卷审过 review_queue 的对应条目；②部分卷只有
  原卷版无解析版（答案需人工/另源核对）；③听力音频独立缺口见
  人工待办清单 第五节。审完一条即可 publish.py --id 发一套。
