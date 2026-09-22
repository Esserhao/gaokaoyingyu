#!/usr/bin/env python3
"""Stage 3: 从纯文本解析为标准 JSON 结构。

用法: python tools/pipeline/parse_exam.py
产出: tools/pipeline/parsed/<name>.json
"""
import json, re, sys
from pathlib import Path

RAW_DIR = Path("tools/pipeline/raw_text")
PARSED_DIR = Path("tools/pipeline/parsed")

# 题型识别模式
SECTION_PATTERNS = {
    "listening": re.compile(r"听力|听力理解|Listening", re.I),
    "reading": re.compile(r"阅读理解|阅读|Reading", re.I),
    "cloze": re.compile(r"完形填空|Cloze", re.I),
    "seven": re.compile(r"七选五|7选五|Seven", re.I),
    "grammar": re.compile(r"语法填空|语法|Grammar", re.I),
    "proofreading": re.compile(r"短文改错|改错|Proofreading", re.I),
    "writing": re.compile(r"写作|书面表达|Writing", re.I),
}

# 题目编号模式
QUESTION_PATTERN = re.compile(r"^\s*(\d{1,2})[．.\)）]\s*(.+)", re.MULTILINE)
# 选项模式
OPTION_PATTERN = re.compile(r"^\s*([A-D])[．.\)）]\s*(.+)", re.MULTILINE)
# 答案模式
ANSWER_PATTERN = re.compile(r"答案[：:]\s*([A-D]{1,4})", re.I)
# 解析模式
EXPLANATION_PATTERN = re.compile(r"解析[：:]\s*(.+)", re.I)

def detect_sections(text: str) -> list:
    """识别文本中的题型段落"""
    sections = []
    lines = text.split("\n")
    current_section = None
    current_content = []

    for line in lines:
        found_type = None
        for sec_type, pattern in SECTION_PATTERNS.items():
            if pattern.search(line):
                found_type = sec_type
                break

        if found_type:
            if current_section:
                sections.append({
                    "type": current_section,
                    "content": "\n".join(current_content)
                })
            current_section = found_type
            current_content = [line]
        else:
            current_content.append(line)

    if current_section:
        sections.append({
            "type": current_section,
            "content": "\n".join(current_content)
        })

    return sections

def parse_questions(section_text: str, section_type: str) -> list:
    """从段落文本解析题目"""
    questions = []

    if section_type == "proofreading":
        # 短文改错特殊处理
        q = {
            "id": 1,
            "type": "proofreading",
            "material": section_text.strip(),
            "modelAnswer": "",
            "explanation": {"summary": "", "points": []}
        }
        questions.append(q)
    elif section_type == "writing":
        # 写作题
        q = {
            "id": 1,
            "type": "writing",
            "stem": section_text.strip(),
            "modelAnswer": "",
            "explanation": None
        }
        questions.append(q)
    else:
        # 标准题型: 按编号分割
        matches = list(QUESTION_PATTERN.finditer(section_text))
        for i, match in enumerate(matches):
            qid = int(match.group(1))
            stem = match.group(2).strip()

            # 提取选项 (A-D)。2026-09-05 重写（附录 G3）：旧 OPTION_PATTERN
            # 按行锚定且 .+ 吞到行尾，docx 导出常见「A. xxx B. xxx C. xxx」
            # 同行多选项被整行吞进 A —— 选项大量丢失（审计 option_letter_
            # mismatch 的根源）。改为字母标记状态机：一行内按连续字母序列
            # A→B→C→D 切分，非连续标记（正文里的 "Mr. D." 之类）跳过。
            options = []
            start = match.end()
            end = matches[i+1].start() if i+1 < len(matches) else len(section_text)
            chunk = section_text[start:end]
            options = _split_options(chunk)

            # 提取答案
            ans_match = ANSWER_PATTERN.search(chunk)
            answer = ans_match.group(1) if ans_match else ""

            # 提取解析
            exp_match = EXPLANATION_PATTERN.search(chunk)
            explanation = exp_match.group(1) if exp_match else ""

            q = {
                "id": qid,
                "type": section_type,
                "stem": stem,
                "options": options,
                "answer": answer,
                "explanation": explanation if explanation else None
            }
            questions.append(q)

    return questions

