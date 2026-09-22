/* =====================================================================
   学习总览（dashboard）
   数据全部来自 localStorage：整卷记录、专题记录、错题、草稿。
   没有任何记录时每块都要有明确的空态文案，不能只显示 0。
   ===================================================================== */

/* 能力概览的六行。key 直接拼进 #/training/<key>/example，
   必须与 js/training.js 的题型键一致。 */
const ABILITY_ROWS = [
  ['阅读理解', 'reading'],
  ['完形填空', 'cloze'],
  ['语法填空', 'grammar'],
  ['听力理解', 'listening'],
  ['应用文写作', 'writing_app'],
  ['读后续写', 'writing_cont'],
];

/* 专题复盘统计的题型名。比 RESUMABLE_TOPICS 多出短文改错与两类写作
   —— 那三个不支持草稿恢复，但完成后一样会记一条 topicRecord。 */
const TOPIC_NAMES = {
  reading: '阅读', listening: '听力', cloze: '完形', seven: '七选五',
  grammar: '语法填空', proofreading: '短文改错',
  writing_app: '应用文', writing_cont: '读后续写',
};

/* G2 分数折算的卷制口径（2026-09-03）。分值来自 data/exams/*.json 的
   实际题目 score 之和，已对全部 16 卷核对：同一 format 下每节分值
   完全一致，故按卷制取常量。主观题没有自动正确率，不参与折算，
   只在面板里如实标注「未计入」。 */
const SCORE_FORMATS = {
  legacy: {
    label: '老高考（全国甲/乙卷）',
    objective: { listening: 30, reading: 30, seven: 10, cloze: 30, grammar: 15 },
    subjective: [['短文改错', 10], ['应用文写作', 25]],
  },
  new: {
    label: '新高考卷',
    objective: { listening: 30, reading: 37.5, seven: 12.5, cloze: 15, grammar: 15 },
    subjective: [['应用文写作', 15], ['读后续写', 25]],
  },
};
const SCORE_SECTION_NAMES = {
  listening: '听力理解', reading: '阅读理解', seven: '七选五',
  cloze: '完形填空', grammar: '语法填空',
};

