"""汇总全库状态，输出一张「还缺什么」的清单。

用法：
    python tools/gap_report.py

对每套 json 归类：
  verified  已通过 exam_check（可上线）
  broken    早期自动解析产出的坏数据，需整套重写
并列出重写所需的源文档是否存在、属于哪个档位。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
EXAMS = os.path.join(ROOT, "data", "exams")
SRC = r"E:\Desk\题目"

# 已知源文档档位（由 survey_sources.py 得出）
READY = "ready"      # docx 解析版，含答案
NOANS = "no-ans"     # docx 原卷版，无答案
LEGACY = "legacy"    # .doc，本机无转换器
OCRPDF = "ocr"       # pdf 文本层损坏
MISSING = "missing"  # 源目录里没有

# exam id → (源文档相对路径, 档位)。None 表示没有对应源。
SOURCE_MAP = {
    "gk2021-jia": ("2021全国高考甲卷英语（有听力）/2021年高考全国甲卷英语试题（解析版）.doc", LEGACY),
    "gk2021-yi": ("2021全国高考乙卷英语（有听力）/2021年高考英语试卷（新课标Ⅰ）（含解析版）.doc", LEGACY),
    "gk2021-xgk1": ("2021全国新高考1卷英语( 含听力)/2021年全国高考新高考I卷英语试题（解析版）.doc", LEGACY),
    "gk2021-xgk2": ("14.英语·2021年普通高等学校招生全国统一考试(新高考全国Ⅱ卷)(含听力音频)-【名校强基卷】2020-2024年5年高考英语真题汇编/14.2021年普通高等学校招生全国统一考试(新高考全国Ⅱ卷).pdf", OCRPDF),
    "gk2022-jia": ("2022年全国甲卷英语高考真题（解析版）.docx", READY),
    "gk2022-yi": ("2022年全国乙卷英语高考真题（解析版）.docx", READY),
    "gk2022-xgk1": ("2022年新高考全国一卷英语真题（解析版）.docx", READY),
    "gk2022-xkb1": ("2022年新高考全国一卷英语真题（解析版）.docx", READY),
    "gk2022-xkb2": ("2022年新高考全国Ⅱ卷英语真题（原卷版）.docx", NOANS),
    "gk2023-jia": ("2023年全国甲卷英语真题（解析版）.docx", READY),
    "gk2023-yi": ("2023年全国乙卷英语真题（含听力）（解析版）.docx", READY),
    "gk2023-xgk1": ("2023年新课标全国Ⅰ卷英语真题（含听力）（解析版）.docx", READY),
    "gk2023-xkb1": ("2023年新课标全国Ⅰ卷英语真题（含听力）（解析版）.docx", READY),
    "gk2023-xkb2": ("2023年新课标全国Ⅱ卷英语真题（含听力）（解析版）.docx", READY),
    "gk2024-jia": ("2024年高考英语试卷（全国甲卷）.docx", NOANS),
    "gk2024-new1": ("2024年高考英语试卷（新课标Ⅰ卷）.docx", NOANS),
    "gk2024-new2": ("2024年高考英语试卷（新课标Ⅱ卷）.docx", NOANS),
    "gk2025-new1": ("2025年高考英语试卷（全国Ⅰ卷）.docx", NOANS),
    "gk2025-new2": ("2025年高考英语试卷（全国Ⅱ卷）.docx", NOANS),
    "gk2026-new1": ("2026 Ⅰ.pdf", OCRPDF),
    "gk2020-new1": ("2020年高考英语试卷（新课标Ⅰ）（含解析版）.doc", LEGACY),
    "gk2020-new2": ("2020年高考英语试卷（新课标Ⅱ）（含解析版）.doc", LEGACY),
    "gk2020-new3": ("2020年高考英语试卷（新课标Ⅲ）（含解析版）.doc", LEGACY),
    "gk2020-shandong": ("2020年山东卷英语高考试题及答案.doc", LEGACY),
    "gk2020-hainan": ("2020年海南高考英语试题和答案.doc", LEGACY),
}

LABEL = {
    READY: "docx 解析版，可直接录",
    NOANS: "原卷版，缺答案",
    LEGACY: ".doc，需转 docx",
    OCRPDF: "PDF，需 OCR",
    MISSING: "源目录无对应文档",
}


def check_one(exam_id: str) -> bool:
    r = subprocess.run(
        [sys.executable, os.path.join(ROOT, "tools", "exam_check.py"), exam_id],
        capture_output=True, text=True, encoding="utf-8", errors="ignore", cwd=ROOT,
    )
    return r.returncode == 0


def main() -> None:
    ids = sorted(os.path.splitext(f)[0] for f in os.listdir(EXAMS) if f.endswith(".json"))
    verified: list[str] = []
    broken: list[str] = []

    print(f"逐套校验 {len(ids)} 个 json …\n")
    for eid in ids:
        (verified if check_one(eid) else broken).append(eid)

    print(f"通过 {len(verified)} 套：{', '.join(verified) or '（无）'}")
    print(f"需重写 {len(broken)} 套\n")

    # 按源档位分组重写任务
    buckets: dict[str, list[tuple[str, str]]] = {}
    for eid in broken:
        rel, tier = SOURCE_MAP.get(eid, (None, MISSING))
        if rel and not os.path.exists(os.path.join(SRC, rel.replace("/", os.sep))):
            tier = MISSING
        buckets.setdefault(tier, []).append((eid, rel or "—"))

    print("=" * 60)
    print("重写任务按源文档可用性分组")
    print("=" * 60)
    for tier in (READY, NOANS, LEGACY, OCRPDF, MISSING):
        items = buckets.get(tier)
        if not items:
            continue
        print(f"\n【{tier}】{LABEL[tier]}  —— {len(items)} 套")
        for eid, rel in sorted(items):
            print(f"  {eid}")
            print(f"      源：{rel}")

    # 音频盘点
    print("\n" + "=" * 60)
    print("听力音频")
    print("=" * 60)
    adir = os.path.join(ROOT, "audio")
    have = {f for f in os.listdir(adir) if f.endswith(".mp3")} if os.path.isdir(adir) else set()
    need: dict[str, list[str]] = {}
    for eid in ids:
        p = os.path.join(EXAMS, f"{eid}.json")
        try:
            with open(p, encoding="utf-8") as f:
                exam = json.load(f)
        except Exception:
            continue
        if not exam.get("hasAudio"):
            continue
        a = exam.get("audio")
        if isinstance(a, dict):
            a = next((v for v in a.values() if isinstance(v, str) and v.strip()), None)
        fn = os.path.basename(a) if a else None
        key = fn if fn and fn in have else "缺失"
        need.setdefault(key, []).append(eid)
    for k, v in sorted(need.items()):
        print(f"  {k}: {', '.join(sorted(v))}")
    unused = have - {k for k in need if k != "缺失"}
    if unused:
        print(f"  未被引用的音频: {', '.join(sorted(unused))}")


if __name__ == "__main__":
    main()
