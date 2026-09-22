"""单套试卷录入后的一站式校验与自动修复。

用法：
    python tools/exam_check.py gk2021-xgk1            # 只校验（可省略 .json）
    python tools/exam_check.py gk2021-xgk1 --fix      # 校验并自动修复可安全修复项
    python tools/exam_check.py --all                  # 校验全部试卷

替代了早期分散的三个脚本（.work/verify_exam.py + score_check.js +
fix_seven_options.py），不再依赖 Node。与 tools/quality_audit.py 的分工：
quality_audit 做全库静态体检，本脚本做单套录入后的结构 + 判分 + 泄漏三重校验。

退出码：0 全部通过；1 存在 FAIL。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "exams"))
INDEX = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "index.json"))

# 主观题 section：不参与客观判分，靠 modelAnswer + 人工评分
MANUAL_KEYS = {"proofreading", "writing_app", "writing_cont"}
# 无题干正文的填空型 section：stem 是"第N空"占位符，不做空题干检查
BLANK_KEYS = {"seven", "cloze", "grammar"}


class Report:
    def __init__(self, name: str):
        self.name = name
        self.lines: list[tuple[str, str]] = []

    def ok(self, msg: str) -> None:
        self.lines.append(("OK", msg))

    def warn(self, msg: str) -> None:
        self.lines.append(("WARN", msg))

    def fail(self, msg: str) -> None:
        self.lines.append(("FAIL", msg))

    @property
    def failed(self) -> bool:
        return any(level == "FAIL" for level, _ in self.lines)

    def dump(self) -> None:
        print(f"== {self.name}")
        for level, msg in self.lines:
            mark = {"OK": "  ok  ", "WARN": " warn ", "FAIL": " FAIL "}[level]
            print(f"{mark}{msg}")


def norm(value) -> str:
    return str(value if value is not None else "").strip().lower()


def check_structure(exam: dict, rep: Report) -> None:
    """题号连续性、passageLabel 有效性、答案存在性、选项自洽性。"""
    ids: list[int] = []
    total_score = 0.0
    for sec in exam.get("sections", []):
        key = sec.get("key", "?")
        questions = sec.get("questions", [])
        if not questions:
            rep.fail(f"{key}: section 无题目")
            continue
        labels = {p.get("label") for p in sec.get("passages", [])}
        pool_letters = {o.get("letter") for o in sec.get("pool", [])}
        for q in questions:
            qid = q.get("id")
            ids.append(qid)
            total_score += float(q.get("score") or 0)

            if q.get("passageLabel") and q["passageLabel"] not in labels:
                rep.fail(f"{key} q{qid}: passageLabel={q['passageLabel']} 在 passages 中不存在")

            has_answer = q.get("answer") is not None or q.get("modelAnswer")
            if not has_answer:
                rep.fail(f"{key} q{qid}: 既无 answer 也无 modelAnswer")

            options = q.get("options") or []
            letters = [o.get("letter") for o in options]
            if len(letters) != len(set(letters)):
                rep.fail(f"{key} q{qid}: 选项字母重复")
            if any(not str(o.get("text", "")).strip() for o in options):
                rep.fail(f"{key} q{qid}: 存在空选项文本")
            if options and q.get("answer") is not None and q["answer"] not in letters:
                rep.fail(f"{key} q{qid}: answer={q['answer']} 不在选项 {letters} 中")

            if key == "seven" and pool_letters and q.get("answer") not in pool_letters:
                rep.fail(f"{key} q{qid}: answer={q.get('answer')} 不在 pool {sorted(pool_letters)} 中")

            if key not in BLANK_KEYS and key not in MANUAL_KEYS and not str(q.get("stem", "")).strip():
                rep.fail(f"{key} q{qid}: 题干为空")

            if key == "listening":
                # 每个听力材料组只需首题带 transcript，但带了就不能是残片
                tr = q.get("transcript")
                if tr is not None and len(str(tr).strip()) < 25:
                    rep.warn(f"{key} q{qid}: transcript 过短（{len(str(tr).strip())} 字符），疑似截断")

    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        rep.fail(f"题号重复：{dup}")
    expected = list(range(1, len(ids) + 1))
    if ids == expected:
        rep.ok(f"题号 1–{len(ids)} 连续无重复")
    elif not dup:
        rep.fail(f"题号不连续：实际首尾 {ids[:3]}…{ids[-3:]}，应为 1–{len(ids)}")

    declared = exam.get("totalScore")
    if declared is not None and abs(total_score - float(declared)) > 1e-6:
        rep.fail(f"各题分值合计 {total_score} ≠ totalScore {declared}")
    else:
        rep.ok(f"分值合计 {total_score} == totalScore {declared}")


def check_scoring(exam: dict, rep: Report) -> None:
    """复刻 js/exam.js 的 score()，用标准答案模拟满分作答。

    exam.js 判分：answer==null 记为人工判分；否则大小写与首尾空格无关地比较。
    """
    answers: dict[str, str] = {}
    manual_score = 0.0
    manual_detail: list[str] = []
    for sec in exam["sections"]:
        manual_in_sec = 0
        for q in sec["questions"]:
            if q.get("answer") is not None:
                answers[f"{sec['key']}-{q['id']}"] = q["answer"]
            else:
                manual_score += float(q.get("score") or 0)
                manual_in_sec += 1
        if manual_in_sec:
            manual_detail.append(f"{sec['key']}×{manual_in_sec}")

    got = 0.0
    correct = 0
    for sec in exam["sections"]:
        for q in sec["questions"]:
            if q.get("answer") is None:
                continue
            if norm(answers.get(f"{sec['key']}-{q['id']}")) == norm(q["answer"]):
                correct += 1
                got += float(q.get("score") or 1)

    objective_max = float(exam["totalScore"]) - manual_score
    if abs(got - objective_max) < 1e-6:
        rep.ok(f"客观题满分模拟 {got:g}/{objective_max:g}（{correct} 题全对）")
    else:
        rep.fail(f"客观题满分模拟 {got:g} ≠ 客观满分 {objective_max:g}（判分链路对不上）")
    rep.ok(f"主观题人工判分 {', '.join(manual_detail) or '无'} 共 {manual_score:g} 分")


def check_leaks(exam: dict, rep: Report) -> None:
    """答案泄漏检查：这是本项目最严重的历史缺陷。

    年份目录的旧数据把【答案】【解析】整段塞进 material/passage，练习模式下
    学生直接看到答案。凡 passage/stem/material 里出现解析标记即判 FAIL。
    """
    markers = ("【答案】", "[答案]", "【解析】", "[解析]", "【详解】", "题详解", "故选")
    for sec in exam["sections"]:
        for p in sec.get("passages", []):
            hit = [m for m in markers if m in str(p.get("text", ""))]
            if hit:
                rep.fail(f"{sec['key']} passage {p.get('label')}: 正文含解析标记 {hit}（答案泄漏）")
        for q in sec["questions"]:
            for field in ("stem", "material"):
                hit = [m for m in markers if m in str(q.get(field, ""))]
                if hit:
                    rep.fail(f"{sec['key']} q{q['id']}: {field} 含解析标记 {hit}（答案泄漏）")
    if not any(level == "FAIL" for level, m in rep.lines if "泄漏" in m):
        rep.ok("无答案泄漏（passage/stem/material 干净）")


def check_render(exam: dict, rep: Report, fix: bool) -> bool:
    """前端渲染前置条件。返回是否发生了修改。

    js/render.js question() 与 js/topic.js renderSeven() 只读 q.options，
    不读 section.pool。七选五若只在 section 级放 pool，会退化成填空输入框。
    """
    changed = False
    for sec in exam["sections"]:
        if sec.get("key") != "seven":
            continue
        pool = sec.get("pool") or []
        missing = [q["id"] for q in sec["questions"] if not (q.get("options") or [])]
        if not missing:
            rep.ok("七选五每题均带 options（渲染正常）")
            continue
        if fix and pool:
            for q in sec["questions"]:
                if not (q.get("options") or []):
                    q["options"] = [dict(o) for o in pool]
            changed = True
            rep.ok(f"七选五已自动补 options：{missing}（源自 section.pool）")
        elif pool:
            rep.fail(f"七选五 q{missing} 缺 options，会被渲染成填空框（--fix 可自动补）")
        else:
            rep.fail(f"七选五 q{missing} 缺 options 且 section.pool 为空，需手工补齐")
    return changed


def check_index(exam: dict, rep: Report) -> None:
    """index.json 与试卷本体的一致性。"""
    if not os.path.exists(INDEX):
        rep.warn("data/index.json 不存在，跳过索引一致性检查")
        return
    entries = json.load(open(INDEX, encoding="utf-8"))
    hits = [e for e in entries if e.get("id") == exam.get("id")]
    if not hits:
        rep.fail(f"index.json 中没有 id={exam.get('id')} 的条目")
        return
    if len(hits) > 1:
        rep.fail(f"index.json 中 id={exam.get('id')} 有 {len(hits)} 个重复条目")
    entry = hits[0]
    actual = sum(len(s["questions"]) for s in exam["sections"])
    if entry.get("questionCount") != actual:
        rep.fail(f"index.questionCount={entry.get('questionCount')} ≠ 实际题数 {actual}")
    else:
        rep.ok(f"index.questionCount={actual} 一致")
    if entry.get("totalScore") != exam.get("totalScore"):
        rep.fail(f"index.totalScore={entry.get('totalScore')} ≠ {exam.get('totalScore')}")
    expect_file = f"exams/{exam['id']}.json"
    if entry.get("file") != expect_file:
        rep.warn(f"index.file={entry.get('file')}，预期 {expect_file}")
    if exam.get("hasAudio") and entry.get("hasAudio") is not True:
        rep.warn("试卷标记 hasAudio 但 index 未标记")
    audio = exam.get("audio")
    if isinstance(audio, dict):
        # 旧数据把 audio 写成对象（如 {"src": ...} / 分段映射），取其中的字符串路径
        audio = next((v for v in audio.values() if isinstance(v, str) and v.strip()), None)
    if isinstance(audio, str) and audio.strip():
        path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", audio))
        if not os.path.exists(path):
            rep.fail(f"音频文件不存在：{audio}")
        else:
            rep.ok(f"音频文件存在：{audio}")


def run(name: str, fix: bool) -> bool:
    path = os.path.join(ROOT, name if name.endswith(".json") else name + ".json")
    if not os.path.exists(path):
        print(f"== {name}\n FAIL 文件不存在：{path}")
        return False
    exam = json.load(open(path, encoding="utf-8"))
    rep = Report(f"{os.path.basename(path)}  {exam.get('title', '')}")

    counts = " / ".join(f"{s['key']}:{len(s['questions'])}" for s in exam.get("sections", []))
    rep.ok(f"section 构成 {counts}")

    check_structure(exam, rep)
    check_scoring(exam, rep)
    check_leaks(exam, rep)
    changed = check_render(exam, rep, fix)
    check_index(exam, rep)

    if changed:
        json.dump(exam, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        rep.ok("已写回修复结果")

    rep.dump()
    return not rep.failed


def main() -> int:
    ap = argparse.ArgumentParser(description="单套试卷录入后的校验与自动修复")
    ap.add_argument("names", nargs="*", help="试卷 id，如 gk2021-xgk1")
    ap.add_argument("--all", action="store_true", help="校验 data/exams 下全部试卷")
    ap.add_argument("--fix", action="store_true", help="自动修复可安全修复项（目前：七选五 options）")
    args = ap.parse_args()

    names = args.names
    if args.all:
        names = [os.path.basename(p) for p in sorted(glob.glob(os.path.join(ROOT, "*.json")))]
    if not names:
        ap.print_help()
        return 2

    results = [run(n, args.fix) for n in names]
    passed = sum(results)
    print(f"\n合计 {len(results)} 套：通过 {passed}，失败 {len(results) - passed}")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
