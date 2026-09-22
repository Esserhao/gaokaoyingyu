from pathlib import Path
import json
root = Path(r'E:\Desk\高考英语网站\data\exams')
def repair(s):
    out=[]; inside=False; escaped=False
    for ch in s:
        if inside:
            if escaped:
                out.append(ch); escaped=False; continue
            if ch == chr(92):
                out.append(ch); escaped=True; continue
            if ch == chr(34):
                out.append(ch); inside=False; continue
            if ch == chr(10): out.append('\\n'); continue
            if ch == chr(13): out.append('\\r'); continue
            if ord(ch) < 32: out.append('\\u%04x' % ord(ch)); continue
            out.append(ch)
        else:
            out.append(ch)
            if ch == chr(34): inside=True
    return ''.join(out)
for p in sorted(root.glob('*.json')):
    raw=p.read_text(encoding='utf-8')
    try: json.loads(raw)
    except json.JSONDecodeError:
        data=json.loads(repair(raw))
        p.write_text(json.dumps(data,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
        print('repaired',p.name)
    else: print('ok',p.name)
