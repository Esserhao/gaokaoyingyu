/* =====================================================================
   上海专区 —— #/shanghai 门厅 + #/shanghai/exams 真题册 + #/shanghai/vocab 考纲词汇。
   数据源（script 注入，非 fetch）：
   - data/shanghai/exams.js   → window.__SH_EXAMS__（登记结构，papers 暂空）
   - data/vocab/sh-kaogang.js → window.__SH_VOCAB__（官方考纲词汇 2075 条，
     verified=false 未人工复核，界面必须标灰如实呈现）
   sh-kaogang.js 226KB 只服务上海两个页面（2026-09-19 起按需注入）：
   shVocabReady() 照 examfreq/dict 的懒加载模式动态 <script>，file:// 下可用；
   加载失败时如实降级（不给假计数，提示重进重试）。
   上海卷制式与全国卷不同（春考/秋考、翻译+概要写作等），本模块独立成页，
   不复用 Exam 的 legacy/new 折算口径，也不混入全国卷词书库。
   ===================================================================== */
Object.assign(UI, {

  /* 考纲词表按需就位。resolve(true)=已载入；resolve(false)=加载失败。
     失败后清空 _shVocabLoading，允许下次进页重试，不让一次失败永久缓存。 */
  shVocabReady() {
    if (window.__SH_VOCAB__) return Promise.resolve(true);
    if (this._shVocabLoading) return this._shVocabLoading;
    this._shVocabLoading = new Promise(res => {
      const s = document.createElement('script');
      s.src = 'data/vocab/sh-kaogang.js';
      s.onload = () => res(true);
      s.onerror = () => { this._shVocabLoading = null; res(false); };
      document.head.appendChild(s);
    });
    return this._shVocabLoading;
  },

  /* 门厅：两张入口卡 + 制式差异说明。词数要等数据就位才有——
     等不到就不显示计数，不渲染一个假的「0 词」。 */
  async shanghai() {
    const ok = await this.shVocabReady();
    /* await 期间用户可能已跳走（226KB 注入不是瞬间完成的）：hash 不再是
       上海门厅就放弃渲染，否则会覆盖新页面（照 word.js _fillWord 守卫先例）。 */
    if (!/^#\/shanghai$/.test(location.hash || '')) return;
    const V = window.__SH_VOCAB__;
    const count = ok && V ? V.words.length + ' 词 · ' : '';
    this.app().innerHTML = this.header('上海专区', true)
      + '<main class="sh-home">'
      + '<h1>上海卷专区</h1>'
      + '<p class="sh-lede">上海卷的题型、卷制和词汇要求和全国卷不一样——这里单独放'
      + '上海的东西，不和全国卷混在一起。</p>'
      + '<ul class="sh-entry-list">'
      + '<li><a href="#/shanghai/exams">'
      + '<b>上海真题册</b><small>历年卷登记与练习（框架已就位，卷子陆续上架）</small></a></li>'
      + '<li><a href="#/shanghai/vocab">'
      + '<b>上海考纲词汇</b><small>' + count + '上海市教育考试院词表'
      + ' · 未人工复核</small></a></li>'
      + '</ul>'
      + '<section class="sh-note"><h2>上海卷和全国卷差在哪？</h2>'
      + '<ul><li>上海卷分春秋两考，客观题占比更低，主观题（中译英、概要写作）占分更高；</li>'
      + '<li>上海考纲词表独立于全国 3500 词，本区词汇取自考试院官方词表；</li>'
      + '<li>两区数据各自独立，学习记录互不影响。</li></ul></section>'
      + '</main>';
  },

  /* 真题册：登记表（可做题 / 仅登记两类），暂无数据时给诚实空态。 */
  shanghaiExams() {
    const SH = window.__SH_EXAMS__ || { papers: [] };
    const papers = SH.papers || [];
    let body;
    if (!papers.length) {
      body = '<div class="sh-empty">'
        + '<b>卷子还没上架</b>'
        + '<p>上海真题册的架子已经搭好：每套卷按「年份 + 春/秋考/一二模」登记，'
        + '拿到完整题目的卷子可以直接在这里做，暂时只有卷名的会留链接。'
        + '第一批卷子整理好就会出现在这里。</p></div>';
    } else {
      body = '<div class="sh-paper-list">' + papers.map(p =>
        '<div class="sh-paper-row' + (p.sections ? ' has-paper' : '') + '">'
        + '<div><b>' + this.esc(p.title) + '</b>'
        + '<small>' + this.esc(p.season) + ' · '
        + (p.verified ? '已人核' : '<em>未人核</em>')
        + (p.source ? ' · 来源：' + this.esc(p.source) : '') + '</small></div>'
        + (p.sections
          ? '<a class="text-btn" href="#/sh/exam/' + this.esc(p.id) + '">开始做题 →</a>'
          : (p.source ? '<a class="text-btn" href="' + this.esc(p.source)
            + '" target="_blank" rel="noopener">外部查看 →</a>' : ''))
        + '</div>').join('') + '</div>';
    }
    this.app().innerHTML = this.header('上海真题册', true)
      + '<main class="sh-exams"><span class="eyebrow">SHANGHAI PAPERS</span>'
      + '<h1>上海真题册</h1>'
      + '<p class="sh-lede">上海卷按考试批次登记；只有完整收录的卷子才开放做题，'
      + '其余只登记不冒充。</p>' + body + '</main>';
  },

  /* 考纲词汇：搜索 + 首字母索引 + 释义列表。列表区单独刷新（shVocabFill），输入框保焦点。
     词表数据按需注入（shVocabReady），失败时给重试指引，不渲染空列表装没事。 */
  async shanghaiVocab() {
    const ok = await this.shVocabReady();
    /* await 期间用户可能已跳走：hash 不再是本页就放弃渲染（防覆盖新页）。 */
    if (!/^#\/shanghai\/vocab$/.test(location.hash || '')) return;
    if (!ok || !window.__SH_VOCAB__) {
      this.app().innerHTML = this.header('上海考纲词汇', true)
        + '<main class="sh-vocab"><span class="eyebrow">SHANGHAI VOCABULARY</span>'
        + '<h1>上海考纲词汇</h1><div class="sh-empty"><b>词表没能加载</b>'
        + '<p>数据文件（data/vocab/sh-kaogang.js）没读出来。回首页再进一次，'
        + '还是不行就检查文件是否在原位。</p></div></main>';
      return;
    }
    const V = window.__SH_VOCAB__;
    this._shVocab = { q: '', letter: '' };
    const letters = [...new Set(V.words.map(x => (x.w[0] || '').toUpperCase()))]
      .filter(c => /[A-Z]/.test(c)).sort();
    const chips = letters.map(c =>
      '<button type="button" class="text-btn" data-action="sh-letter" data-letter="' + c
      + '">' + c + '</button>').join('');
    this.app().innerHTML = this.header('上海考纲词汇', true)
      + '<main class="sh-vocab"><span class="eyebrow">SHANGHAI VOCABULARY</span>'
      + '<h1>上海考纲词汇 <i class="sh-count">' + V.words.length + ' 词</i></h1>'
      + '<p class="sh-lede">词表来自上海市教育考试院官网，机器整理、<b>还没有人工逐条复核</b>，'
      + '发现释义不对以官方词表为准。这本书已经并入全站查词与生词本——'
      + '<a href="#/word">去查词</a> 里命中上海考纲释义的词条会标「未人核」灰签，'
      + '收藏后照常进生词本复习。</p>'
      + '<input class="sh-search" type="search" placeholder="搜索单词…" '
      + 'data-sh-vocab-search aria-label="搜索上海考纲词汇">'
      + '<div class="sh-letters" role="group" aria-label="按首字母筛选">' + chips + '</div>'
      + '<div id="sh-vocab-list" aria-live="polite">' + this.shVocabList() + '</div>'
      + '</main>';
  },

  /* 词表列表（可独立刷新）。2075 条全渲染太重：默认只出前 120 条，有筛选放开到 600。 */
  shVocabList() {
    const V = window.__SH_VOCAB__ || { words: [], verified: false };
    const st = this._shVocab || { q: '', letter: '' };
    const q = st.q.toLowerCase();
    let list = V.words;
    if (st.letter) list = list.filter(x => (x.w[0] || '').toUpperCase() === st.letter);
    if (q) list = list.filter(x => x.w.toLowerCase().includes(q));
    const cap = (st.q || st.letter) ? 600 : 120;
    const shown = list.slice(0, cap);
    if (!shown.length) {
      return '<div class="sh-empty"><b>没有找到「' + this.esc(st.q || st.letter) + '」</b>'
        + '<p>换个词试试；词表只含官方收录的词条。</p></div>';
    }
    const rows = shown.map(x => '<div class="sh-word-row">'
      + '<b class="sh-word">' + this.esc(x.w) + '</b>'
      + (x.note ? '<i class="sh-note">' + this.esc(x.note) + '</i>' : '')
      + '<span class="sh-defs">' + x.defs.map(d =>
        '<em>' + this.esc(d[0]) + '</em> ' + this.esc(d[1])).join('；') + '</span>'
      + '<a class="text-btn sh-detail" href="#/word/' + encodeURIComponent(x.w.toLowerCase())
      + '">详情·收藏</a>'
      + '</div>').join('');
    return '<div class="sh-word-list">' + rows + '</div>'
      + (list.length > shown.length
        ? '<p class="sh-more">只显示前 ' + shown.length + ' 条（共 ' + list.length
        + ' 条）——在上方搜索或选首字母可以缩小范围。</p>'
        : '<p class="sh-more">共 ' + list.length + ' 条</p>');
  },

  shVocabFill(q) {
    this._shVocab = Object.assign(this._shVocab || {}, { q });
    const box = document.getElementById('sh-vocab-list');
    if (box) box.innerHTML = this.shVocabList();
  },
});
