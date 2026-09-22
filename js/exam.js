/* =====================================================================
   Exam —— 单套试卷的状态机：加载、计时、作答、判分、交卷
   状态是模块级单例（同一时刻只可能有一场考试在进行）。
   作答即写 localStorage 草稿，刷新/断电后 start() 会自动接回。
   ===================================================================== */
const Exam = {
  current: null,      // 当前试卷完整 JSON
  answers: {},        // { '<sectionKey>-<qid>': 学生答案 }
  startedAt: 0,
  remaining: 0,       // 剩余秒数
  timer: null,
  _warned: null,      // { 300: true, 60: true } 已提醒过的倒计时档位
  autoSubmitted: false, // 本次交卷是否由计时归零触发

  /* 答案键统一在这里生成，避免各处手拼字符串拼错 */
  key(sectionKey, qid) { return `${sectionKey}-${qid}`; },

  async load(id) {
    const meta = App.exams.find(x => x.id === id);
    /* 改用按需注入的 loadExamData（file:// 下 fetch 会被 CORS 拦截）。
       每次返回 fresh 副本，等价于原 fetch 的 r.json()，避免共享缓存对象
       被后续 meta 赋值等改动污染。 */
    const exam = await loadExamData(meta);
    const copy = JSON.parse(JSON.stringify(exam));
    copy.meta = meta || {};
    return copy;
  },

  allQuestions(exam) {
    return exam.sections.flatMap(s => s.questions.map(q => ({ ...q, section: s })));
  },

  /* 计时口径（2026-09-03 修订）：开考时刻落 localStorage，剩余秒数由挂钟
     推导。刷新、关标签几小时后再回来都接着走，不再凭空多出一整场时间
     —— 改前 start() 每次都把 remaining 重置为满时长，做到一半刷新就满血
     复活，「限时模考」形同虚设，成绩页的「用时」也是按重置后的计时
     倒推出来的假数字。

     只存一个起点时间戳，不每秒回写：一秒一次整包 JSON.stringify 会拖慢
     写作长文的输入。交卷时清掉，「重新练习」才会重新计时。 */
  start(exam) {
    this.current = exam;
    this.answers = { ...Store.getDraft(exam.id) };
    const total = (exam.duration || 120) * 60;
    const clock = Store.getExamClock(exam.id);
    this.startedAt = (clock && clock.startedAt) || Date.now();
    Store.saveExamClock(exam.id, this.startedAt);
    this.remaining = Math.max(0, total - Math.floor((Date.now() - this.startedAt) / 1000));

    this.autoSubmitted = false;

    /* 续算回来时若某个提醒档位已经过去，直接标记成已提醒：
       否则刚一进页面就连弹两条「还剩 5 分钟 / 1 分钟」，反而更吵。
       这种情形下顶栏的红色 urgent 已经是足够的信号。 */
    this._warned = {};
    for (const at of Exam.WARN_AT) if (this.remaining <= at) this._warned[at] = true;

    clearInterval(this.timer);
    /* 学业诊断卷不倒计时（设计定稿附录 B.7：倒计时会让不会的学生乱蒙，
       污染诊断数据；顶栏显示建议用时即可），也不自动交卷。
       错题重做卷（附录 E1）同口径：检验性小卷，只给建议用时。 */
    if (!exam.isDiagnostic && !exam.isRedo) {
      this.timer = setInterval(() => this.tick(), 1000);
    }
  },

  /* 每秒一次：只换文本节点并切换 urgent 类，不重渲染顶栏 ——
     否则每秒都会打断正在输入的填空。
     只认练习页自己的 [data-exam-timer]：学生没交卷就跑去翻别的页时
     定时器还在走，而解析页/成绩页顶栏也有 .timer —— 用通用类名会
     把人家的计时文本（乃至 urgent 红色）每秒改写一遍。
     urgent 此前只在 examBar 渲染时算一次，之后每秒只换文本不换 class，
     于是除非打开页面时就剩不到 5 分钟，否则永远看不到时间告警。 */
  tick() {
    const total = (this.current?.duration || 120) * 60;
    this.remaining = Math.max(0, total - Math.floor((Date.now() - this.startedAt) / 1000));

    const el = document.querySelector('[data-exam-timer]');
    if (el) {
      el.replaceChildren(document.createTextNode(UI.time(this.remaining)));
      el.classList.toggle('urgent', this.remaining < 300);
    }

    this.warnTime();

    if (this.remaining <= 0) {
      clearInterval(this.timer);
      this.autoSubmitted = true;
      App.submit(true);
    }
  },

  /* 到点前的两次提醒（5 分钟 / 1 分钟）。走 UI.toast 的 aria-live 区域，
     读屏也能收到；每档只提醒一次。改前时间归零直接跳走，正在写作文的
     学生会被瞬间切到成绩页，事前事后都没有一句解释。 */
  WARN_AT: [300, 60],
  warnTime() {
    for (const at of Exam.WARN_AT) {
      if (this.remaining > at || this._warned?.[at]) continue;
      this._warned[at] = true;
      UI.toast(at >= 300
        ? '还剩 5 分钟，留意给答题卡留出填涂时间。'
        : '还剩 1 分钟，时间到会自动交卷。');
    }
  },

  set(qid, val) {
    this.answers[qid] = val;
    Store.saveDraft(this.current.id, this.answers);
  },

  /* 比对口径集中在一处：去空白 + 忽略大小写。
     直接复用 UI.eqAnswer（与专题/训练判分同一实现）。 */
  isCorrect(section, q) {
    return UI.eqAnswer(this.answers[this.key(section.key, q.id)], q.answer);
  },

  /* 判分只处理带 answer 的题。短文改错与两类写作（全库共 32 题）没有唯一
     答案，计入 manualSections 交自评/人工，绝不参与自动得分 —— 否则学生会
     看到一个把 40 分作文一律算 0 的假分数。 */
  score(exam) {
    let score = 0;
    let total = 0;                 // 全卷客观题总数（用于结果页的总体口径）
    const sectionScores = {};
    const manualSections = [];

    for (const section of exam.sections) {
      let correct = 0;
      let count = 0;               // 本部分客观题数
      let manual = 0;

      for (const q of section.questions) {
        if (q.answer == null) { manual++; continue; }
        count++;
        total++;
        if (this.isCorrect(section, q)) {
          correct++;
          score += Number(q.score || 1);
        }
      }

      if (manual) {
        manualSections.push({
          key: section.key,
          title: section.partTitle || section.key,
          count: manual,
        });
      }
      /* 这里必须写本部分的 count，而不是累计的 total。
         改前误用了外层 total，于是结果页各部分的分母是「到此为止的累计题数」：
         听力 x/20、阅读 y/35、七选五 z/40、完形 w/60……分母越往后越离谱，
         进度条宽度 correct/total 也跟着被压缩。 */
      sectionScores[section.partTitle || section.key] = { correct, total: count, manual };
    }

    return { score, total, sectionScores, manualSections };
  },

  /* 子技能拆分（task.md §8.4 B2）：把本卷客观题按 12 个子技能归类聚合。
     归类复用 Diagnose 的口径（解析考点名 → 听力题干 → 题型兜底），
     只有落在 Subskill 表内的节点才计入 —— 语法类节点归知识体系，
     固定短语等不在 12 个子技能里的节点不强行塞进任何一项。
     必须在 clearDraft 之前调用：isCorrect 依赖 this.answers。 */
  subskillBreakdown(exam) {
    const out = {};
    for (const section of exam.sections) {
      for (const q of section.questions) {
        if (q.answer == null) continue;
        const diag = Diagnose.classify({
          sectionKey: section.key, stem: q.stem, explanation: q.explanation,
        });
        const node = diag && diag.knowledgeNode;
        if (!node || !Subskill.byId(node)) continue;
        const s = out[node] || (out[node] = { correct: 0, total: 0 });
        s.total++;
        if (this.isCorrect(section, q)) s.correct++;
      }
    }
    return out;
  },

  submit(auto = false) {
    try {
      clearInterval(this.timer);
      const exam = this.current;
      const result = this.score(exam);
      const used = (exam.duration || 120) * 60 - this.remaining;

      Store.saveRecord(exam.id, {
        ...result,
        answers: { ...this.answers },
        submittedAt: Date.now(),
        durationUsed: used,
        /* 本卷满分随记录落账（2026-09-19）：仪表盘得分趋势要用
           score/totalScore 折得分率——120 分制的甲乙卷和 150 分制的新高考卷
           裸分画在同一条线上是误导。旧记录没有这两个字段，趋势图据此跳过。 */
        examId: exam.id,
        totalScore: exam.totalScore,
        /* 由计时归零触发的自动交卷。成绩页据此说明「时间到，已自动交卷」
           —— 改前直接跳走什么都不说，正在写作文的学生不知道发生了什么。 */
        autoSubmitted: !!auto,
        /* 学业诊断卷（E1）：标记随记录落账，画像/按卷统计据此排除；
           结果页按 diagSeed 重放组卷算子技能表现。 */
        isDiagnostic: !!exam.isDiagnostic,
        diagSeed: exam.diagSeed,
        /* 错题重做卷（附录 E1）：同样不进能力历史、不重收错题，
           本次对错看这份记录本身。 */
        isRedo: !!exam.isRedo,
        redoOf: exam.redoOf || null,
      });
      /* 诊断/重做都是测量不是训练：能力历史（sectionHistory/subskillHistory）
         只收真题，保持训练数据的口径纯净 —— 诊断表现由结果页按记录现算。 */
      if (!exam.isDiagnostic && !exam.isRedo) {
        Store.addSectionHistory(exam, { ...result, submittedAt: Date.now() });
        Store.addSubskillHistory(this.subskillBreakdown(exam), Date.now(), exam.id);
      }
      Store.clearDraft(exam.id);
      Store.clearExamClock(exam.id);

      /* 错题重做卷不重收错题（addMistakes 无去重，重做再错会重复堆积）；
         这些题本来就在错题本里，重做的意义就是检验它们。 */
      const mistakes = exam.isRedo ? [] : this.collectMistakes(exam);
      if (mistakes.length) Store.addMistakes(mistakes);

      /* 跳成绩页的前提是用户还在考场（2026-09-19）：计时器跨页存活是有意
         设计，但归零瞬间若人正在别的页面浏览，把人硬拽到成绩页是打断——
         此时 toast 告知一声，记录照常落账（autoSubmitted 标记在），
         成绩可从仪表盘「最近学习」和重做入口查看。 */
      const onExam = /^#\/exam\//.test(location.hash || '');
      if (!auto || onExam) {
        location.hash = exam.isDiagnostic
          ? `#/diagnostic-result/${exam.id}`
          : `#/result/${exam.id}`;
      } else {
        try {
          UI.toast('上一场「' + exam.title + '」时间已到，已自动交卷，成绩见学习总览。');
        } catch (_) { /* 通知失败不影响交卷落账 */ }
      }
    } catch (err) {
      /* 写入失败（配额满/隐私模式）时不能静默卡死：给出错误页，
         草稿仍在 localStorage，用户刷新可接回，不丢进度。 */
      App.renderError(err);
    }
  },

  /* 错题只收客观题。sectionKey 必须带上：错题本用它拼「回到对应训练」链接。

     Diagnose.apply 在这里预填错因三段（词/句/篇章 → 细分 → 知识节点），
     依据是题目自带的 explanation.summary。放在收集时而不是展示时，
     是因为解析对象只有题库里有 —— 错题一旦落进 localStorage，
     后面各页面拿到的就只是白名单里那几个字段了。 */
  collectMistakes(exam) {
    const mistakes = [];
    for (const section of exam.sections) {
      for (const q of section.questions) {
        if (q.answer == null || this.isCorrect(section, q)) continue;
        mistakes.push(Diagnose.apply({
          examId: exam.id,
          examTitle: exam.title,
          sectionKey: section.key,
          qid: q.id,
          type: section.partTitle,
          stem: q.stem,
          myAnswer: this.answers[this.key(section.key, q.id)],
          answer: q.answer,
          explanation: q.explanation,
        }));
      }
    }
    return mistakes;
  },
};
