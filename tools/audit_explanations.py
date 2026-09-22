"""逐题解析覆盖审计（交流纪要 2026-09-05 附录 F2）。

用法：
    python tools/audit_explanations.py            # 全库审计，打印报告
    python tools/audit_explanations.py --json     # 追加输出 JSON（供程序消费）

为什么有这一步：解析是本站「核对答案，更要看懂解析」体验的根基，但
「哪些题还没有解析」一直没有账可查。本工具给出一份数字明确的缺口清单，
供人工补录排期（结论回写 人工待办清单.md）。

判定口径（与 exam-page.js 的渲染口径一致——页面会显示什么，审计就查什么）：
    客观节（listening/reading/seven/cloze/grammar）：
        explanation 缺失 = 无该字段，或为空串/空对象，
        或结构化对象里 summary/question/evidence/answer/points 全空。
    proofreading（短文改错）：explanation.points 为空数组/缺失 = 缺失
        （逐处解析是这题解析的本体）。
    writing_app / writing_cont（写作与读后续写）：不要求 explanation，
        但必须有 modelAnswer（参考范文），缺失计入缺口。
    listening 题目若有音频缺失问题不在此审计（见 人工待办清单 第五节）。

退出码：0 全库无缺口；1 有缺口（便于 CI/护栏调用）。
"""
from __future__ import annotations

import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMS_DIR = os.path.join(ROOT, "data", "exams")

OBJ_SECTIONS = ("listening", "reading", "seven", "cloze", "grammar")

STRUCT_KEYS = ("summary", "question", "evidence", "answer", "points")


def explanation_missing(q: dict) -> bool:
    ex = q.get("explanation")
    if ex is None:
        return True
    if isinstance(ex, str):
        return not ex.strip()
    if isinstance(ex, dict):
        if not any(str(ex.get(k) or "").strip() for k in STRUCT_KEYS
                   if k != "points"):
            pts = ex.get("points")
            if not pts:
                return True
        return False
    return False


def audit():
    out = []
    total_missing = 0
    total_q = 0
    for path in sorted(glob.glob(os.path.join(EXAMS_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            exam = json.load(f)
        eid = exam["id"]
        rows = []
        for s in exam.get("sections", []):
            key = s.get("key", "")
            for q in s.get("questions", []):
                total_q += 1
                if key == "proofreading":
                    pts = (q.get("explanation") or {}).get("points")
                    bad = not pts
                elif key.startswith("writing"):
                    bad = not str(q.get("modelAnswer") or "").strip()
                elif key in OBJ_SECTIONS:
                    bad = explanation_missing(q)
                else:
                    bad = False
                if bad:
                    total_missing += 1
                    rows.append(f"{key}-{q.get('id')}")
        if rows:
            out.append((eid, rows))
    return out, total_missing, total_q


def main() -> int:
    as_json = "--json" in sys.argv
    gaps, total_missing, total_q = audit()
    print(f"逐题解析覆盖审计：共 {total_q} 题，缺 {total_missing} 题"
          f"（覆盖率 {round((total_q - total_missing) / total_q * 100, 1) if total_q else 100}%）")
    for eid, rows in gaps:
        print(f"  {eid}: {len(rows)} 缺 → {', '.join(rows[:12])}"
              + (" …" if len(rows) > 12 else ""))
    if not gaps:
        print("  全库解析齐全。")
    if as_json:
        print(json.dumps({eid: rows for eid, rows in gaps},
                         ensure_ascii=False))
    return 1 if total_missing else 0


if __name__ == "__main__":
    sys.exit(main())
