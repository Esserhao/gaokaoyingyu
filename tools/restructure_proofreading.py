"""将短文改错大段解析整理为结构化 explanation；保留原文备份并标记可疑错位。"""
from pathlib import Path
import json, re

ROOT = Path(r"E:\Desk\高考英语网站\data\exams")
TARGETS = {"gk2022-jia.json", "gk2022-yi.json", "gk2023-jia.json", "gk2023-yi.json"}

def points_from_text(text):
    # 解析“1. ... 2. ...”或换行编号，允许编号前有详解标记。
    matches = list(re.finditer(r"(?<!\d)(\d{1,2})\s*[\.、]\s*", text))
    points = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        if not 1 <= n <= 10:
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end():end].strip(" \t\r\n")
        if body:
            points.append({"number": n, "analysis": body})
    # 同一编号只保留最后一段，避免导语/原文答案重复造成污染。
    unique = {}
    for p in points:
        unique[p["number"]] = p
    return [unique[n] for n in sorted(unique)]

def answer_numbers(answer):
    return sorted(set(int(x) for x in re.findall(r"(?<!\d)(\d{1,2})\s*[\.、]", answer or "") if 1 <= int(x) <= 10))

for path in sorted(ROOT.glob("*.json")):
    if path.name not in TARGETS:
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    for section in data.get("sections", []):
        if section.get("key") != "proofreading":
            continue
        for q in section.get("questions", []):
            raw = q.get("explanation", "")
            if isinstance(raw, dict):
                continue
            points = points_from_text(raw)
            nums = answer_numbers(q.get("modelAnswer", ""))
            point_nums = [p["number"] for p in points]
            issues = []
            if nums != list(range(1, 11)):
                issues.append(f"答案编号不是完整1-10：{nums}")
            if path.name == "gk2023-jia.json" and "父亲" in raw:
                issues.append("解析正文疑似误用了2022全国甲卷内容，与2023全国甲卷材料不匹配")
            if path.name == "gk2023-yi.json" and 1 not in point_nums:
                issues.append("解析正文缺少第1处说明")
            q["explanationRaw"] = raw
            q["explanation"] = {
                "summary": raw.split("\n", 1)[0].strip() if raw else "",
                "points": points,
                "format": "proofreading",
                "source": "原始大段解析整理",
                "reviewStatus": "needs_review" if issues else "machine_structured",
                "reviewIssues": issues,
            }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("structured", path.name)
