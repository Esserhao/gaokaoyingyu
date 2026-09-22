"""词库数据盘点（C2：固化统计口径）。

用法：
    python tools/dict_survey.py            # 输出盘点报告
    python tools/dict_survey.py --strict   # 一致性检查不过时退出码 1

为什么用 node 取值（铁律，勿改回 python 正则解码）：
    data/vocab/ 的 js 文件是「<script> 注入全局变量」格式：
      词书   window.__VOCAB_CACHE__['<id>'] = [ …字面量数组… ]
      词典   window.__DICT_CACHE__['<字母>'] = JSON.parse('…带转义…')
    python 手工解码 JSON.parse 字符串会在 \\uXXXX / \\' / <\\/ 上反复踩坑；
    node 直接 eval 后 window 上拿到的就是真对象，一次到位。

统计口径（此前散落在 G1 等探针里的临时算法，自此以此脚本为准）：
  · 词形键   w.lower().strip().rstrip('.')——小写、去首尾空白、去尾点。
  · 释义有效 m 非空且 m != '无'（词书里存在字面「无」的占位释义，算无释义）。
  · 多词条目 词形含空格（词组）。
  · 去重     同一词书内按词形键去重计数（unique），重复条目单独报告。
  · 覆盖     词书词形键在通用词典（dict/ 分片）中的命中率。
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
VOCAB = os.path.join(ROOT, "data", "vocab")

# 参与盘点的书 = index.js books 清单（含词组书），文件排除项为索引/关系表本身
EXCLUDE_FILES = {"index.js", "synonyms.js", "affixes.js", "dict.js"}

NODE_SCRIPT = r"""
const fs = require('fs');
global.window = {};
// 注意：node -e 模式下 process.argv 没有脚本名占位（argv[0]=node 本体），
// 所以从 slice(1) 取文件参数——写成 slice(2) 会静默丢掉第一个文件。
for (const f of process.argv.slice(1)) {
  eval(fs.readFileSync(f, 'utf8'));
}
const w = global.window;
const bit = (e) =>
  ((e.m && e.m !== '无') ? 1 : 0) | (e.ph ? 2 : 0) | (e.ex ? 4 : 0) | (e.exCn ? 8 : 0);
