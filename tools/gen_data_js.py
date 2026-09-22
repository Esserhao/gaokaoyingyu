"""把 data/*.json 源文件生成可被 <script> 注入的 data/*.js。

用法：
    python tools/gen_data_js.py              # 生成全部（生成前先跑一致性检查）
    python tools/gen_data_js.py --no-check   # 跳过检查，只生成

为什么有这一步：file:// 双击打开时 fetch('data/*.json') 会被 CORS 拦截，
本地数据必须走 .js 注入全局变量（见 js/ui/base.js 头注与项目记忆「数据加载铁律」）。

产出（逐字节受 DOM 快照护栏约束，不得漂移）：
    data/index.js            → window.__EXAMS__
    data/exams/<id>.js       → window.__EXAMS_CACHE__[id]

不在此生成、由各自专属生成器负责（均已内置一致性检查）：
    data/knowledge/index.js  → window.__KB__（tools/build_knowledge.py，§8.6 五类检查）

一致性检查（task.md §8.6 第 3 条）：生成前必须先通过检查。本脚本对它实际生成的
数据做三类检查：index 结构 / index↔exams 交叉引用 / 各卷题组完整性。
（知识图谱旧数据 knowledge_graph.json 已随 D1 改造退役删除，相关检查一并移除。）

退出码：0 全部生成成功且检查通过；1 检查失败或生成出错。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")


def js_value(obj):
    """把任意 JSON 对象序列化成可放进单引号 JS 字符串再 JSON.parse 的形式。

    转义顺序：先反斜杠，再单引号，再把 </ 改成 <\\/ 防止提前闭合 <script>。
    （沿用 .work 旧脚本同名函数，保证产出逐字节不变。）
    """
    j = json.dumps(obj, ensure_ascii=False)
    j = j.replace('\\', '\\\\').replace("'", "\\'").replace('</', '<\\/')
    return j


def write_global(js_path, assign_expr):
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(assign_expr + "\n")


# ----------------------------------------------------------------------
# 一致性检查（task.md §8.6 第 3 条）。只检查本脚本要生成 .js 的数据：
# index 结构 / index↔exams 交叉引用 / 各卷题组完整性 / 知识图谱引用。
# 已知缺口（听力 transcript 为空、写作无参考答案）不在拦截范围，不在此重复
# tools/exam_check.py 的深度审计。
# ----------------------------------------------------------------------

INDEX_REQUIRED_KEYS = ("id", "title", "year", "totalScore", "questionCount", "quality")
# 有标准选项、答案必须是选项字母的题型
CHOICE_TYPES = ("listening", "reading", "seven", "cloze")
# 答案是文本（语法填空），或主观题（答案/范文可空），选项结构不适用
FILL_TYPES = ("grammar",)


def check_index_structure(exams):
    """index 结构：必填键齐全、id 唯一、数值字段为正整数。"""
    errs = []
    seen = set()
    for e in exams:
        eid = e.get("id", "<缺 id>")
        for k in INDEX_REQUIRED_KEYS:
            if k not in e or e[k] in ("", None):
                errs.append("[index] %s 缺少必填字段 %s" % (eid, k))
        if e.get("id") in seen:
            errs.append("[index] id 重复：%s" % e.get("id"))
        seen.add(e.get("id"))
        for k in ("totalScore", "questionCount", "year"):
            v = e.get(k)
            if v is not None and (not isinstance(v, int) or v <= 0):
                errs.append("[index] %s 的 %s 应为正整数，实际 %r" % (eid, k, v))
    return errs


def check_index_exam_crossref(exams, exam_files):
    """交叉引用：index 每个条目都有 data/exams/<id>.json，且无孤儿卷文件；
    文件 title/totalScore 与 index 一致，index 的 questionCount 与文件实际题数一致。"""
    errs = []
    by_id = {e.get("id"): e for e in exams}
    for eid, e in by_id.items():
        if eid not in exam_files:
            errs.append("[交叉引用] index 声明的 %s 缺少 data/exams/%s.json" % (eid, eid))
            continue
        obj = exam_files[eid]
        if obj.get("title") != e.get("title"):
            errs.append("[交叉引用] %s 的 title 不一致：index=%r 文件=%r"
                        % (eid, e.get("title"), obj.get("title")))
        if obj.get("totalScore") != e.get("totalScore"):
            errs.append("[交叉引用] %s 的 totalScore 不一致：index=%r 文件=%r"
                        % (eid, e.get("totalScore"), obj.get("totalScore")))
        actual = sum(len(s.get("questions", [])) for s in obj.get("sections", []))
        if e.get("questionCount") != actual:
            errs.append("[交叉引用] %s 的 questionCount 不一致：index=%r 文件实际=%d"
                        % (eid, e.get("questionCount"), actual))
        # 音频一致性（2026-09-15）：hasAudio=true 必须带 audio 字段且文件存在
        if e.get("hasAudio"):
            ap = obj.get("audio")
            if not ap:
                errs.append("[交叉引用] %s hasAudio=true 但卷子缺 audio 字段" % eid)
            elif not os.path.exists(ap):
                errs.append("[交叉引用] %s 的音频文件不存在：%s" % (eid, ap))
    for fid in exam_files:
        if fid not in by_id:
            errs.append("[交叉引用] data/exams/%s.json 未被 index.json 收录（孤儿卷）" % fid)
    return errs


def check_exam_sections(exam_files):
    """题组完整性：每卷 sections/questions 可用；选择题选项字母连续且答案落在其中；
    语法填空答案非空；客观题答案不允许为空。写作与短文改错主观题不查答案。"""
    errs = []
    for eid, obj in sorted(exam_files.items()):
        sections = obj.get("sections")
        if not sections:
            errs.append("[题组] %s 无 sections" % eid)
            continue
        qids = set()
        for s in sections:
            for q in s.get("questions", []):
                qid = q.get("id")
                if qid is None:
                    errs.append("[题组] %s 存在无 id 的题" % eid)
                    continue
                if qid in qids:
                    errs.append("[题组] %s 题号重复：%r" % (eid, qid))
                qids.add(qid)
                qtype = q.get("type")
                if not q.get("stem"):
                    errs.append("[题组] %s 第 %r 题 stem 为空" % (eid, qid))
                if qtype in CHOICE_TYPES:
                    letters = [o.get("letter") for o in q.get("options", [])]
                    expect = [chr(ord("A") + i) for i in range(len(letters))]
                    if not letters or letters != expect:
                        errs.append("[题组] %s 第 %r 题选项字母异常：%r" % (eid, qid, letters))
                    elif q.get("answer") not in letters:
                        errs.append("[题组] %s 第 %r 题答案 %r 不在选项 %s 中"
                                    % (eid, qid, q.get("answer"), "".join(letters)))
                elif qtype in FILL_TYPES and not str(q.get("answer") or "").strip():
                    errs.append("[题组] %s 第 %r 题（语法填空）答案为空" % (eid, qid))
    return errs


def load_exam_files():
    """读入全部 data/exams/*.json（解析失败即报错），返回 {id: obj}。"""
    exam_files = {}
    for path in sorted(glob.glob(os.path.join(DATA, "exams", "*.json"))):
        fid = os.path.basename(path)[:-5]
        try:
            exam_files[fid] = json.load(open(path, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001 - 校验阶段要拢住所有解析错误
            print("[题组] data/exams/%s.json 无法解析：%s" % (fid, e), file=sys.stderr)
            raise SystemExit(1)
    return exam_files


def run_checks():
    """跑一致性检查。返回 (passed, messages)。"""
    msgs = []
    p = os.path.join(DATA, "index.json")
    if not os.path.exists(p):
        msgs.append("[index] 缺少必需源文件：data/index.json")
        return False, msgs

    idx = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    exam_files = load_exam_files()

    msgs.extend(check_index_structure(idx))
    msgs.extend(check_index_exam_crossref(idx, exam_files))
    msgs.extend(check_exam_sections(exam_files))
    return (len(msgs) == 0, msgs)


# ----------------------------------------------------------------------
# 生成
# ----------------------------------------------------------------------

def generate():
    """生成 index.js / exams/*.js，返回每类计数。"""
    stats = {}

    # 1) index.json -> window.__EXAMS__
    #    hasListening 由卷子 JSON 的 sections 派生（index.json 不手填，防漂移）：
    #    2026-09-15 起，无 listening section 的卷在卷行/做题页标「未收录听力部分」。
    idx = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    listen_map = {}
    for path in glob.glob(os.path.join(DATA, "exams", "*.json")):
        base = os.path.basename(path)[:-5]
        obj = json.load(open(path, encoding="utf-8"))
        listen_map[base] = any(
            s.get("key") == "listening" for s in obj.get("sections", []))
    idx_out = []
    for e in (idx if isinstance(idx, list) else idx.get("exams", [])):
        e = dict(e)
        e["hasListening"] = listen_map.get(e.get("id"), False)
        idx_out.append(e)
    write_global(os.path.join(DATA, "index.js"),
                 "window.__EXAMS__ = JSON.parse('%s');" % js_value(idx_out))
    stats["index.js"] = len(idx_out)

    # 2) exams/*.json -> window.__EXAMS_CACHE__[id]
    exams_dir = os.path.join(DATA, "exams")
    count = 0
    for path in sorted(glob.glob(os.path.join(exams_dir, "*.json"))):
        base = os.path.basename(path)[:-5]  # 去掉 .json
        obj = json.load(open(path, encoding="utf-8"))
        assign = ("window.__EXAMS_CACHE__ = window.__EXAMS_CACHE__ || {};\n"
                  "window.__EXAMS_CACHE__[\"%s\"] = JSON.parse('%s');"
                  % (base, js_value(obj)))
        write_global(os.path.join(exams_dir, base + ".js"), assign)
        count += 1
    stats["exams/*.js"] = count

    return stats


def main():
    ap = argparse.ArgumentParser(description="把 data/*.json 生成可注入的 data/*.js")
    ap.add_argument("--no-check", action="store_true", help="跳过一致性检查，只生成")
    args = ap.parse_args()

    if not args.no_check:
        ok, msgs = run_checks()
        if not ok:
            print("一致性检查未通过：", file=sys.stderr)
            for m in msgs:
                print("  " + m, file=sys.stderr)
            sys.exit(1)

    try:
        stats = generate()
    except Exception as e:  # noqa: BLE001 - 顶层兜住生成阶段任何异常
        print("生成失败：%s" % e, file=sys.stderr)
        sys.exit(1)

    for k, v in stats.items():
        print("%-20s -> %s" % (k, v))
    print("DONE")


if __name__ == "__main__":
    main()
