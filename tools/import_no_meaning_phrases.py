#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
G1 无释义词组补录导入工具。

背景：2026-08-31 词组清洗（tools/clean_phrases.py）剔除了 541 条「清洗后无释义」
的词组，底稿存于 data/vocab/phrases-no-meaning.md（仅备查，不参与网站加载）。
本工具把「人工补释义 → 导入词库」做成可重跑的流水线：

    1) --worksheet   从底稿生成/刷新补录工作表 data/vocab/phrases-supplement.tsv
                     （列：词组 / 级别 / 来源 / 建议释义（AI，未核实）/ 释义（人工填写）。
                      已填内容在刷新时保留；底稿里已消失的词组行自动清理。）
    2) 人工核对      逐条核对「建议释义」列，把认可的解释抄进「释义」列；
                     不认可就改写或留空。导入只认「释义」列。
    3) --import      校验（全部通过才写文件，任何一行有问题即中止并列出问题）：
                       · 释义非空，且过 clean_phrases.clean_meaning 噪音清洗后仍非空
                       · 释义不含制表符/换行；词组非空
                       · 词形归一（lower + 去尾点）后不与 phrases-detail.json 现有条目重复
                       · 工作表内部词形归一后不重复（同词形多来源只取排序居首的来源）
                     通过后：并入 phrases-detail.json（新增 msrc 溯源字段，如实标注
                     「人工补录 <日期>」）→ 按 w 排序写回 → 重新生成
                     gaokao-phrases.js（注意：clean_phrases.py 尾巴仍写旧名 phrases.js，
                     本工具以现行文件名 gaokao-phrases.js 为准）→ 更新 index.js 的
                     total → 从底稿划掉已导入行并更新计数 → 刷新工作表。
    4) --stats       只读报告：待补 / 已填未导 / 已导入。
    --dry-run        与 --import 连用：完整校验与报告，但不写任何文件。

数据铁律：source 不得编造——词组本身仍保留原 Excel 来源；补录释义以 msrc 字段
如实标注为「人工补录」。「建议释义」列只是核对草稿，不进入任何正式数据。
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
VOCAB = os.path.join(ROOT, 'data', 'vocab')
MD_PATH = os.path.join(VOCAB, 'phrases-no-meaning.md')
TSV_PATH = os.path.join(VOCAB, 'phrases-supplement.tsv')
DETAIL_PATH = os.path.join(VOCAB, 'phrases-detail.json')
JS_PATH = os.path.join(VOCAB, 'gaokao-phrases.js')
INDEX_PATH = os.path.join(VOCAB, 'index.js')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_phrases import clean_meaning  # noqa: E402

HEAD = '# 无释义词组补录工作表（G1）—— 由 tools/import_no_meaning_phrases.py 生成\n'
HEAD += '# 用法：核对「建议释义（AI，未核实）」，把认可的解释抄进「释义」列后运行：\n'
HEAD += '#   python tools/import_no_meaning_phrases.py --import [--dry-run]\n'
HEAD += '# 导入只认「释义」列；留空的行跳过。请勿改动前四列或增删行。'
COLS = ['词组', '级别', '来源', '建议释义（AI，未核实）', '释义（人工填写）']


def norm(w):
    return w.lower().strip().rstrip('.')


def parse_md():
    """解析底稿 → [{w, raw, src, level}]；跳过表头与 --- 分隔行。"""
    rows = []
    cur_src = cur_level = None
    for line in open(MD_PATH, encoding='utf-8'):
        s = line.strip()
        hm = re.match(r'^## (.+?)（(.+?)，(\d+) 条）$', s)
        if hm:
            cur_src, cur_level = hm.group(1), hm.group(2)
            continue
        m = re.match(r'^\| (.+?) \| (.+?) \|$', s)
        if m and m.group(1) not in ('词组', '---'):
            rows.append({'w': m.group(1), 'raw': m.group(2), 'src': cur_src, 'level': cur_level})
    return rows


def parse_tsv():
    """解析工作表 → [{w, level, src, sug, m}]（保留填写内容）。跳过注释、列头与空行。"""
    out = []
    for line in open(TSV_PATH, encoding='utf-8'):
        s = line.rstrip('\r\n')
        if not s or s.startswith('#'):
            continue
        parts = s.split('\t')
        if parts[0].strip() == COLS[0]:   # 列头行
            continue
        parts += [''] * (len(COLS) - len(parts))
        out.append({'w': parts[0].strip(), 'level': parts[1].strip(), 'src': parts[2].strip(),
                    'sug': parts[3].strip(), 'm': parts[4].strip()})
    return out


