"""把源试卷文档抽成纯文本，供人工录入参考。

用法：
    python tools/extract_source.py "E:\\Desk\\题目\\2024年高考英语试卷（新课标Ⅰ卷）.docx" --out 2024/new1-jiexi.txt
    python tools/extract_source.py "…\\卷.pdf" --out 2021/xgk2-yuanjuan.txt      # 自动判断是否需要 OCR
    python tools/extract_source.py "…\\卷.pdf" --out … --force-ocr               # 强制 OCR

支持 .docx / .doc / .pdf。输出到 .work/extract/<相对路径>。

设计要点（都是踩过的坑）：
- PDF 常见"文本层损坏"：字体子集化 + ToUnicode 表错位，get_text() 抽出 `!"#$%` 垃圾。
  本脚本用 ASCII 可读率自动判定，低于阈值就转 OCR（渲染 300dpi PNG + rapidocr）。
- .doc（老二进制格式）python-docx 读不了。本机无 LibreOffice/Word COM 时会明确报错
  并给出可行替代，不静默产出空文件。
- 抽出的文本一律做噪声归一（全角冒号、控制字符、常见 OCR 错字），减少录入时的逐处修正。
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import zipfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
OUTBASE = os.path.join(ROOT, ".work", "extract")

# OCR 常见误识别 → 正确形式。只放高置信度的，避免误伤正文。
OCR_FIXES = [
    (r"(?<=\d)：(?=\d)", ":"),          # 7：40 → 7:40
    (r"[\x00-\x08\x0b\x0c\x0e-\x1f]", ""),  # 控制字符
    (r"\bl(?=\d)", "1"),                # l0 am → 10 am
    (r"(?<=\d)O\b", "0"),               # 5O → 50
    (r"\bll\b", "11"),
    (r"\blst\b", "1st"),
    # docx 里普遍把 ’ll 写成 ’11（数字 1 替代字母 l），影响听力 transcript
    (r"(?<=[A-Za-z])[’']11\b", "’ll"),
    (r"(?<=[A-Za-z])[’']13\b", "’ll"),
    (r"\bf(?=\d)", "£"),                # f12 → £12（英镑符号常被识成 f）
    (r"新高考T卷", "新高考Ⅱ卷"),
    (r"新高考开卷", "新高考Ⅱ卷"),
]


def normalize(text: str) -> str:
    for pat, rep in OCR_FIXES:
        text = re.sub(pat, rep, text)
    # 压掉连续空行，但保留段落分隔
    return re.sub(r"\n{4,}", "\n\n\n", text)


def readable_ratio(text: str) -> float:
    """可读率：ASCII 字母数字 + 中文 + 常见标点 占非空白字符的比例。

    文本层损坏的 PDF 抽出的是 `!"#$%&'()` 这类符号流，可读率极低。
    """
    body = re.sub(r"\s", "", text)
    if not body:
        return 0.0
    good = re.findall(r"[A-Za-z0-9\u4e00-\u9fff.,;:?!'\"()\[\]£$—-]", body)
    return len(good) / len(body)


def from_docx(path: str) -> str:
    import docx  # python-docx

    doc = docx.Document(path)
    out: list[str] = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            out.append(t)
    # 试卷里的选项/材料常放在表格中，漏掉会丢题
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            line = " | ".join(x for x in cells if x)
            if line:
                out.append(line)
    return "\n".join(out)


def from_doc(path: str) -> str:
    """老 .doc 二进制格式。无外部转换器时明确失败。"""
    # Word COM（装了 Office 才有）
    try:
        import win32com.client  # type: ignore

        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        try:
            doc = word.Documents.Open(os.path.abspath(path), ReadOnly=True)
            text = doc.Content.Text
            doc.Close(False)
            return text
        finally:
            word.Quit()
    except ImportError:
        pass

    for exe in (
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ):
        if os.path.exists(exe):
            raise SystemExit(
                f"检测到 LibreOffice（{exe}）。请先转换再抽取：\n"
                f'  & "{exe}" --headless --convert-to docx --outdir .work\\conv "{path}"\n'
                f"然后对生成的 .docx 再跑本脚本。"
            )

    raise SystemExit(
        f"无法读取 .doc（老二进制格式）：{path}\n"
        "本机既无 pywin32（Word COM）也无 LibreOffice。可选方案：\n"
        "  1) python -m pip install pywin32   （需已安装 Microsoft Word）\n"
        "  2) 安装 LibreOffice 后用 --convert-to docx\n"
        "  3) 手工另存为 .docx 再抽取"
    )


def from_pdf(path: str, force_ocr: bool, dpi: int) -> str:
    import fitz  # pymupdf

    doc = fitz.open(path)
    parts = [f"\n===== PAGE {i} =====\n" + p.get_text("text") for i, p in enumerate(doc, 1)]
    text = "".join(parts)
    ratio = readable_ratio(text)

    if not force_ocr and ratio >= 0.55:
        print(f"  PDF 文本层可用（可读率 {ratio:.0%}），直接抽取")
        doc.close()
        return text

    reason = "强制 OCR" if force_ocr else f"文本层损坏（可读率 {ratio:.0%} < 55%）"
    print(f"  {reason}，转 OCR：渲染 {dpi}dpi + rapidocr")
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        doc.close()
        raise SystemExit("需要 OCR 但缺依赖：python -m pip install rapidocr-onnxruntime")

    ocr = RapidOCR()
    imgdir = os.path.join(OUTBASE, "_img", os.path.splitext(os.path.basename(path))[0])
    os.makedirs(imgdir, exist_ok=True)
    parts = []
    for i, page in enumerate(doc, 1):
        png = os.path.join(imgdir, f"p{i:03d}.png")
        if not os.path.exists(png):
            page.get_pixmap(dpi=dpi).save(png)
        result, _ = ocr(png)
        lines = [r[1] for r in (result or [])]
        parts.append(f"\n===== PAGE {i} =====\n" + "\n".join(lines))
        print(f"    p{i:03d} lines={len(lines)}", flush=True)
    doc.close()
    return "\n".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description="抽取源试卷文档为纯文本")
    ap.add_argument("src", help="源文件 .docx/.doc/.pdf")
    ap.add_argument("--out", required=True, help=".work/extract/ 下的相对路径，如 2024/new1-jiexi.txt")
    ap.add_argument("--force-ocr", action="store_true", help="PDF 强制走 OCR")
    ap.add_argument("--dpi", type=int, default=300, help="OCR 渲染分辨率（默认 300）")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        print(f"源文件不存在：{args.src}")
        return 1

    ext = os.path.splitext(args.src)[1].lower()
    print(f"抽取 {os.path.basename(args.src)}（{ext}）")

    if ext == ".docx":
        text = from_docx(args.src)
    elif ext == ".doc":
        # 有些"​.doc"其实是 zip 包装的 docx，先探一下
        if zipfile.is_zipfile(args.src):
            print("  实为 docx 容器，按 docx 解析")
            text = from_docx(args.src)
        else:
            text = from_doc(args.src)
    elif ext == ".pdf":
        text = from_pdf(args.src, args.force_ocr, args.dpi)
    else:
        print(f"不支持的扩展名：{ext}")
        return 1

    text = normalize(text)
    dst = os.path.join(OUTBASE, args.out.replace("/", os.sep))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(text)

    lines = text.count("\n") + 1
    print(f"  → {os.path.relpath(dst, ROOT)}  {len(text)} 字符 / {lines} 行  可读率 {readable_ratio(text):.0%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
