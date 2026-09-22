#!/usr/bin/env python3
"""Stage 1: 扫描 E:\\Desk\\题目\\ 全部源文件，生成清单 + 分类统计。

用法: python tools/pipeline/scan_sources.py
产出: tools/pipeline/source_manifest.json
"""
import os, json, re
from pathlib import Path

SOURCE_DIR = Path("E:/Desk/题目")
MANIFEST_PATH = Path("tools/pipeline/source_manifest.json")

# 文件名模式: 识别年份、卷型、文件类型
PATTERNS = {
    "year": re.compile(r"(20\d{2})"),
    "paper": re.compile(r"(全国甲卷|全国乙卷|新高考[ⅠII12]+卷|新课标[ⅠII12]+卷|山东卷|海南卷|上海卷|北京卷|天津卷|浙江卷)"),
    "part": re.compile(r"(解析版|原卷版|答案|听力|音频)"),
}

def classify_file(path: Path):
    """识别文件名中的年份、卷型、部分"""
    name = path.name
    year = PATTERNS["year"].search(name)
    paper = PATTERNS["paper"].search(name)
    part = PATTERNS["part"].search(name)
    return {
        "year": year.group(1) if year else None,
        "paper": paper.group(1) if paper else None,
        "part": part.group(1) if part else None,
        "ext": path.suffix.lower(),
    }

def scan():
    """递归扫描源目录"""
    manifest = {
        "generated": str(__import__("datetime").datetime.now().isoformat()),
        "source_dir": str(SOURCE_DIR),
        "total_files": 0,
        "by_extension": {},
        "by_year": {},
        "by_paper": {},
        "files": [],
    }

    for root, dirs, files in os.walk(SOURCE_DIR):
        for fn in files:
            p = Path(root) / fn
            info = classify_file(p)
            info["path"] = str(p)
            info["size"] = p.stat().st_size
            info["relative"] = str(p.relative_to(SOURCE_DIR))

            manifest["files"].append(info)
            manifest["total_files"] += 1

            ext = info["ext"]
            manifest["by_extension"][ext] = manifest["by_extension"].get(ext, 0) + 1

            if info["year"]:
                manifest["by_year"].setdefault(info["year"], []).append(info["relative"])
            if info["paper"]:
                manifest["by_paper"].setdefault(info["paper"], []).append(info["relative"])

    return manifest

def main():
    m = scan()
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    json.dump(m, open(MANIFEST_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"=== 扫描完成 ===")
    print(f"总文件数: {m['total_files']}")
    print(f"\n按类型: {json.dumps(m['by_extension'], ensure_ascii=False)}")
    print(f"\n按年份:")
    for yr in sorted(m["by_year"]):
        print(f"  {yr}: {len(m['by_year'][yr])} 个文件")
    print(f"\n按卷型:")
    for pp in sorted(m["by_paper"]):
        print(f"  {pp}: {len(m['by_paper'][pp])} 个文件")
    print(f"\n清单已保存: {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
