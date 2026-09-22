/* =====================================================================
   词组闪卡（#/phrases）—— 4,487 条词组数据的「学习出口」
   星图只负责展示词组关系；这里把词组变成可收藏、可排期、可翻面的
   闪卡。数据层与生词本完全同构（store.phrases 区 + Review 1/3/7/15/30
   阶梯 + syncMergeWords 同口径合并），区别只在卡面：
     正面 = 词组 + 朗读；背面 = 释义 + 例句（先翻面再判定 认识/忘记）。
   词组释义来自 data/vocab/gaokao-phrases.js（惰加载，星图同一份缓存）。
   无释义词组不进收录池（与清洗口径一致，见 data/vocab/phrases-no-meaning.md）。
   ===================================================================== */
window.UI = window.UI || {};
Object.assign(UI, {
  _phrDataP: null,   /* gaokao-phrases 惰加载记忆化 Promise（星图同款） */
  _phrNote: '',      /* 一次性提示（收录结果），渲染一次后清空 */

  /* 词组数据就绪（与 synonyms.js 的 _phraseReady 同口径，各自记忆化） */
  _phraseData() {
    if (this._phrDataP) return this._phrDataP;
    this._phrDataP = new Promise(resolve => {
      if (window.__VOCAB__ && window.__VOCAB__.load) {
        window.__VOCAB__.load('gaokao-phrases').then(() => resolve()).catch(() => resolve());
      } else resolve();
    });
    return this._phrDataP;
  },

  _phraseEntry(ph) {
    const list = (window.__VOCAB_CACHE__ || {})['gaokao-phrases'] || [];
    const k = (ph || '').toLowerCase();
    return list.find(x => (x.w || '').toLowerCase() === k) || null;
  },

  /* ---------- 页面 ---------- */
  async phraseCards() {
    /* 词组考频徽标（附录 D）：FREQ.phrases 的键是 token 序列（如 "according
       to"），收藏的原词组小写后能对上就亮徽标，对不上静默降级。 */
    await this._freqReady();
    const PF = ((window.__EXAM_FREQ__ || {}).phrases || {});
    const pfPapers = x => (PF[(x.word || '').toLowerCase()] || {}).papers || 0;
    const all = Object.entries(Store.getPhrases())
      .map(([w, r]) => ({ word: w, ...r }))
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const due = Review.due(all);
    const graduated = all.filter(x => Review.retired(x));
    const learning = all.filter(x => !Review.retired(x) && !Review.isDue(x));
    const note = this._phrNote;
    this._phrNote = '';

    const dueCards = due.length ? due.map(x => this._flashCard(x)).join('')
      : `<p class="word-note">${all.length ? '今天没有到期的词组。刚收录的排在明天复习。' : ''}</p>`;

    const row = (x, actions) => '<div class="word-row">'
      + `<span class="word-row-term">${this.esc(x.word)}</span>`
      + (pfPapers(x)
        ? `<i class="word-row-freq">真题 ${pfPapers(x)} 卷</i>`
        : '<i class="word-row-freq"></i>')
      + `<span class="word-row-sched">${this.esc(Review.label(x))}</span>`
      + `<span class="word-row-actions">${actions}</span></div>`;

    const learnRows = learning.map(x => row(x,
      this.speakBtn(x.word)
      + `<button class="text-btn" data-action="phr-flip" data-phr="${this.esc(x.word)}">翻看</button>`
      + `<button class="text-btn" data-action="phr-remove" data-phr="${this.esc(x.word)}">移除</button>`)).join('');
    const gradRows = graduated.map(x => row(x,
      this.speakBtn(x.word)
      + `<button class="text-btn" data-action="phr-remove" data-phr="${this.esc(x.word)}">移除</button>`)).join('');

    this.app().innerHTML = this.header('词组闪卡', true)
      + '<main class="word-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">PHRASE FLASHCARDS</span><h1>词组闪卡</h1></div>'
      + '<span><button class="text-btn" data-action="phr-import">随机收录 10 条</button> '
      + '<a class="text-btn" href="#/synonyms">去星图收词组 →</a> '
      + '<a class="text-btn" href="#/vocab-guide">词汇指南</a></span></div>'
      + (note ? `<p class="word-note">${this.esc(note)}</p>` : '')
      + (all.length
        ? '<section class="word-card"><h3 class="word-card-title">今天该复习（'
          + `${due.length}）—— 先翻面回想释义，再判定</h3>${dueCards}</section>`
        : '<section class="word-card"><p class="word-note">还没有收录词组。'
          + '点上面的「随机收录 10 条」从 4,487 条高考词组里抽一批起步，'
          + '或在 <a href="#/synonyms">星图</a> 的词组详情卡里逐条收录。'
          + '收录后按 1/3/7/15/30 天阶梯安排复习。</p></section>')
      + (learning.length
        ? `<section class="word-card"><h3 class="word-card-title">排期中（${learning.length}）</h3>${learnRows}</section>`
        : '')
      + (graduated.length
        ? '<section class="word-card"><h3 class="word-card-title">已毕业（'
          + `${graduated.length}）—— 走完 1/3/7/15/30 天阶梯</h3>${gradRows}</section>`
        : '')
      + '</main>';

    /* 词组释义惰加载就绪后整页重渲染一次（背面才有内容）；
       只重渲染一次：首次渲染时数据可能已在缓存（逛过星图），此时
       背面已能渲出，无需回填。 */
    if (!this._phrFilled) {
      this._phraseData().then(() => {
        if (location.hash === '#/phrases' && !this._phrFilled) {
          this._phrFilled = true;
          this.phraseCards();
        }
      });
    }
  },

  /* 翻卡：正面词组 + 朗读 + 翻面；背面释义/例句 + 认识/忘记。
     背面在数据未就绪时给占位文案。 */
  _flashCard(x) {
    const entry = this._phraseEntry(x.word);
    const prog = Review.progress(x);
    const back = entry && entry.m
      ? (entry.m ? `<div class="syn-vocab-m">${this.esc(entry.m)}</div>` : '')
        + (entry.ex ? `<div class="syn-vocab-ex">${this.esc(entry.ex)}
          <button class="speak-btn" data-action="speak" data-speak="${this.esc(entry.ex)}">朗读</button></div>` : '')
        + (entry.exCn ? `<div class="syn-vocab-excn">${this.esc(entry.exCn)}</div>` : '')
      : '<div class="syn-vocab-m">释义加载中…（或该词组无释义）</div>';
    return '<div class="phr-flash" data-phr-flash>'
      + '<div class="phr-flash-front">'
      + `<b class="phr-flash-term">${this.esc(x.word)}</b>`
      + `<span class="phr-flash-round">第 ${prog.round} / ${prog.total} 轮</span>`
      + this.speakBtn(x.word)
      + `<button class="text-btn phr-flip-btn" data-action="phr-flip">翻面</button>`
      + '</div>'
      + '<div class="phr-flash-back">' + back
      + '<div class="phr-flash-actions">'
      + `<button class="primary-btn" data-action="phr-known" data-phr="${this.esc(x.word)}">认识</button>`
      + `<button class="text-btn" data-action="phr-forgot" data-phr="${this.esc(x.word)}">忘记</button>`
      + '</div></div></div>';
  },

  /* 随机收录 10 条：从「有释义且未收录」的词组池里抽。
     收录即进入阶段 0（明天复习）。无释义词组不进池（清洗口径）。 */
  phraseImport() {
    this._phraseData().then(() => {
      const list = (window.__VOCAB_CACHE__ || {})['gaokao-phrases'] || [];
      const have = Store.getPhrases();
      const pool = list.filter(x => x && x.w && x.m && !have[x.w.toLowerCase()]);
      if (!pool.length) {
        this._phrNote = list.length ? '词库里的词组都已收录过了。' : '词组数据还没加载完，稍后再试。';
        return this.phraseCards();
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      pool.slice(0, 10).forEach(x => Store.addPhrase(x.w));
      this._phrNote = `已收录 ${Math.min(10, pool.length)} 条，明天开始复习。`;
      this.phraseCards();
    });
  },
});
