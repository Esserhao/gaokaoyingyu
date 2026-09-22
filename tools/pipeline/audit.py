#!/usr/bin/env python3
"""Stage 4: 自动审计 exams/ 目录下的标准格式 JSON。

检查项:
- 题号连续性
- 选项字母连续性 (支持 2/3/4 选项)
- 答案必须在选项范围内
- 必填字段完整性
- 短文改错材料长度
- 写作题不纳入自动判分

用法: python tools/pipeline/audit.py
产出: tools/pipeline/audit/<name>.audit.json
"""
import json, re, sys
from pathlib import Path

import os
# 输入目录可覆盖：默认审计已发布卷，也可审计流水线 parsed/ 中间产物
EXAMS_DIR = Path(os.environ.get("AUDIT_DIR", "data/exams"))
AUDIT_DIR = Path("tools/pipeline/audit")

def audit_question(q: dict, section_key: str) -> list:
    """审计单个题目，返回问题列表"""
    issues = []

    # 检查必要字段
    if "id" not in q:
        issues.append({"type": "missing_field", "field": "id", "msg": "题目缺少 id"})
    if "type" not in q:
        issues.append({"type": "missing_field", "field": "type", "msg": "题目缺少 type"})
    if not q.get("stem", "").strip():
        issues.append({"type": "empty_stem", "msg": "题目题干为空"})

    # 检查选项
    if q.get("options"):
        letters = [o.get("letter", "") for o in q["options"]]
        n = len(letters)
        if n > 0:
            expected = [chr(ord('A') + i) for i in range(n)]
            if letters != expected:
                issues.append({
                    "type": "option_letter_mismatch",
                    "msg": f"选项字母不连续: {letters} (期望 {expected})"
                })

            # 检查答案是否在选项范围内
            answer = q.get("answer", "")
            if answer and answer not in letters:
                issues.append({
                    "type": "answer_out_of_range",
                    "msg": f"答案 {answer} 不在选项 {letters} 中"
                })
        else:
            issues.append({
                "type": "empty_options",
                "msg": "选项为空"
            })

    # 短文改错特殊检查
    if section_key == "proofreading" or q.get("type") == "proofreading":
        material = q.get("material", "")
        if len(material) < 50:
            issues.append({
                "type": "proofreading_too_short",
                "msg": f"短文改错材料过短 ({len(material)} 字符)"
            })

    # 写作题不检查答案
    if q.get("type") == "writing":
        if q.get("answer"):
            issues.append({
                "type": "writing_has_answer",
                "msg": "写作题不应有标准答案"
            })

    return issues

def audit_file(json_path: Path) -> dict:
    """审计单个解析后的 JSON 文件"""
    data = json.load(open(json_path, encoding="utf-8"))

    audit_result = {
        "source_file": json_path.stem,
        "total_sections": len(data.get("sections", [])),
        "total_questions": 0,
        "issues": [],
        "review_required": [],
        "summary": {}
    }

    for sec in data.get("sections", []):
        section_key = sec.get("key", "")
        questions = sec.get("questions", [])
        audit_result["total_questions"] += len(questions)

        # 检查题号连续性
        ids = [q.get("id", 0) for q in questions if "id" in q]
        if ids:
            expected = list(range(min(ids), max(ids) + 1))
            if ids != expected:
                audit_result["issues"].append({
                    "type": "question_id_gap",
                    "section": section_key,
                    "msg": f"题号不连续: {ids[:10]}..."
                })

        # 审计每个题目
        for q in questions:
            q_issues = audit_question(q, section_key)
            for issue in q_issues:
                issue["section"] = section_key
                issue["question_id"] = q.get("id")
            audit_result["issues"].extend(q_issues)

    # 汇总
    audit_result["summary"] = {
        "total_issues": len(audit_result["issues"]),
        "needs_review": len(audit_result["issues"]) > 0
    }

    return audit_result

def main():
    if not EXAMS_DIR.exists():
        print(f"[ERROR] 目录不存在: {EXAMS_DIR}")
        sys.exit(1)

    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    audited = 0
    total_issues = 0

    # 审计流水线 parsed/ 时文件名是中文源名，不是 gk*；index.json 不是单卷结构要排除
    pattern = "gk*.json" if "AUDIT_DIR" not in os.environ else "*.json"
    for json_path in sorted(EXAMS_DIR.glob(pattern)):
        if json_path.name == "index.json":
            continue
        out_path = AUDIT_DIR / f"{json_path.stem}.audit.json"
        # 总是重新审计
        try:
            result = audit_file(json_path)
            json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            audited += 1
            total_issues += result["summary"]["total_issues"]
            status = "⚠️" if result["summary"]["needs_review"] else "✅"
            print(f"  {status} {json_path.name}: {result['summary']['total_issues']} issues")
        except Exception as e:
            print(f"  [ERROR] {json_path.name}: {e}")

    print(f"\n=== 审计完成 ===")
    print(f"审计: {audited} 文件")
    print(f"总问题数: {total_issues}")
    print(f"产出目录: {AUDIT_DIR}")

if __name__ == "__main__":
    main()
