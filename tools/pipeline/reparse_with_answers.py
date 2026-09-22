#!/usr/bin/env python3
"""
reparse_with_answers.py - 从 Word 文档重新解析，提取答案
解决原 JSON 文件中答案为空的问题
"""
import json
import re
from pathlib import Path
from docx import Document

WORD_DIR = Path("E:/Desk/题目")
PROJECT_ROOT = Path("E:/Desk/高考英语网站")
OUTPUT_DIR = PROJECT_ROOT / "data" / "exams"

# 试卷名 → Word 文件映射
EXAM_MAP = {
    "gk2022-jia": "2022年全国甲卷英语高考真题（解析版）.docx",
    "gk2022-xkb1": "2022年新高考全国一卷英语真题（解析版）.docx",
    "gk2022-xkb2": "2022年新高考全国Ⅱ卷英语真题（原卷版）.docx",
    "gk2022-yi": "2022年全国乙卷英语高考真题（解析版）.docx",
    "gk2023-jia": "2023年全国甲卷英语真题（解析版）.docx",
    "gk2023-xkb1": "2023年新课标全国Ⅰ卷英语真题（含听力）（解析版）.docx",
    "gk2023-xkb2": "2023年新课标全国Ⅱ卷英语真题（含听力）（解析版）.docx",
    "gk2023-yi": "2023年全国乙卷英语真题（含听力）（解析版）.docx",
    "gk2024-jia": "2024年高考英语试卷（全国甲卷）.docx",
    "gk2024-new1": "2024年高考英语试卷（新课标Ⅰ卷）.docx",
    "gk2024-new2": "2024年高考英语试卷（新课标Ⅱ卷）.docx",
    "gk2025-new1": "2025年高考英语试卷（全国Ⅰ卷）.docx",
    "gk2025-new2": "2025年高考英语试卷（全国Ⅱ卷）.docx",
}


def extract_answers_from_doc(doc) -> dict:
    """从 Word 文档提取答案"""
    paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    answers = {}
    
    for p in paras:
        # 格式1: 【答案】1. D    2. B    3. A
        m = re.match(r'【答案】(.+)', p)
        if m:
            parts = re.findall(r'(\d+)\.?\s*([A-D])', m.group(1))
            for qnum, ans in parts:
                answers[int(qnum)] = ans
            continue
        
        # 格式2: 单独一行 '1. D' 或 '1.D'
        m = re.match(r'^(\d+)\.\s*([A-D])$', p)
        if m:
            answers[int(m.group(1))] = m.group(2)
    
    return answers


def extract_questions_from_doc(doc) -> list:
    """从 Word 文档提取题目"""
    paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    questions = []
    current_question = None
    current_options = []
    
    for p in paras:
        # 检测题目编号: "1. What..." 或 "1．What..."
        q_match = re.match(r'^(\d{1,2})[．.\)）]\s*(.+)', p)
        
        if q_match:
            # 保存上一题
            if current_question:
                current_question["options"] = current_options
                questions.append(current_question)
            
            qnum = int(q_match.group(1))
            stem = q_match.group(2).strip()
            current_question = {
                "id": qnum,
                "stem": stem,
                "options": [],
                "answer": ""
            }
            current_options = []
            continue
        
        # 检测选项: "A. xxx" 或 "A．xxx"
        opt_match = re.match(r'^([A-D])[．.\)）]\s*(.+)', p)
        if opt_match and current_question:
            letter = opt_match.group(1)
            text = opt_match.group(2).strip()
            # 去掉行尾可能的其他选项（如 "A. xxx    B. yyy"）
            parts = re.split(r'\s{2,}', text)
            current_options.append({"letter": letter, "text": parts[0].strip()})
            continue
        
        # 检测选项延续（多行选项）
        if current_question and current_options and not q_match:
            last_opt = current_options[-1]
            # 检查是否是新选项在同一行
            inline_opt = re.match(r'^\s*([A-D])[．.\)）]\s*(.+)', p)
            if inline_opt:
                current_options.append({
                    "letter": inline_opt.group(1),
                    "text": inline_opt.group(2).strip()
                })
    
    # 最后一题
    if current_question:
        current_question["options"] = current_options
        questions.append(current_question)
    
    return questions


def parse_exam(exam_id: str, word_file: str) -> dict:
    """解析单个试卷"""
    word_path = WORD_DIR / word_file
    if not word_path.exists():
        print(f"  ❌ Word 文件不存在: {word_file}")
        return None
    
    doc = Document(word_path)
    
    # 提取答案
    answers = extract_answers_from_doc(doc)
    print(f"  提取到 {len(answers)} 个答案")
    
    # 提取题目
    questions = extract_questions_from_doc(doc)
    print(f"  提取到 {len(questions)} 道题")
    
    # 合并答案到题目
    matched = 0
    for q in questions:
        qid = q["id"]
        if qid in answers:
            q["answer"] = answers[qid]
            matched += 1
    
    print(f"  匹配答案: {matched}/{len(questions)}")
    
    return {
        "id": exam_id,
        "questions": questions,
        "answer_count": len(answers),
        "matched_count": matched
    }


def main():
    print("=== 重新解析 Word 文档提取答案 ===\n")
    
    results = {}
    
    for exam_id, word_file in EXAM_MAP.items():
        print(f"\n--- {exam_id} ({word_file}) ---")
        result = parse_exam(exam_id, word_file)
        if result:
            results[exam_id] = result
    
    # 保存结果
    output_path = PROJECT_ROOT / "tools" / "pipeline" / "reparsed_answers.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n\n=== 完成 ===")
    print(f"处理: {len(results)} 套")
    print(f"输出: {output_path}")


if __name__ == "__main__":
    main()
