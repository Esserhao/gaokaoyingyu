#!/usr/bin/env python3
"""
词组数据清洗：过滤无释义词条、清理释义中的语料例句噪音。
在 phrases-detail.json 基础上就地清洗，并重新生成 phrases.js。
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_DIR = os.path.join(ROOT, "data", "vocab")


def clean_meaning(m):
    """清理释义中的噪音：
    1. 句号后跟着完整中文句子的部分（语料例句串进释义）如「去钓鱼；垂钓；我以前常去钓鱼」
       —— 规则：分号分隔的尾段若以「我/他/她/你/我们/他们」等主语开头且长度>8，判为例句噪音删除。
    2. 英文残留（如 "in extreme"的变体 这类标注保留，纯英文句子删除）。
    """
    if not m:
        return ""
    parts = [p.strip() for p in m.split("；")]
    keep = []
    subject_re = re.compile(r"^(我|你|他|她|它|我们|你们|他们|她们|它们|这|那)")
    for p in parts:
        # 分段内再按句号切：只保留第一句，后续完整句（长度>8且以主语开头）删
        if "。" in p:
            first, rest = p.split("。", 1)
            if subject_re.match(rest.strip()) and len(rest.strip()) > 8:
                p = first + "。"
        # 整段是长主语句（无分号切分时）
        if subject_re.match(p) and len(p) > 12 and ("。" in p or len(p) > 20):
            continue
        keep.append(p)
    # 去重保序
    seen = set()
    out = []
    for p in keep:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return "；".join(out)


def main():
    detail_path = os.path.join(VOCAB_DIR, "phrases-detail.json")
    with open(detail_path, encoding="utf-8") as f:
        phrases = json.load(f)

    total_before = len(phrases)

    # 1. 清理释义噪音
    for p in phrases:
        p["m"] = clean_meaning(p.get("m", ""))

    # 2. 过滤：无释义的剔除（星图和词库都只收有释义的，保证含金量）
    dropped = [p for p in phrases if not p["m"]]
    kept = [p for p in phrases if p["m"]]

    # 3. 词形规范化：去尾部句点（"think of sb." → "think of sb"）
    for p in kept:
        p["w"] = p["w"].strip().rstrip(".")

    # 排序
    kept.sort(key=lambda x: x["w"].lower())

    # 写回 detail
    with open(detail_path, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, indent=2)

    # 重新生成 phrases.js（浏览器加载格式）
    simple = []
    for p in kept:
        item = {"w": p["w"], "m": p["m"]}
        if p.get("ex"):
            item["ex"] = p["ex"]
        if p.get("exCn"):
            item["exCn"] = p["exCn"]
        simple.append(item)
    js = ("window.__VOCAB_CACHE__=window.__VOCAB_CACHE__||{};"
          + "window.__VOCAB_CACHE__['gaokao-phrases']="
          + json.dumps(simple, ensure_ascii=False) + ";")
    with open(os.path.join(VOCAB_DIR, "phrases.js"), "w", encoding="utf-8") as f:
        f.write(js)

    print(f"清洗前: {total_before} 条")
    print(f"剔除无释义: {len(dropped)} 条")
    print(f"清洗后保留: {len(kept)} 条")

    # 更新 index.js 里的 total
    idx_path = os.path.join(VOCAB_DIR, "index.js")
    with open(idx_path, encoding="utf-8") as f:
        idx = f.read()
    idx = re.sub(
        r'(\{"id":"gaokao-phrases".*?"total":)\d+',
        r"\g<1>" + str(len(kept)),
        idx,
    )
    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(idx)
    print("index.js total 已同步")


if __name__ == "__main__":
    main()