const out = { meta: null, books: {}, dict: {}, syn: null, affix: null };
if (w.__VOCAB__ && w.__VOCAB__.books) {
  out.meta = w.__VOCAB__.books.map(b => ({ id: b.id, name: b.name, level: b.level, total: b.total, file: b.file }));
}
for (const [id, arr] of Object.entries(w.__VOCAB_CACHE__ || {})) {
  out.books[id] = arr.map(e => [String(e.w || ''), bit(e), String(e.m || '')]);
}
for (const [k, arr] of Object.entries(w.__DICT_CACHE__ || {})) {
  for (const e of arr) {
    (out.dict[k] = out.dict[k] || []).push([String(e.w || ''), (e.m && e.m !== '无') ? 1 : 0]);
  }
}
if (w.__SYN__) out.syn = w.__SYN__.groups.map(g => g.type);
if (w.__AFFIX__) out.affix = { pre: w.__AFFIX__.prefixes.length, suf: w.__AFFIX__.suffixes.length };
console.log(JSON.stringify(out));
"""


def load_data() -> dict:
    book_files = sorted(
        os.path.join(VOCAB, f) for f in os.listdir(VOCAB)
        if f.endswith(".js") and f not in EXCLUDE_FILES
    )
    dict_files = sorted(
        os.path.join(VOCAB, "dict", f) for f in os.listdir(os.path.join(VOCAB, "dict"))
        if f.endswith(".js")
    )
    side = [os.path.join(VOCAB, "index.js"), os.path.join(VOCAB, "synonyms.js"), os.path.join(VOCAB, "affixes.js")]
    argv = [node_bin(), "-e", NODE_SCRIPT] + side + book_files + dict_files
    res = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if res.returncode != 0:
        sys.exit(f"node 取值失败：\n{res.stderr}")
    return json.loads(res.stdout)


def node_bin() -> str:
    """优先用受管 node（与项目护栏一致），找不到再退系统 node。"""
    managed = os.path.expandvars(r"C:\Users\ASUS\.workbuddy\binaries\node\versions\22.22.2-2\node.exe")
    if os.path.isfile(managed):
        return managed
    return "node"


def key(w: str) -> str:
    return w.lower().strip().rstrip(".")


def book_stats(entries: list) -> dict:
    keys = [key(w) for w, _, _ in entries]
    seen: dict[str, list[str]] = {}
    for k, (_w, _f, m) in zip(keys, entries):
        seen.setdefault(k, []).append(m.strip())
    # 重复口径：同词形且释义相同 = 跨来源重复（无害）；释义不同 = 冲突（需人工裁决）
    dup_keys = {k: ms for k, ms in seen.items() if len(ms) > 1}
    conflict_keys = {
        k: ms for k, ms in dup_keys.items()
        if len({re.sub(r"\s+", "", m) for m in ms}) > 1
    }
    return {
        "entries": len(entries),
        "unique": len(seen),
        "dup": len(keys) - len(seen),
        "no_m": sum(1 for _, f, _ in entries if not f & 1),
        "ph": sum(1 for _, f, _ in entries if f & 2),
        "ex": sum(1 for _, f, _ in entries if f & 4),
        "excn": sum(1 for _, f, _ in entries if f & 8),
        "multi": sum(1 for k in keys if " " in k),
        "dup_keys": dup_keys,
        "conflict_keys": conflict_keys,
    }


def no_meaning_md() -> list[str]:
    """底稿剩余词形（排除表头与 | --- | 分隔行），并减去已进词组书的。"""
    path = os.path.join(VOCAB, "phrases-no-meaning.md")
    rows = []
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        m = re.match(r"^\| (.+?) \|", s)
        if not m or m.group(1) == "词组" or set(m.group(1)) <= {"-", " "}:
            continue
        rows.append(m.group(1))
    return rows


def main() -> None:
    strict = "--strict" in sys.argv
    data = load_data()
    problems: list[str] = []

    print("=" * 62)
    print("词库数据盘点（tools/dict_survey.py）")
    print("=" * 62)

    # —— 词书 ——
    print(f"\n【词书】index.js 声明 {len(data['meta'])} 本")
    total_entries = 0
    book_keys = set()
    for b in data["meta"]:
        st = book_stats(data["books"].get(b["id"], []))
        total_entries += st["entries"]
        book_keys.update(
            k for k in (key(w) for w, _, _ in data["books"].get(b["id"], []))
            if " " not in k
        )
        mark = "" if st["entries"] == b["total"] else f"  ⚠ index total={b['total']} 不符"
        if st["entries"] != b["total"]:
            problems.append(f"{b['id']}: index.js total={b['total']} 实际 {st['entries']}")
        fpath = os.path.join(VOCAB, b["file"] or f"{b['id']}.js")
        if not os.path.isfile(fpath):
            problems.append(f"{b['id']}: file 字段指向缺失文件 {b['file']}")
            mark += "  ⚠ 文件缺失"
        print(f"  {b['id']:<20} {st['entries']:>6} 条（去重 {st['unique']}，重复 {st['dup']}）"
              f"  无释义 {st['no_m']}  例句 {st['ex']}  音标 {st['ph']}{mark}")
        if st["conflict_keys"]:
            problems.append(
                f"{b['id']}: 同词形但释义冲突 {len(st['conflict_keys'])} 个，需人工裁决，"
                f"如 {list(st['conflict_keys'])[:5]}"
            )
        if st["dup_keys"]:
            benign = len(st["dup_keys"]) - len(st["conflict_keys"])
            if benign:
                problems.append(
                    f"{b['id']}: 跨来源同义重复 {benign} 个词形（无害，"
                    f"如 {list(st['dup_keys'])[:5]}）"
                )
    print(f"  合计 {total_entries} 条；去词组后的单词词形 {len(book_keys)} 个")

    # —— 通用词典 ——
    d_entries = [e for arr in data["dict"].values() for e in arr]
    d_keys = {key(w) for w, _ in d_entries}
    d_no_m = sum(1 for _, f in d_entries if not f & 1)
    d_multi = sum(1 for w, _ in d_entries if " " in key(w))
    print(f"\n【通用词典】dict/ 共 {len(data['dict'])} 分片，{len(d_entries)} 条"
          f"（去重 {len(d_keys)}）")
    print(f"  无释义 {d_no_m}；多词条目（词组）{d_multi}；"
          f"词书单词覆盖率 {sum(1 for k in book_keys if k in d_keys)}/{len(book_keys)}"
          f" = {sum(1 for k in book_keys if k in d_keys) / max(len(book_keys), 1):.1%}")

    # —— 词组 ——
    ph = data["books"].get("gaokao-phrases", [])
    ph_st = book_stats(ph)
    md_left = no_meaning_md()
    ph_keys = {key(w) for w, _, _ in ph}
    md_stale = [w for w in md_left if key(w) in ph_keys]
    print(f"\n【词组】gaokao-phrases {ph_st['entries']} 条（无释义 {ph_st['no_m']}，"
          f"应≈0）；无释义词组底稿剩 {len(md_left)} 条待人工补录"
          + (f"（其中 {len(md_stale)} 条词形已在词组书，属陈旧行，导入工具会拒绝）"
             if md_stale else "（无陈旧行）"))

    # —— 关系表 ——
    syn: dict[str, int] = {}
    for t in data["syn"] or []:
        syn[t] = syn.get(t, 0) + 1
    print(f"\n【关系表】synonyms {sum(syn.values())} 组"
          f"（" + " / ".join(f"{k} {v}" for k, v in sorted(syn.items())) + "）；"
          f"affixes 前缀 {data['affix']['pre']} + 后缀 {data['affix']['suf']}")

    # —— 结论 ——
    print()
    if problems:
        print(f"一致性检查：{len(problems)} 项待处理")
        for p in problems:
            print(f"  ⚠ {p}")
        if strict:
            sys.exit(1)
    else:
        print("一致性检查：全部通过 ✅")


if __name__ == "__main__":
    main()
