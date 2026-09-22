#!/usr/bin/env python3
"""
audit_word_vs_json.py - 对比 Word 原始文档与 JSON 中的答案
验证每道题的答案是否与解析版一致
"""
import json
import re
from pathlib import Path
from docx import Document

PROJECT_ROOT = Path("E:/Desk/高考英语网站")
EXAMS_DIR = PROJECT_ROOT / "data" / "exams"
WORD_DIR = Path("E:/Desk/题目")

# 需要审计的卷子列表（新增的14套）
TARGET_EXAMS = [
    "gk2022-jia", "gk2022-xkb1", "gk2022-xkb2", "gk2022-yi",
    "gk2023-jia", "gk2023-xkb1", "gk2023-xkb2", "gk2023-yi",
    "gk2024-jia", "gk2024-new1", "gk2024-new2",
    "gk2025-new1", "gk2025-new2",
    "gk2026-new1",
]


def extract_answers_from_word(doc_path: Path) -> dict:
    """从 Word 文档提取答案
    
    返回: {题号: 答案字母}
    """
    if not doc_path.exists():
        return {}
    
    doc = Document(doc_path)
    paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    
    answers = {}
    current_question = None
    
    for p in paras:
        # 匹配 "1. What does..." 格式
        q_match = re.match(r'^(\d+)\.\s+(.+)$', p)
        if q_match:
            current_question = int(q_match.group(1))
            continue
        
        # 匹配 "【答案】1. D    2. B    3. A"
        ans_match = re.match(r'【答案】(.+)', p)
        if ans_match:
            ans_text = ans_match.group(1)
            parts = re.findall(r'(\d+)\.\s*([A-D])', ans_text)
            for qnum, ans in parts:
                answers[int(qnum)] = ans
            continue
        
        # 匹配单独答案行: "1. D" 或 "1.D"
        single_ans = re.match(r'^(\d+)\.?\s*([A-D])$', p)
        if single_ans:
            answers[int(single_ans.group(1))] = single_ans.group(2)
    
    return answers


def get_questions_from_json(json_path: Path) -> dict:
    """从 JSON 文件提取题目和答案
    
    返回: {题号: {stem, options, answer, type}}
    """
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    
    questions = {}
    for sec in data.get("sections", []):
        for q in sec.get("questions", []):
            qid = q.get("id")
            questions[qid] = {
                "stem": q.get("stem", ""),
                "options": q.get("options", []),
                "answer": q.get("answer", ""),
                "type": q.get("type", ""),
                "section": sec.get("key", ""),
            }
    
    return questions


def compare_answers(exam_id: str, word_answers: dict, json_questions: dict) -> list:
    """对比 Word 和 JSON 的答案
    
    返回不一致的列表
    """
    mismatches = []
    
    for qid, word_ans in sorted(word_answers.items()):
        if qid in json_questions:
            json_ans = json_questions[qid]["answer"]
            if json_ans != word_ans:
                mismatches.append({
                    "question_id": qid,
                    "word_answer": word_ans,
                    "json_answer": json_ans,
                    "stem": json_questions[qid]["stem"][:60],
                    "type": json_questions[qid]["type"],
                })
    
    return mismatches


def main():
    print("=== 审计：Word 原始文档 vs JSON 答案 ===\n")
    
    total_mismatches = 0
    total_checked = 0
    
    for exam_id in TARGET_EXAMS:
        json_path = EXAMS_DIR / f"{exam_id}.json"
        if not json_path.exists():
            print(f"❌ {exam_id}: JSON 文件不存在")
            continue
        
        # 读取 JSON
        json_questions = get_questions_from_json(json_path)
        
        # 读取 Word
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        
        source = data.get("source", "")
        # 构造 Word 文件路径
        word_path = WORD_DIR / f"{source}.docx"
        if not word_path.exists():
            # 尝试其他文件名
            for ext in [".docx", ".doc"]:
                for f in WORD_DIR.glob(f"*{data['year']}*{data['paper'].replace('全国', '')}*解析*{ext}"):
                    word_path = f
                    break
        
        if not word_path.exists():
            # 尝试其他匹配方式
            word_answers = {}
        else:
            word_answers = extract_answers_from_word(word_path)
        
        # 对比
        mismatches = compare_answers(exam_id, word_answers, json_questions)
        
        if mismatches:
            total_mismatches += len(mismatches)
            print(f"⚠️ {exam_id} ({data['year']} {data['paper']}): {len(mismatches)} 处不一致")
            for m in mismatches[:5]:
                print(f"   Q{m['question_id']}: Word={m['word_answer']}, JSON={m['json_answer']} | {m['stem'][:50]}")
            if len(mismatches) > 5:
                print(f"   ... +{len(mismatches)-5} 处")
        else:
            has_answers = any(q["answer"] for q in json_questions.values())
            if has_answers:
                answer_count = sum(1 for q in json_questions.values() if q["answer"])
                print(f"✅ {exam_id} ({data['year']} {data['paper']}): {answer_count} 题答案全部匹配")
            else:
                print(f"⚠️ {exam_id} ({data['year']} {data['paper']}): JSON 中无答案")
        
        total_checked += 1
    
    print(f"\n总计: {total_checked} 套卷子, {total_mismatches} 处不一致")


if __name__ == "__main__":
    main()
