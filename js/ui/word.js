/* =====================================================================
   查词（#/word，C4）—— 词条页 + 点击查词（C6）的取词逻辑
   数据源：data/vocab/ 8 本词书（window.__VOCAB__，惰加载），查询时
   首次把全部词书加载进缓存（本地文件，一次性 ~2MB），之后同步命中。
   词条页除释义/音标/例句外，还给出这个词的三类连接：
     · 同义/近义/反义（data/vocab/synonyms.js 的 __SYN__ 词族）
     · 词缀派生（js/ui/synonyms.js 的 _affixIdx，词形规则计算）
     · 星空入口：跳到 #/synonyms 以该词为中心展开星座
   点击查词：带 data-lookup 的阅读区（错题详情 / 知识详情证据 / 解析页）
   点击英文单词 → #/word/<词>。取词用 caretRangeFromPoint 从光标位置
   反查文本节点，不往正文里塞 <span>，阅读排版零改动。
   ===================================================================== */
window.UI = window.UI || {};
Object.assign(UI, {
  _wordAllP: null,   /* 全词书加载的记忆化 Promise */

  /* 查询词在全部词书里的命中（含惰加载；首次调用会载入全部词书），
     再兜底查通用词典分片（window.__DICT__，12 万词，按首字母懒加载）。
     返回 [{name, level, entry}]，entry 形如 {w,pos,ph,m,ex,exCn}。 */
  _wordLookupAll(word) {
    const V = window.__VOCAB__;
    if (!V || !V.books) return Promise.resolve([]);
    if (!this._wordAllP) {
      this._wordAllP = Promise.all(V.books.map(b => V.load(b.id).catch(() => null)));
    }
    return this._wordAllP.then(() => {
      const cache = window.__VOCAB_CACHE__ || {};
      const out = [];
      V.books.forEach(b => {
        const e = (cache[b.id] || []).find(x => (x.w || '').toLowerCase() === word.toLowerCase());
        if (e) out.push({ name: b.name, level: b.level, entry: e, verified: b.verified !== false });
      });
      return out;
    }).then(out => {
      /* 通用词典兜底：8 本精选词书未必收全（尤其低频词与词形变化），
         这里补上 AsunDictionary 的释义行。分片按首字母懒加载。 */
      const D = window.__DICT__;
      const lower = word.toLowerCase();
      const letter = lower[0];
      if (!D || !D.load || !/[a-z]/.test(letter)) return out;
      return D.load(letter).then(() => {
        const hit = (window.__DICT_CACHE__[letter] || [])
          .find(x => (x.w || '').toLowerCase() === lower);
        if (hit) out.push({ name: D.meta.name, level: '通用', entry: hit });
        return out;
      }).catch(() => out);
    });
  },

  /* 查词首页：搜索框 + 用法说明 + 示例词 */
  wordHome() {
    this.app().innerHTML = this.header('查词', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">DICTIONARY</span><h1>查词</h1></div>'
      + '<a class="text-btn" href="#/">返回首页</a></div>'
      + '<section class="word-search-card">'
      /* 查询按钮（2026-09-03）：此前这里只有一个裸输入框，回车或失焦才触发。
         新用户不知道要按回车，移动端软键盘不出现「前往」键就彻底卡住。 */
      + '<div class="syn-explore-row">'
      + '<input id="word-search" class="syn-explore-input" data-word-search '
      + 'placeholder="输入单词，如 happy / development / un-">'
      + '<button class="primary-btn" data-action="word-search">查询</button>'
      + '</div>'
      + '<p class="word-note">10 本词书（高考核心 3500 / 高中乱序 / 六级 / 初中 / 上海考纲 等），'
      + '另有 12 万词通用词典兜底。错题详情、知识详情的例句和整卷解析页里，'
      + '点击文中任意英文单词也能直接查；词条页与生词本里的 ♪ 读 按钮'
      + '用浏览器内置语音朗读单词与例句。</p>'
      + '<div class="word-examples">'
      + '<a class="syn-chip syn-chip-aff" href="#/word/happy">happy</a>'
      + '<a class="syn-chip syn-chip-aff" href="#/word/development">development</a>'
      + '<a class="syn-chip syn-chip-aff" href="#/word/un-">un-</a>'
      + '</div></section>'
      + '<p class="word-note">要找试卷、知识点、词组？<a href="#/search">用全站搜索 →</a></p>'
      + '<div id="word-body"></div></main>';
  },

  /* 词条页：词书释义 + 同义/近义/反义 + 词缀派生 + 星空入口 */
  wordDetail(word) {
    word = (word || '').trim();
    this.app().innerHTML = this.header('查词', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">DICTIONARY</span><h1>查词</h1></div>'
      + '<a class="text-btn" href="#/word">重新查词</a></div>'
      + '<section class="word-search-card"><div class="syn-explore-row">'
      + `<input id="word-search" class="syn-explore-input" data-word-search value="${this.esc(word)}" `
      + 'placeholder="输入单词，如 happy / development / un-">'
      + '<button class="primary-btn" data-action="word-search">查询</button>'
      + '</div></section>'
      + `<div id="word-body"><p class="word-loading">正在查询「${this.esc(word)}」…</p></div>`
      + '</main>';
    this._fillWord(word);
  },

  async _fillWord(word) {
    const entries = await this._wordLookupAll(word);
    const box = document.getElementById('word-body');
    if (!box) return;   // 页面已切走

    if (!entries.length) {
      /* 词书未收：是词缀则直接给词缀详情；否则给未收录空态 */
      await this._affixReady();
      const aff = this._matchAffix(word.toLowerCase());
      if (aff) {
        box.innerHTML = '<p class="word-note">词书未收该词形；它是一个词缀，下面是它的家族。</p>'
          + this._affixCard(aff.key);
      } else {
        box.innerHTML = '<section class="word-card"><h2 class="word-hw">'
          + `${this.esc(word)}</h2><p class="word-note">10 本词书与 12 万词通用词典都未收录这个词。`
          + '请检查拼写，或到 <a href="#/synonyms">同义近义反义星空</a> 用关系链找相近的词。</p></section>';
      }
      return;
    }

    const first = entries[0].entry;
    const lower = word.toLowerCase();

    /* 收藏状态（C5 生词本）：已收藏显示星标 + 可移除 */
    const saved = (Store.getWords() || {})[lower];
    const saveBtn = `<div class="word-actions">`
      + `<button class="${saved ? 'ghost-btn' : 'primary-btn'}" `
      + `data-action="${saved ? 'word-remove' : 'word-add'}" data-word="${this.esc(lower)}">`
      + `${saved ? '★ 已在生词本 · 点击移除' : '☆ 收藏生词'}</button>`
      + `<a class="text-btn" href="#/words">生词本 →</a></div>`;

    const bookRows = entries.map(x => '<div class="word-entry">'
      + `<span class="word-book-badge">${this.esc(x.name)}</span>`
      + (x.verified === false ? '<em class="word-unverified">未人核</em>' : '')
      + (x.entry.pos ? `<span class="word-pos">${this.esc(x.entry.pos)}</span>` : '')
      + (x.entry.ph ? `<span class="word-ph">${this.esc(x.entry.ph)}</span>` : '')
      + this.speakBtn(x.entry.ex || word)
      + `<div class="word-m">${this.esc(x.entry.m)}</div>`
      + (x.entry.ex ? `<div class="syn-vocab-ex">${this.esc(x.entry.ex)}</div>` : '')
      + (x.entry.exCn ? `<div class="syn-vocab-excn">${this.esc(x.entry.exCn)}</div>` : '')
      + '</div>').join('');

    /* 真题考频（附录 C3）：tools/build_examfreq.py 离线统计词形在各套真题
       卷面（原文/题干/选项）的出现情况。数据按需注入（约 MB 级，不进首屏），
       生成器未跑或文件缺失时不渲染该区，词条页其余部分不受影响。 */
    await this._freqReady();
    const fq = ((window.__EXAM_FREQ__ || {}).words || {})[lower];
    const freqCard = fq
      ? '<section class="word-card word-freq"><h3 class="word-card-title">真题考频</h3>'
        + `<p class="word-freq-line">在 <b>${fq.papers}</b> 套真题里出现 <b>${fq.hits}</b> 次。</p>`
        + (fq.ex || []).map(x =>
          '<a class="word-freq-ex" href="#/review/' + this.esc(x.e) + '">'
          + `<span>${this.esc(x.t)}</span>`
          + `<small>${this.esc(x.label || '')}</small></a>`).join('')
        + '<p class="word-note">点击原句进入该套卷的解析页。</p></section>'
      : '';

    /* 关系与词缀（异步索引就绪后回填，与星座页同一套数据） */
    box.innerHTML = '<section class="word-card">'
      + `<h2 class="word-hw">${this.esc(word)} ${this.speakBtn(word)}</h2>`
      + (first.pos ? `<span class="word-pos">${this.esc(first.pos)}</span>` : '')
      + (first.ph ? `<span class="word-ph">${this.esc(first.ph)}</span>` : '')
      + saveBtn
      + bookRows
      + '</section>'
      + freqCard
      + '<section class="word-rel-cards" id="word-rel-cards">'
      + '<p class="word-loading">查询词的关系与词缀…</p></section>';
    await this._affixReady();
    await this._formReady();
    const relBox = document.getElementById('word-rel-cards');
    if (!relBox) return;

    const rel = this._synIndex()[lower] || { syn: [], near: [], ant: [] };
    const chips = (title, cls, arr) => arr.length
      ? `<div class="syn-rel syn-rel-${cls}"><b>${title}</b>`
        + arr.map(w => `<button class="syn-chip syn-chip-${cls}" data-action="word-syn" data-word="${this.esc(w)}">${this.esc(w)}</button>`).join('')
        + '</div>'
      : '';
    const ax = this._affixIdx || { byWord: {}, derive: {} };
    const formList = (this._formIdx || {})[lower] || [];
    const deriveList = ax.derive[lower] || [];
    const own = ax.byWord[lower] || { pre: [], suf: [] };
    const affChips = (arr, kind) => arr.map(a => `<button class="syn-chip syn-chip-aff" data-action="word-syn" `
      + `data-word="${this.esc(this._affixDisplay(a, kind))}">`
      + `${this.esc(this._affixDisplay(a, kind))}</button>`).join('');
    relBox.innerHTML = '<section class="word-card"><h3 class="word-card-title">词的关系（星空）</h3>'
      + '<div class="syn-rel-block">'
      + chips('同义', 'syn', rel.syn)
      + chips('近义', 'near', rel.near)
      + chips('反义', 'ant', rel.ant)
      + (formList.length
        ? '<div class="syn-rel syn-rel-sim"><b>形近词</b>'
          + formList.map(w => `<button class="syn-chip syn-chip-sim" data-action="word-syn" data-word="${this.esc(w)}">${this.esc(w)}</button>`).join('')
          + '</div>'
        : '')
      + (deriveList.length
        ? '<div class="syn-rel syn-rel-aff"><b>派生词</b>'
          + deriveList.map(d => `<button class="syn-chip syn-chip-aff" data-action="word-syn" data-word="${this.esc(d.w)}">`
            + `${this.esc(d.w)}<small class="syn-chip-tag">${this.esc(this._affixDisplay(d.a, d.kind))}</small></button>`).join('')
          + '</div>'
        : '')
      + ((own.pre.length || own.suf.length)
        ? '<div class="syn-rel syn-rel-aff"><b>本词词缀</b>' + affChips(own.pre, 'pre') + affChips(own.suf, 'suf') + '</div>'
        : '')
      + '</div>'
      + '<button class="primary-btn" data-action="word-syn" data-word="' + this.esc(lower) + '">'
      + `在星空里展开「${this.esc(lower)}」→</button></section>`;
  },

  /* 真题考频数据按需注入（附录 C3）：与 dict 分片同一懒加载模式。
     file:// 下动态 <script src> 可用（不受 fetch CORS 限制）；加载失败
     （文件不存在）静默降级为无考频区。 */
  _freqReady() {
    if (window.__EXAM_FREQ__) return Promise.resolve(true);
    if (this._freqLoading) return this._freqLoading;
    this._freqLoading = new Promise(res => {
      const s = document.createElement('script');
      s.src = 'data/examfreq.js';
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
    return this._freqLoading;
  },

  /* ---------- 点击查词：从点击坐标反查光标下的英文单词 ----------
     用 caretRangeFromPoint（Chrome / 无头护栏浏览器都支持，注意它挂在
     document 而非 window 上）定位文本节点，再向两侧扩展到词边界。
     不改动正文 DOM，阅读排版零影响。 */
  wordFromPoint(e) {
    const doc = e.target.ownerDocument;
    if (!doc.caretRangeFromPoint) return null;
    const r = doc.caretRangeFromPoint(e.clientX, e.clientY);
    if (!r || !r.startContainer || r.startContainer.nodeType !== 3) return null;
    const text = r.startContainer.textContent || '';
    let a = r.startOffset, b = r.startOffset;
    const isWordChar = c => /[A-Za-z'-]/.test(c);
    while (a > 0 && isWordChar(text[a - 1])) a--;
    while (b < text.length && isWordChar(text[b])) b++;
    const wd = text.slice(a, b).replace(/^[-']+/, '').replace(/[-']+$/, '').toLowerCase();
    return /^[a-z][a-z'-]+$/.test(wd) ? wd : null;
  },

  /* 词汇使用指南（2026-09-19 循环第十三轮）：教师侧方法论落站。
     主张：以测代背（测试效应）+ 跟间隔走（间隔复习），用考频定优先级。
     证据分级沿用《能力提升与可视化方案》口径：【强】=实验/元分析支持，
     【中】=教研共识。自著学习指引、非官方考试材料，如实标注。 */
  vocabGuide() {
    const ladder = Review.INTERVALS.join(' / ');
    const tag = g => `<i class="guide-evidence">${g}</i>`;
    const do1 = (act, how) => '<p class="guide-do"><b>' + act + '</b>' + how + '</p>';

    return this.header('词汇指南', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">VOCABULARY GUIDE</span><h1>单词怎么记才真会</h1></div>'
      + '<a class="text-btn" href="#/words">回生词本</a></div>'
      + '<section class="word-card"><h3 class="word-card-title">核心主张</h3>'
      + '<p class="analysis-lead">单词不是「背」会的，是<b>「反复见到 + 亲手提取」</b>会的。'
      + '两条证据最硬的结论决定用法：</p>'
      + do1('以测代背', '合上释义先回忆、再看答案——重读十遍不如提取一遍'
        + '（一周后保持率 61% 对 40%）' + tag('【强】'))
      + do1('跟间隔走', '到期当天清，别凭感觉攒着——间隔安排的复习量是'
        + '「将忘未忘」时最划算' + tag('【强】'))
      + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">在本站怎么用（功能对照）</h3>'
      + do1('收词', '在真题阅读/听力、错题解析里遇到生词，'
        + '进 <a href="#/word">词条页</a> 点 ☆ 收藏——不要拿词书整表往后划')
      + do1('复习', '<a href="#/words">生词本</a>推词的那个瞬间就是提取练习：'
        + '<b>先回忆、再看释义</b>，然后照实点「认识 / 忘记」。'
        + '阶梯是 ' + ladder + ' 天，连着三轮都认识的词，是阶梯在悄悄为你省时间')
      + do1('定优先级', '词条页的「真题考频」区：3500 词是范围，'
        + '<b>考频才是优先级</b>——真题里反复出现的词形先花力气')
      + do1('词组', '<a href="#/phrases">词组闪卡</a>：完形与读后续写的差距大量在词组。'
        + '释义有 541 条还在人工补核，先记「见过」、再记「精确义」，两步走不丢人')
      + do1('织网', '<a href="#/synonyms">同义词星空</a>是把近义词摊开比较一次的地方——'
        + '星空里比较一遍 deliver / convey / transmit，胜过单独背三条释义'
        + '（完形「复现与逻辑核对」考的就是这张网）')
      + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">三条底线</h3>'
      + do1('新词限量', '每天 10–30 个，最多 30——一个词平均需要 8–10 次不同场合的'
        + '接触才算掌握，摊进间隔复习正好' + tag('【中】'))
      + do1('到期当天清', '攒到周末一次补两小时，不如每天十分钟跟着阶梯走')
      + do1('不抄写', '抄单词本是安慰剂：抄十遍不归因不复测，效果趋近于零。'
        + '手可以动，但必须跟着「遮释义 → 回忆 → 核对」的节奏动' + tag('【中】'))
      + '</section>'
      + '<section class="word-card"><h3 class="word-card-title">站内在升级什么</h3>'
      + '<p class="word-note">复习算法计划从固定阶梯升级为 FSRS（按你的记住/忘掉'
      + '记录拟合参数，同保持率可省 20–30% 复习量——厂商口径' + tag('【中】')
      + '），先在词汇闪卡灰度；词组释义 541 条人工补核进行中（见人工待办清单）。</p></section>'
      + '<p class="word-note">本页是自著学习指引，整理自认知科学实验与教研共识'
      + '（证据分级与来源见《能力提升与可视化方案.md》），不是官方考试说明。'
      + '方法对不对，用你自己的到期清完率检验。</p>'
      + '</main>';
  },

  /* ---------- 生词本（C5 + 附录 D 考频） ----------
     今天该复习（Review.due，认识 +1 档 / 忘记归零）+ 排期中 + 已毕业。
     行首的词链回词条页，复习时顺眼看释义。
     考频排序（附录 D）：复习队列按真题出现次数从高到低——同样到期的词，
     高频考词先过；平手按到期先后。考频键是词目，收藏的是屈折表面形时
     查不到徽标，静默降级不阻塞页面。 */
  async words() {
    await this._freqReady();
    const FREQ = ((window.__EXAM_FREQ__ || {}).words || {});
    const fHits = x => (FREQ[x.word] || {}).hits || 0;
    const fPapers = x => (FREQ[x.word] || {}).papers || 0;
    const byFreq = (a, b) => fHits(b) - fHits(a)
      || ((a.nextReviewAt ?? a.addedAt ?? 0) - (b.nextReviewAt ?? b.addedAt ?? 0));

    const all = Object.entries(Store.getWords())
      .map(([w, r]) => ({ word: w, ...r }))
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const due = Review.due(all).sort(byFreq);
    const graduated = all.filter(x => Review.retired(x));
    const learning = all.filter(x => !Review.retired(x) && !Review.isDue(x)).sort(byFreq);

    const row = (x, actions) => '<div class="word-row">'
      + `<a class="word-row-term" href="#/word/${encodeURIComponent(x.word)}">${this.esc(x.word)}</a>`
      + (fPapers(x)
        ? `<i class="word-row-freq">真题 ${fPapers(x)} 卷</i>`
        : '<i class="word-row-freq"></i>')
      + `<span class="word-row-sched">${this.esc(Review.label(x))}</span>`
      + `<span class="word-row-actions">${actions}</span></div>`;

    const dueRows = due.length
      ? due.map(x => row(x,
        this.speakBtn(x.word)
        + `<button class="text-btn" data-action="word-known" data-word="${this.esc(x.word)}">认识</button>`
        + `<button class="text-btn" data-action="word-forgot" data-word="${this.esc(x.word)}">忘记</button>`)).join('')
      : '<p class="word-note">今天没有到期的生词。收藏新词会排在明天复习。</p>';
    const learnRows = learning.map(x => row(x,
      `<button class="text-btn" data-action="word-remove" data-word="${this.esc(x.word)}">移除</button>`)).join('');
    const gradRows = graduated.map(x => row(x,
      `<button class="text-btn" data-action="word-remove" data-word="${this.esc(x.word)}">移除</button>`)).join('');

    this.app().innerHTML = this.header('生词本', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">VOCABULARY NOTEBOOK</span><h1>生词本</h1></div>'
      + '<span><a class="text-btn" href="#/word">去查词</a>'
      + '<a class="text-btn" href="#/phrases">词组闪卡</a>'
      + '<a class="text-btn" href="#/vocab-guide">词汇指南</a>'
      + (all.length
        ? '<button class="text-btn" data-action="print-page">打印</button>'
        : '') + '</span></div>'
      + '<section class="word-card"><h3 class="word-card-title">今天该复习（'
      + `${due.length}）</h3>${dueRows}</section>`
      + (learning.length
        ? `<section class="word-card"><h3 class="word-card-title">排期中（${learning.length}）</h3>${learnRows}</section>`
        : '')
      + (graduated.length
        ? '<section class="word-card"><h3 class="word-card-title">已毕业（'
          + `${graduated.length}）—— 走完 1/3/7/15/30 天阶梯</h3>${gradRows}</section>`
        : '')
      + (!all.length
        ? '<section class="word-card"><p class="word-note">还没有收藏生词。'
          + '在 <a href="#/word">查词</a> 或错题解析里遇到生词，点「收藏生词」就进这里，'
          + '按 1/3/7/15/30 天的阶梯安排复习。</p></section>'
        : '')
      + '</main>';
  },
});
