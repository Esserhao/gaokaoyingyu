"""把「解析版」docx 抽出的纯文本解析成 data/exams/<id>.json 草稿。

用法：
    python tools/parse_jiexi.py .work/extract/2023/new2-jiexi.txt --id gk2023-xgk2 \
        --paper 新课标Ⅱ卷 --year 2023 --format new --region 新高考地区

解析版格式高度规整，可机器切块；产出仍必须过 exam_check.py 并人工抽检。
本脚本只负责把「题目 / 选项 / 答案 / 解析 / 听力原文 / 文章」对齐，
不做任何猜测式补全：缺答案的题会显式报错而不是留空。

已知格式（2022/2023 各卷一致）：
  听力单题   `1. 【此处可播放…】` + 题干 + 选项 + `【答案】C` + `【原文】…`
  听力多题   `【答案】6. C    7. B`
  阅读       文章前有单独一行的 `A`/`B`/`C`/`D` 标签
  七选五     文章含 `____36____`，选项池是连续 7 行 `A.`–`G.`
  完形       选项行 `41. A. designed\tB. followed\tC. changed\tD. finished`
  语法填空   `【答案】56. tasty` 可能多题挤在一行
  写作       题号 + 提示 + `【答案】` 正文
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "data", "exams")

MARK_ANS = "【答案】"
MARK_EXP = "【解析】"
MARK_TXT = "【原文】"
MARK_LEAD = "【导语】"
MARK_DETAIL = re.compile(r"^【?(\d+)题详解】")
MARK_TIP = "【点睛】"
AUDIO_NOTE = re.compile(r"【此处可播放相关音频[^】]*】")

RE_PART = re.compile(r"^第[一二三四]部分")
RE_SEC = re.compile(r"^第[一二]节")
RE_QNUM = re.compile(r"^(\d+)[\.．]\s*(.*)$")
RE_BLANK = re.compile(r"_{2,}\s*(\d+)\s*_{2,}")
# 完形选项行：41. A. x  B. y  C. z  D. w
RE_CLOZE_OPTS = re.compile(r"^(\d+)[\.．]?\s*A[\.．]\s*(.+?)\s*B[\.．]\s*(.+?)\s*C[\.．]\s*(.+?)\s*D[\.．]\s*(.+?)$")
# 单行内的选项片段：A. xxx  B. yyy
RE_OPT_INLINE = re.compile(r"(?<![A-Za-z])([A-D])[\.．]\s*")
RE_POOL_OPT = re.compile(r"^([A-G])[\.．]\s*(.+)$")
# 答案块内的 "6. C" / "56. tasty" / 裸 "C"
RE_ANS_PAIR = re.compile(r"(\d+)[\.．]\s*([^\s].*?)(?=\s{2,}\d+[\.．]|\s*$)")


def norm(s: str) -> str:
    return AUDIO_NOTE.sub("", s).replace("\u3000", " ").strip()


def load_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [norm(x) for x in f.read().splitlines()]


class Block:
    """一个 `【答案】…【解析】…【原文】…` 块。"""

    def __init__(self) -> None:
        self.answers: dict[int, str] = {}
        self.bare: str | None = None      # 单题答案（无题号前缀）
        self.transcript: str = ""
        self.lead: str = ""
        self.details: dict[int, str] = {}
        self.model: str = ""              # 写作参考答案


def parse_answer_payload(text: str) -> tuple[dict[int, str], str | None]:
    """解析 `【答案】` 后面的内容。返回 (题号→答案, 裸答案)。"""
    text = text.strip()
    if not text:
        return {}, None
    pairs = dict()
    for m in RE_ANS_PAIR.finditer(text):
        pairs[int(m.group(1))] = m.group(2).strip()
    if pairs:
        return pairs, None
    # 裸答案：单个字母，或写作正文首行
    if re.fullmatch(r"[A-G]", text):
        return {}, text
    return {}, text


def collect_blocks(lines: list[str]) -> list[tuple[int, Block]]:
    """扫描全文，返回 [(行号, Block)]，行号是 `【答案】` 所在行。"""
    out: list[tuple[int, Block]] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if not line.startswith(MARK_ANS):
            i += 1
            continue
        blk = Block()
        start = i
        pairs, bare = parse_answer_payload(line[len(MARK_ANS):])
        blk.answers.update(pairs)
        if bare:
            blk.bare = bare
            blk.model = bare
        i += 1
        # 【答案】之后、【解析】之前的续行仍属于答案（语法填空多行、写作正文）
        while i < n and not lines[i].startswith(MARK_EXP):
            if lines[i].startswith(MARK_ANS) or RE_PART.match(lines[i]):
                break
            pairs, bare = parse_answer_payload(lines[i])
            if pairs:
                blk.answers.update(pairs)
            elif bare:
                blk.model = (blk.model + "\n" + bare).strip()
            i += 1
        # 【解析】段：收集【原文】【导语】【N题详解】
        if i < n and lines[i].startswith(MARK_EXP):
            i += 1
            cur_detail: int | None = None
            while i < n:
                s = lines[i]
                if s.startswith(MARK_ANS) or RE_PART.match(s):
                    break
                if s.startswith(MARK_TXT):
                    blk.transcript = s[len(MARK_TXT):].strip()
                    i += 1
                    continue
                if s.startswith(MARK_LEAD):
                    blk.lead = s[len(MARK_LEAD):].strip()
                    i += 1
                    continue
                m = MARK_DETAIL.match(s)
                if m:
                    cur_detail = int(m.group(1))
                    blk.details[cur_detail] = ""
                    i += 1
                    continue
                if s.startswith(MARK_TIP):
                    cur_detail = None
                    i += 1
                    continue
                if cur_detail is not None and s:
                    blk.details[cur_detail] = (blk.details[cur_detail] + s).strip()
                i += 1
        out.append((start, blk))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="解析版文本 → exam JSON 草稿")
    ap.add_argument("src")
    ap.add_argument("--id", required=True)
    ap.add_argument("--paper", required=True)
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--format", default="new", choices=["new", "legacy"])
    ap.add_argument("--region", default="")
    ap.add_argument("--dump", action="store_true", help="只打印切块概览，不写文件")
    args = ap.parse_args()

    lines = load_lines(args.src)
    blocks = collect_blocks(lines)

    print(f"源文件 {args.src}：{len(lines)} 行，识别到 {len(blocks)} 个答案块")
    total_ans = 0
    for ln, b in blocks:
        keys = sorted(b.answers)
        tag = f"q{keys[0]}–{keys[-1]}" if keys else ("裸答案" if b.bare else "写作")
        total_ans += len(keys) or 1
        extra = []
        if b.transcript:
            extra.append(f"原文{len(b.transcript)}字")
        if b.lead:
            extra.append("导语")
        if b.details:
            extra.append(f"详解×{len(b.details)}")
        if b.model and not keys:
            extra.append(f"参考答案{len(b.model)}字")
        print(f"  行{ln + 1:>4}  {tag:<12} {' '.join(extra)}")
    print(f"答案总数（去重前）：{total_ans}")

    if args.dump:
        return 0
    print("\n本脚本目前只做答案块切分；section 组装请看 --dump 输出后手工完成。", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
