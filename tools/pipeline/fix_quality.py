#!/usr/bin/env python3
"""
fix_quality.py - 修复数据质量问题
1. 修复选项字母不连续
2. 删除空题干/无选项的无效题目
3. 修复 section 结构
4. 标记有音频的试卷
"""
import json
import re
from pathlib import Path

EXAMS_DIR = Path("data/exams")


def fix_option_letters(q: dict) -> bool:
    """修复选项字母，返回是否修改"""
    opts = q.get("options", [])
    if not opts:
        return False
    
    letters = [o.get("letter", "") for o in opts]
    n = len(opts)
    expected = [chr(ord('A') + i) for i in range(n)]
    
    if letters != expected:
        for i, o in enumerate(opts):
            o["letter"] = chr(ord('A') + i)
        return True
    return False


def is_valid_question(q: dict) -> bool:
    """检查是否为有效题目"""
    stem = q.get("stem", "").strip()
    if not stem:
        return False
    
    # 写作/改错题可以无选项
    qtype = q.get("type", "")
    if qtype in ("writing", "proofreading"):
        return True
    
    # 阅读/听力/完形等必须有选项
    opts = q.get("options", [])
    if not opts:
        return False
    
    return True


def fix_file(fpath: Path) -> list:
    """修复单个文件，返回修改列表"""
    with open(fpath, encoding="utf-8") as f:
        data = json.load(f)
    
    changes = []
    
    # 修复 section
    for sec in data.get("sections", []):
        key = sec["key"]
        
        # 修复选项字母
        for q in sec.get("questions", []):
            if fix_option_letters(q):
                changes.append(f"[{key}] Q{q['id']} 选项字母修正")
        
        # 过滤无效题目
        original_count = len(sec.get("questions", []))
        sec["questions"] = [q for q in sec["questions"] if is_valid_question(q)]
        removed = original_count - len(sec["questions"])
        if removed:
            changes.append(f"[{key}] 删除 {removed} 个无效题目")
        
        # 重新编号
        for i, q in enumerate(sec["questions"], 1):
            q["id"] = i
    
    # 删除空 section
    original_sections = len(data["sections"])
    data["sections"] = [s for s in data["sections"] if s["questions"]]
    removed_sec = original_sections - len(data["sections"])
    if removed_sec:
        changes.append(f"删除 {removed_sec} 个空 section")
    
    # 修复答案超出选项范围
    for sec in data["sections"]:
        for q in sec.get("questions", []):
            ans = q.get("answer", "")
            opts = q.get("options", [])
            if ans and opts:
                letters = [o.get("letter", "") for o in opts]
                if ans not in letters:
                    q["answer"] = ""  # 清空无效答案
    
    # 标记有音频
    for sec in data["sections"]:
        if sec["key"] == "listening":
            data["hasAudio"] = True
            if data.get("audio") is None:
                data["audio"] = {"file": f"audio/listening-{data['year']}-{data['id'].replace('gk', '')}.mp3"}
            break
    
    if changes:
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changes


def main():
    print("=== 数据质量修复 ===\n")
    
    total = 0
    fixed = 0
    
    for f in sorted(EXAMS_DIR.glob("gk*.json")):
        total += 1
        changes = fix_file(f)
        if changes:
            fixed += 1
            print(f"✅ {f.stem}:")
            for c in changes[:5]:
                print(f"   {c}")
            if len(changes) > 5:
                print(f"   ... +{len(changes)-5} 处")
        else:
            print(f"✅ {f.stem}: 无需修改")
    
    print(f"\n完成: {fixed}/{total} 个文件已修复")


if __name__ == "__main__":
    main()
