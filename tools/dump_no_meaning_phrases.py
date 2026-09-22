#!/usr/bin/env python3
"""
导出被清洗剔除的「无释义」词组条目为独立 Markdown 文件。
复用 convert_phrases.py 的提取逻辑 + clean_phrases.py 的清洗逻辑，
筛出「清洗后无释义」的条目（与清洗当次的剔除集合一致），生成
data/vocab/phrases-no-meaning.md 备查（不参与网站加载）。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert_phrases import extract_phrases  # noqa: E402
from clean_phrases import clean_meaning  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "vocab", "phrases-no-meaning.md")


def main():
    phrases = extract_phrases()          # 与清洗前同一份 5,028 条合并去重结果
    dropped = []
    for p in phrases.values():
        cleaned = clean_meaning(p.get("m", ""))
        if not cleaned.strip():
            dropped.append(p)
    dropped.sort(key=lambda x: x["w"].lower())

    # 按来源文件分组
    by_src = {}
    for p in dropped:
        by_src.setdefault((p.get("source", "未知"), p.get("level", "")), []).append(p)

    lines = []
    lines.append("# 词组数据 · 无释义条目备查")
    lines.append("")
    lines.append(f"> 共 **{len(dropped)}** 条。这些词组在 2026-08-31 的词组清洗")
    lines.append("（`tools/clean_phrases.py`）中被剔除，未录入网站词库与星图。")
    lines.append("剔除口径：清洗后中文释义为空 —— 或源数据本就没有释义（「无」/空），")
    lines.append("或释义整段是语料例句噪音（以「我/你/他…」开头的完整句），被判定不可信。")
    lines.append("本文件只作人工复查与后续补释义的底稿，不参与 `gaokao-phrases.js` 加载。")
    lines.append("")

    for (src, level) in sorted(by_src):
        items = by_src[(src, level)]
        lines.append(f"## {src}（{level}，{len(items)} 条）")
        lines.append("")
        lines.append("| 词组 | 源数据释义 |")
        lines.append("| --- | --- |")
        for p in items:
            raw = p.get("m", "").replace("|", "\\|").replace("\n", " ")
            note = "　※噪音已清" if raw.strip() else ""
            lines.append(f"| {p['w']} | {raw if raw.strip() else '（无）'}{note} |")
        lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"导出 {len(dropped)} 条 -> {OUT}")
    for (src, level), items in sorted(by_src.items()):
        print(f"  {src}（{level}）: {len(items)}")


if __name__ == "__main__":
    main()
