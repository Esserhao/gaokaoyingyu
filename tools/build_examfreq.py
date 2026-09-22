"""把真题卷面文本统计成词条页「真题考频」数据（交流纪要 2026-09-05 附录 C3）。

用法：
    python tools/build_examfreq.py            # 统计 + 一致性检查 + 生成 data/examfreq.js
    python tools/build_examfreq.py --check    # 只跑一致性检查，不写文件

为什么有这一步：zhenti 参考站的会员卖点「生词本真题常见义优先」，本站其实
更有资格做 —— 本地全套真题语料可以统计每个词形的出现卷次/次数，词条页把
考频与真题原句置顶。统计完全离线，产物仍是 <script> 注入全局（数据铁律），
且约 MB 级，由 js/ui/word.js 的 _freqReady() 按需注入，不进首屏。

数据源（只读）：
    data/index.json          试卷索引（与 data/index.js 同源）
    data/exams/<id>.json     各套试卷全文（sections / passages / questions）
    data/vocab/*.js          8 本词书（词目表；词组含空格的条目跳过）
产出（写入）：
    data/examfreq.js         window.__EXAM_FREQ__ = {meta, words, phrases}
    data/examwords.js        window.__EXAM_WORDS__ = {examId: [[词, 本卷次数]…]}
                             —— 每卷考点词精简榜（top 15），词条页预读块用，
                             仅数 KB，随 data/index.js 急加载。

每卷考点词口径：本卷出现 ≥2 次、词长 ≥3、且全语料卷次在 2–14 之间
（16 卷全勤的 be/have 类基础词与仅出现 1 卷的孤立词都不算「考点词」），
按本卷次数降序取 15 个。

词形口径：
    token = 正则 [A-Za-z][A-Za-z'-]*，lower() 后剥掉首尾的 ' 和 -
    （与 js/ui/word.js wordFromPoint 的取词口径一致）；所有格 's / s' 归并到
    主动词形。词目变体按常规屈折规则派生（复数/-ed/-ing/-er/-est/-ly，
    含 e 去尾、CVC 双写、辅音+y→i）；不规则变化（went→go 等）不在规则内，
    会漏计 —— 见 meta.rule。

一致性检查（任一失败退出码 1，不写文件）：
    1) data/index.json 与 data/exams/*.json 的 id 集合互相一致；
    2) 每条例句所属 examId 必须存在于题库，且例句文本确实包含该词目的
       某一表面形（防切句/窗口截断错位）；
    3) 每个产出词目 papers ≥ 1 且 hits ≥ papers。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_JSON = os.path.join(ROOT, "data", "index.json")
EXAMS_DIR = os.path.join(ROOT, "data", "exams")
OUT_JS = os.path.join(ROOT, "data", "examfreq.js")
VOCAB_DIR = os.path.join(ROOT, "data", "vocab")

MAX_EXAMPLES = 2          # 每个词目最多例句数；同一套卷只取一条
SENT_WINDOW = 150         # 例句截断长度
SENT_PAD = 40             # 截断窗口向匹配点前多留的字符

TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'-]+")
VOWELS = "aeiou"

# 不规则变化表面形 → 词目（保守清单：只收高频且无歧义的）。
# 口径说明（同步进 meta.rule）：规则派生（复数/-ed/-ing/-er/-est/-ly，含去 e、
# CVC 双写、辅音+y→i）之外的高频屈折在此人工列出；比较级 better/worse 等两可
# 形式（自身也是词条）刻意不收，避免双向膨胀。词目不在词书里时自然不生效。
IRREGULAR = {
    # be / have / do / go
    "was": "be", "were": "be", "been": "be", "am": "be",
    "has": "have", "had": "have",
    "did": "do", "done": "do", "does": "do",
    "went": "go", "gone": "go", "goes": "go",
    # e 动词的不规则过去式/分词拼写（规则派生出的 *d/*ed 形不存在）
    "made": "make", "took": "take", "taken": "take", "came": "come",
    "became": "become", "gave": "give", "given": "give", "wrote": "write",
    "written": "write", "drove": "drive", "driven": "drive", "rode": "ride",
    "ridden": "ride", "rose": "rise", "risen": "rise", "broke": "break",
    "broken": "break", "spoke": "speak", "spoken": "speak", "woke": "wake",
    "woken": "wake", "chose": "choose", "chosen": "choose", "forgot": "forget",
    "forgotten": "forget", "hid": "hide", "hidden": "hide", "ate": "eat",
    "eaten": "eat", "fell": "fall", "fallen": "fall", "shook": "shake",
    "shaken": "shake", "wore": "wear", "worn": "wear", "tore": "tear",
    "torn": "tear", "blew": "blow", "blown": "blow", "grew": "grow",
    "grown": "grow", "knew": "know", "known": "know", "threw": "throw",
    "thrown": "throw", "drew": "draw", "drawn": "draw", "flew": "fly",
    "flown": "fly", "saw": "see", "seen": "see",
    # i→a/u 元音变换
    "ran": "run", "sat": "sit", "won": "win", "sang": "sing", "sung": "sing",
    "swam": "swim", "swum": "swim", "drank": "drink", "drunk": "drink",
    "began": "begin", "begun": "begin", "rang": "ring", "rung": "ring",
    # -t / -d 型
    "told": "tell", "sold": "sell", "felt": "feel", "kept": "keep",
    "slept": "sleep", "crept": "creep", "swept": "sweep", "left": "leave",
    "lost": "lose", "met": "meet", "held": "hold", "fed": "feed",
    "led": "lead", "built": "build", "lent": "lend", "sent": "send",
    "spent": "spend", "bent": "bend", "meant": "mean", "dealt": "deal",
    "stood": "stand", "understood": "understand", "lay": "lie", "lain": "lie",
    "laid": "lay",
    # -ought / -aught / 其它
    "brought": "bring", "bought": "buy", "thought": "think",
    "caught": "catch", "taught": "teach", "sought": "seek", "fought": "fight",
    "got": "get", "gotten": "get", "found": "find", "paid": "pay",
    "said": "say", "learnt": "learn", "burnt": "burn", "truly": "true",
    # 名词复数
    "children": "child", "men": "man", "women": "woman", "feet": "foot",
    "teeth": "tooth", "mice": "mouse", "geese": "goose",
}


def _cvc(w: str) -> bool:
    """辅音-元音-辅音结尾（不含 w/x/y），用于双写规则。"""
    return (len(w) >= 3 and w[-1] not in VOWELS and w[-1] not in "wxy"
            and w[-2] in VOWELS and w[-3] not in VOWELS)


def variants(w: str) -> set:
    """从词目派生常规屈折表面形（含词目本身）。规则刻意保守：
    只产出常见拼写变体，漏计可接受、误计要避免。"""
    out = {w}
    short = len(w) <= 2
    # 复数
    if not short:
        if w.endswith(("s", "x", "z", "ch", "sh")):
            out.add(w + "es")
        elif w.endswith("y") and w[-2] not in VOWELS:
            out.add(w[:-1] + "ies")
        elif w.endswith("fe"):
            out.add(w[:-2] + "ves")
        elif w.endswith("f"):
            out.add(w[:-1] + "ves")
        else:
            out.add(w + "s")
    # 过去式 / 过去分词
    if not short:
        if w.endswith("e"):
            out.add(w + "d")
        elif w.endswith("y") and w[-2] not in VOWELS:
            out.add(w[:-1] + "ied")
        else:
            out.add(w + "ed")
            if _cvc(w):
                out.add(w + w[-1] + "ed")
    # 现在分词
    if w.endswith("ie"):
        out.add(w[:-2] + "ying")
    elif w.endswith("e") and not w.endswith("ee"):
        out.add(w[:-1] + "ing")
    else:
        out.add(w + "ing")
        if _cvc(w):
            out.add(w + w[-1] + "ing")
    # 比较级 / 最高级
    if not short:
        if w.endswith("e"):
            out.add(w + "r")
            out.add(w + "st")
        elif w.endswith("y") and w[-2] not in VOWELS:
            out.add(w[:-1] + "ier")
            out.add(w[:-1] + "iest")
        else:
            out.add(w + "er")
            out.add(w + "est")
            if _cvc(w):
                out.add(w + w[-1] + "er")
                out.add(w + w[-1] + "est")
    # 副词
    if not short:
        if w.endswith("y") and w[-2] not in VOWELS:
            out.add(w[:-1] + "ily")
        else:
            out.add(w + "ly")
    return out


def lemma_surfaces(w: str) -> set:
    """词目的全部表面形 = 规则屈折 ∪ 不规则表（IRREGULAR 的反向）。
    surf2lemmas、频次聚合、例句定位都用这一份，保证口径单一。"""
    out = variants(w)
    for surface, lemma in IRREGULAR.items():
        if lemma == w:
            out.add(surface)
    return out


def load_phrases():
    """词组书（gaokao-phrases.js）里可安全匹配的词组：2–5 个纯字母 token。
    含省略号（no sooner...than 类模式句）、斜杠、括号、数字的条目跳过——
    它们在卷面上的形态无法按连续 token 序列匹配。返回 {token序列键: 原词组}。"""
    path = os.path.join(VOCAB_DIR, "gaokao-phrases.js")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    m = re.search(r"window\.__VOCAB_CACHE__\['[^']+'\]=(\[.*\]);?\s*$", raw, re.S)
    if not m:
        return {}
    out = {}
    for it in json.loads(m.group(1)):
        w = str(it.get("w", "")).strip().lower()
        if not w or re.search(r"[.…()/\d]", w):
            continue
        toks = [normalize_token(t) for t in TOKEN_RE.findall(w)]
        if 2 <= len(toks) <= 5 and all(toks):
            out.setdefault(" ".join(toks), w)
    return out


def load_vocab_lemmas():
    """8 本词书的词目并集。词组（含空格/连字符短语）跳过。"""
    lemmas = set()
    for path in sorted(glob.glob(os.path.join(VOCAB_DIR, "*.js"))):
        name = os.path.basename(path)
        if name in ("index.js", "synonyms.js", "affixes.js", "dict.js",
                    "gaokao-phrases.js"):
            continue
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        m = re.search(r"window\.__VOCAB_CACHE__\['[^']+'\]=(\[.*\]);?\s*$",
                      raw, re.S)
        if not m:
            print(f"  跳过（无法解析）：{name}")
            continue
        for it in json.loads(m.group(1)):
            w = str(it.get("w", "")).strip().lower().rstrip(".")
            if w and " " not in w and re.fullmatch(r"[a-z][a-z'-]*", w):
                lemmas.add(w)
    return lemmas


def normalize_token(t: str) -> str:
    t = t.strip("'-")
    if t.endswith("'s"):
        t = t[:-2]
    elif t.endswith("s'"):
        t = t[:-2]
    return t


def sentences(text) -> list:
    out = []
    for para in str(text).split("\n"):
        para = para.strip()
        if not para:
            continue
        for sent in re.split(r"(?<=[.!?])\s+", para):
            sent = sent.strip()
            if sent:
                out.append(sent)
    return out


def exam_text_units(exam: dict):
    """按优先级产出 (sentence, label) 序列：原文 > 题干/材料 > 选项。"""
    title = exam.get("title", exam.get("id", "?"))
    for tier in range(3):
        for s in exam.get("sections", []):
            part = s.get("partTitle") or s.get("key") or ""
            label = f"{title}·{part}"
            if tier == 0:
                for p in s.get("passages") or []:
                    for sent in sentences(p.get("text", "")):
                        yield sent, label
            elif tier == 1:
                for q in s.get("questions", []):
                    for field in ("stem", "material"):
                        if q.get(field):
                            for sent in sentences(q[field]):
                                yield sent, label
            else:
                for q in s.get("questions", []):
                    for o in q.get("options") or []:
                        # 选项里多是裸词（如 happier / happily），单独一条
                        # 撑不起「真题原句」；至少 4 个词才当例句用。
                        if o.get("text") and len(TOKEN_RE.findall(o["text"])) >= 4:
                            yield o["text"].strip(), label


def check_and_collect():
    with open(INDEX_JSON, encoding="utf-8") as f:
        index = json.load(f)
    index_ids = [e["id"] for e in index]

    exam_files = {}
    for path in sorted(glob.glob(os.path.join(EXAMS_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            ex = json.load(f)
        exam_files[ex["id"]] = ex

    ok = True
    if sorted(index_ids) != sorted(exam_files):
        ok = False
        print(f"检查1失败：index 与 exams 目录 id 不一致 "
              f"（index {len(index_ids)} / 目录 {len(exam_files)}）")

    lemmas = load_vocab_lemmas()
    print(f"词书词目并集：{len(lemmas)}")

    surf2lemmas = {}
    for w in lemmas:
        for var in lemma_surfaces(w):
            surf2lemmas.setdefault(var, set()).add(w)

    phrases = load_phrases()
    print(f"可匹配词组：{len(phrases)}")

    token_count = {}
    token_papers = {}
    examples = {}
    hits_exam = {}   # lemma -> set(examId)
    exam_lemmas = {} # examId -> {lemma: 本卷出现次数}
    phr_count = {}
    phr_papers = {}
    phr_examples = {}

    for eid in index_ids:
        ex = exam_files[eid]
        for sent, label in exam_text_units(ex):
            toks = []
            for m in TOKEN_RE.finditer(sent):
                t = normalize_token(m.group(0).lower())
                if not t:
                    continue
                toks.append((m.start(), t))
                token_count[t] = token_count.get(t, 0) + 1
                token_papers.setdefault(t, set()).add(eid)
            matched = set()
            for _, t in toks:
                matched |= surf2lemmas.get(t, set())
            if matched:
                per_exam = exam_lemmas.setdefault(eid, {})
            for lemma in matched:
                per_exam[lemma] = per_exam.get(lemma, 0) + 1
                hits_exam.setdefault(lemma, set()).add(eid)
                lst = examples.setdefault(lemma, [])
                if len(lst) >= MAX_EXAMPLES:
                    continue
                if any(x["e"] == eid for x in lst):
                    continue
                pos = _first_hit(sent, lemma, surf2lemmas)
                t = _trim(sent, pos)
                lst.append({"t": t, "e": eid, "label": label[:44]})

            # 词组：连续 token n-gram（2–5）查表，一次扫描同时记频次与例句定位
            tl = [t for _, t in toks]
            phr_hits_here = {}
            for n in (2, 3, 4, 5):
                for i in range(len(tl) - n + 1):
                    key = " ".join(tl[i:i + n])
                    if key in phrases:
                        phr_hits_here.setdefault(key, toks[i][0])
            for key, pos in phr_hits_here.items():
                phr_count[key] = phr_count.get(key, 0) + 1
                phr_papers.setdefault(key, set()).add(eid)
                lst = phr_examples.setdefault(key, [])
                if len(lst) < MAX_EXAMPLES and all(x["e"] != eid for x in lst):
                    lst.append({"t": _trim(sent, pos), "e": eid,
                                "label": label[:44]})

    words = {}
    for lemma, exams in hits_exam.items():
        var_list = lemma_surfaces(lemma)
        hits = sum(token_count.get(v, 0) for v in var_list)
        papers = set()
        for v in var_list:
            papers |= token_papers.get(v, set())
        words[lemma] = {
            "hits": hits,
            "papers": len(papers),
            "ex": examples.get(lemma, []),
        }

    phrases_out = {}
    for key, exams in phr_papers.items():
        phrases_out[key] = {
            "w": phrases[key],
            "hits": phr_count.get(key, 0),
            "papers": len(exams),
            "ex": phr_examples.get(key, []),
        }

    # 每卷考点词（data/examwords.js）：见文件头口径说明
    examwords = {}
    for eid, counts in exam_lemmas.items():
        rows = []
        for lemma, n in counts.items():
            info = words.get(lemma)
            if not info or len(lemma) <= 2:
                continue
            if not 2 <= info["papers"] <= 14:
                continue
            rows.append([lemma, n, info["papers"]])
        rows.sort(key=lambda r: (-r[1], -r[2], r[0]))
        examwords[eid] = [[w, n] for w, n, _ in rows[:15]]

    # ---- 检查 2/3 ----
    for lemma, it in words.items():
        for x in it["ex"]:
            if x["e"] not in exam_files:
                ok = False
                print(f"检查2失败：例句 examId 不存在 {lemma} ← {x['e']}")
        if it["papers"] < 1 or it["hits"] < it["papers"]:
            ok = False
            print(f"检查3失败：{lemma} papers={it['papers']} hits={it['hits']}")
    for key, it in phrases_out.items():
        for x in it["ex"]:
            if x["e"] not in exam_files:
                ok = False
                print(f"检查2失败：词组例句 examId 不存在 {key} ← {x['e']}")
        if it["papers"] < 1 or it["hits"] < it["papers"]:
            ok = False
            print(f"检查3失败：词组 {key} papers={it['papers']} hits={it['hits']}")

    print(f"统计到考频的词目：{len(words)} / {len(lemmas)}；词组：{len(phrases_out)}")
    return ok, words, phrases_out, examwords


def _first_hit(sent: str, lemma: str, surf2lemmas: dict) -> int:
    for m in TOKEN_RE.finditer(sent):
        t = normalize_token(m.group(0).lower())
        if lemma in surf2lemmas.get(t, ()):
            return m.start()
    return 0


def _trim(sent: str, pos: int) -> str:
    if len(sent) <= SENT_WINDOW:
        return sent
    start = max(0, pos - SENT_PAD)
    end = min(len(sent), start + SENT_WINDOW)
    out = sent[start:end]
    return ("…" if start > 0 else "") + out + ("…" if end < len(sent) else "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只检查不写文件")
    args = ap.parse_args()

    ok, words, phrases_out, examwords = check_and_collect()
    if not ok:
        print("一致性检查未通过，不生成。")
        return 1

    meta = {
        "exams": len(json.load(open(INDEX_JSON, encoding="utf-8"))),
        "words": len(words),
        "phrases": len(phrases_out),
        "rule": "token=[A-Za-z][A-Za-z'-]+ 剥首尾引号连字符；所有格归并；"
                "常规屈折（复数/-ed/-ing/-er/-est/-ly，e去尾/CVC双写/y→i/f→ves）"
                "与不规则表归回词目；比较级 better/worse 等两可形式不归并；"
                "词组按 2–5 连续 token 序列匹配，含省略号/括号的模式条目跳过。",
    }
    payload = {"meta": meta, "words": dict(sorted(words.items())),
               "phrases": dict(sorted(phrases_out.items()))}
    js = "window.__EXAM_FREQ__=" + json.dumps(payload, ensure_ascii=False,
                                             separators=(",", ":"))
    ew_js = "window.__EXAM_WORDS__=" + json.dumps(
        dict(sorted(examwords.items())), ensure_ascii=False,
        separators=(",", ":"))
    if args.check:
        print(f"--check：检查通过（将生成 {len(js)} + {len(ew_js)} 字节）。")
        return 0
    with open(OUT_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    out_ew = os.path.join(ROOT, "data", "examwords.js")
    with open(out_ew, "w", encoding="utf-8", newline="\n") as f:
        f.write(ew_js)
    print(f"已生成 {OUT_JS}（{len(js)} 字节，{len(words)} 词 + "
          f"{len(phrases_out)} 词组）；{out_ew}（{len(ew_js)} 字节，"
          f"{len(examwords)} 卷考点词）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
