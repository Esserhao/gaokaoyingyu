/* =====================================================================
   全站搜索（F9，#/search）
   一个框搜四样东西：真题卷、知识节点、单词、词组。全部客户端匹配
   （本站没有后端，也没有索引要维护），数据源都是各页已经用熟的那几份：
     试卷   app.exams（16 套的标题/卷别/年份）
     知识点 window.KB（50 个节点的名字/分类/标签）
     单词   8 本词书缓存（复用查词页的 _wordAllP 惰加载，前缀匹配）
     词组   gaokao-phrases 缓存（复用词组闪卡的 _phraseData）
   结果只刷 [data-search-results]，搜索框始终保有焦点（连打不丢）。
   ===================================================================== */

Object.assign(UI, {
  _searchP: null,          /* 单飞：同一时刻只跑一次聚合 */
  _searchState: { q: '' }, /* 重渲染后回填输入框的值 */

  search(q) {
    this._searchState.q = q || '';
    this.app().innerHTML = this.header('全站搜索', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">SEARCH</span><h1>全站搜索</h1></div>'
      + '<a class="text-btn" href="#/">回到试卷库</a></div>'
      + '<section class="word-search-card"><div class="syn-explore-row">'
      + '<input id="global-search" class="syn-explore-input" data-global-search '
      + 'placeholder="搜试卷 / 知识点 / 单词 / 词组，如 定语从句 · happy · look forward to"'
      + (this._searchState.q ? ` value="${this.esc(this._searchState.q)}"` : '')
      + '></div>'
      + '<p class="word-note">快捷键「/」随时跳到这里；搜索即打即出，不用按回车。</p>'
      + '</section>'
      + '<div data-search-results>' + this._searchHome() + '</div></main>';
  },

  _searchHome() {
    return '<section class="search-hint">'
      + '<div class="ins-sec"><h3>试试这些</h3><ul>'
      + '<li><a href="#/search" data-search-try="定语从句">定语从句</a><b>知识点</b></li>'
      + '<li><a href="#/search" data-search-try="2024">2024</a><b>真题卷</b></li>'
      + '<li><a href="#/search" data-search-try="abandon">abandon</a><b>单词</b></li>'
      + '<li><a href="#/search" data-search-try="look forward">look forward</a><b>词组</b></li>'
      + '</ul></div></section>';
  },

  /* 输入回调（app.js input() 节流后调这里）：只刷结果区，不动输入框 */
  searchFill(q) {
    this._searchState.q = q;
    const box = document.querySelector('[data-search-results]');
    if (!box) return;
    if (!q) { box.innerHTML = this._searchHome(); return; }

    /* 同一时刻只保留最后一次请求（快速连打时旧结果不回写） */
    const token = (this._searchToken = (this._searchToken || 0) + 1);
    box.innerHTML = '<p class="searching">搜索中…</p>';
    this._searchGather(q).then(groups => {
      if (token !== this._searchToken) return;
      box.innerHTML = this._searchRender(groups, q);
    });
  },

  /* 四路聚合：试卷/知识点同步出，单词/词组等缓存就绪 */
  async _searchGather(q) {
    const lc = q.toLowerCase();
    const allExams = window.__EXAMS__ || [];
    const exams = allExams.filter(x =>
      x.title.toLowerCase().includes(lc)
      || (x.paper || '').toLowerCase().includes(lc)
      || String(x.year).includes(q)).slice(0, 5);
    const nodes = (KB || []).filter(n =>
      (n.name || '').toLowerCase().includes(lc)
      || (n.category || '').includes(q)
      || (n.tags || []).some(t => t.toLowerCase().includes(lc))).slice(0, 6);

    /* 单词：前缀命中优先，按词书去重取一个代表释义 */
    if (!this._wordAllP) this._wordLookupAllInit();
    await this._wordAllP;
    const cache = window.__VOCAB_CACHE__ || {};
    const V = window.__VOCAB__ || { books: [] };
    const seen = {};
    const words = [];
    V.books.forEach(b => {
      ((cache[b.id]) || []).forEach(e => {
        const w = (e.w || '').toLowerCase();
        if (!w.startsWith(lc) || seen[w]) return;
        seen[w] = true;
        if (words.length < 8) words.push({ w: e.w, m: e.m || '', book: b.name });
      });
    });

    /* 词组：包含匹配（词组多词，前缀太苛刻） */
    await (this._phraseData ? this._phraseData() : Promise.resolve());
    const phrList = (window.__VOCAB_CACHE__ || {})['gaokao-phrases'] || [];
    const phrases = phrList.filter(x => (x.w || '').toLowerCase().includes(lc))
      .slice(0, 6);

    return [
      { title: '真题卷', items: exams.map(x =>
        ({ href: '#/exam/' + x.id, main: x.title, sub: x.paper + ' · ' + x.year + ' 年' })) },
      { title: '知识点', items: nodes.map(n =>
        ({ href: '#/knowledge/' + encodeURIComponent(n.name), main: n.name, sub: n.category || '' })) },
      { title: '单词', items: words.map(x =>
        ({ href: '#/word/' + encodeURIComponent(x.w), main: x.w, sub: x.m.slice(0, 60) })) },
      { title: '词组', items: phrases.map(x =>
        ({ main: x.w, sub: (x.m || '').slice(0, 60), plain: true })) },
    ];
  },

  /* _wordLookupAll 的词书预热部分单独拆出（不想真查某一个词） */
  _wordLookupAllInit() {
    const V = window.__VOCAB__;
    if (!V || !V.books) return Promise.resolve();
    this._wordAllP = Promise.all(
      V.books.map(b => V.load(b.id).catch(() => null)));
    return this._wordAllP;
  },

  _searchRender(groups, q) {
    const any = groups.some(g => g.items.length);
    if (!any) return '<p class="drill-empty">没有找到与「' + this.esc(q)
      + '」相关的内容。知识点只收了 50 个高考考点，生僻词试试 '
      + '<a href="#/word/' + encodeURIComponent(q) + '">查词页</a>（含 12 万通用词典）。</p>';
    return groups.filter(g => g.items.length).map(g =>
      '<section class="ins-block"><h2>' + this.esc(g.title)
      + `<span>${g.items.length} 条</span></h2><div class="search-rows">`
      + g.items.map(it => it.plain
        ? '<div class="search-row"><span class="search-main">'
          + this.esc(it.main) + '</span><small>' + this.esc(it.sub) + '</small></div>'
        : '<a class="search-row" href="' + it.href + '"><span class="search-main">'
          + this.esc(it.main) + '</span><small>' + this.esc(it.sub) + '</small>'
          + '<b>→</b></a>').join('')
      + '</div></section>').join('');
  },
});
