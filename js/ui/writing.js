/* =====================================================================
   历年参考范文（#/writing/models）—— 2026-09-19 新增

   题库把范文散放在各卷 data/exams/*.js 的 modelAnswer 字段里。学生想横向
   比较几年范文，过去只能一套一套卷子钻进去、在整卷解析里翻。这一页把它们
   集中到一处：按题型分组、可搜索、标出词数，每篇都能跳回写作专题拿自己的
   文章对照自评，也能回到原卷看完整解析。

   只收「应用文写作」与「读后续写」两类（全库共 25 篇，覆盖率 100%）。
   短文改错不在内：它的参考答案是把错处改对，性质是「改对几处」的自评题，
   不是可以拿来仿写结构的范文；它的答案照旧留在整卷解析里。

   数据来源照实标（answerSource 字段），不编造出处 —— 与 data 目录的
   铁律一致：来源不明的宁可空着，也不写一个看着体面的假出处。
   ===================================================================== */
Object.assign(UI, {

  /* 页面骨架先出来（含"正在汇总"），数据到位后回填。
     一次要注入 16 套卷的脚本，等待期间不能是一片空白。 */
  writingModels(exams) {
    this.app().innerHTML = this.header('参考范文', true)
      + '<main class="wm-page program-page">'
      + '<div class="program-hero">'
      + '<span class="reference-kicker">MODEL ESSAYS · 参考范文库</span>'
      + '<h1>历年考场范文，<em>集中看一遍。</em></h1>'
      + '<p>读范文别背整篇。对照自己的文章看三件事就够了：要点有没有漏、'
      + '段落之间靠什么衔接、句子长短是怎么错开的。</p></div>'
      + '<div class="wm-loading" data-wm-slot><span class="loading-dot"></span>'
      + '<b>正在汇总 ' + (exams || []).length + ' 套卷的参考范文…</b></div>'
      + '</main>';
    return this._writingModelsFill(exams);
  },

  async _writingModelsFill(exams) {
    const loaded = await Promise.all((exams || []).map(async meta => {
      try { return { meta, exam: await loadExamData(meta) }; } catch (_) { return null; }
    }));

    const items = [];
    loaded.filter(Boolean).forEach(({ meta, exam }) => {
      (exam.sections || []).forEach(section => {
        if (section.key !== 'writing_app' && section.key !== 'writing_cont') return;
        (section.questions || []).forEach(q => {
          const model = q.modelAnswer ?? q.answer;
          if (!model) return;
          /* 出处要从试卷对象上取 —— 索引 data/index.js 里只有 title/年份这些
             展示字段，没有 answerSource。从 meta 上读会永远读不到，
             25 篇会全部误报成「未标注出处」。 */
          items.push({
            meta, section, q, model: String(model), source: exam.answerSource || '',
          });
        });
      });
    });

    /* 新卷在前 —— 学生更关心近年考法。同年内按卷号排，卷内先应用文后续写，
       与卷面顺序一致。 */
    items.sort((a, b) => (b.meta.year - a.meta.year)
      || String(a.meta.id).localeCompare(String(b.meta.id))
      || a.section.key.localeCompare(b.section.key) || (a.q.id - b.q.id));

    const slot = document.querySelector('[data-wm-slot]');
    if (!slot) return;                       /* 数据回来前已经切走了 */
    if (!items.length) {
      slot.innerHTML = '<p>题库里还没有可用的参考范文。</p>';
      return;
    }

    const groups = ['全部', '应用文写作', '读后续写'];
    const counts = { '全部': items.length, '应用文写作': 0, '读后续写': 0 };
    items.forEach(it => { counts[this._writingGroup(it)] += 1; });

    const tabs = groups.map((g, i) => '<button class="wm-tab' + (i === 0 ? ' is-active' : '')
      + '" data-wm-tab="' + g + '">' + g + '<span>' + counts[g] + '</span></button>').join('');

    slot.outerHTML = '<div class="wm-toolbar">'
      + '<nav class="wm-tabs" aria-label="题型筛选">' + tabs + '</nav>'
      + '<input class="wm-search" type="search" data-wm-search '
        + 'placeholder="搜题干或范文里的词，如 invitation、环保" aria-label="搜索范文">'
      + '<button class="text-btn" data-wm-toggle-all>展开全部范文</button>'
      + '<span class="wm-count" data-wm-count>共 ' + items.length + ' 篇</span></div>'
      + '<div class="wm-list">' + items.map((it, i) => this._writingCard(it, i)).join('') + '</div>'
      + '<section class="wm-footnote"><b>关于这些范文</b>'
      + '<p>它们是从各卷参考答案里原样搬过来的，只作对照用，不是必须背下来的标准答案。'
      + '真正要紧的是把自己的文章和它并排看，找出只属于自己的那两三处差距。</p>'
      + '<p>短文改错的参考答案不在这里 —— 它的题面就是把错处改对，'
      + '没有可仿写的谋篇结构，答案照旧留在整卷解析里。</p></section>';

    /* 筛选用 hidden 切换而不是重建 DOM：范文展开状态、选中文本、
       滚动位置都不会因为打一个字而丢掉。 */
    const entries = [].slice.call(document.querySelectorAll('[data-wm-card]')).map(card => ({
      card,
      hay: (card.dataset.wmHay || '')
        + ' ' + ((card.querySelector('.wm-model pre') || {}).textContent || ''),
    }));
    const countEl = document.querySelector('[data-wm-count]');
    let activeTab = '全部';

    const applyFilter = () => {
      const kw = (document.querySelector('[data-wm-search]') || {}).value || '';
      const needle = kw.trim().toLowerCase();
      let shown = 0;
      entries.forEach(({ card, hay }) => {
        const okTab = activeTab === '全部' || card.dataset.wmGroup === activeTab;
        const okKw = !needle || hay.toLowerCase().indexOf(needle) !== -1;
        card.hidden = !(okTab && okKw);
        if (!card.hidden) shown += 1;
      });
      if (countEl) {
        countEl.textContent = shown === items.length
          ? '共 ' + items.length + ' 篇'
          : '筛出 ' + shown + ' / ' + items.length + ' 篇';
      }
    };

    document.querySelectorAll('[data-wm-tab]').forEach(btn => btn.onclick = () => {
      activeTab = btn.dataset.wmTab;
      document.querySelectorAll('[data-wm-tab]').forEach(
        b => b.classList.toggle('is-active', b === btn));
      applyFilter();
    });
    const search = document.querySelector('[data-wm-search]');
    if (search) search.oninput = applyFilter;

    const toggleAll = document.querySelector('[data-wm-toggle-all]');
    if (toggleAll) toggleAll.onclick = () => {
      const open = [].slice.call(document.querySelectorAll('[data-wm-model]'))
        .filter(d => !d.closest('[hidden]'));
      const expand = open.some(d => !d.open);
      open.forEach(d => { d.open = expand; });
      toggleAll.textContent = expand ? '收起全部范文' : '展开全部范文';
    };

    this._writingPrintHook();
  },

  _writingGroup(item) {
    return item.section.key === 'writing_cont' ? '读后续写' : '应用文写作';
  },

  _writingCard(item, index) {
    const { meta, section, q, model, source } = item;
    const group = this._writingGroup(item);
    /* 细分类型（书信/图表/投稿…）复用写作专题那套从题干反推的规则，
       两处口径必须一致，否则同一篇在两边显示成不同类型。 */
    const type = Topic.writingType({ section });
    const prompt = String(q.stem || q.prompt || '').trim();
    const required = (prompt.match(/(\d+)\s*词/) || [])[1];
    const words = model.trim().split(/\s+/).filter(Boolean).length;
    const hay = [type, group, meta.title, meta.paper, prompt].join(' ').toLowerCase();

    return '<article class="wm-card" data-wm-card data-wm-group="' + group + '"'
      + ' data-wm-hay="' + this.esc(hay) + '" id="wm-card-' + index + '">'
      + '<div class="wm-card-top">'
      + '<span class="wm-chip">' + this.esc(type) + '</span>'
      + '<b>' + this.esc(section.secTitle || section.partTitle || group) + '</b>'
      + '<span class="wm-source">' + this.esc(meta.title) + ' · 第 ' + q.id + ' 题</span>'
      + '</div>'
      + '<div class="wm-prompt"><span class="wm-label">题目</span>'
      + '<p>' + this.text(prompt) + '</p></div>'
      + '<details class="wm-model" data-wm-model>'
      + '<summary>查看参考范文（约 ' + words + ' 词'
      + (required ? ' · 题目要求 ' + required + ' 词左右' : '') + '）</summary>'
      + '<pre>' + this.esc(model) + '</pre>'
      + (source
        ? '<p class="wm-src">范文来源：' + this.esc(source) + '</p>'
        : '<p class="wm-src">范文来源：题库未标注出处，使用前请与老师核对。</p>')
      + '</details>'
      + '<div class="wm-actions">'
      + '<a class="ghost-btn" href="#/writing/' + encodeURIComponent(meta.id) + '/'
        + encodeURIComponent(section.key) + '">拿我的文章对照自评 →</a>'
      + '<a class="text-btn" href="#/review/' + encodeURIComponent(meta.id) + '">看这套卷的完整解析</a>'
      + '</div></article>';
  },

  /* Ctrl+P（不经过页内打印按钮）时，折叠的范文在纸上会一片空白 ——
     折叠内容根本不参与渲染，CSS 救不回来（见 css/print.css 的说明）。
     所以打印前把本页的 details 全部打开、打完再收回去。
     钩子只认 .wm-card 里的块，其它页面不受影响，注册一次即可。 */
  _writingPrintHook() {
    if (this._wmPrintHooked) return;
    this._wmPrintHooked = true;
    window.addEventListener('beforeprint', () => {
      document.querySelectorAll('.wm-card details:not([open])').forEach(d => {
        d.open = true;
        d.dataset.wmAuto = '1';
      });
    });
    window.addEventListener('afterprint', () => {
      document.querySelectorAll('.wm-card details[data-wm-auto]').forEach(d => {
        d.open = false;
        delete d.dataset.wmAuto;
      });
    });
  },
});
