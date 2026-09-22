/* =====================================================================
   Diagnostic —— 学业分析的两个纯逻辑件（task.md E1/E3，设计定稿
   见 交流纪要/2026-08-31.md 附录 B）：
     ① 组卷器 build(seed)：从 16 套真题按配额抽 24 道客观题生成诊断卷
     ② 规则引擎 rules(input)：按优先级产出每日任务清单（3~5 项）

   组卷口径：
     - 配额 阅读 8 / 七选五 3 / 完形 8 / 语法 5，**无听力**（全库音频仅
       2021 三套，没有音频的听力题是废题；听力能力用既有数据分析）。
     - 阅读：按 passageLabel 精确取「同一篇的一组题」，每卷最多 3 题，
       含该篇原文；完形/语法/七选五：整篇取自同一套卷的连续题
       （一篇文章的空格号必须连续，否则文章对不上）。
     - 同一 seed 组出同一张卷（复测锁与结果页回放都靠这个）。
     - 题干/选项/答案/解析原样拷贝，不手写新题（题库质量优先）。

   规则引擎口径：
     - 纯函数：同一份 input 算出同一份清单；方案本体不持久化，
       只有「今日已完成任务 id」落在 taskLog（store.js）。
     - 优先级：到期复习（错题/生词）→ 生疏子技能 → 薄弱知识节点 →
       题型空白 → 兜底整卷。反规则：同任务当日不重复（去重由调用方
       传 taskDone）、子技能最多取 2 个、节点最多 1 个、清单封顶 5 项。
   ===================================================================== */

/* DAY_MS 复用 js/review.js 的同名常量（本文件不重复声明，避免 const 冲突） */

