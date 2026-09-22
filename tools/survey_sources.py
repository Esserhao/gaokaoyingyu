"""盘点 E:\\Desk\\题目 下的源文档，判断每套卷能否直接录入。

用法：
    python tools/survey_sources.py

判定规则（决定录入优先级）：
  ready   .docx 解析版，含答案+解析+听力原文 → 可直接录，优先
  no-ans  .docx 原卷版，无答案 → 需另找答案源，暂缓
  legacy  .doc 老二进制格式 → 需先转 docx
  ocr     .pdf 文本层损坏 → 需 OCR，成本高，最后做
"""
from __future__ import annotations

import os
import re
import zipfile

SRC = r"E:\Desk\题目"
EXAMS = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "exams"))

ANSWER_MARKERS = ("【答案】", "[答案]", "【解析】", "[解析]", "参考答案", "【详解】")


def docx_text(path: str, limit: int = 400_000) -> str:
    """只读 document.xml 并剥标签，比 python-docx 快得多（盘点用）。"""
    try:
        with zipfile.ZipFile(path) as z:
            raw = z.read("word/document.xml").decode("utf-8", "ignore")[:limit]
    except Exception:
        return ""
    return re.sub(r"<[^>]+>", "", raw)


def classify(path: str) -> tuple[str, str]:
    ext = os.path.splitext(path)[1].lower()
    name = os.path.basename(path)

    if ext == ".pdf":
        return "ocr", "PDF，需判定文本层/OCR"
    if ext == ".doc":
        if zipfile.is_zipfile(path):
            return "legacy", ".doc 但实为 docx 容器，可直接解析"
        return "legacy", ".doc 老二进制，需转 docx"
    if ext != ".docx":
        return "skip", ext or "无扩展名"

    text = docx_text(path)
    if not text:
        return "skip", "无法读取"
    hits = [m for m in ANSWER_MARKERS if m in text]
    if hits:
        return "ready", f"含答案标记 {hits[:3]}"
    if "答案是" in text:
        return "no-ans", "仅含听力例题的“答案是C”，无逐题答案"
    return "no-ans", "无答案标记（原卷版）"


def main() -> None:
    rows: list[tuple[str, str, str, str]] = []
    for root, _dirs, files in os.walk(SRC):
        for fn in sorted(files):
            if fn.startswith("~$"):  # Office 临时锁文件
                continue
            if os.path.splitext(fn)[1].lower() not in (".doc", ".docx", ".pdf"):
                continue
            path = os.path.join(root, fn)
            kind, note = classify(path)
            rel = os.path.relpath(path, SRC)
            rows.append((kind, rel, note, path))

    done = {os.path.splitext(f)[0] for f in os.listdir(EXAMS)} if os.path.isdir(EXAMS) else set()

    order = {"ready": 0, "no-ans": 1, "legacy": 2, "ocr": 3, "skip": 4}
    rows.sort(key=lambda r: (order.get(r[0], 9), r[1]))

    counts: dict[str, int] = {}
    for kind, rel, note, _ in rows:
        counts[kind] = counts.get(kind, 0) + 1

    print(f"源目录 {SRC}")
    print(f"合计 {len(rows)} 个文档：" + "，".join(f"{k}={v}" for k, v in sorted(counts.items(), key=lambda x: order.get(x[0], 9))))
    print()
    cur = None
    for kind, rel, note, _ in rows:
        if kind != cur:
            cur = kind
            label = {
                "ready": "【ready】解析版 docx，可直接录入",
                "no-ans": "【no-ans】原卷版，缺答案，需另找答案源",
                "legacy": "【legacy】.doc，需先转 docx",
                "ocr": "【ocr】PDF，需 OCR",
                "skip": "【skip】",
            }[kind]
            print(label)
        print(f"  {rel}")
        print(f"      {note}")
    print()
    print(f"data/exams 已有 {len(done)} 个 json（含待重写的坏数据）")


if __name__ == "__main__":
    main()