Object.assign(UI, {
  dashboard(exams) {
    const mistakes = Store.getMistakes();
    const data = Store._load();
    const records = Object.values(data.records || {});
    const drafts = Object.keys(data.drafts || {});
    const knowledge = Store.getKnowledgeStats();
    const topicRecords = Store.getTopicRecords();

    const continuePanel = this.dashContinue(exams);
    /* records 以卷号为键。旧记录体内没有 examId（2026-09-03 G2 改前不入账），
       这里从键上补；2026-09-19 起 exam.submit 落账也带 examId 字段，
       两处并存以兼容历史数据。 */
    const recent = Object.entries(data.records || {})
      .filter(([, r]) => r && r.submittedAt)
      .sort((a, b) => (b[1].submittedAt || 0) - (a[1].submittedAt || 0))
      .slice(0, 3)
      .map(([examId, r]) => ({ ...r, examId }));
    const totalAnswered = records.reduce((n, r) => n + Object.keys(r.answers || {}).length, 0);
    const next = mistakes.find(x => x.reviewStatus !== '已掌握');
    const pending = mistakes.filter(x => x.reviewStatus !== '已掌握').length;
    /* 到期数是「今天真的该做几道」，pending 是「还没标掌握的总数」。
       两个都要：前者是今天的行动量（十几道，做得完），后者是欠账总额
       （可能上百道，只用来提示规模）。排期规则见 js/review.js。 */
    const dueCount = Review.due(mistakes).length;
    // （分题型掌握度已改为从 Store.getSectionHistory() 聚合，见下方能力概览；
    //  不再以「总得分 / 记录数」估算单一百分比，故此处不保留 totalScore/pct。）

    /* 首屏行动项的优先级：今天有到期的 → 先清队列；没到期但有欠账 →
       指回错题本；什么都没有 → 去做一套卷子。三档文案都要说清「为什么
       是这件事」，否则学生只看到一个按钮，不知道点进去要干什么。 */
    const hero = '<section class="dashboard-hero"><div>'
      + '<span class="reference-kicker">NEXT STEP</span>'
      + `<h2>${dueCount
        ? `今天有 ${dueCount} 道错题到期，先复习完。`
        : next
          ? '先回炉一个错题，再继续向前。'
          : '先选一套真题，建立第一份学习记录。'}</h2>`
      + `<p>${dueCount
        ? `按 ${Review.INTERVALS.join(' / ')} 天的间隔递进：答得上来就往后拉长，`
          + '答不上来就退回明天。'
        : next
          ? this.esc(next.knowledgeNode || next.subCause || next.type || '待回炉错题')
          : '完成一次练习后，这里会自动生成你的学习轨迹。'}</p></div>`
      + (dueCount
        ? '<a class="primary-btn" href="#/review-queue">进入复习队列 →</a>'
        : next
          ? '<a class="primary-btn" href="#/mistakes">查看待回炉错题 →</a>'
          : '<a class="primary-btn" href="#/simulation">开始真题模拟 →</a>')
      + '</section>'
      /* 学业分析 · 今日方案（附录 D）：有整卷记录后，规则引擎的每日任务直接
         放到学习总览——学生打开第一眼就是「今天该干什么」，点 ✔ 就地勾掉。
         还没有任何记录时保持原横幅，先邀请做一次诊断。 */
      + (records.length ? this._todayPlanHtml() : '<a class="analysis-banner" href="#/analysis">'
        + '<span class="reference-kicker">ACADEMIC ANALYSIS</span>'
        + '<b>学业分析</b>'
        + '<small>做一次诊断，看看你的强弱项和今天该练什么</small>'
        + '<strong>进入 →</strong></a>');

    const stats = '<section class="dashboard-stats">'
      + `<div><b>${records.length}</b><span>次整卷记录</span></div>`
      + `<div><b>${totalAnswered}</b><span>道已作答</span></div>`
      + `<div><b>${dueCount}</b><span>道今天待复习</span></div>`
      + `<div><b>${pending}</b><span>道待回炉错题</span></div>`
      + `<div><b>${Object.keys(knowledge).length}</b><span>个知识节点</span></div>`
      + `<div><b>${topicRecords.length}</b><span>次专题完成</span></div></section>`;

    /* 分题型掌握度：从 Store.getSectionHistory() 按题型键聚合
       「累计对题 / 累计总题」，六行各自反映该题型历史正确率。 */
    const secHistory = Store.getSectionHistory();
    const abilityRows = ABILITY_ROWS.map(([label, key]) => {
      const arr = secHistory[key] || [];
      let correct = 0, total = 0;
      for (const r of arr) { correct += r.correct || 0; total += r.total || 0; }
      const pct = total ? Math.round(correct / total * 100) : null;
      const width = pct != null ? Math.min(100, Math.max(8, pct)) : 0;
      const text = pct != null ? `${pct}%` : '待开始';
      const sub = arr.length ? `<em style="font-style:normal;font-size:12px;color:#9aa3a0;margin-left:6px">${arr.length}次</em>` : '';
      return `<a class="ability-row" href="#/training/${key}/example">`
        + `<span>${label}</span>`
        + `<i><u style="width:${width}%"></u></i>`
        + `<b>${text}${sub}</b></a>`;
    }).join('');

    const recentRows = recent.length
      ? recent.map(r => {
          /* 学业诊断卷/错题重做卷不是真题：链接到各自的结果页而不是
             #/result 的 Exam.load 常规路径（诊断有专页，重做按前缀还原），
             标题也如实标注。 */
          const eid = r.examId || '';
          const isDiag = eid.startsWith('diag-');
          const isRedo = eid.startsWith('redo-');
          const href = isDiag ? '#/diagnostic-result/' + eid : '#/result/' + this.esc(eid);
          const label = isDiag ? '学业诊断卷' : isRedo ? '错题重做卷' : (r.title || '真题练习');
          return `<a class="recent-row" href="${href}">`
            + `<b>${this.esc(label)}</b>`
            + `<span>${r.score || 0} 分 · ${r.submittedAt
              ? new Date(r.submittedAt).toLocaleDateString('zh-CN')
              : '最近完成'}</span></a>`;
        }).join('')
      : '<p class="dashboard-empty">还没有完成记录。先做一套真题，回来查看变化。</p>';

    const grid = '<section class="dashboard-grid"><article class="dashboard-panel">'
      + '<div class="panel-heading"><h2>能力概览</h2><span>按题型继续学习</span></div>'
      + abilityRows + '</article><article class="dashboard-panel">'
      + '<div class="panel-heading"><h2>最近学习</h2>'
      + `<span>${drafts.length ? '有未完成草稿' : ''}</span></div>`
      + recentRows + '</article></section>';

    const snapshot = '<section class="dashboard-panel knowledge-snapshot">'
      + '<div class="panel-heading"><h2>知识节点快照</h2>'
      + '<a href="#/knowledge">打开错题溯源 →</a></div>'
      + (Object.entries(knowledge).slice(0, 6)
        .map(([k, v]) => `<span class="knowledge-pill">${this.esc(k)} · ${v} 题</span>`).join('')
        || '<p class="dashboard-empty">错题标注后，这里会出现你的薄弱节点。</p>')
      + '</section>';

    this.app().innerHTML = this.header('学习总览', true)
      + '<main class="dashboard-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">YOUR STUDY DESK</span><h1>学习总览</h1></div>'
      + '<a class="text-btn" href="#/">回到试卷库</a></div>'
      + hero + continuePanel + stats + this.dashHeatmap() + this.dashWeekly() + grid
      + this.dashScoreBand(exams) + this.dashTrend(records) + this.dashTopicReview(topicRecords)
      + this.dashWritingSelf(Store.getWritingSelfChecks()) + snapshot
      + '</main>';
  },

  /* ---------- 今日方案（附录 D）----------
     规则引擎与学业分析页同一份 input（Diagnostic.inputFromStore），前 3 项
     嵌进学习总览；点 ✔ 由 analysis-task-done 走 app.route() 就地重渲染。
     完整方案（画像 + 全部任务 + 证据）仍在 #/analysis。 */
  _todayPlanHtml() {
    const tasks = Diagnostic.rules(Diagnostic.inputFromStore(Date.now())).slice(0, 3);
    return '<section class="analysis-plan dashboard-plan">'
      + '<div class="library-head"><div>'
      + '<span class="eyebrow">TODAY</span><h2>今天的方案</h2></div>'
      + '<a class="text-btn" href="#/analysis">完整学业分析 →</a></div>'
      + (tasks.length
        ? tasks.map(t => this.taskCardHtml(t)).join('')
        : '<section class="word-card"><p class="word-note">今天的任务都完成了，'
          + '也可以去 <a href="#/simulation">做一套整卷</a> 保持手感。</p></section>')
      + '</section>';
  },

  /* ---------- 本周回顾（附录 F1 / G2）----------
     热力图回答「哪天学了」，这里回答「这一周变化了什么」。
     G2 起统计口径收拢在 _weeklyStats()：卡片是摘要（前 3 条判级变化 +
     完整周报入口），整页在 #/weekly。 */
  _weeklyStats(now = Date.now()) {
    const d = new Date(now);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7).getTime();
    const end = monday + 7 * DAY_MS;   /* 窗口上界：算「上一周」时不得把本周记录算进来 */

    const data = Store._load();
    const recs = Object.entries(data.records || {})
      .filter(([, r]) => r && (r.submittedAt || 0) >= monday && (r.submittedAt || 0) < end);
    const papers = recs.filter(([id]) => !id.startsWith('diag-') && !id.startsWith('redo-')).length;
    const diagN = recs.length - papers;
    const tasks = Object.entries(Store.getTaskLog())
      .filter(([k]) => {
        const [y, m, dd] = k.split('-').map(Number);
        const t = new Date(y, m - 1, dd).getTime();
        return t >= monday && t < end;
      })
      .reduce((a, [, v]) => a + v.length, 0);
    const newWords = Object.values(Store.getWords())
      .filter(r => (r.addedAt || 0) >= monday && (r.addedAt || 0) < end).length;
    const newPhr = Object.values(Store.getPhrases() || {})
      .filter(r => (r.addedAt || 0) >= monday && (r.addedAt || 0) < end).length;
    const newMistakes = Store.getMistakes()
      .filter(x => (x.ts || 0) >= monday && (x.ts || 0) < end).length;

    const sh = data.subskillHistory || {};
    const shBefore = {};
    Object.entries(sh).forEach(([id, arr]) => {
      shBefore[id] = (arr || []).filter(x => (x.submittedAt || 0) < monday);
    });
    const changes = [];
    Object.keys(sh).forEach(id => {
      const a = Subskill.tierOf(shBefore, id);
      const b = Subskill.tierOf(sh, id);
      const ta = a ? a.tier : '未练';
      const tb = b ? b.tier : '未练';
      if (ta !== tb) changes.push({ id, ta, tb, t: b, up: b && (!a || b.pct >= a.pct) });
    });

    /* 分题型：本周窗口 vs 累计（sectionHistory 每条 {correct,total,submittedAt}） */
    const secWeek = {};
    const secAll = {};
    Object.entries(data.sectionHistory || {}).forEach(([k, arr]) => {
      (arr || []).forEach(x => {
        if (!x.total) return;
        secAll[k] = secAll[k] || { c: 0, t: 0 };
        secAll[k].c += x.correct || 0;
        secAll[k].t += x.total || 0;
        if ((x.submittedAt || 0) >= monday && (x.submittedAt || 0) < end) {
          secWeek[k] = secWeek[k] || { c: 0, t: 0 };
          secWeek[k].c += x.correct || 0;
          secWeek[k].t += x.total || 0;
        }
      });
    });

    return { monday, papers, diagN, tasks, newWords, newPhr, newMistakes, changes, secWeek, secAll };
  },

  _weekDelta(cur, prev) {
    const dv = cur - prev;
    return dv === 0 ? '与上周持平' : `比上周${dv > 0 ? '多' : '少'} ${Math.abs(dv)}`;
  },

  dashWeekly(now = Date.now()) {
    const s = this._weeklyStats(now);
    const chips = s.changes.slice(0, 3).map(c =>
      `<span class="week-chip ${c.up ? 'up' : 'down'}">${this.esc(c.id)}：${this.esc(c.ta)} → ${this.esc(c.tb)}</span>`).join('');
    const chipLine = s.changes.length
      ? '<div class="week-chips">' + chips
        + (s.changes.length > 3 ? `<span class="week-chip">还有 ${s.changes.length - 3} 处</span>` : '') + '</div>'
      : '';

    const active = s.papers + s.diagN + s.tasks + s.newWords + s.newPhr + s.newMistakes;
    const lead = active
      ? `本周交卷 ${s.papers} 套（另有诊断/重做 ${s.diagN} 次）· 完成任务 ${s.tasks} 项 · `
        + `新收生词 ${s.newWords} 个、词组 ${s.newPhr} 组 · 新错题 ${s.newMistakes} 道。`
      : '本周还没有练习记录。从上面的「今天的方案」挑一件事开始，周报就有内容了。';

    return '<section class="dashboard-week"><div class="panel-heading">'
      + '<h2>本周回顾</h2><a class="text-btn" href="#/weekly">完整周报 →</a></div>'
      + `<p class="dashboard-empty">${lead}</p>${chipLine}`
      + '</section>';
  },

  /* ---------- 学习周报整页（附录 G2，#/weekly）----------
     卡片版的完整形态：四块本周数字（各带与上周的对比）、子技能判级
     变化全量（链到对应题型专项）、分题型本周正确率 vs 累计。
     全部口径与首页卡片同源（_weeklyStats），只是不裁剪。 */
  weekly(now = Date.now()) {
    const s = this._weeklyStats(now);
    const prev = this._weeklyStats(s.monday - DAY_MS);
    const weekRange = new Date(s.monday).toLocaleDateString('zh-CN')
      + ' — ' + new Date(s.monday + 6 * DAY_MS).toLocaleDateString('zh-CN');

    const stat = (n, label, pv) => `<div><b>${n}</b><span>${label}`
      + (pv != null ? ` · ${this._weekDelta(n, pv)}` : '') + '</span></div>';
    const statGrid = '<section class="dashboard-stats">'
      + stat(s.papers, '套整卷交卷', prev.papers)
      + stat(s.tasks, '项任务完成', prev.tasks)
      + stat(s.newWords + s.newPhr, '个新收生词/词组', prev.newWords + prev.newPhr)
      + stat(s.newMistakes, '道新错题', prev.newMistakes)
      + '</section>'
      + `<p class="dashboard-empty">${weekRange} · 另有诊断/重做 ${s.diagN} 次</p>`;

    const changeRows = s.changes.length
      ? s.changes.map(c => {
        const sk = Subskill.all().find(x => x.id === c.id);
        const href = sk ? `#/training/${sk.section}/skill/${encodeURIComponent(c.id)}`
          : '#/training';
        const name = sk ? sk.name : c.id;
        return `<a class="recent-row" href="${href}">`
          + `<b>${this.esc(name)}<i class="week-chip ${c.up ? 'up' : 'down'}">${this.esc(c.ta)} → ${this.esc(c.tb)}</i></b>`
          + `<span>${c.t ? `当前 ${c.t.pct}%（最近 ${c.t.total} 题）` : '本周未练'}</span></a>`;
      }).join('')
      : '<p class="dashboard-empty">本周各子技能判级无变化（判级按最近 10 题滚动）。</p>';

    const secRows = Object.keys(s.secAll).length
      ? Object.keys(s.secAll).map(k => {
        const w = s.secWeek[k] || { c: 0, t: 0 };
        const a = s.secAll[k];
        const wp = w.t ? Math.round(w.c / w.t * 100) + '%' : '—';
        const ap = Math.round(a.c / a.t * 100) + '%';
        return '<div class="ability-row">'
          + `<span>${this.esc(SCORE_SECTION_NAMES[k] || k)}</span>`
          + `<i><u style="width:${w.t ? Math.round(w.c / w.t * 100) : 0}%"></u></i>`
          + `<b>本周 ${wp} · 累计 ${ap}</b></div>`;
      }).join('')
      : '<p class="dashboard-empty">还没有分题型练习记录（交整卷后自动累计）。</p>';

    const active = s.papers + s.diagN + s.tasks + s.newWords + s.newPhr + s.newMistakes;
    const lead = active
      ? '这一周的变化都在这里。判级往后走说明练到位了，往后退的题型'
        + '点进去再练一轮——周报只管如实呈现，怎么练回「学业分析」看方案。'
      : '本周还没有练习记录。回「学习总览」从「今天的方案」挑一件事开始。';

    this.app().innerHTML = this.header('学习周报', true)
      + '<main class="dashboard-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">WEEKLY REVIEW</span><h1>学习周报</h1></div>'
      + '<a class="text-btn" href="#/dashboard">返回学习总览</a></div>'
      + '<p class="knowledge-intro">' + lead + '</p>'
      + statGrid
      + '<section class="dashboard-grid">'
      + '<article class="dashboard-panel"><div class="panel-heading">'
      + '<h2>子技能判级变化</h2><span>' + s.changes.length + ' 处</span></div>'
      + changeRows + '</article>'
      + '<article class="dashboard-panel"><div class="panel-heading">'
      + '<h2>分题型正确率</h2><span>本周 vs 累计</span></div>'
      + secRows + '</article></section>'
      + '</main>';
  },

  /* ---------- 打卡日历（F6）：17 周活动热力格 + 连续打卡天数 ----------
     「活动」的口径 = 当天发生过任何一次学习事件：交整卷（submittedAt）、
     完成专题（completedAt）、收错题（ts）、收生词/词组（addedAt）。
     判级只看事件次数：1–2 次、3–5、6–9、10+ 四档深浅。
     streak 从今天往回数；今天还没学不打断（学上一天就算连续，
     鼓励「今天还来得及」而不是一早就把 streak 灭了）。 */
  dashHeatmap() {
    const data = Store._load();
    const days = {};
    const key = ts => {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');
    };
    const bump = ts => { if (!ts) return; const k = key(ts); days[k] = (days[k] || 0) + 1; };
    /* records / words / phrases 是按键的对象，mistakes / topicRecords 是数组 */
    Object.values(data.records || {}).forEach(r => bump(r.submittedAt));
    (data.topicRecords || []).forEach(r => bump(r.completedAt));
    (data.mistakes || []).forEach(m => bump(m.ts));
    Object.values(data.words || {}).forEach(w => bump(w.addedAt));
    Object.values(data.phrases || {}).forEach(p => bump(p.addedAt));

    /* 网格：17 列（周），每列 7 行（周一 → 周日），最后一列到今天为止 */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const DAY = 86400000;
    const start = new Date(today.getTime() - (17 * 7 - 1) * DAY);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // 回到那周的周一

    const level = n => !n ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
    let cells = '', monthMarks = '', done = false;
    let streak = 0;
    for (let col = 0; col < 18 && !done; col++) {          /* 18 列保险，done 截断 */
      let hasFuture = false;
      for (let row = 0; row < 7; row++) {
        const dt = new Date(start.getTime() + (col * 7 + row) * DAY);
        if (dt > today) { hasFuture = true; continue; }
        const n = days[key(dt.getTime())] || 0;
        cells += `<i class="hm-l${level(n)}" title="${dt.getMonth() + 1}月${dt.getDate()}日`
          + ` · ${n} 次活动"></i>`;
      }
      if (hasFuture) done = true;
      /* 月标：该列首日是新月份的第一列才标 */
      const first = new Date(start.getTime() + col * 7 * DAY);
      const prev = new Date(start.getTime() + (col - 1) * 7 * DAY);
      if (col === 0 || first.getMonth() !== prev.getMonth()) {
        monthMarks += `<span>${first.getMonth() + 1}月</span>`;
      } else {
        monthMarks += '<span></span>';
      }
    }
    /* streak：今天有活动从今天数，否则从昨天数 */
    const act = dt => (days[key(dt.getTime())] || 0) > 0;
    const cursor = new Date(today.getTime() - (act(today) ? 0 : DAY));
    while (act(cursor) && streak < 400) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const totalDays = Object.keys(days).length;
    return '<section class="dashboard-panel heatmap-panel">'
      + '<div class="panel-heading"><h2>打卡日历</h2>'
      + `<span>近 17 周 · 有记录 ${totalDays} 天</span></div>`
      + '<div class="heatmap-head"><b class="hm-streak">'
      + (streak ? `🔥 连续打卡 ${streak} 天` : '今天练一轮，点亮第一格')
      + `</b><span>过去 ${17 * 7} 天里，你在 ${totalDays} 天留下过学习记录。</span></div>`
      + '<div class="heatmap-months">' + monthMarks + '</div>'
      + '<div class="heatmap-grid">' + cells + '</div>'
      + '<div class="heatmap-legend">少'
      + '<i class="hm-l0"></i><i class="hm-l1"></i><i class="hm-l2"></i>'
      + '<i class="hm-l3"></i><i class="hm-l4"></i>多</div>'
      + '</section>';
  },

  /* 数据备份与迁移（#15）。整包导出当前设备的 gkyy_records_v1，
     或把另一台设备导出的 JSON 合并进来。写作草稿走独立 localStorage 键，
     不在这套机制里（见 js/store.js 头注），页面要明确告知，避免学生
     以为一篇写到一半的作文也跟着备份走了。 */
  dataManager() {
    const d = Store._load();
    const stat = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
    const stats = '<section class="dashboard-stats sync-stats">'
      + stat(Object.keys(d.records || {}).length, '套整卷成绩')
      + stat(Object.keys(d.drafts || {}).length, '份整卷草稿')
      + stat((d.mistakes || []).length, '条错题')
      + stat(Object.keys(d.topicDrafts || {}).length, '份专题草稿')
      + stat((d.topicRecords || []).length, '次专题复盘')
      + '</section>';

    const exportPanel = '<section class="dashboard-panel sync-panel">'
      + '<div class="panel-heading"><h2>导出进度备份</h2>'
      + '<span>把当前设备的全部学习记录存成一个文件</span></div>'
      + '<p class="sync-desc">导出的 JSON 包含：整卷成绩、整卷草稿、'
      + '错题（含间隔复习排期）、专题草稿、专题复盘。'
      + '<b>写作草稿不在此列</b>——它单独存一个键，需另行处理。</p>'
      + '<button class="primary-btn" data-action="export-data">导出为 JSON 文件</button>'
      + '</section>';

    const importPanel = '<section class="dashboard-panel sync-panel">'
      + '<div class="panel-heading"><h2>导入进度备份</h2>'
      + '<span>从另一台设备合并一份进度，不覆盖当前数据</span></div>'
      + '<p class="sync-desc">合并规则：成绩与专题草稿按更新时间较新的一方保留；'
      + '错题按身份去重，间隔复习排期取进展更靠前的一方；'
      + '不会把别台设备已排好的复习计划整批冲掉。</p>'
      + '<button class="ghost-btn" data-action="import-data">选择备份文件并合并</button>'
      + '<input type="file" accept="application/json,.json" data-import-file hidden>'
      + '</section>';

    this.app().innerHTML = this.header('数据备份与迁移', true)
      + '<main class="dashboard-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">YOUR DATA</span><h1>数据备份与迁移</h1></div>'
      + '<a class="text-btn" href="#/">回到试卷库</a></div>'
      + '<p class="sync-intro">所有记录只保存在当前浏览器。换设备、清缓存'
      + '或重装前，先导出一份备份；到了新设备再导入合并，进度不丢。</p>'
      + stats + exportPanel + importPanel
      + '<div id="sync-result" class="sync-result" role="status" aria-live="polite"></div>'
      + '</main>';
  },

  /* 未完成的专题草稿 → 一键继续。
     草稿筛选与题型表在 js/ui/library.js 的 openTopicDrafts 里，
     和专题总览页的续做横幅共用一份；这里只负责补试卷标题、
     按时间倒序，和拼这一块的 HTML。label 要补「专题」二字：
     共用表给的是「阅读」，本面板的文案是「阅读专题」。 */
  dashContinue(exams) {
    const entries = this.openTopicDrafts()
      .map(d => {
        const exam = exams.find(e => e.id === d.examId);
        return { ...d, label: d.label + '专题', title: exam ? exam.title : d.examId };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (!entries.length) return '';

    return '<section class="dashboard-continue"><div class="panel-heading">'
      + `<h2>继续专题练习</h2><span>你有 ${entries.length} 个专题尚未完成</span></div>`
      + '<div class="continue-list">'
      + entries.map(d => `<a class="continue-item" href="${d.route}">`
        + `<span class="continue-type">${this.esc(d.label)}</span><b>${this.esc(d.title)}</b>`
        + `<small>已答 ${d.answered} 题 · 进入后自动恢复草稿</small>`
        + '<strong>继续 →</strong></a>').join('')
      + '</div></section>';
  },

  /* 得分趋势折线。viewBox 固定 280×70，单点时画在中线（x=140）。
     纵轴是得分率（2026-09-19 修订）：改前 120 分制的甲乙卷与 150 分制的
     新高考卷裸分画在同一条线上——90/120（75%）与 90/150（60%）等高，
     学生会据此误判进步退步。旧记录没有 totalScore，制式无法判定，只能跳过：
     宁可少一条数据，不画一条错的数据。
     注意 polyline / circle 的属性之间原本没有空格，这里保持原样 ——
     加空格会改变输出字节，虽然渲染相同。 */
  dashTrend(records) {
    /* 诊断卷/重做卷与整卷分开口径（与能力历史同规则）：它们是测量不是训练，
       混进同一条折线会污染趋势。 */
    const trend = records.filter(r => r.submittedAt && r.score != null
        && r.totalScore > 0 && !r.isDiagnostic && !r.isRedo)
      .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
    const legacy = records.filter(r => r.submittedAt && r.score != null
      && !(r.totalScore > 0) && !r.isDiagnostic && !r.isRedo).length;
    const pct = r => Math.round((r.score || 0) / r.totalScore * 100);
    const at = (r, i) => {
      const x = trend.length > 1 ? i / (trend.length - 1) * 280 : 140;
      const y = 60 - (r.score || 0) / r.totalScore * 50;
      return [x, y];
    };

    const points = trend.map((r, i) => at(r, i).join(',')).join(' ');
    const dots = trend.map((r, i) => {
      const [x, y] = at(r, i);
      return `<circle cx="${x}"cy="${y}"r="3"fill="#268b71"><title>`
        + `${r.score} / ${r.totalScore}（${pct(r)}%）</title></circle>`;
    }).join('');
    /* 均值参考线（方案·可视化防线）：多卷时给一条虚线锚住平均水平，
       防止把单次波动读成趋势变化。 */
    const avgPct = trend.length > 1
      ? Math.round(trend.reduce((s, r) => s + pct(r), 0) / trend.length)
      : null;
    const meanLine = avgPct == null ? '' : `<line x1="8"x2="272"`
      + `y1="${60 - avgPct / 100 * 50}"y2="${60 - avgPct / 100 * 50}"`
      + `stroke="#268b71"stroke-width="1"stroke-dasharray="4 3"opacity="0.45"><title>`
      + `平均 ${avgPct}%</title></line>`;
    const labels = trend.slice(-5).map(r => {
      const d = new Date(r.submittedAt);
      return `<span>${d.getMonth() + 1}/${d.getDate()}</span>`;
    }).join('');
    const scores = trend.slice(-5).map(r =>
      `<b title="${r.score} / ${r.totalScore} 分">${pct(r)}%</b>`).join('');

    return '<section class="dashboard-panel trend-panel"><div class="panel-heading">'
      + `<h2>得分趋势</h2><span>按得分率比较${legacy ? ' · ' + legacy + ' 条早期记录未计入' : ''}</span></div>`
      + `<svg viewBox="0 0 280 70" class="trend-svg"><polyline points="${points}"`
      + `fill="none"stroke="#268b71"stroke-width="2"/>${meanLine}${dots}</svg>`
      + `<div class="trend-labels">${labels || '<span>暂无记录</span>'}</div>`
      + `<div class="trend-scores">${scores || '<b>--</b>'}</div>`
      + (trend.length > 1
        ? '<p class="trend-note">不同卷难度不同：比变化看走势，别比单次分数。</p>'
        : '')
      + '</section>';
  },

  /* 专题复盘次数。题型名表见文件顶部 TOPIC_NAMES；
     计数从 0 起列全部题型，只展示做过的那些。 */
  dashTopicReview(topicRecords) {
    const counts = Object.fromEntries(Object.keys(TOPIC_NAMES).map(k => [k, 0]));
    topicRecords.forEach(r => { if (counts[r.type] != null) counts[r.type]++; });

    const body = Object.values(counts).some(v => v > 0)
      ? '<div class="topic-review-list">'
        + Object.entries(counts).filter(([, v]) => v > 0)
          .map(([k, v]) => '<div class="topic-review-item">'
            + `<span>${TOPIC_NAMES[k] || k}</span><b>${v} 次</b></div>`)
          .join('')
        + '</div>'
      : '<p class="dashboard-empty">完成专题训练后，这里会统计复盘次数。</p>';

    return '<section class="dashboard-panel topic-review-panel"><div class="panel-heading">'
      + '<h2>专题复盘统计</h2><span>按题型查看完成次数</span></div>'
      + body + '</section>';
  },

  /* ---------- 写作自评面板（2026-09-19）----------
     聚合口径收拢在 UI.writingSelfFacts（base.js，与学业分析画像共用）；
     这里只负责面板形态。只统计「自评过」的篇目；写了没自评的以未自评
     计数提醒，不冒充数据。行样式复用 topic-review-item。 */
  dashWritingSelf(selfs) {
    const facts = this.writingSelfFacts(selfs);
    const done = facts.done;
    const rows = done.slice(0, 3).map(s => {
      const exam = (window.__EXAMS__ || []).find(e => e.id === s.examId);
      const d = s.savedAt ? new Date(s.savedAt) : null;
      return '<div class="topic-review-item">'
        + '<div><b>' + this.esc((exam ? exam.paper : s.examId))
        + ' · ' + this.esc(facts.typeName(s.sectionKey)) + '</b>'
        + '<small>' + (d ? (d.getMonth() + 1) + '/' + d.getDate() + ' · ' : '')
        + this.esc(facts.dimText(s)) + (s.wordcount ? ' · ' + this.esc(String(s.wordcount)) + ' 词' : '')
        + '</small></div>'
        + '<a class="text-btn" href="#/writing/' + encodeURIComponent(s.examId)
        + '/' + encodeURIComponent(s.sectionKey) + '">回看 →</a></div>';
    }).join('');
    const pending = facts.pending;
    /* 各段包 nowrap：折行只落在「 · 」边界，不把「达标2」拆到两行。 */
    const seg = t => `<span style="white-space:nowrap">${t}</span>`;
    const note = [facts.avg, facts.tally.join(' · ')].filter(Boolean).map(f => seg(f)).join(' · ')
      + ((facts.avg || facts.tally.length) && pending ? ' · ' : '');
    const tail = pending ? seg(pending + ' 篇已写作未自评')
      : (done.length ? seg('全部已自评') : '');
    const body = done.length
      ? '<div class="topic-review-list">' + rows + '</div>'
        + (note + tail ? `<p class="dash-note">${note + tail}</p>` : '')
      : '<p class="dashboard-empty">'
        + (pending
          ? pending + ' 篇作文还没自评——在写作专题底部给自己打分，这里开始积累。'
          : '还没有写作自评记录。写完作文后，在写作专题底部自评四项，这里会开始积累。')
        + '</p>';
    return '<section class="dashboard-panel writing-self-panel"><div class="panel-heading">'
      + '<h2>写作自评</h2><span>' + done.length + ' 篇已自评</span></div>'
      + body + '</section>';
  },

  /* ---------- G2 分数折算（2026-09-03） ----------
     把各题型的历史正确率折算成客观题得分，只做算术不做预测：
     · 折算分 = 每节「累计答对 ÷ 累计作答」× 该卷制该节满分，求和；
     · 波动区间 = 每节最近 3 次的最低/最高单次正确率分别折算求和
       （只做过一次时区间坍缩为一点，就不再显示区间）；
     · 卷制按最近一次整卷记录的 format 取（legacy / new）；
     · 主观题没有自动正确率，不参与折算，面板里如实标注。
     呈现口径全程「折算」，避免「预计你能考 X 分」这类承诺式话术。 */
  dashScoreBand(exams) {
    const hist = Store.getSectionHistory();
    const attempted = Object.keys(SCORE_FORMATS.legacy.objective)
      .filter(k => (hist[k] || []).some(x => x.total));

    if (!attempted.length) {
      return '<section class="dashboard-panel scoreband-panel">'
        + '<div class="panel-heading"><h2>分数折算</h2><span>客观题部分 · 只折算不预测</span></div>'
        + '<p class="dashboard-empty">完成一套真题后，这里把各题型的历史正确率'
        + '折算成客观题得分——是多少就显示多少，不做预测。</p></section>';
    }

    /* 卷制取最近一次整卷记录：records 以卷号为键、体内无 examId，
       所以从 entries 的键取卷号再查 format（2026-09-03 修正——
       原来读 r.examId 恒为 undefined，卷制永远落到 legacy 兜底）。 */
    const data = Store._load();
    const latest = Object.entries(data.records || {})
      .filter(([, r]) => r && r.submittedAt)
      .sort((a, b) => (b[1].submittedAt || 0) - (a[1].submittedAt || 0))[0];
    const meta = latest && (exams || []).find(e => e.id === latest[0]);
    const fmt = SCORE_FORMATS[meta && meta.format] || SCORE_FORMATS.legacy;

    let mid = 0, lo = 0, hi = 0, hasRange = false;
    const used = [];
    const rows = [];
    for (const [key, max] of Object.entries(fmt.objective)) {
      const arr = (hist[key] || []).filter(x => x.total);
      if (!arr.length) continue;
      let c = 0, t = 0;
      arr.forEach(r => { c += r.correct || 0; t += r.total || 0; });
      const acc = c / t;
      const recent = arr.slice(-3).map(r => (r.correct || 0) / r.total);
      const aLo = Math.min(...recent), aHi = Math.max(...recent);
      if (recent.length > 1 && aHi > aLo) hasRange = true;
      lo += aLo * max; hi += aHi * max; mid += acc * max;
      used.push(`${SCORE_SECTION_NAMES[key]}（${max} 分）`);
      const pct = Math.round(acc * 100);
      rows.push('<div class="scoreband-row">'
        + `<span>${SCORE_SECTION_NAMES[key]}</span>`
        + `<i><u style="width:${Math.min(100, Math.max(6, pct))}%"></u></i>`
        + `<b>${pct}% · 折算 ${Math.round(acc * max * 10) / 10} / ${max} 分</b></div>`);
    }

    const subjectiveTxt = fmt.subjective
      .map(([n, p]) => `${n} ${p} 分`).join(' + ')
      + `，共 ${fmt.subjective.reduce((a, [, p]) => a + p, 0)} 分`;

    const band = hasRange
      ? ` · 近几次波动 ≈ ${Math.round(lo)}–${Math.round(hi)} 分`
      : '';

    return '<section class="dashboard-panel scoreband-panel">'
      + `<div class="panel-heading"><h2>分数折算</h2><span>${fmt.label} · 只折算不预测</span></div>`
      + '<div class="scoreband-hero">'
      + `<b>${Math.round(mid)}<small>分</small></b>`
      + `<span>按历史正确率折算的客观题得分${band}</span></div>`
      + rows.join('')
      + `<p class="scoreband-note">口径：${used.join('、')}的「累计答对 ÷ 累计作答」`
      + '× 该题型的卷面满分；'
      + `其余未作答的客观题与主观题（${subjectiveTxt}，人工评分）未计入。`
      + '多练几套，折算会越来越贴近真实水平。</p>'
      + '</section>';
  },
});
