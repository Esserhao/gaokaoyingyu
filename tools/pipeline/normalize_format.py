#!/usr/bin/env python3
"""
normalize_format.py - 将 parsed/ 目录下的 JSON 转换为标准格式。
处理：
  1. 拆分挤在一起的选项（\t 分隔）
  2. 合并重复 key 的 section
  3. 重新编号问题 ID
  4. 添加缺失的元数据字段（id/year/paper/title/format/duration/totalScore/hasAudio/audio/source）
  5. 修正 partTitle 为中文
  6. 添加 score 字段
"""

import json
import os
import re
import sys

# ── 路径配置 ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
PARSED_DIR = os.path.join(SCRIPT_DIR, "parsed")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "exams")

# ── 试卷名 → ID 后缀 ──────────────────────────────────────
PAPER_MAP = {
    "全国甲卷": "jia",
    "全国乙卷": "yi",
    "新课标全国Ⅰ卷": "xkb1",
    "新课标全国Ⅱ卷": "xkb2",
    "新高考全国一卷": "xkb1",
    "新高考全国二卷": "xkb2",
    "新高考全国Ⅰ卷": "xkb1",
    "新高考全国Ⅱ卷": "xkb2",
    "全国Ⅰ卷": "new1",
    "全国Ⅱ卷": "new2",
    "全国I卷": "new1",
    "全国II卷": "new2",
}

# 试卷名 → 地区
PAPER_REGION = {
    "全国甲卷": "全国",
    "全国乙卷": "全国",
    "新课标全国Ⅰ卷": "新高考地区",
    "新课标全国Ⅱ卷": "新高考地区",
    "新高考全国一卷": "新高考地区",
    "新高考全国二卷": "新高考地区",
    "新高考全国Ⅰ卷": "新高考地区",
    "新高考全国Ⅱ卷": "新高考地区",
    "全国Ⅰ卷": "全国",
    "全国Ⅱ卷": "全国",
    "全国I卷": "全国",
    "全国II卷": "全国",
}

# ── section key → 中文标题（与现有标准格式一致）─────────────
SECTION_TITLES = {
    "listening": "第一部分 听力",
    "reading": "第二部分 阅读理解",
    "seven": "第三部分 七选五",
    "cloze": "第三部分 完形填空",
    "grammar_fill": "第三部分 语法填空",
    "grammar": "第三部分 语法填空",
    "proofreading": "第四部分 短文改错",
    "writing": "第四部分 书面表达",
}

# ── section key → 问题类型 ───────────────────────────────
SECTION_TYPE = {
    "listening": "listening",
    "reading": "reading",
    "seven": "seven",
    "cloze": "cloze",
    "grammar_fill": "grammar_fill",
    "grammar": "grammar_fill",
    "proofreading": "proofreading",
    "writing": "writing",
}

# ── 每题默认分值 ─────────────────────────────────────────
SECTION_SCORE = {
    "listening": 1.5,
    "reading": 2,
    "seven": 2,
    "cloze": 1.5,
    "grammar_fill": 1.5,
    "grammar": 1.5,
    "proofreading": 1,
    "writing": 25,
}


def get_format(paper: str) -> str:
    """根据试卷名判断 format。"""
    if "新课标" in paper or "新高考" in paper:
        return "new"
    if re.search(r"全国[ⅠⅡIⅡ]", paper):
        return "new"
    return "legacy"


def parse_filename(filename: str):
    """从文件名提取 (year, paper)。"""
    name = filename.replace(".json", "")

    # 提取年份
    m = re.search(r"(20\d{2})", name)
    year = int(m.group(1)) if m else 0

    # 提取试卷名
    paper = None
    for key in sorted(PAPER_MAP.keys(), key=len, reverse=True):
        if key in name:
            paper = key
            break

    # 特殊处理 "2026 Ⅰ" 这类文件名
    if not paper:
        if "Ⅰ" in name or "I" in name:
            paper = "全国Ⅰ卷"
        elif "Ⅱ" in name or "II" in name:
            paper = "全国Ⅱ卷"

    return year, paper


