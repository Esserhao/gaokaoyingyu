/* =====================================================================
   错题混排重练（F5，#/drill）
   复习队列是「按题单挑」的：一次只面对一道题，看完解析打分。
   这个页面是它的反面 —— 把错题当一场小测验：从错题本里抽出可判分的
   客观题，打乱顺序连做 10 道，当场判定，最后给一张小结。

   「可判分」的口径很挑剔：
     ① 题干必须自足 —— 完形/语法的题干是「第41空」这种残句，
        离开原文没法重做，直接排除；
     ② 选项必须能从题库取回 —— 错题落 localStorage 时白名单没存
        options（见 js/store.js addMistakes），这里按 examId+qid
        回 data/exams/ 现查；查不到的题（卷子加载失败/数据缺）跳过。
   所以实际入池的是阅读理解和听力的错题，这是刻意的：宁少不错。

   复习排期的联动（与复习队列同一套口径）：
     答对 → Store.markMistakeReviewed(idx, '复习中')，阶梯前进一步；
     答错 → 不动排期（这道题本来就还没会，退回明天反而打断既有节奏；
            复习队列会在它到期时再安排）。
   markMistakeReviewed 收的 index 是 getMistakes() 倒序列表的下标，
   错题对象进会话时就把这个下标带上（mIdx），答案判定处直接用。

   渲染与节点练测（A9）同口径：骨架先出、数据回填、盒子级重渲染，
   会话状态放 UI._drill（刷新即丢，进度已逐题落盘）。
   ===================================================================== */

/* 题干自足的题型才有重练价值（残句题干见文件头①） */
const DRILL_SECTIONS = ['reading', 'listening'];