const Diagnostic = {
  QUOTA: { reading: 8, seven: 3, cloze: 8, grammar: 5 },
  PART_TITLES: {
    reading: '阅读理解 · 诊断',
    seven: '七选五 · 诊断',
    cloze: '完形填空 · 诊断',
    grammar: '语法填空 · 诊断',
  },

  /* 线性同余伪随机：同一 seed 序列完全一致 */
  rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  },

  /* 组卷。返回可被 UI.exam / Exam.score 直接消费的 exam 对象。 */
  async build(seed = Date.now()) {
    const rand = this.rng(seed);
    const metas = window.__EXAMS__ || [];
    const exams = await Promise.all(metas.map(m => loadExamData(m).catch(() => null)));

    /* 候选池 */
    const readingGroups = [];          // {exam, section, label, questions}
    const singleSources = { seven: [], cloze: [], grammar: [] };
    exams.forEach(exam => {
      if (!exam) return;
      (exam.sections || []).forEach(section => {
        const qs = section.questions || [];
        if (section.key === 'reading') {
          const byLabel = {};
          qs.forEach(q => {
            const label = q.passageLabel || 'A';
            (byLabel[label] || (byLabel[label] = [])).push(q);
          });
          Object.keys(byLabel).sort().forEach(label => {
            if (byLabel[label].length >= 2) {
              readingGroups.push({ exam, section, label, questions: byLabel[label] });
            }
          });
        } else if (singleSources[section.key] && qs.length >= this.QUOTA[section.key]) {
          singleSources[section.key].push({ exam, section });
        }
      });
    });

    const sections = [];
    let usedTotal = 0;

    /* 阅读：打乱文章组后逐组取，每卷 ≤3 题，带原文 */
    let quota = this.QUOTA.reading;
    const groups = readingGroups.slice();
    for (let i = groups.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }
    const rQuestions = [];
    const rPassages = [];
    const perExam = {};
    for (const g of groups) {
      if (quota <= 0) break;
      const take = Math.min(3 - (perExam[g.exam.id] || 0), quota, g.questions.length);
      if (take <= 0) continue;
      g.questions.slice(0, take).forEach(q => { rQuestions.push({ ...q }); quota--; });
      perExam[g.exam.id] = (perExam[g.exam.id] || 0) + take;
      const passage = (g.section.passages || []).find(p => p.label === g.label);
      if (passage) rPassages.push({ ...passage, label: '材料' + (rPassages.length + 1) });
    }
    if (rQuestions.length) {
      sections.push({ key: 'reading', partTitle: this.PART_TITLES.reading,
        passages: rPassages, questions: rQuestions });
      usedTotal += rQuestions.length;
    }

    /* 完形 / 七选五 / 语法：各取一套卷的同一篇，连续 quota 题 */
    [['seven'], ['cloze'], ['grammar']].forEach(([key]) => {
      const pool = singleSources[key];
      if (!pool.length) return;
      const src = pool[Math.floor(rand() * pool.length)];
      const qs = (src.section.questions || [])
        .slice()
        .sort((a, b) => a.id - b.id)
        .slice(0, this.QUOTA[key]);
      if (!qs.length) return;
      sections.push({ key, partTitle: this.PART_TITLES[key],
        passages: (src.section.passages || []).slice(0, 1).map(p => ({ ...p })),
        questions: qs.map(q => ({ ...q })) });
      usedTotal += qs.length;
    });

    /* 全卷重编题号（1..N）：不同卷的题号会撞 key（reading-25 撞 reading-25） */
    let n = 0;
    sections.forEach(s => s.questions.forEach(q => { q.id = ++n; }));

    return {
      id: 'diag-' + seed.toString(36),
      title: '学业诊断卷',
      duration: 18,
      totalScore: sections.reduce((a, s) => a + s.questions.reduce((b, q) => b + (q.score || 0), 0), 0),
      isDiagnostic: true,
      diagSeed: seed,
      hasAudio: false,
      sections,
    };
  },

  /* ---------- 规则引擎 ----------
     input: { now, mistakes, words, sectionHistory, subskillHistory, taskDone:Set }
     返回 [{id, title, why, href, evidence}]，已按优先级排序、封顶 5 项。 */
  rules(input) {
    const tasks = [];
    const DAY = DAY_MS;

    /* R1 到期复习（错题 → 生词） */
    const dueMistakes = Review.due(input.mistakes || []);
    if (dueMistakes.length) {
      tasks.push({ id: 'review:due', title: '错题复习 ' + dueMistakes.length + ' 题',
        why: '你有 ' + dueMistakes.length + ' 道错题今天到期',
        href: '#/review-queue',
        evidence: dueMistakes.slice(0, 3).map(m =>
          (m.examTitle || '') + ' 第 ' + (m.qid ?? '?') + ' 题 · ' + (m.knowledgeNode || '未归类')) });
    }
    const wordList = Object.entries(input.words || {}).map(([w, r]) => ({ word: w, ...r }));
    const dueWords = Review.due(wordList);
    if (dueWords.length) {
      tasks.push({ id: 'words:due', title: '生词复习 ' + dueWords.length + ' 词',
        why: dueWords.length + ' 个生词今天该复习',
        href: '#/words',
        evidence: dueWords.slice(0, 5).map(x => x.word) });
    }

    /* R2 生疏子技能（近 7 天没练过的优先，按正确率升序取 2 个） */
    const lastPracticed = id => {
      const arr = (input.subskillHistory || {})[id] || [];
      return arr.length ? Math.max(...arr.map(e => e.submittedAt || 0)) : 0;
    };
    const stale = Subskill.all()
      .map(s => ({ s, t: Subskill.tierOf(input.subskillHistory, s.id), last: lastPracticed(s.id) }))
      .filter(x => x.t && x.t.tier === '生疏' && input.now - x.last > 7 * DAY)
      .sort((a, b) => a.t.pct - b.t.pct)
      .slice(0, 2);
    stale.forEach(({ s, t }) => {
      tasks.push({ id: 'skill:' + s.id, title: '「' + s.name + '」专项 3 题',
        why: s.name + ' 最近 10 题正确率 ' + t.pct + '%，低于稳定线',
        href: '#/training/' + s.section + '/skill/' + encodeURIComponent(s.id),
        evidence: ['最近 ' + t.total + ' 题答对 ' + t.correct + ' 题',
          '上次练习：' + (t.last ? new Date(lastPracticed(s.id)).toLocaleDateString('zh-CN') : '从未')] });
    });

    /* R3 薄弱知识节点（未掌握的错题按节点计数 ≥2，取最多 1 个） */
    const nodeCount = {};
    (input.mistakes || []).forEach(m => {
      if (m.reviewStatus === '已掌握') return;
      const k = m.knowledgeNode;
      if (!k) return;
      nodeCount[k] = (nodeCount[k] || 0) + 1;
    });
    Object.entries(nodeCount).filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 1)
      .forEach(([k, c]) => {
        tasks.push({ id: 'node:' + k, title: '攻克「' + k + '」',
          why: '「' + k + '」已错 ' + c + ' 次，还没标掌握',
          href: '#/knowledge/' + encodeURIComponent(k),
          evidence: ['共有 ' + c + ' 道未掌握的错题挂在这个节点上'] });
      });

    /* R4 题型空白（从未练过的题型，取 1 个） */
    const typeNames = { reading: '阅读理解', seven: '七选五', cloze: '完形填空',
      grammar: '语法填空', listening: '听力理解' };
    const blank = Object.keys(typeNames)
      .find(k => !(input.sectionHistory || {})[k] || !(input.sectionHistory[k] || []).length);
    if (blank) {
      tasks.push({ id: 'blank:' + blank, title: typeNames[blank] + '还没有练习',
        why: typeNames[blank] + '还没有任何练习记录，先做一套看看底子',
        href: '#/training/' + blank + '/example' });
    }

    /* R5 兜底 */
    if (!tasks.length) {
      tasks.push({ id: 'mock:full', title: '做一套整卷模拟',
        why: '各维度状态良好，做一套真题保持手感',
        href: '#/simulation' });
    }

    /* 当日已完成的不再现；封顶 5 项 */
    return tasks.filter(t => !input.taskDone.has(t.id)).slice(0, 5);
  },

  /* 最近一次诊断记录（含 id）或 null */
  lastDiag() {
    const records = (Store._load() && Store._load().records) || {};
    let best = null;
    Object.entries(records).forEach(([id, r]) => {
      if (r && r.isDiagnostic && (!best || (r.submittedAt || 0) > (best.submittedAt || 0))) {
        best = { ...r, id };
      }
    });
    return best;
  },

  /* ---------- 共享输入构建器（2026-09-05，纪要附录 D）----------
     rules() 是纯函数，但「从 Store 装配 input」这段原来长在学业分析页里。
     首页「今日方案」要用同一套规则，装配收拢到这里：同样的当日 taskDone
     集合、同样的 mistakes/words/history 快照，两处口径不可能再漂移。
     本文件排在 store.js 之后加载，Store 在此可用；rules 本体保持纯函数。 */
  dayKey(now) {
    const d = new Date(now);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  inputFromStore(now) {
    const data = Store._load() || {};
    return {
      now,
      mistakes: Store.getMistakes(),
      words: Store.getWords(),
      sectionHistory: data.sectionHistory || {},
      subskillHistory: data.subskillHistory || {},
      taskDone: new Set(Store.getTaskLog()[this.dayKey(now)] || []),
    };
  },
};
