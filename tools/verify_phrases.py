#!/usr/bin/env python3
"""验证词组数据文件"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_DIR = os.path.join(ROOT, "data", "vocab")

def verify():
    # 验证 phrases.js
    phrases_path = os.path.join(VOCAB_DIR, "phrases.js")
    with open(phrases_path, "r", encoding="utf-8") as f:
        js_content = f.read()
    
    # 提取JSON
    start = js_content.find("[")
    end = js_content.rfind("]") + 1
    data = json.loads(js_content[start:end])
    
    print(f"✅ phrases.js 验证通过！共 {len(data)} 条词组")
    
    # 统计
    has_ex = sum(1 for item in data if item.get("ex"))
    has_excn = sum(1 for item in data if item.get("exCn"))
    has_meaning = sum(1 for item in data if item.get("m"))
    
    print(f"  - 有释义: {has_meaning} 条 ({has_meaning*100//len(data)}%)")
    print(f"  - 有英文例句: {has_ex} 条 ({has_ex*100//len(data)}%)")
    print(f"  - 有中文例句: {has_excn} 条 ({has_excn*100//len(data)}%)")
    
    # 前10条示例
    print("\n=== 前10条词组示例 ===")
    for i, item in enumerate(data[:10]):
        m = item["m"][:25] if item["m"] else "(无释义)"
        ex_tag = " [例]" if item.get("ex") else ""
        print(f"{i+1}. {item['w']}: {m}{ex_tag}")
    
    # 验证 phrases-detail.json
    detail_path = os.path.join(VOCAB_DIR, "phrases-detail.json")
    with open(detail_path, "r", encoding="utf-8") as f:
        detail = json.load(f)
    
    print(f"\n✅ phrases-detail.json 验证通过！共 {len(detail)} 条")
    
    # 级别分布
    from collections import Counter
    levels = Counter(item.get("level", "?") for item in detail)
    print("\n=== 级别分布 ===")
    for level, count in levels.most_common():
        print(f"  {level}: {count} 条")
    
    # 验证 index.js
    index_path = os.path.join(VOCAB_DIR, "index.js")
    with open(index_path, "r", encoding="utf-8") as f:
        index_content = f.read()
    
    if '"gaokao-phrases"' in index_content:
        print(f"\n✅ index.js 已注册 gaokao-phrases 词库")
    else:
        print(f"\n❌ index.js 未注册 gaokao-phrases 词库")

if __name__ == "__main__":
    verify()
