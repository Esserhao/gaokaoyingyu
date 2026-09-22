/* =====================================================================
   学业分析（#/analysis）+ 诊断卷页面（#/diagnostic、#/diagnostic-result/<id>）
   task.md E1/E2/E3，设计定稿见 交流纪要/2026-08-31.md 附录 B。

   组卷与规则引擎在 js/diagnostic.js（纯逻辑）；本文件只做三件事：
     ① UI.analysis：诊断状态区 + 五块画像 + 每日任务清单（规则引擎产出，
        深链直达、完成回写 taskLog、依据一句话默认可见 + details 展开证据）
     ② UI.diagnosticHome：诊断说明页（范围 / 建议用时 / 听力与写作豁免声明）
     ③ UI.diagnosticResult：按 seed 重放诊断卷，出子技能表现摘要

   边界（对学生明说）：听力暂不在诊断范围（音频未齐）；写作不机器判分，
   只以自评任务出现在方案里。
   ===================================================================== */

window.UI = window.UI || {};
Object.assign(UI, {
  /* ---------- 学业分析主页 ---------- */
  analysis() {
    const lastDiag = Diagnostic.lastDiag();
    const now = Date.now();
    /* input 装配收拢在 Diagnostic.inputFromStore（附录 D）：与首页今日方案
       同一口径——taskDone 当日集合、mistakes/words/history 快照都一致。 */
    const input = Diagnostic.inputFromStore(now);
    const realRecords = Object.keys(Store._load().records || {})
      .filter(id => !id.startsWith('diag-')).length;

    const tasks = Diagnostic.rules(input);

    this.app().innerHTML = this.header('学业分析', true)
      + '<main class="analysis-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">ACADEMIC ANALYSIS</span><h1>学业分析</h1></div>'
      + '<a class="text-btn" href="#/dashboard">返回学习总览</a></div>'
      + this._analysisDiagState(lastDiag, now)
      + this._analysisProfile({
        mistakes: input.mistakes,
        sectionHistory: input.sectionHistory,
        subskillHistory: input.subskillHistory,
        words: input.words,
        realRecords,
      })
      + this._analysisPlan(tasks, input.taskDone)
      + '</main>';
  },

  _dayKey(now) {
    const d = new Date(now);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  /* ① 诊断状态区 */
  _analysisDiagState(lastDiag, now) {
    if (!lastDiag) {
      return '<section class="analysis-diag none">'
        + '<div><b>还没有做过学业诊断</b>'
        + '<p>做一张 24 题的诊断卷（约 18 分钟，全部来自历年真题），'
        + '我会按结果给你排每天的任务。</p></div>'
        + '<a class="primary-btn" href="#/diagnostic">开始诊断 →</a></section>';
    }
    const days = Math.floor((now - lastDiag.submittedAt) / DAY_MS);
    const locked = days < 7;
    const retest = locked
      ? `<button class="ghost-btn" disabled>复测（${7 - days} 天后解锁）</button>`
      : '<a class="ghost-btn" href="#/diagnostic">再测一次（换一套题）</a>';
    return '<section class="analysis-diag">'
      + '<div><b>上次诊断：' + new Date(lastDiag.submittedAt).toLocaleDateString('zh-CN')
      + ' · 得分 ' + (lastDiag.score ?? '?') + ' / ' + (lastDiag.total ?? 24) + '</b>'
      + '<p>距离上次诊断 ' + days + ' 天。方案每天会按你的练习数据自动滚动，'
      + '复测用来验证这些天的训练有没有见效。</p></div>'
      + retest + '</section>';
  },

  /* ② 画像区：五块 */
  _analysisProfile(input) {
    const dueMistakes = Review.due(input.mistakes).length;
    const pendingMistakes = input.mistakes.filter(x => x.reviewStatus !== '已掌握').length;
    const dueWords = Review.due(Object.entries(input.words).map(([w, r]) => ({ word: w, ...r }))).length;
    const tiers = { '生疏': 0, '在练': 0, '稳定': 0 };
    const staleList = [];
    Subskill.all().forEach(s => {
      const t = Subskill.tierOf(input.subskillHistory, s.id);
      if (!t) return;
      tiers[t.tier]++;
      if (t.tier === '生疏') staleList.push({ s, t });
    });
    const untrained = Subskill.all().length - Object.keys(input.subskillHistory || {}).filter(k => (input.subskillHistory[k] || []).length).length;

    /* 综合状态一句话 */
    const parts = [];
    if (dueMistakes) parts.push(dueMistakes + ' 道错题待回炉');
    if (dueWords) parts.push(dueWords + ' 个生词到期');
    const staleCount = staleList.length;
    if (staleCount) parts.push(staleCount + ' 个子技能生疏');
    if (!parts.length) parts.push(input.realRecords || input.mistakes.length
      ? '各维度状态良好' : '还是一张白纸——先做一次诊断或一套真题');

    /* 分题型条形 */
    const typeNames = { reading: '阅读理解', seven: '七选五', cloze: '完形填空',
      grammar: '语法填空', listening: '听力理解' };
    const typeRows = Object.keys(typeNames).map(key => {
      const arr = input.sectionHistory[key] || [];
      let correct = 0, total = 0;
      arr.forEach(r => { correct += r.correct || 0; total += r.total || 0; });
      const pct = total ? Math.round(correct / total * 100) : null;
      const width = pct != null ? Math.min(100, Math.max(8, pct)) : 0;
      return '<div class="ability-row">'
        + `<span>${typeNames[key]}</span>`
        + `<i><u style="width:${width}%"></u></i>`
        + `<b>${pct != null ? pct + '%' : '待开始'}</b></div>`;
    }).join('');

    /* 错因结构 */
    const causeMap = {};
    input.mistakes.forEach(x => { const k = x.cause || '未分类'; causeMap[k] = (causeMap[k] || 0) + 1; });
    const causeTotal = input.mistakes.length || 1;
    const causeRows = Object.entries(causeMap).sort((a, b) => b[1] - a[1])
      .map(([k, c]) => '<div class="ability-row">'
        + `<span>${this.esc(k)}</span>`
        + `<i><u style="width:${Math.round(c / causeTotal * 100)}%"></u></i>`
        + `<b>${Math.round(c / causeTotal * 100)}%</b></div>`).join('')
      || '<p class="word-note">还没有错题记录。</p>';

    /* 知识节点薄弱榜 */
    const nodeCount = {};
    input.mistakes.forEach(m => {
      if (m.reviewStatus === '已掌握' || !m.knowledgeNode) return;
      nodeCount[m.knowledgeNode] = (nodeCount[m.knowledgeNode] || 0) + 1;
    });
    const weakNodes = Object.entries(nodeCount).filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    const weakRows = weakNodes.length
      ? weakNodes.map(([k, c]) => `<a class="weak-node" href="#/knowledge/${encodeURIComponent(k)}">`
          + `${this.esc(k)}<b>${c} 次</b></a>`).join('')
      : '<p class="word-note">暂无薄弱节点（同一节点错 2 次以上才会出现在这里）。</p>';

    /* 子技能生疏明细 */
    const staleChips = staleList.map(({ s, t }) =>
      `<a class="weak-node" href="#/training/${s.section}/skill/${encodeURIComponent(s.id)}">`
      + `${this.esc(s.name)}<b>${t.pct}%</b></a>`).join('');

    /* 写作自评（2026-09-19 循环第八轮）：画像此前没有写作维度——自评数据
       在写作专题一直存着，仪表盘已接，这里补第六块。口径同一份事实层。 */
    const wf = this.writingSelfFacts();
    const wfChips = wf.done.slice(0, 3).map(s => {
      const exam = (window.__EXAMS__ || []).find(e => e.id === s.examId);
      return '<a class="weak-node" href="#/writing/' + encodeURIComponent(s.examId)
        + '/' + encodeURIComponent(s.sectionKey) + '">'
        + this.esc((exam ? exam.paper : s.examId) + ' · ' + wf.typeName(s.sectionKey))
        + '<b>' + this.esc(wf.dimText(s)) + (s.wordcount ? ' · ' + this.esc(String(s.wordcount)) + ' 词' : '')
        + '</b></a>';
    }).join('');
    const writingCard = '<section class="word-card"><h3 class="word-card-title">写作自评</h3>'
      + (wf.done.length
        ? '<p class="analysis-lead">' + wf.done.length + ' 篇已自评'
          + (wf.avg ? '（' + this.esc(wf.avg) + '）' : '')
          + (wf.pending ? ' · 另有 ' + wf.pending + ' 篇已写作未自评' : '') + '</p>'
          + (wf.tally.length ? '<p class="word-note">' + this.esc(wf.tally.join(' · ')) + '</p>' : '')
          + '<div class="word-rel-cards-inline">' + wfChips + '</div>'
        : '<p class="word-note">' + (wf.pending
          ? wf.pending + ' 篇作文还没自评——写作专题底部打分后，这里开始积累。'
          : '还没有写作自评。在写作专题完成一篇文章并自评四项，这里开始积累。') + '</p>')
      + '</section>';

    return '<section class="analysis-profile">'
      + '<section class="word-card"><h3 class="word-card-title">综合状态</h3>'
      + `<p class="analysis-lead">${this.esc(parts.join('；'))}。</p>`
      + '<p class="word-note">另有 ' + untrained + ' 个子技能还没练过、'
      + pendingMistakes + ' 道错题在复习周期内。</p></section>'
      + '<section class="word-card"><h3 class="word-card-title">分题型正确率</h3>'
      + typeRows + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">子技能掌握（最近 10 题）</h3>'
      + '<p class="analysis-lead">生疏 ' + tiers['生疏'] + ' · 在练 ' + tiers['在练']
      + ' · 稳定 ' + tiers['稳定'] + '（另有 ' + untrained + ' 个未练）</p>'
      + (staleChips ? '<div class="word-rel-cards-inline">' + staleChips + '</div>' : '')
      + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">错因结构</h3>'
      + causeRows + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">薄弱知识节点</h3>'
      + weakRows + '</section>'
      + writingCard
      + '</section>';
  },

  /* ③ 方案区：每日任务清单 */
  /* 任务卡（附录 D）：学业分析页与首页「今日方案」共用同一张卡。 */
  taskCardHtml(t) {
    return '<section class="word-card task-card">'
      + '<div class="task-head"><h3>' + this.esc(t.title) + '</h3>'
      + `<button class="text-btn" data-action="analysis-task-done" data-task="${this.esc(t.id)}">✔ 今天完成</button></div>`
      + `<p class="task-why">${this.esc(t.why)}</p>`
      + (t.evidence && t.evidence.length
        ? '<details class="task-evidence"><summary>依据</summary><ul>'
          + t.evidence.map(e => '<li>' + this.esc(e) + '</li>').join('') + '</ul></details>'
        : '')
      + `<a class="primary-btn" href="${this.esc(t.href)}">开始 →</a></section>`;
  },

  _analysisPlan(tasks, done) {
    const taskCard = t => this.taskCardHtml(t);

    const doneCount = done.size;
    return '<section class="analysis-plan"><div class="library-head"><div>'
      + '<span class="eyebrow">TODAY</span><h2>今天的方案</h2></div>'
      + `<span class="text-btn">已完成 ${doneCount} 项</span></div>`
      + (tasks.length
        ? tasks.map(taskCard).join('')
        : '<section class="word-card"><p class="word-note">今天的任务都完成了，'
          + '也可以去 <a href="#/simulation">做一套整卷</a> 保持手感。</p></section>')
      + '</section>';
  },

  /* ---------- 诊断说明页 ---------- */
  diagnosticHome() {
    const lastDiag = Diagnostic.lastDiag();
    const now = Date.now();
    const days = lastDiag ? Math.floor((now - lastDiag.submittedAt) / DAY_MS) : 99;
    const locked = lastDiag && days < 7;
    this.app().innerHTML = this.header('学业诊断', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">DIAGNOSTIC</span><h1>学业诊断</h1></div>'
      + '<a class="text-btn" href="#/analysis">返回学业分析</a></div>'
      + '<section class="word-card">'
      + '<p class="analysis-lead">24 道客观题（阅读 8 · 七选五 3 · 完形 8 · 语法 5），'
      + '全部抽自历年真题，建议用时 18 分钟。</p>'
      + '<ul class="diag-notes">'
      + '<li><b>听力暂不在诊断范围</b>：音频资源还没补齐，听力能力会用你的练习数据分析。</li>'
      + '<li><b>没有作文</b>：写作和短文改错不机器判分，它们会以自评任务出现在方案里。</li>'
      + '<li><b>混着做是故意的</b>：四种题型交错出现——混合练习比整块刷同一题型记得'
      + '更牢，做起来更难受是正常代价，不是题出偏了。</li>'
      + '<li>不用赶时间，但请独立完成——诊断结果只用来给你排任务。</li>'
      + '</ul>'
      + (locked
        ? `<p class="word-note">距上次诊断仅 ${days} 天（需间隔 7 天，避免重复抽到原题）。</p>`
        : '')
      + (locked
        ? `<button class="ghost-btn" disabled>可复测前还需 ${7 - days} 天</button>`
        : '<button class="primary-btn" data-action="diag-start">'
          + (lastDiag ? '再测一次（换一套题）' : '开始诊断') + ' →</button>')
      + '</section></main>';
  },

  /* ---------- 诊断结果页（按 seed 重放诊断卷算子技能表现） ---------- */
  async diagnosticResult(id) {
    const record = Store.getRecord(id);
    if (!record || !record.isDiagnostic) {
      this.app().innerHTML = '<main class="empty-state"><strong>找不到这次诊断</strong>'
        + '<p>记录可能已被清除。</p><a class="primary-btn" href="#/analysis">返回学业分析</a></main>';
      return;
    }
    const exam = await Diagnostic.build(record.diagSeed);
    const keyOf = (s, q) => s.key + '-' + q.id;

    /* 按子技能聚合本次诊断表现 */
    const skMap = {};
    exam.sections.forEach(s => s.questions.forEach(q => {
      const diag = Diagnose.classify({ sectionKey: s.key, stem: q.stem, explanation: q.explanation });
      const node = diag && diag.knowledgeNode;
      if (!node || !Subskill.byId(node)) return;
      const row = skMap[node] || (skMap[node] = { correct: 0, total: 0 });
      row.total++;
      if (UI.eqAnswer(record.answers[keyOf(s, q.id)], q.answer)) row.correct++;
    }));
    const skRows = Object.entries(skMap).map(([k, v]) => ({ name: k, ...v }))
      .sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

    const rows = skRows.map(r => {
      const pct = Math.round(r.correct / r.total * 100);
      const s = Subskill.byId(r.name);
      return '<div class="ability-row">'
        + `<span>${this.esc(s ? s.name : r.name)}</span>`
        + `<i><u style="width:${Math.min(100, Math.max(8, pct))}%"></u></i>`
        + `<b>${pct}%<em style="font-style:normal;font-size:12px;color:#9aa3a0;margin-left:6px">${r.correct}/${r.total}</em></b></div>`;
    }).join('');

    this.app().innerHTML = this.header('诊断结果', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">DIAGNOSTIC RESULT</span><h1>诊断结果</h1></div>'
      + '<a class="text-btn" href="#/analysis">返回学业分析</a></div>'
      + '<section class="word-card"><h3 class="word-card-title">总分 '
      + `${record.score} / ${record.total}</h3>`
      + '<p class="word-note">答对的题已自动归档；答错的题已进错题本（含自动错因）。'
      + '下面按子技能看强弱，越往上越弱。</p></section>'
      + '<section class="word-card"><h3 class="word-card-title">子技能表现</h3>'
      + (rows || '<p class="word-note">本题库暂无法归类这些题。</p>')
      + '</section>'
      + '<a class="primary-btn" href="#/analysis">查看你的学业分析（含每日方案）→</a>'
      + '</main>';
  },
});