def split_options(options: list) -> list:
    """拆分挤在一起的选项，并重新按 A/B/C/D 顺序编号。"""
    if not options:
        return []

    raw_texts = []
    for opt in options:
        text = opt.get("text", "").strip()
        if not text:
            continue
        if "\t" in text:
            parts = text.split("\t")
            for part in parts:
                part = part.strip()
                if part:
                    m = re.match(r"^([A-D])[.\s]+(.+)$", part)
                    raw_texts.append(m.group(2).strip() if m else part)
        else:
            m = re.match(r"^([A-D])[.\s]+(.+)$", text)
            raw_texts.append(m.group(2).strip() if m else text)

    return [{"letter": chr(ord('A') + i), "text": t} for i, t in enumerate(raw_texts)]


def extract_options_from_stem(stem: str) -> tuple:
    """从题干中提取嵌入的选项（如 'A. xxx\tB. yyy'）。
    
    返回 (clean_stem, options_list)
    """
    # 匹配模式：题干 + \t + A. xxx \t B. yyy ...
    # 或者整个 stem 就是选项
    lines = stem.split("\n")
    last_line = lines[-1].strip() if lines else ""
    
    # 检查最后一行是否包含 \t 分隔的选项
    if "\t" in last_line:
        parts = last_line.split("\t")
        # 检查是否所有部分都是 "A. xxx" 格式
        all_options = True
        for i, part in enumerate(parts):
            part = part.strip()
            expected_letter = chr(ord('A') + i)
            m = re.match(rf"^{expected_letter}[.\s]+(.+)$", part)
            if not m:
                all_options = False
                break
        
        if all_options and len(parts) >= 2:
            # 提取选项
            options = []
            for i, part in enumerate(parts):
                part = part.strip()
                m = re.match(rf"^{chr(ord('A')+i)}[.\s]+(.+)$", part)
                if m:
                    options.append({"letter": chr(ord('A') + i), "text": m.group(1).strip()})
            # 返回清理后的题干和选项
            clean_stem = "\n".join(lines[:-1]).strip()
            return clean_stem, options
    
    # 检查整个 stem 是否就是选项（如 "A. ownership\tB. membership"）
    if re.match(r'^[A-D][.\s]', stem) and "\t" in stem:
        parts = stem.split("\t")
        options = []
        for i, part in enumerate(parts):
            part = part.strip()
            m = re.match(rf"^{chr(ord('A')+i)}[.\s]+(.+)$", part)
            if m:
                options.append({"letter": chr(ord('A') + i), "text": m.group(1).strip()})
        if len(options) >= 2:
            return "", options
    
    return stem, []


def merge_sections(sections: list) -> list:
    """合并相同 key 的 section。"""
    order = []
    merged = {}

    for sec in sections:
        key = sec.get("key", "unknown")
        if key not in merged:
            merged[key] = {
                "key": key,
                "partTitle": SECTION_TITLES.get(key, sec.get("partTitle", key)),
                "secTitle": sec.get("secTitle", ""),
                "passages": sec.get("passages", []),
                "pool": sec.get("pool", []),
                "questions": [],
            }
            order.append(key)
        merged[key]["questions"].extend(sec.get("questions", []))
        # 合并 passages 和 pool
        if sec.get("passages"):
            merged[key]["passages"] = sec["passages"]
        if sec.get("pool"):
            merged[key]["pool"] = sec["pool"]

    return [merged[k] for k in order]


def renumber_questions(questions: list) -> list:
    """从 1 开始连续编号。"""
    for i, q in enumerate(questions, 1):
        q["id"] = i
    return questions


def normalize_question(q: dict, section_key: str) -> dict:
    """标准化单个问题。"""
    stem = q.get("stem", "").strip()
    options = split_options(q.get("options", []))
    
    # 如果没有选项，尝试从题干中提取
    if not options and stem:
        clean_stem, extracted_opts = extract_options_from_stem(stem)
        if extracted_opts:
            stem = clean_stem
            options = extracted_opts

    nq = {
        "id": q.get("id", 0),
        "stem": stem,
        "options": options,
        "type": SECTION_TYPE.get(section_key, q.get("type", section_key)),
        "score": SECTION_SCORE.get(section_key, 1.5),
        "answer": q.get("answer", ""),
    }

    # 保留可选字段
    for field in ("transcript", "explanation", "modelAnswer", "material", "passageLabel"):
        if q.get(field):
            nq[field] = q[field]

    return nq


