"""将短文改错参考答案整理为统一的填空/批改格式。只读输出，不修改题库。"""
from __future__ import annotations
import glob, json, os, re
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'data', 'exams'))

def normalize(text: str) -> list[str]:
    rows=[]
    for raw in str(text or '').splitlines():
        raw=raw.strip()
        if not raw: continue
        m=re.match(r'^(\d+)[.、]?\s*(.*)$',raw)
        if m:
            rows.append(f"{m.group(1)}. {m.group(2).strip()}")
        else:
            rows.append(raw)
    return rows

for path in sorted(glob.glob(os.path.join(ROOT, '*.json'))):
    data=json.load(open(path,encoding='utf-8'))
    for sec in data.get('sections',[]):
        if sec.get('key')!='proofreading': continue
        q=sec.get('questions',[{}])[0]
        print(f"## {os.path.basename(path)} · 第 {q.get('id')} 题")
        print('答题格式：增加写“在……之间加上……”；删除写“删去‘…’”；修改写“把‘原词’改为‘新词’”。')
        print('\n'.join(normalize(q.get('modelAnswer','')) or ['待人工补充']))
        print()
