#!/usr/bin/env python3
"""Stage 6: 发布到 data/exams/ 并更新 index.json。

用法: python tools/pipeline/publish.py --id <exam_id> [--force]
示例: python tools/pipeline/publish.py --id gk2024-xkb1
"""
import json, sys, argparse
from pathlib import Path

PARSED_DIR = Path("tools/pipeline/parsed")
AUDIT_DIR = Path("tools/pipeline/audit")
EXAMS_DIR = Path("data/exams")
INDEX_PATH = Path("data/index.json")

def publish(exam_id: str, force: bool = False):
    """发布单个考试"""
    parsed_path = PARSED_DIR / f"{exam_id}.json"
    audit_path = AUDIT_DIR / f"{exam_id}.audit.json"

    if not parsed_path.exists():
        print(f"[ERROR] 解析文件不存在: {parsed_path}")
        return False

    # 检查审计状态
    if audit_path.exists():
        audit = json.load(open(audit_path, encoding="utf-8"))
        if audit["summary"]["needs_review"] and not force:
            print(f"[WARN] 审计未通过，跳过发布。使用 --force 强制发布。")
            print(f"  问题数: {audit['summary']['total_issues']}")
            return False

    # 读取解析数据
    data = json.load(open(parsed_path, encoding="utf-8"))

    # 转换为前端格式
    exam_json = {
        "id": exam_id,
        "title": data.get("title", exam_id),
        "year": data.get("year", ""),
        "paper": data.get("paper", ""),
        "region": data.get("region", ""),
        "questionCount": sum(len(s.get("questions", [])) for s in data.get("sections", [])),
        "totalScore": data.get("totalScore", 150),
        "duration": data.get("duration", 120),
        "hasAudio": data.get("hasAudio", False),
        "quality": "review_required",
        "sections": []
    }

    for sec in data.get("sections", []):
        section = {
            "key": sec.get("key", ""),
            "partTitle": sec.get("partTitle", ""),
            "questions": sec.get("questions", []),
            "passages": sec.get("passages", [])
        }
        exam_json["sections"].append(section)

    # 保存到 data/exams/
    EXAMS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXAMS_DIR / f"{exam_id}.json"
    json.dump(exam_json, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[OK] 已发布: {out_path}")

    # 更新 index.json
    if INDEX_PATH.exists():
        index = json.load(open(INDEX_PATH, encoding="utf-8"))
        # 检查是否已存在
        existing = next((e for e in index if e["id"] == exam_id), None)
        if existing:
            existing["file"] = f"exams/{exam_id}.json"
            existing["quality"] = "review_required"
        else:
            index.append({
                "id": exam_id,
                "title": exam_json["title"],
                "year": exam_json["year"],
                "paper": exam_json["paper"],
                "region": exam_json["region"],
                "questionCount": exam_json["questionCount"],
                "totalScore": exam_json["totalScore"],
                "duration": exam_json["duration"],
                "hasAudio": exam_json["hasAudio"],
                "file": f"exams/{exam_id}.json",
                "quality": "review_required"
            })
        json.dump(index, open(INDEX_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"[OK] 已更新 index.json")

    return True

def main():
    parser = argparse.ArgumentParser(description="发布考试到 data/exams/")
    parser.add_argument("--id", required=True, help="考试 ID")
    parser.add_argument("--force", action="store_true", help="强制发布（跳过审计检查）")
    args = parser.parse_args()

    success = publish(args.id, args.force)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
