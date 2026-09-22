#!/usr/bin/env python3
"""
词组数据含金量评估脚本
从多个维度评估 5028 条词组的质量：
1. 覆盖度：词组的首词是否在高中词书中（真实词汇组合 vs 生僻拼接）
2. 释义质量：有多少条有有效释义
3. 重复度：与星图现有词组的重合
4. 抽样人工核对清单
"""
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_DIR = os.path.join(ROOT, "data", "vocab")

def load_phrases():
    with open(os.path.join(VOCAB_DIR, "phrases-detail.json"), encoding="utf-8") as f:
        return json.load(f)

def _parse_jsonp(content, marker):
    """解析 window.__X__['key']=JSON.parse('...') 或 =[{...}] 两种格式"""
    # 格式1: JSON.parse('...')
    m = re.search(re.escape(marker) + r"\s*=\s*JSON\.parse\('(.*)'\)", content, re.S)
    if m:
        raw = m.group(1)
        # 还原 JS 字符串转义（\\' -> '，\\" -> "，\\\\ -> \）
        raw = raw.replace("\\\\", "\x00").replace("\\'", "'").replace('\\"', '"').replace("\x00", "\\")
        return json.loads(raw)
    # 格式2: 直接 JSON 字面量
    m = re.search(re.escape(marker) + r"\s*=\s*(\[.*\])", content, re.S)
    if m:
        return json.loads(m.group(1))
    raise ValueError(f"cannot parse {marker[:40]}")

def load_wordlist():
    """从 highschool.js 提取词表（首词集合）"""
    path = os.path.join(VOCAB_DIR, "highschool.js")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    data = _parse_jsonp(content, "window.__VOCAB_CACHE__['highschool']")
    words = set()
    for item in data:
        w = item.get("w", "")
        if w:
            words.add(w.lower())
    return words

def load_syn_groups():
    """加载星图现有分组"""
    path = os.path.join(VOCAB_DIR, "synonyms.js")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    data = _parse_jsonp(content, "window.__SYN__")
    return data.get("groups", [])

def main():
    phrases = load_phrases()
    wordlist = load_wordlist()
    syn_groups = load_syn_groups()

    print(f"词组总数: {len(phrases)}")
    print(f"高中词书词数: {len(wordlist)}")
    print(f"星图现有分组: {len(syn_groups)} 组")

    # === 1. 覆盖度：首词在词书中的比例 ===
    def first_word(p):
        # 取第一个英文单词
        m = re.match(r"[a-zA-Z']+", p["w"])
        return m.group(0).lower() if m else ""

    covered = [p for p in phrases if first_word(p) in wordlist]
    print(f"\n=== 覆盖度 ===")
    print(f"首词在高中词书中: {len(covered)} 条 ({len(covered)*100//len(phrases)}%)")
    print(f"首词不在词书中: {len(phrases)-len(covered)} 条")

    # === 2. 释义质量 ===
    no_meaning = [p for p in phrases if not p.get("m")]
    has_meaning = [p for p in phrases if p.get("m")]
    print(f"\n=== 释义质量 ===")
    print(f"有释义: {len(has_meaning)} 条 ({len(has_meaning)*100//len(phrases)}%)")
    print(f"无释义: {len(no_meaning)} 条")

    # 无释义的按来源统计
    src_counter = Counter(p.get("source", "?") for p in no_meaning)
    print("无释义来源分布:")
    for src, cnt in src_counter.most_common():
        print(f"  {src}: {cnt}")

    # === 3. 词组长度分布（2词 vs 3+词） ===
    def word_count(w):
        return len(re.findall(r"[a-zA-Z']+", w))
    len_dist = Counter(word_count(p["w"]) for p in phrases)
    print(f"\n=== 词组长度分布 ===")
    for n in sorted(len_dist):
        print(f"  {n} 词: {len_dist[n]} 条")

    # === 4. 含占位符的词组（如 "add ... to ..."）===
    placeholder = [p for p in phrases if "..." in p["w"] or "sth" in p["w"].lower() or "sb" in p["w"].lower()]
    print(f"\n含占位符(sth/sb/...): {len(placeholder)} 条")

    # === 5. 与星图现有词组的重合 ===
    syn_phrases = set()
    for g in syn_groups:
        for w in g["words"]:
            if " " in w:  # 含空格的是词组
                syn_phrases.add(w.lower())
    phrase_keys = {p["w"].lower() for p in phrases}
    overlap = syn_phrases & phrase_keys
    print(f"\n=== 与星图重合 ===")
    print(f"星图现有词组: {len(syn_phrases)} 个")
    print(f"与新词库重合: {len(overlap)} 个")
    print(f"重合示例: {sorted(overlap)[:10]}")

    # === 6. 高频释义抽查（同一释义出现次数最多的，检查是否是模板垃圾） ===
    print(f"\n=== 释义频次 TOP15（检查模板垃圾）===")
    m_counter = Counter(p["m"] for p in has_meaning)
    for m, cnt in m_counter.most_common(15):
        print(f"  [{cnt}次] {m[:50]}")

    # === 7. 抽样：随机抽 30 条有释义的（固定种子）供人工核对 ===
    import random
    random.seed(42)
    sample = random.sample(has_meaning, 30)
    print(f"\n=== 人工核对抽样（30条，种子42）===")
    for p in sample:
        print(f"  {p['w']}  =  {p['m'][:40]}  [{p.get('level','?')}]")

    # === 8. 疑似垃圾模式扫描 ===
    print(f"\n=== 疑似垃圾模式 ===")
    garbage_patterns = [
        (r"^[a-z]$", "单字母"),
        (r"\d", "含数字"),
        (r"无", "释义为'无'"),
    ]
    for pat, name in garbage_patterns:
        hits = [p for p in phrases if re.search(pat, p["w"])]
        print(f"  {name}: {len(hits)} 条")

if __name__ == "__main__":
    main()
