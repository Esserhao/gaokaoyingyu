/* =====================================================================
   考点/词频透视（F4，#/insights）
   把 16 套真题的全部客观题在浏览器里跑一遍 Diagnose 的规则表，
   得到三张确定性榜单：
     ① 考点频率榜 —— 每个知识节点在真题里出现了多少次；
     ② 题型 × 考点 —— 阅读/七选五/完形/语法各自主考哪些节点；
     ③ 完形高频词 —— 选项词的出场次数与「正确答案次数」。
   全部是静态聚合（无学生数据参与），同一天刷新两次结果一致，
   所以这条路由可以进快照护栏。

   为什么复用 Diagnose 而不是新写规则：错题本自动分类用的就是这套
   规则（js/diagnose.js），透视页用它意味着「真题怎么考」和「错题
   归到哪个节点」永远同一套口径，不会出现统计各说各话。

   渲染走「骨架先出、数据回填」：16 套卷的脚本要并行注入，先画
   页面骨架（含 loading 文案），Promise.all 拿到全部数据后回填
   [data-insights-body]，与 KnowledgeGraph 的惰加载同口径。
   ===================================================================== */

/* 客观题的题型白名单：这些 section 里的题有选项、有答案，能进聚合。
   写/续写是主观题，没有考点分类，不进来。 */
const INSIGHT_SECTIONS = ['listening', 'reading', 'seven', 'cloze', 'grammar'];

