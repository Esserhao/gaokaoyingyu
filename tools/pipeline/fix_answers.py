#!/usr/bin/env python3
"""
fix_answers.py - 从原始文档提取答案并更新 JSON 文件
"""
import json
import re
from pathlib import Path
from docx import Document

WORD_DIR = Path("E:/Desk/题目")
EXAMS_DIR = Path("E:/Desk/高考英语网站/data/exams")

EXAM_SOURCES = {
    "gk2022-jia": ("2022年全国甲卷英语高考真题（解析版）.docx", "docx"),
    "gk2022-xkb1": ("2022年新高考全国一卷英语真题（解析版）.docx", "docx"),
    "gk2022-xkb2": ("2022年新高考全国Ⅱ卷英语真题（原卷版）.docx", "docx"),
    "gk2022-yi": ("2022年全国乙卷英语高考真题（解析版）.docx", "docx"),
    "gk2023-jia": ("2023年全国甲卷英语真题（解析版）.docx", "docx"),
    "gk2023-xkb1": ("2023年新课标全国Ⅰ卷英语真题（含听力）（解析版）.docx", "docx"),
    "gk2023-xkb2": ("2023年新课标全国Ⅱ卷英语真题（含听力）（解析版）.docx", "docx"),
    "gk2023-yi": ("2023年全国乙卷英语真题（含听力）（解析版）.docx", "docx"),
    "gk2024-jia": ("2024年高考英语试卷（全国甲卷）.docx", "docx"),
    "gk2024-new1": ("2024年高考英语试卷（新课标Ⅰ卷）.docx", "docx"),
    "gk2024-new2": ("2024年高考英语试卷（新课标Ⅱ卷）.docx", "docx"),
    "gk2025-new1": ("2025年高考英语试卷（全国Ⅰ卷）.docx", "docx"),
    "gk2025-new2": ("2025年高考英语试卷（全国Ⅱ卷）.docx", "docx"),
    "gk2026-new1": ("2026 Ⅰ.pdf", "pdf"),
}


def extract_answers_from_docx(doc_path: Path) -> dict:
    """从 Word 文档提取答案"""
    doc = Document(doc_path)
    paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    answers = {}
    
    for p in paras:
        # 格式1: 【答案】1. D    2. B    3. A
        m = re.search(r'【答案】(.+)', p)
        if m:
            parts = re.findall(r'(\d+)\.?\s*([A-D])', m.group(1))
            for qnum, ans in parts:
                answers[int(qnum)] = ans
        
        # 格式2: 单独一行 '1. D'
        m = re.match(r'^(\d+)\.\s*([A-D])$', p)
        if m:
            answers[int(m.group(1))] = m.group(2)
        
        # 格式3: 末尾 '1—5 ACBCA  6—10 BBCAB'
        m = re.findall(r'(\d+)\s*[—–-]\s*(\d+)\s+([A-D]+)', p)
        for start, end, ans_str in m:
            start, end = int(start), int(end)
            for i, ans in enumerate(ans_str):
                qnum = start + i
                if qnum <= end:
                    answers[qnum] = ans
    
    return answers


def extract_answers_from_pdf(pdf_path: Path) -> dict:
    """从 PDF 提取答案"""
    import PyPDF2
    
    reader = PyPDF2.PdfReader(str(pdf_path))
    answers = {}
    
    for page in reader.pages:
        text = page.extract_text()
        if not text:
            continue
        
        # 提取答案块
        for m in re.finditer(r'【答案】(.+?)(?=\n|$)', text):
            block = m.group(1)
            parts = re.findall(r'(\d+)\.?\s*([A-D])', block)
            for qnum, ans in parts:
                answers[int(qnum)] = ans
        
        # 单独答案行
        for m in re.finditer(r'(\d+)\.\s*([A-D])(?:\s|$)', text):
            qnum = int(m.group(1))
            ans = m.group(2)
            if qnum not in answers:
                answers[qnum] = ans
    
    return answers


def update_json_with_answers(exam_id: str, answers: dict) -> dict:
    """更新 JSON 文件中的答案"""
    json_path = EXAMS_DIR / f"{exam_id}.json"
    if not json_path.exists():
        return {"error": "JSON not found"}
    
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    
    updated = 0
    mismatches = []
    
    for sec in data.get("sections", []):
        for q in sec.get("questions", []):
            qid = q.get("id")
            if qid in answers:
                old_ans = q.get("answer", "")
                new_ans = answers[qid]
                if old_ans != new_ans:
                    if old_ans:
                        mismatches.append(f"Q{qid}: {old_ans} -> {new_ans}")
                    q["answer"] = new_ans
                    updated += 1
    
    if updated > 0:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    return {
        "updated": updated,
        "mismatches": mismatches[:10],
        "total_answers": len(answers)
    }


def main():
    print("=== 修复 JSON 答案 ===\n")
    
    total_fixed = 0
    total_mismatches = 0
    
    for exam_id, (source, fmt) in EXAM_SOURCES.items():
        print(f"--- {exam_id} ({source}) ---")
        
        source_path = WORD_DIR / source
        if not source_path.exists():
            print(f"  ❌ 源文件不存在: {source}\n")
            continue
        
        # 提取答案
        if fmt == "docx":
            answers = extract_answers_from_docx(source_path)
        else:
            answers = extract_answers_from_pdf(source_path)
        
        if not answers:
            print(f"  ⚠️ 未提取到答案\n")
            continue
        
        print(f"  从源文件提取到 {len(answers)} 个答案")
        
        # 更新 JSON
        result = update_json_with_answers(exam_id, answers)
        
        if "error" in result:
            print(f"  ❌ {result['error']}\n")
            continue
        
        print(f"  更新答案: {result['updated']}/{result['total_answers']} 题")
        
        if result["mismatches"]:
            total_mismatches += len(result["mismatches"])
            print(f"  修正错误答案: {len(result['mismatches'])} 处")
            for m in result["mismatches"][:5]:
                print(f"    {m}")
        
        total_fixed += result["updated"]
        print()
    
    print(f"=== 完成 ===")
    print(f"总计更新: {total_fixed} 个答案")
    print(f"修正错误: {total_mismatches} 处")


if __name__ == "__main__":
    main()