def normalize_file(input_path: str, output_path: str) -> bool:
    """转换单个文件。"""
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    filename = os.path.basename(input_path)
    year, paper = parse_filename(filename)

    if not paper or year == 0:
        print(f"  ⚠ 无法识别年份或试卷名: {filename}")
        return False

    paper_id = PAPER_MAP[paper]
    exam_id = f"gk{year}-{paper_id}"

    # 合并重复 section
    raw_sections = data.get("sections", [])
    if not raw_sections:
        print(f"  ⚠ 无 sections: {filename}")
        return False

    merged = merge_sections(raw_sections)

    # 标准化每个 section
    sections = []
    for sec in merged:
        key = sec["key"]
        questions = [normalize_question(q, key) for q in sec["questions"]]
        questions = renumber_questions(questions)
        # 过滤空题
        questions = [q for q in questions if q["stem"]]
        if questions:
            sec["questions"] = questions
            sections.append(sec)

    if not sections:
        print(f"  ⚠ 转换后无有效题目: {filename}")
        return False

    # 构建标准格式
    canonical = {
        "id": exam_id,
        "year": year,
        "paper": paper,
        "region": PAPER_REGION.get(paper, "全国"),
        "title": f"{year}年{paper}英语",
        "format": get_format(paper),
        "duration": 120,
        "totalScore": 150,
        "hasAudio": False,
        "audio": None,
        "source": data.get("source_file", filename),
        "sections": sections,
    }

    # 判断是否有听力音频（有 transcript 则标记为有音频）
    for sec in sections:
        if sec["key"] == "listening":
            for q in sec["questions"]:
                if q.get("transcript"):
                    canonical["hasAudio"] = True
                    canonical["audio"] = {"file": f"audio/listening-{year}-{paper_id}.mp3"}
                    break
            break

    # 写入
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(canonical, f, ensure_ascii=False, indent=2)

    total_q = sum(len(s["questions"]) for s in sections)
    print(f"  ✓ {exam_id}: {len(sections)} 个部分, {total_q} 道题")
    return True


def update_index(output_dir: str):
    """扫描 output_dir 下的所有 gk*.json 文件，生成/更新 index.json。"""
    index_path = os.path.join(output_dir, "..", "index.json")
    entries = []

    for fname in sorted(os.listdir(output_dir)):
        if not fname.startswith("gk") or not fname.endswith(".json"):
            continue
        fpath = os.path.join(output_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        question_count = sum(len(s.get("questions", [])) for s in data.get("sections", []))
        entry = {
            "id": data["id"],
            "year": data["year"],
            "paper": data["paper"],
            "region": data.get("region", "全国"),
            "title": data["title"],
            "format": data["format"],
            "totalScore": data["totalScore"],
            "duration": data["duration"],
            "questionCount": question_count,
            "hasAudio": data.get("hasAudio", False),
            "file": f"exams/{fname}",
            "quality": "review_required",
        }
        entries.append(entry)

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"\n已更新 index.json: {len(entries)} 个试卷")


def main():
    print(f"读取目录: {PARSED_DIR}")
    print(f"输出目录: {OUTPUT_DIR}\n")

    if not os.path.isdir(PARSED_DIR):
        print(f"错误: 目录不存在 {PARSED_DIR}")
        sys.exit(1)

    files = sorted([f for f in os.listdir(PARSED_DIR) if f.endswith(".json")])
    print(f"共 {len(files)} 个文件待处理\n")

    success = 0
    skipped = 0

    for filename in files:
        input_path = os.path.join(PARSED_DIR, filename)
        year, paper = parse_filename(filename)

        if not paper or year == 0:
            print(f"跳过: {filename} (无法识别)")
            skipped += 1
            continue

        paper_id = PAPER_MAP[paper]
        exam_id = f"gk{year}-{paper_id}"
        output_path = os.path.join(OUTPUT_DIR, f"{exam_id}.json")

        print(f"处理: {filename}")
        if normalize_file(input_path, output_path):
            success += 1
        else:
            skipped += 1

    print(f"\n完成: {success} 个转换成功, {skipped} 个跳过")

    # 更新 index.json
    update_index(OUTPUT_DIR)


if __name__ == "__main__":
    main()
