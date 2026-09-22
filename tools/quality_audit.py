"""高考英语题库静态质量审计。只报告异常，不自动篡改题库。"""
from __future__ import annotations
import collections
import glob
import json
import os
import re

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "exams"))
MANUAL_REVIEW_KEYS = {"proofreading"}
WRITING_KEYS = {"writing_app", "writing_cont"}


def issue(level, kind, section, question=None, detail=None):
    item = {"level": level, "type": kind, "section": section}
    if question is not None:
        item["question"] = question
    if detail is not None:
        item["detail"] = detail
    return item


def audit(path: str) -> list[dict]:
    data = json.load(open(path, encoding="utf-8"))
    issues = []
    sections = data.get("sections", [])
    if not sections:
        issues.append(issue("C", "missing-sections", "exam"))
    for section in sections:
        key = section.get("key", "")
        questions = section.get("questions", [])
        if not questions:
            issues.append(issue("C", "empty-section", key))
        ids = [q.get("id") for q in questions]
        for qid, count in collections.Counter(ids).items():
            if qid is None:
                issues.append(issue("C", "missing-question-id", key))
            elif count > 1:
                issues.append(issue("C", "duplicate-question-id", key, qid, count))
        numeric_ids = [x for x in ids if isinstance(x, int)]
        if numeric_ids and numeric_ids != sorted(numeric_ids):
            issues.append(issue("B", "question-order-not-ascending", key, detail=ids))
        passage_labels = {p.get("label") for p in section.get("passages", [])}
        for q in questions:
            qid = q.get("id")
            options = q.get("options") or []
            letters = [o.get("letter") for o in options]
            if any(not str(o.get("text", "")).strip() for o in options):
                issues.append(issue("C", "empty-option-text", key, qid))
            if len(letters) != len(set(letters)):
                issues.append(issue("C", "duplicate-option-letter", key, qid))
            if options and q.get("answer") is not None and str(q.get("answer")).strip() not in {str(x).strip() for x in letters}:
                issues.append(issue("C", "answer-not-in-options", key, qid, q.get("answer")))
            if key == "reading" and q.get("passageLabel") not in passage_labels:
                issues.append(issue("C", "invalid-passage-label", key, qid, q.get("passageLabel")))
            if key == "listening" and q.get("transcript") is not None and len(str(q.get("transcript")).strip()) < 25:
                issues.append(issue("B", "short-listening-transcript", key, qid))
            answer_value = q.get("answer")
            if key in MANUAL_REVIEW_KEYS and q.get("modelAnswer"):
                answer_value = q.get("modelAnswer")
            if answer_value is None:
                if key in MANUAL_REVIEW_KEYS:
                    issues.append(issue("B", "missing-answer", key, qid))
                elif key not in WRITING_KEYS:
                    issues.append(issue("C", "missing-answer", key, qid))
            if key not in WRITING_KEYS and key not in {"seven", "cloze", "grammar"} and not str(q.get("stem", "")).strip():
                issues.append(issue("C", "empty-stem", key, qid))
            combined = " ".join(str(q.get(k, "")) for k in ("stem", "explanation", "answer"))
            if "�" in combined or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", combined):
                issues.append(issue("C", "suspicious-character", key, qid))
    return issues


if __name__ == "__main__":
    all_issues = []
    files = sorted(glob.glob(os.path.join(ROOT, "*.json")))
    for path in files:
        for found in audit(path):
            found["file"] = os.path.basename(path)
            all_issues.append(found)
    counts = collections.Counter(x["level"] for x in all_issues)
    print(f"files={len(files)} issues={len(all_issues)} levels={dict(counts)}")
    for found in all_issues:
        print(json.dumps(found, ensure_ascii=False))
