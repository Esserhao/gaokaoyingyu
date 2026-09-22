/* =====================================================================
   分题型训练：把整卷拆成可重复训练的题型集合
   与「专题训练」（js/topic.js）的区别：这里是同一题型跨年份横向对比，
   一次只看一道题；专题是一份完整材料里的连续多题。
   模板断行规则同 js/ui/base.js：只用加号拼接，不在模板内换行。
   ===================================================================== */
const Training = {
  /* 八个题型的元信息。strategy 会直接印在训练首页的「训练要点」里，
     是学生进入例题前唯一能看到的方法提示，措辞按可操作步骤写。 */
  types: [
    {
      key: 'listening', name: '听力理解', en: 'LISTENING',
      note: '短对话、长对话与独白',
      strategy: '先抓人物、地点、数字和态度；听前快速浏览选项，优先预测场景。',
    },
    {
      key: 'reading', name: '阅读理解', en: 'READING',
      note: '细节、主旨、推断与词义',
      strategy: '先看题干定位关键词，再回到原文核对；主旨题关注首尾段与转折句。',
    },
    {
      key: 'seven', name: '七选五', en: 'TEXT COMPLETION',
      note: '段落衔接与逻辑结构',
      strategy: '先读首尾句建立语境，再用代词、连接词和同义复现判断空格。',
    },
    {
      key: 'cloze', name: '完形填空', en: 'CLOZE',
      note: '语境、词义与篇章逻辑',
      strategy: '先通读把握主线；每空同时考虑搭配、语气、指代和上下文。',
    },
    {
      key: 'grammar', name: '语法填空', en: 'GRAMMAR',
      note: '词性变化、时态、语态与从句',
      strategy: '先判空格成分，再决定词形；无提示词重点检查冠词、介词、连词。',
    },
    {
      key: 'proofreading', name: '短文改错', en: 'PROOFREADING',
      note: '冠词、介词、时态与逻辑',
      strategy: '先通读理解语义，再按“动词—名词—形容词—介词—连词”顺序排查。',
    },
    {
      key: 'writing_app', name: '应用文写作', en: 'PRACTICAL WRITING',
      note: '书信、通知与活动介绍',
      strategy: '先列任务要点，再用清晰段落完成目的、细节与结尾。',
    },
    {
      key: 'writing_cont', name: '读后续写', en: 'CONTINUATION',
      note: '情节推进、动作描写与主题升华',
      strategy: '承接原文冲突，保持人物和时态一致；用动作、语言和心理推动结局。',
    },
  ],

  /* 逐套试卷取出该题型的全部题目。索引里只有元信息，题目要按需
     fetch data/exams/<id>.json —— 首页不预加载，进训练页才拉。 */
  async build(exams, typeKey) {
    const meta = this.types.find(x => x.key === typeKey) || this.types[0];

    /* 并行拉取所有试卷，单套异常（404/坏 JSON）只跳过该套，不影响其余。
       改前是顺序 for…of await，N 套卷要 N 次往返，进训练页明显偏慢。 */
    const perExam = await Promise.all(exams.map(async e => {
      try {
        const d = await loadExamData(e);
        if (!d) return [];
        const s = d.sections.find(x => x.key === typeKey);
        if (!s) return [];
        return s.questions.map(q => ({ exam: e, section: s, q }));
      } catch (_) { return []; }
    }));
    const items = perExam.flat();

    return { meta, items };
  },

  esc(v = '') { return UI.esc(v) },

  /* 12 个子技能的三档进度板。历史为空时每张卡显示「未练」而不是整段
     折叠 —— 进度板本身就是引导，空态要指出下一步（先交一套卷）。 */
  subskillBoard() {
    const history = Store.getSubskillHistory();
    const card = s => {
      const tb = Subskill.tierBadge(history, s.id);
      return `<a class="subskill-card t-${tb.cls}" href="#/knowledge/${encodeURIComponent(s.id)}">`
        + `<b>${this.esc(s.name)}</b><small>${this.esc(s.method)}</small>`
        + `<span class="subskill-stat">${this.esc(tb.text)}</span></a>`;
    };
    const groups = [
      ['篇章', '篇章能力 · 阅读与听力'],
      ['词义辨析', '词义辨析 · 完形选词'],
    ];
    return '<section class="subskill-board">'
      + '<div class="section-line"><h2>子技能进度</h2>'
      + '<span>12 个子技能 · 生疏 / 在练 / 稳定（按最近 10 题算）</span></div>'
      + groups.map(([fam, label]) => '<div class="subskill-group"><h3>' + label + '</h3>'
        + '<div class="subskill-grid">'
        + Subskill.all().filter(s => s.family === fam).map(card).join('')
        + '</div></div>').join('')
      + '</section>';
  },

  /* render(exams, typeKey, filter, subskill)
     subskill（B3）不空时进入「子技能专项」模式：summary 换成该子技能的
     方法卡 + 三档进度，题目列表只显示 Diagnose 归类到该子技能的题。
     年份筛选照常可用 —— 筛选按钮会带上 this._subskill 重进本页。 */
  render(exams, typeKey = 'reading', filter = 'all', subskill = null) {
    const meta = this.types.find(x => x.key === typeKey) || this.types[0];
    const sk = subskill ? Subskill.byId(subskill) : null;
    this._subskill = sk ? sk.id : null;
    const years = [...new Set(exams.map(e => e.year))].sort((a, b) => b - a);
    const counts = {};
    exams.forEach(e => counts[e.year] = (counts[e.year] || 0) + 1);

    const head = '<main class="training-home">'
      + UI.referenceHeader({
          brand: '高中英语指北', brandNote: '分题型训练中心', brandHref: '#/',
          backHref: '#/mistakes', backLabel: '错题本',
        })
      + `<section class="training-hero"><span class="reference-kicker">TOPIC PRACTICE · ${meta.en}</span>`
      + (sk
        ? `<h1>${this.esc(sk.name)}</h1><p>${this.esc(sk.method)}</p>`
        : '<h1>分题型训练</h1>'
          + '<p>把整套试卷拆开练，集中突破一个题型，再回到完整试卷检验。</p>')
      + '</section>'
      + '<nav class="training-nav"><a href="#/">历年真题</a>'
      + '<a class="active" href="#/training">分题型训练</a></nav>';

    /* 题型卡片一律指向 /example（例题精讲），而不是题目列表 ——
       先看一道讲透的题，再自己练，是这个页面的设计前提。 */
    const cards = this.types.map(t => `<a class="topic-card ${t.key === typeKey ? 'active' : ''}" `
      + `href="#/training/${t.key}/example">`
      + `<span class="topic-index">${String(this.types.indexOf(t) + 1).padStart(2, '0')}</span>`
      + `<b>${t.name}</b><small>${t.note}</small><em>${t.en}</em></a>`).join('');

    /* 子技能模式：summary 换成方法卡 + 三档进度 + 回知识详情入口；
       普通模式：题型训练要点。 */
    const skBadge = sk ? Subskill.tierBadge(Store.getSubskillHistory(), sk.id) : null;
    const summary = sk
      ? '<section class="training-summary"><div>'
        + `<span class="reference-kicker">SKILL · ${this.esc(meta.name)}</span>`
        + `<h2>${this.esc(sk.name)} · 方法</h2><p>${this.esc(sk.method)}</p>`
        + `<span class="subskill-tier t-${skBadge.cls}">${this.esc(skBadge.text)}</span></div>`
        + `<div class="summary-stat"><b>专项</b><span>`
        + `<a href="#/knowledge/${encodeURIComponent(sk.id)}">知识详情 →</a></span></div></section>`
      : '<section class="training-summary"><div>'
        + '<span class="reference-kicker">同类题总结</span>'
        + `<h2>${meta.name} · 训练要点</h2><p>${meta.strategy}</p></div>`
        + `<div class="summary-stat"><b>跨年份</b><span>${exams.length} 套题库</span></div></section>`;

    /* 子技能进度板（task.md §8.4 B1/B2）：题型正确率看不出「阅读不行是
       推理判断还是细节定位」，这层按 12 个子技能给三档（生疏/在练/稳定，
       按最近 10 次作答算）。卡片指向 #/knowledge/<id> —— 那里按
       「节点 → 家族」分派出子技能版式（方法卡 + 进度 + 去练入口）。 */
    const subBoard = this.subskillBoard();

    /* filter 从 data 属性来，始终是字符串；year 是数字。这里故意用 ==
       松比较，改成 === 会让年份筛选永远不高亮。 */
    const chips = years.map(y => `<button class="filter-chip ${filter == y ? 'active' : ''}" `
      + `data-training-filter="${y}">${y}年 <small>${counts[y]}套</small></button>`).join('')
      + `<button class="filter-chip ${filter === 'all' ? 'active' : ''}" `
      + 'data-training-filter="all">全部年份</button>';

    UI.app().innerHTML = head
      + `<section class="topic-grid">${cards}</section>`
      + summary
      + (sk ? '' : subBoard)   /* 子技能专项页聚焦单一技能，不再铺全量进度板 */
      + `<section class="training-filter"><b>筛选题目</b><div>${chips}</div></section>`
      + '<div id="training-list" class="training-list">'
      + `<div class="training-loading">正在汇总 ${sk ? this.esc(sk.name) : meta.name} 题目…</div></div></main>`;

    this.loadInto(exams, typeKey, filter, sk ? sk.id : null);
  },

  /* 列表异步填充：render 先出骨架，题目到齐后替换 #training-list。
     期间用户可能已经切走页面，所以取不到容器就直接放弃。
     subskill（B3）不空时只保留 Diagnose 归类到该子技能的题 ——
     分类口径与交卷落账（Exam.subskillBreakdown）完全一致。 */
  async loadInto(exams, typeKey, filter, subskill = null) {
    const data = await this.build(exams, typeKey);
    let items = data.items;
    if (subskill) {
      items = items.filter(x => {
        const diag = Diagnose.classify({
          sectionKey: x.section.key, stem: x.q.stem, explanation: x.q.explanation,
        });
        return diag && diag.knowledgeNode === subskill;
      });
    }
    if (filter !== 'all') items = items.filter(x => String(x.exam.year) === String(filter));

    const list = document.getElementById('training-list');
    if (!list) return;

    list.innerHTML = items.length
      ? items.map((x, i) => `<a class="training-row" href="#/training/${typeKey}/${x.exam.id}/${x.q.id}">`
        + `<span class="training-no">${String(i + 1).padStart(2, '0')}</span>`
        + `<span><b>${this.esc(x.exam.year)} · ${this.esc(x.exam.paper)}</b>`
        + `<small>第 ${x.q.id} 题 · ${this.esc(x.exam.region || '')}</small></span>`
        + '<strong>开始练习 →</strong></a>').join('')
      : '<div class="empty-state"><strong>暂无该筛选结果</strong>'
        + `<p>${subskill ? '题库里该子技能的题还没被归类出来，换个子技能或题型试试。' : '换一个年份试试。'}</p></div>`;
  },
};
