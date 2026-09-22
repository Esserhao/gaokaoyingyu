/* =====================================================================
   UI 基础层 —— 全站渲染的公共设施
   加载顺序：本文件必须排在所有 js/ui/*.js 之前（它创建 UI 对象本体，
   其余模块用 Object.assign(UI, {…}) 往上挂各自的页面渲染方法）。

   为什么不用 ES module：本站零构建、file:// 直开也要能跑，
   所以沿用 <script> + 全局对象的组织方式。

   ⚠ 关于模板字符串的换行
   这些方法的返回值会直接进 innerHTML。模板字符串里的换行与缩进都是
   真实字符，行内元素之间多一个空白就会渲染出多一个空格。因此本次重构
   一律用「多段模板 + 加号拼接」来断行，不在模板内部换行 ——
   输出保持逐字节不变，可读性靠拼接结构获得。
   ===================================================================== */

/* 知识库（data/knowledge.json）：全站单例，加载失败按空库降级，
   不能因为一个附加资源失败就让整站白屏。 */
let KB = null;

async function loadKB() {
  if (KB) return KB;
  /* 知识库由 index.html 的 <script src="data/knowledge.js"> 注入为
     window.__KB__（file:// 下 fetch 会被 CORS 拦截）。加载失败按空库降级，
     不能因为一个附加资源失败就让整站白屏。 */
  try {
    KB = window.__KB__ || [];
  } catch (e) {
    KB = [];
  }
  return KB;
}