Object.assign(UI, {
  insights(exams) {
    this.app().innerHTML = this.header('考点透视', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">EXAM INSIGHTS</span><h1>考点透视</h1></div>'
      + '<a class="text-btn" href="#/learn">知识台阶 →</a></div>'
      + '<p class="knowledge-intro">'
      + '把全部真题客观题按同一套规则归类：考什么、考几次、哪个题型最爱考、'
      + '完形爱用哪些词。这是题库自己的透视，与你的错题无关。</p>'
      + '<div data-insights-body>'
      + '<p class="ins-loading">正在汇总 ' + exams.length + ' 套真题…</p>'
      + '</div></main>';
    this._insightsFill(exams);
  },

  async _insightsFill(exams) {
    /* 单套加载失败只跳过该套（与 training.js 同口径），不让整页挂掉 */
    const datas = await Promise.all(
      exams.map(e => loadExamData(e).catch(() => null)));

    /* ---- 收集全部客观题：{year, paper, section, q} ---- */
    const qs = [];
    let papers = 0;
    datas.forEach(d => {
      if (!d) return;
      papers += 1;
      (d.sections || []).forEach(s => {
        if (INSIGHT_SECTIONS.indexOf(s.key) < 0) return;
        (s.questions || []).forEach(q => {
          if (!Array.isArray(q.options) || !q.options.length) return;
          if (q.answer == null || q.answer === '') return;
          qs.push({ year: d.year, paper: d.paper || d.title, section: s.key, q });
        });
      });
    });

    /* ---- ① 考点频率：跑 Diagnose 规则 ---- */
    const nodeStats = {};
    let unmatched = 0;
    qs.forEach(r => {
      const c = Diagnose.classify({
        sectionKey: r.section,
        stem: r.q.stem || '',
        explanation: r.q.explanation,
      });
      if (!c) { unmatched += 1; return; }
      const st = nodeStats[c.knowledgeNode] =
        nodeStats[c.knowledgeNode] || { count: 0, sub: c.subCause, years: {}, sections: {} };
      st.count += 1;
      st.years[r.year] = (st.years[r.year] || 0) + 1;
      st.sections[r.section] = (st.sections[r.section] || 0) + 1;
    });
    const ranked = Object.keys(nodeStats).sort((a, b) =>
      nodeStats[b].count - nodeStats[a].count || a.localeCompare(b, 'zh'));

    const max = ranked.length ? nodeStats[ranked[0]].count : 1;
    const rows = ranked.slice(0, 24).map((n, i) => {
      const st = nodeStats[n];
      const yearSpan = Object.keys(st.years).sort().join('、');
      const w = Math.max(4, Math.round(st.count / max * 100));
      return '<div class="ins-row">'
        + `<span class="ins-rank">${i + 1}</span>`
        + '<div class="ins-main"><a href="#/knowledge/' + encodeURIComponent(n) + '">'
        + this.esc(n) + ' →</a>'
        + `<small>${this.esc(st.sub)} · 考过 ${yearSpan}</small>`
        + `<i style="width:${w}%"></i></div>`
        + `<strong>${st.count}</strong></div>`;
    }).join('');

    /* ---- ② 题型 × 考点：每个题型各自的 Top5 ---- */
    const secMeta = [
      ['reading', '阅读理解'], ['seven', '七选五'],
      ['cloze', '完形填空'], ['grammar', '语法填空'],
    ];
    const secBlocks = secMeta.map(([key, name]) => {
      const per = {};
      qs.forEach(r => {
        if (r.section !== key) return;
        const c = Diagnose.classify({
          sectionKey: key, stem: r.q.stem || '', explanation: r.q.explanation });
        if (!c) return;
        per[c.knowledgeNode] = (per[c.knowledgeNode] || 0) + 1;
      });
      const top = Object.keys(per).sort((a, b) =>
        per[b] - per[a] || a.localeCompare(b, 'zh')).slice(0, 5);
      const total = Object.keys(per).reduce((s, k) => s + per[k], 0);
      const items = top.map(n =>
        '<li><a href="#/knowledge/' + encodeURIComponent(n) + '">' + this.esc(n)
        + '</a><b>' + per[n] + '</b></li>').join('')
        || '<li>暂无分类结果</li>';
      return '<div class="ins-sec"><h3>' + this.esc(name)
        + `<span>${total} 题</span></h3><ul>${items}</ul></div>`;
    }).join('');

    /* ---- ③ 完形高频词：选项词频 + 正确答案词频 ---- */
    /* 选项在题库里是 {letter, text} 对象（个别旧数据是纯字符串），
       这里统一取 text；带空格的词组不算「词」，留给词组层。 */
    const optText = o => (o && typeof o === 'object' ? o.text : o);
    const words = {};
    qs.forEach(r => {
      if (r.section !== 'cloze') return;
      const ansLetter = String(r.q.answer).trim().charAt(0).toUpperCase();
      r.q.options.forEach((o, i) => {
        const w = String(optText(o) || '').trim().toLowerCase()
          .replace(/^[^a-z]+/, '').replace(/[^a-z'-]+$/, '');
        if (!w || w.length < 2 || w.indexOf(' ') >= 0) return;
        const rec = words[w] = words[w] || { n: 0, ans: 0 };
        rec.n += 1;
        const letter = (o && typeof o === 'object' && o.letter)
          ? String(o.letter).trim().charAt(0).toUpperCase() : 'ABCD'.charAt(i);
        if (letter === ansLetter) rec.ans += 1;
      });
    });
    const topWords = Object.keys(words).sort((a, b) =>
      words[b].n - words[a].n || words[b].ans - words[a].ans
      || a.localeCompare(b)).slice(0, 24);
    const wordChips = topWords.map(w =>
      '<a class="ins-word" href="#/word/' + encodeURIComponent(w)
      + `">${this.esc(w)}<small>${words[w].n} 次 / 正确 ${words[w].ans}</small></a>`
    ).join('');

    /* ---- 汇总数字 ---- */
    const nodeCount = ranked.length;
    const summary = '<section class="ins-summary">'
      + `<div class="summary-stat"><b>${papers}</b><span>套真题入统</span></div>`
      + `<div class="summary-stat"><b>${qs.length}</b><span>道客观题</span></div>`
      + `<div class="summary-stat"><b>${nodeCount}</b><span>个考点被命中</span></div>`
      + `<div class="summary-stat"><b>${unmatched}</b><span>题未识别（宁缺毋滥）</span></div>`
      + '</section>';

    const box = document.querySelector('[data-insights-body]');
    if (!box) return;
    box.innerHTML = summary
      + '<section class="ins-block"><h2>考点频率榜 <span>TOP 24</span></h2>'
      + (rows || '<p class="ins-loading">没有可统计的题目。</p>') + '</section>'
      + '<section class="ins-block"><h2>题型 × 考点 <span>各题型 Top5</span></h2>'
      + '<div class="ins-sec-grid">' + secBlocks + '</div></section>'
      + '<section class="ins-block"><h2>完形高频词 <span>选项词频</span></h2>'
      + '<p class="ins-note">统计每个词作为完形选项出现的次数；「正确」是它'
      + '被设为答案的次数——高频又高正确率的词值得优先背。</p>'
      + '<div class="ins-words">' + (wordChips || '<p class="ins-note">完形题库暂无选项词。</p>')
      + '</div></section>';
  },
});
