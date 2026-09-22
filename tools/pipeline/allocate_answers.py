#!/usr/bin/env python3
"""
allocate_answers.py - 智能分配答案到各题型

2024/2025 全国卷答案格式：
- 1—20: 听力（实际题目数量可能更少）
- 21—35: 阅读理解
- 36—45: 完形填空/语法填空
- 46—55: 短文改错
- 写作: 无答案

根据 JSON 中各题型的题目数量，将答案正确分配给对应题目
"""
import json
import re
from pathlib import Path
from docx import Document

WORD_DIR = Path("E:/Desk/题目")
EXAMS_DIR = Path("E:/Desk/高考英语网站/data/exams")


def extract_answers_from_pdf(pdf_path: Path) -> dict:
    """从 PDF 提取答案"""
    import PyPDF2
    
    reader = PyPDF2.PdfReader(str(pdf_path))
    answers = {}
    
    for page in reader.pages:
        text = page.extract_text()
        if not text:
            continue
        
        # 匹配 '1—5 ACBCA' 格式
        matches = re.findall(r'(\d+)\s*[—–-]\s*(\d+)\s+([A-D]+)', text)
        for start, end, ans_str in matches:
            start, end = int(start), int(end)
            for i, ans in enumerate(ans_str):
                qnum = start + i
                if qnum <= end:
                    answers[qnum] = ans
        
        # 单独答案行
        for m in re.finditer(r'(\d+)\.?\s*([A-D])(?:\s|$)', text):
            qnum = int(m.group(1))
            ans = m.group(2)
            if qnum not in answers:
                answers[qnum] = ans
    
    return answers


def extract_raw_answers(doc_path: Path) -> dict:
    """提取所有原始答案，返回 {range_str: [answers]}"""
    if doc_path.suffix == ".pdf":
        return extract_answers_from_pdf(doc_path)
    
    doc = Document(doc_path)
    paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    
    # 格式: '1—5 ACBCA  6—10 BBCAB  11—15 ABABC  16—20 ACBCA'
    raw_answers = {}
    for p in paras:
        # 匹配多个范围
        matches = re.findall(r'(\d+)\s*[—–-]\s*(\d+)\s+([A-D]+)', p)
        for start, end, ans_str in matches:
            start, end = int(start), int(end)
            for i, ans in enumerate(ans_str):
                qnum = start + i
                if qnum <= end:
                    raw_answers[qnum] = ans
        
        # 也检查单独的答案
        matches = re.findall(r'(\d+)\.?\s*([A-D])(?:\s|$)', p)
        for qnum_str, ans in matches:
            qnum = int(qnum_str)
            if qnum not in raw_answers:
                raw_answers[qnum] = ans
    
    return raw_answers


def allocate_answers_to_sections(data: dict, raw_answers: dict) -> tuple:
    """将原始答案分配给各 section
    
    返回: (更新数, 不匹配列表)
    """
    if not raw_answers:
        return 0, []
    
    # 获取各 section 的题目数量
    sections_info = []
    for sec in data.get("sections", []):
        key = sec.get("key", "")
        questions = sec.get("questions", [])
        if not questions:
            continue
        
        # 根据题型确定答案范围
        qtype = questions[0].get("type", key)
        
        sections_info.append({
            "section": sec,
            "key": key,
            "type": qtype,
            "count": len(questions),
            "start_id": questions[0].get("id", 0),
            "end_id": questions[-1].get("id", 0),
        })
    
    # 获取答案范围
    ans_min = min(raw_answers.keys())
    ans_max = max(raw_answers.keys())
    
    updated = 0
    mismatches = []
    
    # 策略1: 按顺序分配
    # 听力题通常答案 1-N
    # 阅读题答案 N+1 - M
    # 写作/改错题无答案或另有范围
    
    # 先分配听力（如果有）
    listening = [s for s in sections_info if s["type"] == "listening"]
    non_listening = [s for s in sections_info if s["type"] != "listening"]
    
    if listening:
        # 听力答案从 1 开始
        for sec_info in listening:
            sec = sec_info["section"]
            for q in sec.get("questions", []):
                qid = q.get("id", 0)
                if qid in raw_answers:
                    old = q.get("answer", "")
                    new = raw_answers[qid]
                    if old != new:
                        if old:
                            mismatches.append(f"Q{qid}: {old} -> {new}")
                        q["answer"] = new
                        updated += 1
    
    # 非听力题：找到答案范围
    # 如果听力存在，答案从听力题数+1 开始
    # 如果不存在，从 1 开始
    if listening:
        non_list_start = listening[0]["count"] + 1
    else:
        non_list_start = 1
    
    # 按顺序分配给非听力题
    current_ans_idx = non_list_start
    for sec_info in non_listening:
        sec = sec_info["section"]
        qtype = sec_info["type"]
        
        # 写作/改错题通常无答案
        if qtype in ("writing", "proofreading"):
            continue
        
        for q in sec.get("questions", []):
            if current_ans_idx in raw_answers:
                old = q.get("answer", "")
                new = raw_answers[current_ans_idx]
                if old != new:
                    if old:
                        mismatches.append(f"[{sec_info['key']}] Q{q.get('id','?')}: {old} -> {new}")
                    q["answer"] = new
                    updated += 1
            current_ans_idx += 1
    
    return updated, mismatches


def main():
    print("=== 智能分配答案 ===\n")
    
    target_exams = []
    for f in sorted(EXAMS_DIR.glob("gk*.json")):
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        
        # 检查是否有空答案
        has_empty = False
        for sec in data.get("sections", []):
            for q in sec.get("questions", []):
                if not q.get("answer") and q.get("type") not in ("writing", "proofreading"):
                    has_empty = True
                    break
        
        if has_empty:
            target_exams.append((f.name, data.get("source", "")))
    
    print(f"需要处理的卷子: {len(target_exams)}")
    for name, source in target_exams:
        print(f"  {name}: {source}")
    print()
    
    total_updated = 0
    
    for json_name, source in target_exams:
        json_path = EXAMS_DIR / json_name
        
        # 找 Word 文件
        word_path = WORD_DIR / f"{source}.docx"
        if not word_path.exists():
            # 尝试其他路径
            for ext in [".docx", ".doc", ".pdf"]:
                for f in WORD_DIR.glob(f"*{source}*{ext}"):
                    word_path = f
                    break
        
        if not word_path.exists():
            print(f"❌ {json_name}: Word 文件不存在")
            continue
        
        print(f"--- {json_name} ---")
        print(f"  Word: {word_path.name}")
        
        # 提取答案
        raw_answers = extract_raw_answers(word_path)
        if not raw_answers:
            print(f"  ⚠️ 未提取到答案\n")
            continue
        
        print(f"  原始答案: {len(raw_answers)} 个 (范围 {min(raw_answers.keys())}-{max(raw_answers.keys())})")
        
        # 读取 JSON
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        
        # 分配答案
        updated, mismatches = allocate_answers_to_sections(data, raw_answers)
        
        if updated:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  更新: {updated} 题")
            total_updated += updated
        
        if mismatches:
            print(f"  修正: {len(mismatches)} 处")
            for m in mismatches[:5]:
                print(f"    {m}")
        
        print()
    
    print(f"=== 完成 ===")
    print(f"总计更新: {total_updated} 个答案")


if __name__ == "__main__":
    main()