Object.assign(UI, {
  drill() {
    this._drill = null;
    this.app().innerHTML = this.header('错题重练', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">MISTAKE DRILL</span><h1>错题重练</h1></div>'
      + '<a class="text-btn" href="#/review-queue">复习队列 →</a></div>'
      + '<p class="knowledge-intro">'
      + '从错题本抽出 10 道题干完整的客观题打乱重做，答对的题自动推进'
      + '复习阶梯。完形、语法这类离开原文没法重做的题不进池子。</p>'
      + '<div data-drill-box><p class="drill-loading">正在核对错题题干与选项…</p>'
      + '</div></main>';
    this._drillFill();
  },

  async _drillFill() {
    const mistakes = Store.getMistakes();
    /* 回题库现查选项：按 examId 分组加载，单套失败只跳过该套 */
    const byExam = {};
    mistakes.forEach((m, idx) => {
      (byExam[m.examId] = byExam[m.examId] || []).push({ m, idx });
    });
    const ids = Object.keys(byExam);
    const datas = await Promise.all(ids.map(id => {
      const meta = { id, file: 'exams/' + id + '.json' };
      return loadExamData(meta).catch(() => null);
    }));
    const qIndex = {};
    datas.forEach((d, i) => {
      if (!d) return;
      (d.sections || []).forEach(s => (s.questions || []).forEach(q => {
        qIndex[d.id + '::' + q.id] = q;
      }));
    });

    const pool = [];
    ids.forEach((id, i) => {
      if (!datas[i]) return;                       /* 卷子加载失败 → 该套全跳 */
      byExam[id].forEach(({ m, idx }) => {
        if (DRILL_SECTIONS.indexOf(m.sectionKey) < 0) return;
        if (!m.stem || Review.retired(m)) return;   /* 已毕业的不再折腾 */
        const q = qIndex[id + '::' + m.qid];
        if (!q || !Array.isArray(q.options) || q.options.length < 2) return;
        pool.push({ m, mIdx: idx, q });
      });
    });

    const box = document.querySelector('[data-drill-box]');
    if (!box) return;
    if (!mistakes.length) {
      box.innerHTML = '<p class="drill-empty">错题本还是空的。'
        + '先去 <a href="#/training">分题型训练</a> 或 <a href="#/">做一套真题</a>，'
        + '做错的题会自动收进来。</p>';
      return;
    }
    if (!pool.length) {
      box.innerHTML = '<p class="drill-empty">现在错题本里的题都是完形、语法'
        + '这类离开原文没法重做的（或者卷子数据没加载出来），暂时凑不出'
        + '重练卷。阅读、听力的错题会出现在这里。</p>';
      return;
    }
    this._drillPool = pool;
    box.innerHTML = '<div class="drill-entry">'
      + `<p>错题本共 ${mistakes.length} 道，其中 <b>${pool.length}</b> 道`
      + '题干完整、可以直接重做。</p>'
      + '<button class="primary-btn" data-action="drill-start">'
      + (pool.length >= 10 ? '抽 10 道开始重练 →' : `全部 ${pool.length} 道开始重练 →`)
      + '</button>'
      + '<p class="drill-note">答对推进复习阶梯；答错不动排期，'
      + '复习队列到期时还会再见到它们。</p></div>';
  },

  /* 抽题：Fisher-Yates 打乱后取前 10（不足全取） */
  drillStart() {
    const pool = (this._drillPool || []).slice();
    if (!pool.length) return;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const items = pool.slice(0, 10).map(({ m, mIdx, q }) => ({
      m, mIdx,
      stem: q.stem,
      opts: q.options.map((o, i) => {
        const text = (o && typeof o === 'object') ? o.text : o;
        const letter = (o && typeof o === 'object' && o.letter)
          ? String(o.letter) : 'ABCDEFG'.charAt(i);
        return { letter, text };
      }),
      answer: String(q.answer).trim().charAt(0).toUpperCase(),
    }));
    this._drill = { items, pos: 0, right: 0, answered: null, done: false };
    this._drillRender();
  },

  drillAnswer(letter) {
    const s = this._drill;
    if (!s || s.answered || s.done) return;
    const cur = s.items[s.pos];
    const correct = letter === cur.answer;
    s.answered = { letter, correct };
    if (correct) {
      s.right += 1;
      Store.markMistakeReviewed(cur.mIdx, '复习中');
    }
    this._drillRender();
  },

  drillNext() {
    const s = this._drill;
    if (!s || !s.answered) return;
    s.answered = null;
    s.pos += 1;
    if (s.pos >= s.items.length) s.done = true;
    this._drillRender();
  },

  _drillRender() {
    const box = document.querySelector('[data-drill-box]');
    if (!box) return;
    box.innerHTML = this._drillBody();
  },

  _drillBody() {
    const s = this._drill;
    if (!s || s.done) return this._drillSummary(s);

    const cur = s.items[s.pos];
    const head = '<p class="drill-progress">第 ' + (s.pos + 1) + ' / ' + s.items.length
      + ' 题 · ' + this.esc(cur.m.examTitle || '') + '</p>'
      + '<p class="drill-stem">' + this.text(cur.m.stem || '（无题干）') + '</p>';
    const parts = [head];

    if (!s.answered) {
      parts.push('<div class="drill-opts">' + cur.opts.map(o =>
        '<button class="drill-opt" data-action="drill-answer" data-letter="'
        + this.esc(o.letter) + '"><b>' + this.esc(o.letter) + '.</b> '
        + this.esc(o.text) + '</button>').join('') + '</div>');
    } else {
      const okAns = s.answered.correct;
      parts.push('<div class="drill-opts">' + cur.opts.map(o => {
        const cls = o.letter === cur.answer ? ' is-right'
          : (o.letter === s.answered.letter ? ' is-wrong' : '');
        return '<span class="drill-opt' + cls + '"><b>' + this.esc(o.letter)
          + '.</b> ' + this.esc(o.text) + '</span>';
      }).join('') + '</div>');
      const explain = Diagnose.hintText(cur.m);
      parts.push('<p class="drill-verdict ' + (okAns ? 'is-right' : 'is-wrong') + '">'
        + (okAns ? '✓ 答对了，这道题的复习阶梯往前走一步。'
          : '✗ 答错了。正确答案 ' + this.esc(cur.answer) + '，排期不动，'
          + '复习队列到期再见面。') + '</p>'
        + (explain ? '<p class="drill-explain">' + this.text(explain) + '</p>' : '')
        + '<button class="primary-btn" data-action="drill-next">'
        + (s.pos + 1 >= s.items.length ? '看小结 →' : '下一题 →') + '</button>');
    }
    return parts.join('');
  },

  _drillSummary(s) {
    if (!s) return '<p class="drill-empty">会话已失效，刷新页面重新开始。</p>';
    const n = s.items.length;
    const pct = n ? Math.round(s.right / n * 100) : 0;
    return '<div class="drill-entry"><p class="drill-progress">小结</p>'
      + `<p class="drill-score">${s.right} / ${n} · ${pct}%</p>`
      + '<div class="learn-bar"><i style="width:' + pct + '%"></i></div>'
      + '<p class="drill-note">'
      + (s.right === n ? '全对！这些题的复习阶梯都往前走了一步。'
        : '答对的重练题已推进阶梯；答错的等复习队列到期再练。') + '</p>'
      + '<p><a class="text-btn" href="#/review-queue">去复习队列 →</a> '
      + '<a class="text-btn" href="#/mistakes">回错题本 →</a></p>'
      + '<button class="text-btn" data-action="drill-again">再抽一轮 →</button>'
      + '</div>';
  },
});