def _split_options(chunk: str) -> list:
    """选项状态机切分：同一行内 A→B→C→D 连续字母标记逐段切开。
    期望字母不出现的（如解析版里「C They lived...」缺点的 C）就跳过，
    由审计如实体现在 option_letter_mismatch 里，交给人工复核。"""
    options = []
    expected = 'A'
    cur_letter, cur_text = None, ''
    for line in chunk.splitlines():
        marks = list(re.finditer(r"([A-D])[．.、\)）]", line))
        opened = False
        for m in marks:
            L = m.group(1)
            if L == expected:
                if cur_letter:
                    options.append({"letter": cur_letter, "text": cur_text.strip()})
                cur_letter, cur_text = L, line[m.end():]
                expected = chr(ord(L) + 1)
                opened = True
        if not opened and cur_letter and line.strip() \
                and not re.match(r"^\s*\d{1,2}[．.\)）]", line) \
                and not ANSWER_PATTERN.search(line) \
                and not EXPLANATION_PATTERN.search(line):
            # 选项正文折行：并入当前选项（答案/解析/新题行不算）
            cur_text += ' ' + line.strip()
    if cur_letter:
        options.append({"letter": cur_letter, "text": cur_text.strip()})
    return options


def _parse_jiexi_batches(text: str):
    """解析版批式答案/解析捕获（2026-09-05，附录 G3）。

    解析版 docx 的答案与解析不是跟在每题后面，而是每篇文章一批：
        【答案】4. A    5. D    6. C    7. B
        【解析】
        【导语】……
        【4题详解】
        细节理解题。根据……故选A项。
    返回 ({qid: answer}, {qid: explanation})，按题号回填到任何
    逐题捕获失败的题上。"""
    ans_map, exp_map = {}, {}
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("【答案】"):
            for m in re.finditer(r"(\d{1,2})\s*[.．]?\s*([A-G])", line):
                ans_map[int(m.group(1))] = m.group(2)
            i += 1
        elif line.startswith("【") and "题详解】" in line:
            m = re.match(r"【(\d{1,2})题详解】", line)
            if m:
                qid = int(m.group(1))
                buf = [line[m.end():].strip()]
                i += 1
                while i < len(lines):
                    l2 = lines[i]
                    if l2.startswith("【") or re.match(r"^[A-D]\s*$", l2) \
                            or l2.startswith("【答案】"):
                        break
                    buf.append(l2)
                    i += 1
                exp_map[qid] = "\n".join(x for x in buf if x).strip()
                continue
            i += 1
        else:
            i += 1
    return ans_map, exp_map


def parse_file(text_path: Path) -> dict:
    """解析单个文本文件为 JSON"""
    text = text_path.read_text(encoding="utf-8")

    # 识别题型段落
    sections = detect_sections(text)

    result = {
        "source_file": text_path.stem,
        "sections": []
    }

    ans_map, exp_map = _parse_jiexi_batches(text)
    filled = 0
    OBJ_FILL = ("listening", "reading", "seven", "cloze", "grammar")
    for sec in sections:
        questions = parse_questions(sec["content"], sec["type"])
        for q in questions:
            """批式回填只认客观节：写作/短文改错的节内 qid 从 1 重新计数，
            会与全局题号撞号——2026-09-05 修（附录 G3），此前写作题被灌入
            阅读的答案（审计 writing_has_answer 的根源）。"""
            if sec["type"] in OBJ_FILL and not q.get("answer") and q["id"] in ans_map:
                q["answer"] = ans_map[q["id"]]
                filled += 1
            if sec["type"] in OBJ_FILL and not q.get("explanation") and q["id"] in exp_map:
                q["explanation"] = exp_map[q["id"]]
        result["sections"].append({
            "key": sec["type"],
            "partTitle": sec["type"],
            "questions": questions
        })
    if ans_map or exp_map:
        result["jiexi_filled"] = filled
        print(f"    批式答案/解析回填 {filled} 题"
              f"（答案 {len(ans_map)} / 解析 {len(exp_map)}）")

    return result

def main():
    if not RAW_DIR.exists():
        print("[ERROR] 请先运行 extract_content.py")
        sys.exit(1)

    PARSED_DIR.mkdir(parents=True, exist_ok=True)

    parsed = 0
    for text_path in RAW_DIR.glob("*.txt"):
        out_path = PARSED_DIR / f"{text_path.stem}.json"
        if out_path.exists():
            continue

        try:
            data = parse_file(text_path)
            json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            parsed += 1
            print(f"  [OK] {text_path.name} -> {out_path.name} ({len(data['sections'])} sections)")
        except Exception as e:
            print(f"  [ERROR] {text_path.name}: {e}")

    print(f"\n=== 解析完成 ===")
    print(f"解析: {parsed} 文件")
    print(f"产出目录: {PARSED_DIR}")

if __name__ == "__main__":
    main()
