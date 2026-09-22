# -*- coding: utf-8 -*-
"""把 AsunDictionary 通用英汉词典（MIT）转成项目词库的查询型分片。

输入：.work/ecdict_dump.sql —— english-chinese-dict-db-main.zip 里的
      encn_chars_all.txt（TSV，122,432 行，列见该包 createsql.sql）。
输出：
    data/vocab/dict.js         → window.__DICT__（注册表 + 按首字母懒加载）
    data/vocab/dict/<l>.js     → window.__DICT_CACHE__[<l>]（该首字母的分片）

词条只保留：纯英文词（字母/连字符/撇号）、有中文释义的行；
字段 {w, ph, m, f}（词 / 音标 / 释义 / 语料频次）。
用途是**查词兜底**：8 本精选词书都没收的词（尤其低频词和词形变化）来这里查。
主释义仍以精选词书优先（js/ui/word.js 的查询顺序）。
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, '.work', 'ecdict_dump.sql')
OUT_DIR = os.path.join(ROOT, 'data', 'vocab', 'dict')
REGISTRY = os.path.join(ROOT, 'data', 'vocab', 'dict.js')

META = {
    'name': '通用词典（AsunDictionary）',
    'total': 0,
    'source': 'github english-chinese-dict-db（MIT，© 2026 Richasun，汇编自多个开源词库）',
    'file': 'dict/<首字母>.js',
}


def js_value(obj):
    j = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    j = j.replace('\\', '\\\\').replace("'", "\\'").replace('</', '<\\/')
    return j


def main():
    if not os.path.exists(SRC):
        sys.exit('缺少输入文件 ' + SRC)

    kept = 0
    skipped = 0
    shards = {}
    with open(SRC, encoding='utf-8', newline='') as f:
        reader = csv.reader(f, delimiter='\t', quotechar='"', doublequote=True)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        for row in reader:
            if len(row) < len(header):
                skipped += 1
                continue
            w = (row[col['characters']] or '').strip()
            m = (row[col['char_trans']] or '').strip()
            ph = (row[col['char_yb']] or '').strip()
            freq = (row[col['char_nums']] or '').strip()
            if not w or not m:
                skipped += 1
                continue
            # 源数据的多义换行有字面 "\n" 与真实换行两种，统一成中文分号分隔
            m = re.sub(r'\s*(?:\\n|\n)\s*', '；', m.replace('\r', '')).strip('；')
            if w[0].lower() not in 'abcdefghijklmnopqrstuvwxyz':
                skipped += 1      # 重音字母/数字开头的词，查询入口只认 a-z
                continue
            if not all(c.isalpha() and c.isascii() or c in "-'" for c in w):
                skipped += 1
                continue
            entry = {'w': w, 'm': m}
            if ph:
                entry['ph'] = ph
            if freq.isdigit():
                entry['f'] = int(freq)
            shards.setdefault(w[0].lower(), []).append(entry)
            kept += 1

    META['total'] = kept
    os.makedirs(OUT_DIR, exist_ok=True)

    counts = {}
    for letter in sorted(shards):
        entries = sorted(shards[letter], key=lambda e: e['w'].lower())
        counts[letter] = len(entries)
        out = os.path.join(OUT_DIR, letter + '.js')
        with open(out, 'w', encoding='utf-8') as f:
            f.write("window.__DICT_CACHE__ = window.__DICT_CACHE__ || {};\n"
                    "window.__DICT_CACHE__['%s'] = JSON.parse('%s');\n"
                    % (letter, js_value(entries)))

    with open(REGISTRY, 'w', encoding='utf-8') as f:
        f.write("/* 通用英汉词典（AsunDictionary，MIT）—— 查词兜底数据源（C4）。\n"
                "   由 tools/convert_ecdict.py 从 .work/ecdict_dump.sql 生成，勿手改；\n"
                "   分片按首字母懒加载（data/vocab/dict/<l>.js），主释义仍以 8 本精选词书优先。 */\n")
        f.write("window.__DICT_CACHE__ = window.__DICT_CACHE__ || {};\n")
        f.write("window.__DICT__ = %s;\n" % js_value(
            {'meta': META, 'letters': ''.join(sorted(counts))}))
        f.write("window.__DICT__.load = function (letter) {\n"
                "  if (window.__DICT_CACHE__[letter]) return Promise.resolve(window.__DICT_CACHE__[letter]);\n"
                "  if (this.letters.indexOf(letter) < 0) return Promise.reject(Error('词典分片不存在'));\n"
                "  return new Promise(function (resolve, reject) {\n"
                "    var s = document.createElement('script');\n"
                "    s.src = 'data/vocab/dict/' + letter + '.js';\n"
                "    s.onload = function () {\n"
                "      window.__DICT_CACHE__[letter] ? resolve(window.__DICT_CACHE__[letter])\n"
                "        : reject(Error('词典分片加载失败'));\n"
                "    };\n"
                "    s.onerror = function () { reject(Error('词典分片加载失败')); };\n"
                "    document.head.appendChild(s);\n"
                "  });\n"
                "};\n")

    print('kept:', kept, '| skipped:', skipped, '| shards:', len(counts))
    print('per-letter:', {k: counts[k] for k in sorted(counts)})
    biggest = max(counts, key=lambda k: counts[k])
    size = os.path.getsize(os.path.join(OUT_DIR, biggest + '.js'))
    print('biggest shard: %s (%d entries, %.1f KB)' % (biggest, counts[biggest], size / 1024))


if __name__ == '__main__':
    main()
