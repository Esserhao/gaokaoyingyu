#!/usr/bin/env python3
"""精确解析 2021 年高考英语听力真题。

每卷的特征：
  甲卷: [答案]A [解析] [原文]xxx —— 单题单答案块，标签用半角[]
  乙卷: 【答案】A【解析】【原文】xxx —— 同上，标签用全角【】
  新Ⅰ卷: [答案]6.A 7.B [解析] [原文]xxx —— 多题共用答案块，标签用半角[]

听力边界：
  甲卷: "第一节" → "第二部分"（含笔试部分标记）
  乙卷: "第一节" → "第二部分"  
  新Ⅰ卷: "第一节" → "阅读（共两节" 或 "阅读（共两"

策略：逐行扫描，状态机识别。
"""
import json, re
from pathlib import Path

BASE = Path(__file__).parent.parent
EXTRACT_DIR = BASE / ".work" / "extract" / "2021"
OUTPUT_DIR = BASE / "data" / "exams"


def find_listen_end(text: str, name: str) -> int:
    """定位听力部分的结束位置。"""
    s = text.find("第一节")
    if s < 0:
        return -1

    # 优先标记
    markers = {
        "jia": ["笔试部分", "第二部分", "阅读理解"],
        "yi": ["笔试部分", "第二部分", "阅读理解"],
        "xgk1": ["阅读（共两节", "阅读（共两", "第二部分", "语言运用"],
    }
    for em in markers.get(name, ["第二部分"]):
        p = text.find(em, s + 1)
        if p > 0:
            return p
    return len(text)


def parse_exam(name: str, jiexi_text: str) -> list:
    """解析单卷听力题。"""
    text = jiexi_text.replace("【", "[").replace("】", "]")

    s = text.find("第一节")
    if s < 0:
        return []

    e = find_listen_end(text, name)
    listen = text[s:e] if e > 0 else text[s:]

    # 逐行解析
    lines = listen.split("\n")
    questions = []
    # 多题共用答案块
    pending_ans = {}
    cur_qid = None
    cur_stem = ""
    cur_opts = []
    cur_trans = ""
    state = "idle"  # idle|q|opts|ans|exp|trans

    for line in lines:
        raw = line.rstrip()
        stripped = raw.strip()
        if not stripped:
            continue

        # 标签行
        if stripped.startswith("[答案]"):
            block = stripped[4:].strip()
            # 单答案 "A"
            single = re.match(r"^\s*([A-D])\s*$", block)
            if single:
                pending_ans[cur_qid] = single.group(1)
            else:
                # 多答案 "6.A 7.B" 或 "6. A\n7. B"
                for m in re.finditer(r"(\d+)\s*\.?\s*([A-D])", block):
                    pending_ans[int(m.group(1))] = m.group(2)
            state = "ans"
            continue
        if stripped.startswith("[解析]"):
            state = "exp"
            continue
        if stripped.startswith("[原文]"):
            cur_trans = stripped[4:].strip()
            state = "trans"
            continue

        # 题号行 "N. xxx" 或 "N. What..."
        qm = re.match(r"^(\d+)\.\s*(.+)", stripped)
        if qm:
            # 保存上一题
            if cur_qid is not None:
                questions.append({
                    "id": cur_qid, "stem": cur_stem,
                    "options": sorted(cur_opts, key=lambda o: o["letter"]),
                    "type": "listening", "score": 1.5,
                    "answer": pending_ans.get(cur_qid, ""),
                    "explanation": "略",
                    "transcript": cur_trans,
                })
            cur_qid = int(qm.group(1))
            cur_stem = qm.group(2).strip()
            cur_opts = []
            cur_trans = ""
            state = "q"
            continue

        # 选项行 "A. xxx\tB. xxx\tC. xxx"
        if re.match(r"^[A-C]\.\s", stripped) or "\t" in stripped:
            for om in re.finditer(r"([A-C])\.\s*(.+?)(?:\t|$)", stripped, re.DOTALL):
                cur_opts.append({"letter": om.group(1), "text": om.group(2).strip()})
            if cur_opts:
                state = "opts"
            continue

        # 答案行（无题号的单字母行）
        if state == "ans":
            single = re.match(r"^\s*([A-D])\s*$", stripped)
            if single and cur_qid is not None:
                pending_ans[cur_qid] = single.group(1)
            continue

        # 原文续行
        if state == "trans":
            cur_trans += " " + stripped
            continue

        # 题干续行
        if state == "q":
            cur_stem += " " + stripped
            continue

    # 保存最后一题
    if cur_qid is not None:
        questions.append({
            "id": cur_qid, "stem": cur_stem,
            "options": sorted(cur_opts, key=lambda o: o["letter"]),
            "type": "listening", "score": 1.5,
            "answer": pending_ans.get(cur_qid, ""),
            "explanation": "略",
            "transcript": cur_trans,
        })

    return questions


def main():
    cfgs = [
        ("gk2021-jia", "jia-jiexi.txt", "全国甲卷", "全国", "2021年全国甲卷英语", "legacy", "audio/listening-2021-jiayi.mp3"),
        ("gk2021-yi", "yi-jiexi.txt", "全国乙卷", "全国", "2021年全国乙卷英语", "legacy", "audio/listening-2021-jiayi.mp3"),
        ("gk2021-xgk1", "xgk1-jiexi.txt", "新高考Ⅰ卷", "新高考地区", "2021年新高考Ⅰ卷英语", "new", "audio/listening-2021-xgk1.mp3"),
    ]
    for eid, src_f, paper, region, title, fmt, audio_f in cfgs:
        raw = (EXTRACT_DIR / src_f).read_text(encoding="utf-8")
        name = src_f.split("-")[0]  # jia / yi / xgk1
        qs = parse_exam(name, raw)
        exam = {
            "id": eid, "year": 2021, "paper": paper, "region": region,
            "title": title, "format": fmt, "duration": 120, "totalScore": 150,
            "hasAudio": True, "audio": {"file": audio_f},
            "source": "2021年高考真题",
            "sections": [{
                "key": "listening", "partTitle": "第一部分 听力",
                "secTitle": "", "passages": [], "pool": [],
                "questions": qs,
            }] if qs else [],
        }
        (OUTPUT_DIR / f"{eid}.json").write_text(
            json.dumps(exam, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"{eid}: {len(qs)} 道听力题")

    # 更新 index.json
    idx_path = BASE / "data" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else []
    idx = [e for e in idx if e.get("year") != 2021]
    for eid, src_f, paper, region, title, fmt, audio_f in cfgs:
        d = json.loads((OUTPUT_DIR / f"{eid}.json").read_text(encoding="utf-8"))
        qn = sum(len(s.get("questions", [])) for s in d.get("sections", []))
        idx.append({
            "id": eid, "year": 2021, "paper": paper, "region": region,
            "title": title, "format": fmt, "totalScore": 150, "duration": 120,
            "questionCount": qn, "hasAudio": True,
            "file": f"exams/{eid}.json",
            "quality": "review_required",
            "reviewNote": "2021卷已导入听力原文；客观题需人工抽检。",
        })
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"index.json 已更新，共 {len(idx)} 套试卷")


if __name__ == "__main__":
    main()
