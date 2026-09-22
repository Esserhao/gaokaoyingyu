#!/usr/bin/env python3
"""Stage 2: 从 doc/docx/pdf 抽取纯文本，保留段落结构。

依赖: python-docx (docx), PyPDF2 (pdf)
用法: python tools/pipeline/extract_content.py
产出: tools/pipeline/raw_text/<name>.txt
"""
import os, json, re, sys
from pathlib import Path

MANIFEST_PATH = Path("tools/pipeline/source_manifest.json")
RAW_DIR = Path("tools/pipeline/raw_text")

def extract_docx(path: Path) -> str:
    """从 docx 抽取文本"""
    try:
        from docx import Document
        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs]
        # 也抽取表格内容
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text for cell in row.cells]
                paragraphs.append(" | ".join(row_text))
        return "\n".join(paragraphs)
    except ImportError:
        print("  [WARN] python-docx 未安装，跳过 docx: ", path.name)
        return ""
    except Exception as e:
        print(f"  [ERROR] docx 抽取失败 {path.name}: {e}")
        return ""

def extract_pdf(path: Path) -> str:
    """从 pdf 抽取文本"""
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(str(path))
        paragraphs = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)
    except ImportError:
        print("  [WARN] PyPDF2 未安装，跳过 pdf: ", path.name)
        return ""
    except Exception as e:
        print(f"  [ERROR] pdf 抽取失败 {path.name}: {e}")
        return ""

def extract_doc(path: Path) -> str:
    """从旧版 doc 抽取文本 (尝试用 antiword 或 win32com)"""
    # 尝试用 python-docx 读取 (docx 有时能读 doc)
    try:
        from docx import Document
        doc = Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs)
    except:
        pass
    # 尝试 win32com (仅 Windows)
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(str(path.resolve()))
        text = doc.Range().Text
        doc.Close()
        word.Quit()
        return text
    except:
        pass
    print(f"  [WARN] 无法抽取 doc: {path.name}")
    return ""

def main():
    if not MANIFEST_PATH.exists():
        print("[ERROR] 请先运行 scan_sources.py")
        sys.exit(1)

    manifest = json.load(open(MANIFEST_PATH, encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    extracted = 0
    skipped = 0

    for info in manifest["files"]:
        path = Path(info["path"])
        ext = info["ext"]

        # 只处理文档类型
        if ext not in (".docx", ".doc", ".pdf"):
            skipped += 1
            continue

        # 跳过音频
        if ".mp3" in path.name:
            skipped += 1
            continue

        # 生成输出文件名
        out_name = path.stem[:80]  # 截断过长文件名
        out_path = RAW_DIR / f"{out_name}.txt"

        if out_path.exists():
            skipped += 1
            continue

        if ext == ".docx":
            text = extract_docx(path)
        elif ext == ".pdf":
            text = extract_pdf(path)
        elif ext == ".doc":
            text = extract_doc(path)
        else:
            continue

        if text.strip():
            out_path.write_text(text, encoding="utf-8")
            extracted += 1
            print(f"  [OK] {path.name} -> {out_path.name} ({len(text)} chars)")
        else:
            print(f"  [EMPTY] {path.name}")

    print(f"\n=== 抽取完成 ===")
    print(f"抽取: {extracted} 文件")
    print(f"跳过: {skipped} 文件")
    print(f"产出目录: {RAW_DIR}")

if __name__ == "__main__":
    main()
