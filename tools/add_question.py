#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
add_question.py —— 节点级题池的人工录题入口（task.md §8.8 A7）

把一道新题追加进 tools/kb_questions_custom.py（build_knowledge.py 的
QUESTION_BATCHES 已预留该批次名，录完重跑 build 即生成页面用 questions.js）。

强制项（缺一不收）：
  --node     必须是 data/knowledge/index.js 里存在的节点 id；
  --variant  子维度标签（同一节点建议沿用已有变体名，判级按变体统计）；
  --kind     choice（四选一）或 fill（填空）；
  --stem     题干（空格统一写 ______）；
  --answer   choice 用字母 A-D；fill 用标准答案（小写英文，唯一合理）；
  --source   来源说明，拒绝空串/「无」（可追溯是硬要求）；
可选：--options（choice 必填，逗号分隔 4 项，自动补 "A. " 前缀）、
      --explain、--verified（人工复核过才传 --verified true）。

用法示例：
  python tools/add_question.py --node 定语从句 --variant 关系代词 --kind choice \
    --stem "This is the museum ______ we visited last year." \
    --options "which,where,when,what" --answer A \
    --explain "先行词作 visited 的宾语，用关系代词 which。" \
    --source "人工录入（常安，2026-08-31）" --verified true
  python tools/build_knowledge.py   # 重新生成 questions.js

纯人工复核的既有题目想改 verified：直接编辑批次文件里对应条目的
"verified" 字段（False → True），本工具不负责回改。
"""
import argparse
import ast
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_INDEX = os.path.join(ROOT, "data", "knowledge", "index.js")
CUSTOM = os.path.join(ROOT, "tools", "kb_questions_custom.py")


def kb_node_ids():
    """从生成的 index.js 里取全部节点 id（唯一事实源的产物）。"""
    text = open(KB_INDEX, encoding="utf-8").read()
    return set(re.findall(r'"id":\s*"([^"]+)"', text))


def load_custom_questions():
    if not os.path.exists(CUSTOM):
        return []
    tree = ast.parse(open(CUSTOM, encoding="utf-8").read())
    ns = {}
    exec(compile(tree, CUSTOM, "exec"), ns)
    return list(ns.get("QUESTIONS", []))


def dump_custom(questions):
    """用 json.dumps 生成 AST 安全的字面量（中文转 \\uXXXX，避免编码坑）。
    注意这是要给 Python import 的：JSON 的 false/true/null 必须转成
    Python 的 False/True/None，否则重跑 build 时 NameError。"""
    body = json.dumps(questions, ensure_ascii=True, indent=2)
    body = re.sub(r': false\b', ': False', body)
    body = re.sub(r': true\b', ': True', body)
    body = re.sub(r': null\b', ': None', body)
    header = (
        "# -*- coding: utf-8 -*-\n"
        "# 节点级题池 · 人工录入批次（tools/add_question.py 维护，勿手改结构）。\n"
        "# 本文件由 add_question.py 整体重写；想改某题的 verified，直接改字段后重跑 build。\n"
        "QUESTIONS = "
    )
    with open(CUSTOM, "w", encoding="utf-8") as f:
        f.write(header + body + "\n")


def validate(args, node_ids):
    errs = []
    if args.node not in node_ids:
        errs.append("--node 不是有效节点 id：%r（对照 data/knowledge/index.js）" % args.node)
    if not args.variant.strip():
        errs.append("--variant 不能为空（判级按变体统计）")
    if args.kind not in ("choice", "fill"):
        errs.append("--kind 只能是 choice 或 fill")
    if "______" not in args.stem and args.kind == "fill":
        errs.append('fill 题干应包含空格标记 ______')
    if args.kind == "choice":
        opts = [o.strip() for o in args.options.split(",")] if args.options else []
        if len(opts) != 4:
            errs.append("choice 需要 4 个选项（逗号分隔），实得 %d" % len(opts))
        if args.answer not in ("A", "B", "C", "D"):
            errs.append("choice 答案须为大写字母 A-D")
    else:
        if args.options:
            errs.append("fill 题不应给 --options")
        if not args.answer.strip() or args.answer.strip() != args.answer.strip().lower():
            errs.append("fill 答案应为小写英文（机器比对用）")
    if not args.answer.strip():
        errs.append("--answer 不能为空")
    if not args.stem.strip():
        errs.append("--stem 不能为空")
    if not args.source.strip() or args.source.strip() in ("无", "-", "N/A"):
        errs.append("--source 必填且要有可追溯性（谁、何时、取材哪里）")
    return errs, ([o.strip() for o in args.options.split(",")] if args.kind == "choice" else [])


def main():
    ap = argparse.ArgumentParser(description="节点级题池录题（A7）")
    ap.add_argument("--node", required=True)
    ap.add_argument("--variant", required=True)
    ap.add_argument("--kind", required=True, choices=["choice", "fill"])
    ap.add_argument("--stem", required=True)
    ap.add_argument("--options", default="")
    ap.add_argument("--answer", required=True)
    ap.add_argument("--explain", default="")
    ap.add_argument("--source", required=True)
    ap.add_argument("--verified", default="false", choices=["true", "false"])
    args = ap.parse_args()

    node_ids = kb_node_ids()
    errs, opts = validate(args, node_ids)
    if errs:
        print("校验未通过，未写入：")
        for e in errs:
            print("  ✗ " + e)
        raise SystemExit(1)

    letter = {"A": 0, "B": 1, "C": 2, "D": 3}
    if args.kind == "choice":
        # 用户给的选项可能已带 "A. " 前缀，统一剥掉再按位重编
        cleaned = [re.sub(r"^[A-D][.、] ?", "", o) for o in opts]
        options = ["%s. %s" % (l, t) for l, t in zip("ABCD", cleaned)]
    else:
        options = []

    q = {
        "node": args.node,
        "variant": args.variant.strip(),
        "kind": args.kind,
        "stem": args.stem.strip(),
        "options": options,
        "answer": args.answer.strip(),
        "explain": args.explain.strip(),
        "source": args.source.strip(),
        "verified": args.verified == "true",
    }

    questions = load_custom_questions()
    dup = next((x for x in questions if x.get("stem") == q["stem"] and x.get("node") == q["node"]), None)
    if dup:
        print("✗ 同节点同题干已存在（%s：%s…），未写入。" % (dup["node"], dup["stem"][:24]))
        raise SystemExit(1)

    questions.append(q)
    dump_custom(questions)
    print("✓ 已录入：%s / %s / %s（verified=%s）" % (
        q["node"], q["variant"], q["kind"], "true" if q["verified"] else "false"))
    print("  当前 custom 批次共 %d 题" % len(questions))
    print("下一步：python tools/build_knowledge.py 重新生成 questions.js")


if __name__ == "__main__":
    main()