const UI = {
  app: () => document.getElementById('app'),

  /* 所有来自题库 JSON 的文本都要过 esc：题干里有 < > & 引号，
     直接塞进 innerHTML 会破坏结构。 */
  esc(v = '') {
    return String(v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },

  /* 需要保留原文换行的地方（题干、材料、听力原文）用 text 而不是 esc */
  text(v = '') {
    return this.esc(v).replace(/\n/g, '<br>');
  },

  time(sec) {
    sec = Math.max(0, sec | 0);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  },

  /* ---------- 轻提示（2026-09-03 新增） ----------
     做题途中的非阻塞反馈：倒计时预警、收藏失败、撤销提示都走这里。
     容器常驻 body 且带 role=status + aria-live=polite，读屏用户也能收到；
     不抢焦点、不打断正在输入的作文。同一时刻只留一条，后来的覆盖前面的。 */
  toast(msg, ms = 3600) {
    let box = document.getElementById('toast-live');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-live';
      box.className = 'toast-live';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    clearTimeout(this._toastTimer);
    box.textContent = msg;
    box.classList.add('show');
    this._toastTimer = setTimeout(() => box.classList.remove('show'), ms);
  },

  /* ---------- 带撤销的提示条（2026-09-03 新增） ----------
     破坏性操作的兜底。清空错题本此前只有一次原生 confirm，确认完就永久
     删除、没有任何补救 —— 而错题本里的 reviewStage / nextReviewAt 是
     一次一次复习攒出来的排期资产，一次误点就没了。
     这里把数据先在内存里留一份，10 秒内可撤销；超时后引用释放。 */
  undoBar(msg, onUndo, ms = 10000) {
    let box = document.getElementById('toast-live');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-live';
      box.className = 'toast-live';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    clearTimeout(this._toastTimer);
    box.innerHTML = `<span>${this.esc(msg)}</span>`
      + '<button type="button" data-action="toast-undo">撤销</button>';
    box.classList.add('show');
    this._undoFn = onUndo;
    this._toastTimer = setTimeout(() => {
      box.classList.remove('show');
      this._undoFn = null;
    }, ms);
  },

  /* ---------- 存储失败警示条（2026-09-03 新增） ----------
     localStorage 写不进去时（隐私模式、配额满、file:// 下部分浏览器）
     在页面顶部插一条红条，并给「立即导出备份」的出口。

     为什么必须是持久横幅而不是一次性弹窗：数据丢失是持续状态，弹一次
     关掉之后用户依然在往一个写不进盘的系统里做题。此前答题页还写着
     「答题过程中会自动保存草稿」，等于在谎报成功。

     用 insertBefore 插在 #app 最前面，不碰页面已有内容。路由是整块
     innerHTML 重建，所以 App.afterRender() 每次渲染后要补挂一次。 */
  writeWarning() {
    if (document.getElementById('store-warning')) return;
    const bar = document.createElement('div');
    bar.id = 'store-warning';
    bar.className = 'store-warning';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = '<div class="store-warning-inner">'
      + '<b>当前浏览器无法保存进度</b>'
      + '<span>可能是隐私模式或存储空间已满。正在做的题、收的错题，关闭页面后会全部丢失。</span>'
      + '<a href="#/data">立即导出备份 →</a>'
      + '<button type="button" data-action="dismiss-warning" aria-label="关闭这条提示">×</button>'
      + '</div>';
    const app = this.app();
    if (app) app.insertBefore(bar, app.firstChild);
  },

  header(title = '高考英语真题在线', back = false) {
    return '<header class="topbar"><div class="topbar-inner">'
      + '<a class="brand" href="#/"><span class="brand-mark">英</span>'
      + `<span><b>${title}</b><small>真题 · 限时 · 解析</small></span></a>`
      + this.themeToggle()
      + (back
        ? '<a class="nav-back" href="#/">返回试卷库</a>'
        : '<span class="nav-note">按真实试卷排版练习</span>')
      + '</div></header>'
      + this.siteNav();
  },

  /* ---------- 主题三态（附录 C1）----------
     纸墨（默认）→ 白昼 → 夜间 循环。首帧预置在 index.html 头部内联脚本
     （类挂 <html>，避免闪底色），这里只渲染按钮，切换在 app.js theme-cycle。
     答题页 examBar 不渲染它，保持作答沉浸；主题本身全站生效。 */
  themeToggle() {
    return '<button type="button" class="theme-toggle" data-action="theme-cycle" '
      + `title="切换主题（纸墨 → 白昼 → 夜间）">${this.themeLabel()}</button>`;
  },

  themeLabel() {
    const r = document.documentElement;
    return r.classList.contains('theme-day') ? '☀ 白昼'
      : r.classList.contains('theme-night') ? '☾ 夜间' : '◐ 纸墨';
  },

  /* ---------- 做题页字号三档（附录 E3）----------
     默认 / 大（fs-lg）/ 特大（fs-xl），类挂 <html>（首帧预置在 index.html
     内联脚本），落 localStorage.gkyy_fs。只放大做题页的原文与题目文字
     （css/app.css 的 html.fs-* 块），不动全站版式。 */
  fsLevel() {
    const r = document.documentElement;
    return r.classList.contains('fs-xl') ? 2
      : r.classList.contains('fs-lg') ? 1 : 0;
  },

  fsToggle() {
    const lv = this.fsLevel();
    return '<span class="fs-toggle" role="group" aria-label="做题页字号">'
      + `<button type="button" class="text-btn" data-action="fs-dec" title="缩小字号"${lv === 0 ? ' disabled' : ''}>A－</button>`
      + `<button type="button" class="text-btn" data-action="fs-inc" title="放大字号"${lv === 2 ? ' disabled' : ''}>A＋</button>`
      + '</span>';
  },

  bumpFs(d) {
    const lv = Math.max(0, Math.min(2, this.fsLevel() + d));
    const r = document.documentElement;
    r.classList.remove('fs-lg', 'fs-xl');
    if (lv === 1) r.classList.add('fs-lg');
    if (lv === 2) r.classList.add('fs-xl');
    try {
      localStorage.setItem('gkyy_fs', lv === 1 ? 'lg' : lv === 2 ? 'xl' : '');
    } catch (e) { /* 隐私模式：本次会话内仍生效 */ }
    const bar = document.querySelector('.fs-toggle');
    if (bar) bar.outerHTML = this.fsToggle();
  },

  /* ---------- 全站主导航（五大域） ----------
     收编原首页报头的 11 项平铺工具链与分类导航条：同页重复出现的
     入口、无分组的长清单、有功能无入口的词组闪卡，都由这张常驻
     导航统一承载。details/summary 是原生交互，零 JS、键盘可用；
     答题页（examBar）不渲染，保持作答沉浸。 */
  SITE_NAV_DOMAINS: [
    { key: 'learn', label: '学',
      re: /^\/(dashboard|weekly|learn|knowledge-graph|insights|methods)/,
      items: [
        { href: '#/dashboard', label: '学习总览' },
        { href: '#/weekly', label: '学习周报' },
        { href: '#/methods', label: '做题方法' },
        { href: '#/learn', label: '知识台阶' },
        { href: '#/knowledge-graph', label: '知识点星图' },
        { href: '#/insights', label: '考点透视' },
      ] },
    { key: 'train', label: '练',
      re: /^$|^\/(training|topics|simulation|exam\/|topic\/|result|review(?!-queue))/,
      items: [
        { href: '#/', label: '历年真题' },
        { href: '#/training', label: '分题型训练' },
        { href: '#/topics', label: '专题训练' },
        { href: '#/simulation', label: '真题模拟' },
      ] },
    { key: 'wrong', label: '错',
      re: /^\/(mistakes|mistake\/|knowledge(?!-graph)|review-queue|drill)/,
      items: [
        { href: '#/mistakes', label: '错题本' },
        { href: '#/knowledge', label: '错题溯源' },
        { href: '#/drill', label: '错题重练' },
      ] },
    { key: 'vocab', label: '词',
      re: /^\/(word|words|phrases|synonyms|vocab-guide)/,
      items: [
        { href: '#/word', label: '查词' },
        { href: '#/words', label: '生词本' },
        { href: '#/phrases', label: '词组闪卡' },
        { href: '#/synonyms', label: '同义近义反义' },
        { href: '#/vocab-guide', label: '词汇指南' },
      ] },
    { key: 'tools', label: '工具',
      re: /^\/(search|data)/,
      items: [
        { href: '#/search', label: '全站搜索' },
        { href: '#/data', label: '数据备份' },
      ] },
  ],

  siteNav() {
    const path = (location.hash || '#/').slice(1).split('?')[0];
    return '<nav class="site-nav" aria-label="全站导航">'
      + this.SITE_NAV_DOMAINS.map(d => '<details class="site-nav-item'
        + (d.re.test(path) ? ' is-active' : '') + '">'
        + `<summary class="site-nav-summary"><b>${d.label}</b>`
        + '<span aria-hidden="true">▾</span></summary>'
        + '<div class="site-nav-menu">'
        + d.items.map(i => `<a href="${i.href}">${i.label}</a>`).join('')
        + '</div></details>').join('')
      + '</nav>';
  },

  /* 已作答统计：值为非空字符串（含去空白）即算作答。答题页顶栏、
     专题草稿标记、错题本续练此前各写了一遍同样的 .filter 表达式。 */
  countAnswered(obj) {
    return Object.values(obj || {}).filter(v => String(v ?? '').trim() !== '').length;
  },

  /* 答案相等判定：去空白 + 忽略大小写。判分与收错题此前各写一遍同样的长
     表达式，改动时极易只改一边，收口到一处。 */
  eqAnswer(a, b) {
    return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  },

  /* ---------- 朗读（浏览器 SpeechSynthesis，零版权零依赖） ----------
     替代方案说明：真题听力音频受版权与下载限制长期缺口，读词/读例句
     用浏览器内置语音引擎兜底，file:// 与 http 下都能用。
     无该 API（老浏览器/无头护栏）时按钮直接不渲染，不降级报错。
     朗读文本可以是词组/例句，lang 固定 en-US（中文例句翻译不读）。 */
  speakSupported() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  },

  /* 朗读按钮。text 原样传英文；label 可选（默认 ♪ 读）。
     esc 只转 data 属性里的引号；朗读时用 dataset 原文，不再二次转义。 */
  speakBtn(text, label) {
    if (!this.speakSupported() || !String(text || '').trim()) return '';
    return `<button class="speak-btn" data-action="speak" `
      + `data-speak="${this.esc(text)}" aria-label="朗读" `
      + `title="朗读">${this.esc(label || '♪ 读')}</button>`;
  },

  speak(raw) {
    if (!this.speakSupported()) return;
    const text = String(raw || '').trim();
    if (!text) return;
    /* 连续点多个按钮时先取消上一段，避免排队叠音 */
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  },

  /* 专题/训练/首页共用的顶栏骨架。差异只在品牌链接去向、右侧是
     单个返回链接还是一组工具链接。tools 与 backHref 二选一：给
     tools 时渲染 siteNav 全站导航（原 home-tools 平铺簇已由主导航
     收编，tools 数组的 label 不再各自渲染），否则渲染单个
     mistake-link。主导航在报头下方整行常驻。 */
  referenceHeader({ brand, brandNote, brandHref = '#/', backHref, backLabel, tools }) {
    const right = tools
      ? ''
      : (backHref ? `<a class="mistake-link" href="${backHref}">${backLabel || '返回'}</a>` : '');
    return '<header class="reference-header">'
      + `<a class="reference-brand" href="${brandHref}"><span class="brand-mark">英</span>`
      + `<span><b>${this.esc(brand)}</b><small>${this.esc(brandNote || '')}</small></span></a>`
      + this.themeToggle()
      + right + '</header>'
      + this.siteNav();
  },

  /* 写作自评的事实层（2026-09-19 循环第八轮）：仪表盘面板与学业分析画像
     共用同一份聚合口径——两处各算一套，改动必漏一处。只聚合不写。
     list 可传调用方已取好的聚合结果（测试/多面板复用同一次读取）。 */
  writingSelfFacts(list) {
    const all = Array.isArray(list) ? list : Store.getWritingSelfChecks();
    const done = all.filter(s => s.selfChecked);
    const TYPE = { writing_app: '应用文', writing_cont: '读后续写' };
    const DIM = { reach: '达标', partial: '基本', miss: '待加强' };
    const DIMF = ['要点', '连贯', '语言'];
    const tally = ['coverage', 'coherence', 'accuracy'].map((f, i) => {
      const c = {};
      done.forEach(s => { if (s[f]) c[s[f]] = (c[s[f]] || 0) + 1; });
      const parts = ['reach', 'partial', 'miss'].filter(v => c[v])
        .map(v => (DIM[v] || v) + c[v]);
      return parts.length ? DIMF[i] + ' ' + parts.join('/') : null;
    }).filter(Boolean);
    const byWords = {};
    done.forEach(s => {
      if (s.wordcount) (byWords[s.sectionKey] = byWords[s.sectionKey] || []).push(s.wordcount);
    });
    const avg = Object.entries(byWords).map(([k, arr]) =>
      (TYPE[k] || k) + '均值 '
      + Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) + ' 词').join(' · ');
    return {
      all, done,
      pending: all.length - done.length,
      tally, avg,
      dimText: s => ['coverage', 'coherence', 'accuracy']
        .map((f, i) => (s[f] ? DIMF[i] + (DIM[s[f]] || s[f]) : null))
        .filter(Boolean).join(' · ') || '维度未填',
      typeName: k => TYPE[k] || '写作',
    };
  },

  /* 定位改写标注（2026-09-19 试点）：「原文表述 → 选项改写 → 替换手法」。
     数据在 data/loc/index.js（window.__LOC__，AI 标注·未人核，有意与
     verified 试卷数据分文件）；verified:false 的条目渲染灰签，人核翻转
     后标签消失。查不到条目渲染空串，全站无感。 */
  locHtml(examId, qid) {
    const loc = ((window.__LOC__ || {})[examId] || {})[qid];
    if (!loc) return '';
    return '<div class="explanation-loc"><b>定位改写</b>'
      + `<p>原文：${this.esc(loc.from)}</p>`
      + `<p>选项：${this.esc(loc.to)}</p>`
      + `<p>手法：${this.esc(loc.rule)}</p>`
      + (loc.verified ? '' : '<i class="loc-unverified">AI 标注 · 未人核</i>')
      + '</div>';
  },

  /* 解析字段有两种形态：老数据是纯字符串，新数据是结构化对象
     （summary / question / evidence / answer / points / nextPractice）。
     短文改错的逐处解析走 points 分支。 */
  explanationHtml(value) {
    if (!value) return '';
    if (typeof value === 'string') {
      return `<div class="explanation-body">${this.text(value)}</div>`;
    }

    const block = (label, content, tag = 'p') => content
      ? `<${tag} class="explanation-block"><b>${this.esc(label)}</b>`
        + `<span>${this.text(content)}</span></${tag}>`
      : '';

    /* 短文改错逐处解析：一处一张卡，头部是「第 n 处 + 错误类型 + 知识节点」，
       正文是「操作：原词 → 改后」加一段分析。 */
    const points = (value.points || []).map((point, i) => {
      const head = '<header>'
        + `<b>第 ${this.esc(point.number || i + 1)} 处</b>`
        + (point.errorType ? `<span>${this.esc(point.errorType)}</span>` : '')
        + (point.knowledgeNode ? `<strong>${this.esc(point.knowledgeNode)}</strong>` : '')
        + '</header>';
      const operation = point.operation
        ? `<p class="explanation-answer">${this.esc(point.operation)}`
          + (point.wrong ? `：${this.esc(point.wrong)}` : '')
          + (point.correct ? ` → ${this.esc(point.correct)}` : '')
          + '</p>'
        : '';
      return '<article class="explanation-point">' + head + operation
        + `<p>${this.text(point.analysis || point.content || '')}</p></article>`;
    }).join('');

    const next = value.nextPractice?.length
      ? block('建议回炉', value.nextPractice.join('、'))
      : '';

    return block('核心考点', value.summary)
      + block('题目分析', value.question)
      + block('原文证据', value.evidence, 'blockquote')
      + (value.answer ? block('参考答案', value.answer) : '')
      + points
      + next;
  },
};

/* 短文改错三种修改方法的唯一数据源：答题格式块与每道子题答题框提示
   都从 proofMethodsHtml() 渲染，保证「答题格式」与「答题框提示」文字完全相同，
   也和数据的规范三式（modelAnswer）一一对应：
   修改→把'原词'改为'新词'；增加→在'前词'后加上'所加词'（前加写'在X前加上Y'）；
   删除→删去'某词'。 */
UI.PROOF_METHODS = [
  { op: '修改', fmt: '把’原词’改为’新词’' },
  { op: '增加', fmt: '在’前词’和’后词’之间加上’所加词’（仅在词后补写时简写’在X后加上Y’，词前补写写’在X前加上Y’）' },
  { op: '删除', fmt: '删去’某词’' },
];
UI.proofMethodsHtml = function (extraClass) {
  const cls = 'proof-methods' + (extraClass ? ' ' + extraClass : '');
  const cells = UI.PROOF_METHODS.map(m =>
    `<div class="proof-method"><b>${m.op}</b><span>${m.fmt}</span></div>`).join('');
  return `<div class="${cls}">${cells}</div>`;
};