def worksheet_rows(md_rows, old=None):
    """合并底稿与旧工作表：底稿为准，保留旧表已填的 sug / m。"""
    old_map = {norm(r['w']): r for r in (old or [])}
    seen = set()
    out = []
    for r in md_rows:
        k = norm(r['w'])
        if k in seen:      # 同词形多来源只留第一行，导入时同样只取一条
            continue
        seen.add(k)
        o = old_map.get(k, {})
        out.append({'w': r['w'], 'level': r['level'], 'src': r['src'],
                    'sug': o.get('sug', ''), 'm': o.get('m', '')})
    return out


def write_tsv(rows):
    lines = [HEAD, '\t'.join(COLS)]
    for r in rows:
        lines.append('\t'.join([r['w'], r['level'], r['src'], r['sug'], r['m']]))
    with open(TSV_PATH, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')


def load_detail():
    with open(DETAIL_PATH, encoding='utf-8') as f:
        return json.load(f)


def regen_js(detail):
    """重新生成 gaokao-phrases.js（现行文件名；格式与 clean_phrases.py 一致）。"""
    simple = []
    for p in detail:
        item = {'w': p['w'], 'm': p['m']}
        if p.get('ex'):
            item['ex'] = p['ex']
        if p.get('exCn'):
            item['exCn'] = p['exCn']
        simple.append(item)
    js = ("window.__VOCAB_CACHE__=window.__VOCAB_CACHE__||{};"
          + "window.__VOCAB_CACHE__['gaokao-phrases']="
          + json.dumps(simple, ensure_ascii=False) + ";")
    with open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write(js)


def update_index_total(total):
    with open(INDEX_PATH, encoding='utf-8') as f:
        idx = f.read()
    idx2 = re.sub(r'(\{"id":"gaokao-phrases".*?"total":)\d+', r'\g<1>' + str(total), idx)
    if idx2 == idx:
        raise RuntimeError('index.js 的 gaokao-phrases total 未能更新（正则未命中）')
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        f.write(idx2)


def rewrite_md(md_rows, imported_norms):
    """从底稿中移除已导入词组行，更新各来源计数与头部说明。"""
    remain = [r for r in md_rows if norm(r['w']) not in imported_norms]
    by_src = {}
    for r in remain:
        by_src.setdefault((r['src'], r['level']), []).append(r)
    today = datetime.date.today().isoformat()
    lines = ['# 词组数据 · 无释义条目备查', '',
             f'> 共 **{len(remain)}** 条。这些词组在 2026-08-31 的词组清洗',
             '（`tools/clean_phrases.py`）中被剔除，未录入网站词库与星图。',
             '剔除口径：清洗后中文释义为空 —— 或源数据本就没有释义（「无」/空），',
             '或释义整段是语料例句噪音（以「我/你/他…」开头的完整句），被判定不可信。',
             f'> {today} 起，补录导入走 `tools/import_no_meaning_phrases.py` 流水线',
             '（工作表 `phrases-supplement.tsv`）；已补录导入的条目从本清单移除。', '']
    for (src, level) in sorted(by_src):
        items = by_src[(src, level)]
        lines.append(f'## {src}（{level}，{len(items)} 条）')
        lines.append('')
        lines.append('| 词组 | 源数据释义 |')
        lines.append('| --- | --- |')
        for p in items:
            raw = p['raw'].replace('|', '\\|').replace('\n', ' ')
            note = '　※噪音已清' if raw.strip() else ''
            lines.append(f"| {p['w']} | {raw if raw.strip() else '（无）'}{note} |")
        lines.append('')
    with open(MD_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def do_import(dry_run):
    if not os.path.exists(TSV_PATH):
        sys.exit('找不到工作表 ' + TSV_PATH + '，先运行 --worksheet 生成')
    ws = parse_tsv()
    detail = load_detail()
    have = {norm(p['w']) for p in detail}
    md_rows = parse_md()

    todo, problems = [], []
    seen = {}
    for i, r in enumerate(ws, start=1):
        if not r['m']:
            continue
        k = norm(r['w'])
        if not r['w']:
            problems.append(f'第{i}行：词组为空')
            continue
        if k in have:
            problems.append(f'第{i}行「{r["w"]}」：与 phrases-detail.json 现有条目重复')
        if k in seen:
            problems.append(f'第{i}行「{r["w"]}」：与第{seen[k]}行词形重复（同词形只导一条）')
        cm = clean_meaning(r['m'])
        if not cm:
            problems.append(f'第{i}行「{r["w"]}」：释义清洗后为空（疑似噪音句，参考 clean_meaning 口径）')
        if '\t' in r['m'] or '\n' in r['m']:
            problems.append(f'第{i}行「{r["w"]}」：释义含制表符/换行')
        seen.setdefault(k, i)
        todo.append({'row': i, 'w': r['w'], 'm': cm, 'level': r['level'], 'src': r['src'], 'key': k})

    filled = sum(1 for r in ws if r['m'])
    print(f'工作表共 {len(ws)} 行，已填释义 {filled} 行，待导入 {len(todo)} 行')
    if problems:
        print(f'\n校验未通过（{len(problems)} 处），未写任何文件：')
        for p in problems:
            print('  ✗ ' + p)
        sys.exit(1)
    if not todo:
        print('没有可导入的行。核对建议释义后，把认可的解释填进「释义」列再运行。')
        return

    if dry_run:
        print('\n--dry-run 校验通过，将导入以下条目（未写文件）：')
        for t in todo:
            print(f'  + {t["w"]}  [{t["level"]}]  {t["m"][:40]}')
        print(f'\n导入后词组总量：{len(detail)} → {len(detail) + len(todo)}')
        return

    # 正式写：detail → js → index → 底稿 → 工作表
    today = datetime.date.today().isoformat()
    for t in todo:
        detail.append({'w': t['w'].strip().rstrip('.'), 'm': t['m'],
                       'level': t['level'], 'src': t['src'],
                       'msrc': f'人工补录 {today}'})
    detail.sort(key=lambda x: x['w'].lower())
    with open(DETAIL_PATH, 'w', encoding='utf-8') as f:
        json.dump(detail, f, ensure_ascii=False, indent=2)
    regen_js(detail)
    update_index_total(len(detail))
    rewrite_md(md_rows, {t['key'] for t in todo})
    imported_norms = {t['key'] for t in todo}
    remaining = worksheet_rows(parse_md(), [r for r in ws if norm(r['w']) not in imported_norms])
    write_tsv(remaining)
    print(f'✓ 导入 {len(todo)} 条：phrases-detail.json {len(detail) - len(todo)} → {len(detail)}')
    print('✓ 已重新生成 gaokao-phrases.js；index.js total 已同步')
    print(f'✓ 底稿剩余 {len(remaining)} 条待补；工作表已刷新')
    print('提示：网站显示词组总数的界面可能有变化，建议跑一遍 53 路由快照护栏确认。')


def do_worksheet():
    old = parse_tsv() if os.path.exists(TSV_PATH) else []
    rows = worksheet_rows(parse_md(), old)
    write_tsv(rows)
    filled = sum(1 for r in rows if r['m'])
    print(f'工作表已生成：{len(rows)} 行（释义已填 {filled} 行，保留原有填写内容）→ {TSV_PATH}')


def do_stats():
    md_rows = parse_md()
    detail = load_detail()
    have = {norm(p['w']) for p in detail}
    ws = parse_tsv() if os.path.exists(TSV_PATH) else []
    filled = [r for r in ws if r['m']]
    done = [p for p in detail if str(p.get('msrc', '')).startswith('人工补录')]
    print(f'底稿待补：{len(md_rows)} 条（去重词形 {len({norm(r["w"]) for r in md_rows})}）')
    print(f'工作表：{len(ws)} 行，已填释义 {len(filled)} 行')
    print(f'词库：{len(detail)} 条，其中人工补录 {len(done)} 条')
    print(f'底稿中仍待补（排除已入词库）：{sum(1 for r in md_rows if norm(r["w"]) not in have)} 条')


def main():
    ap = argparse.ArgumentParser(description='无释义词组补录导入工具（G1）')
    ap.add_argument('--worksheet', action='store_true', help='生成/刷新补录工作表 TSV')
    ap.add_argument('--import', dest='do_import', action='store_true', help='导入已填释义的行')
    ap.add_argument('--stats', action='store_true', help='只读统计')
    ap.add_argument('--dry-run', action='store_true', help='与 --import 连用：只校验不写文件')
    args = ap.parse_args()
    if args.worksheet:
        do_worksheet()
    elif args.do_import:
        do_import(args.dry_run)
    elif args.stats:
        do_stats()
    else:
        ap.print_help()


if __name__ == '__main__':
    main()
