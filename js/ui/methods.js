/* =====================================================================
   做题方法卡（M1 · 做题方法规范）—— #/methods 门厅 + #/methods/<key> 单卡。
   数据源 data/methods/index.js（window.__METHODS__）：全国卷五大客观题型
   + 两张写作卡（writing_app / writing_cont，流程参照、无归因标签）的
   自著候选流程，每步 = 动作 + 禁止 + 卡住回退（骨架参考 Stumax 的
   规则三件套，题型与步骤按全国卷重写）。
   铁律：step.id 与错题「错在哪一步」标签共用同一套词表（errStage）——
   错题本按阶段聚合后，高频失败步骤直跳这里的对应步骤。改 id = 断链。
   ===================================================================== */
Object.assign(UI, {

  /* 门厅：七张题型卡 + 数据性质说明。 */
  methods() {
    const M = window.__METHODS__ || { sections: {}, note: '' };
    const cards = Object.values(M.sections).map(s => {
      const chips = s.steps.map(st => `<i>${this.esc(st.name)}</i>`).join('<b>→</b>');
      return '<a class="method-card" href="#/methods/' + s.key + '">'
        + '<h3>' + this.esc(s.name) + '</h3>'
        + '<p class="method-card-flow">' + chips + '</p>'
        + '<span class="method-card-meta">' + s.steps.length + ' 步 · ' + '看完整卡 →</span>'
        + '</a>';
    }).join('');

    this.app().innerHTML = this.header('做题方法', true)
      + '<main class="methods-home">'
      + '<span class="eyebrow">METHOD CARDS</span>'
      + '<h1>做题方法卡</h1>'
      + '<p class="methods-note">' + this.esc(M.note) + '</p>'
      + '<div class="methods-grid">' + cards + '</div>'
      + '<section class="methods-link">'
      + '<h2>方法怎么才算「用上了」？</h2>'
      + '<p>错题本里每道题可以标记<b>「错在哪一步」</b>——标签用的就是'
      + '上面这套步骤词表。攒了几次之后，错题本会告诉你哪个步骤最容易出事，'
      + '点进去就能回到这一步的做法重新过一遍。'
      + '去 <a href="#/mistakes">错题本</a> 给错题标一步试试。</p>'
      + '</section>'
      + '</main>';
  },

  /* 单卡：总流程 + 分步（动作 / 禁止 / 卡住了）。 */
  methodCard(key) {
    const M = window.__METHODS__ || { sections: {} };
    const s = M.sections[key];
    if (!s) { this.methods(); return; }

    const flow = s.steps.map(st => '<i>' + this.esc(st.name) + '</i>').join('<b>→</b>');
    const steps = s.steps.map((st, i) =>
      '<section class="method-step" data-step-id="' + this.esc(st.id) + '">'
      + '<h3><b>' + (i + 1) + '</b>' + this.esc(st.name) + '</h3>'
      + '<p class="method-step-action">' + this.esc(st.action) + '</p>'
      + '<ul class="method-forbid">'
      + st.forbid.map(f => '<li>' + this.esc(f) + '</li>').join('')
      + '</ul>'
      + '<p class="method-fallback">卡住了：' + this.esc(st.fallback) + '</p>'
      + '</section>').join('');

    this.app().innerHTML = this.header('做题方法', true)
      + '<main class="methods-home">'
      + '<a class="method-back" href="#/methods">← 全部题型</a>'
      + '<h1>' + this.esc(s.name) + '</h1>'
      + '<p class="method-flow">' + flow + '</p>'
      + steps
      + '<a class="method-train" href="#/training/' + this.esc(key) + '">带着这套流程去练 '
      + this.esc(s.name) + ' →</a>'
      + '</main>';

    /* 「到步直达」收口（2026-09-19）：错题归因/高频步骤的链接带 data-locstep，
       app.js click 记入 _pendingStep；卡页此刻已渲染，滚到对应步骤高亮一闪。
       方法卡头注释「高频失败步骤直跳这里的对应步骤」自本版起完整兑现。 */
    if (App._pendingStep) {
      const pending = App._pendingStep;
      App._pendingStep = '';
      this.scrollToStep(pending);
    }
  },

  /* 滚到卡内具体步骤并高亮一闪（prefers-reduced-motion 时直接跳位）。 */
  scrollToStep(stepId) {
    if (!stepId) return;
    const el = document.querySelector('[data-step-id="' + stepId + '"]');
    if (!el) return;
    el.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    el.classList.add('method-step-hit');
    setTimeout(() => el.classList.remove('method-step-hit'), 1600);
  },

  /* 错题归因 chips（cause-editor 第四个控件）：按错题的 sectionKey
     找对应题型的步骤表；主观题等没有方法卡的题型不出这行。
     data-errstage 的值 = step.id，点击即写入（app.js click 分支）。
     index：错题序号。错题本列表的编辑器自带 data-index 外壳，这里
     再把 index 直接标到每个 chip 上——错题详情页没有那个外壳。 */
  stageChips(sectionKey, current, index) {
    const M = window.__METHODS__ || { sections: {} };
    const s = M.sections[sectionKey];
    if (!s) return '';
    const idxAttr = index == null ? '' : ` data-index="${index}"`;
    const chips = s.steps.map(st =>
      '<button type="button" class="stage-chip' + (current === st.id ? ' is-on' : '')
      + '" data-errstage="' + this.esc(st.id) + '"' + idxAttr + '>'
      + this.esc(st.name) + '</button>').join('');
    /* 到步直达（2026-09-19）：已归因到某一步时，「看这套方法」直接滚到那一步。 */
    const atStep = current && current.startsWith(s.key + ':')
      ? ' data-locstep="' + this.esc(current) + '"' : '';
    return '<div class="stage-row"><span class="stage-row-label">错在哪一步？</span>'
      + '<span class="stage-chips">' + chips + '</span>'
      + '<a class="stage-row-link" href="#/methods/' + this.esc(s.key) + '"' + atStep
      + '>看这套方法 →</a>'
      + '</div>';
  },

  /* errStage → 「语法填空 · 定考点」式展示名；查不到返回空串。 */
  stageLabel(errStage) {
    if (!errStage) return '';
    const M = window.__METHODS__ || { sections: {} };
    const s = (M.sections || {})[errStage.split(':')[0]];
    const st = s && s.steps.find(t => t.id === errStage);
    return st ? s.name + ' · ' + st.name : '';
  },

  /* 错题本顶部：按「错在哪一步」聚合。只统计有 errStage 的错题；
     同一阶段出现 ≥2 次才亮出来——只错一次说明不了方法问题。 */
  stageSummary(items) {
    const M = window.__METHODS__ || { sections: {} };
    const bySec = M.sections || {};
    const cnt = {};
    for (const x of items) {
      if (!x.errStage) continue;
      cnt[x.errStage] = (cnt[x.errStage] || 0) + 1;
    }
    const rows = Object.entries(cnt)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1]);
    if (!rows.length) return '';
    const list = rows.map(([id, c]) => {
      const secKey = id.split(':')[0];
      const s = bySec[secKey];
      const st = s && s.steps.find(t => t.id === id);
      if (!st) return '';
      return '<a class="stage-sum-row" href="#/methods/' + this.esc(secKey)
        + '" data-locstep="' + this.esc(id) + '">'
        + '<b>' + this.esc(s.name) + ' · ' + this.esc(st.name) + '</b>'
        + '<span>错了 ' + c + ' 次</span></a>';
    }).join('');
    return '<section class="stage-summary">'
      + '<h2>错在哪一步（同一处错 ≥2 次才亮）</h2>' + list
      + '<p class="stage-sum-note">同一类错反复出现在同一个步骤，就该回那一步的做法里找原因——'
      + '点击行直达那一步的做法。</p></section>';
  },
});
