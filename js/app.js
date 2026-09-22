/* =====================================================================
   App —— hash 路由 + 全局事件接线
   本站无构建步骤：所有 js/*.js 按 index.html 里的顺序同步加载，
   彼此通过全局对象（UI / Exam / Store / Topic / Training…）通信。

   路由约定（重要）：整个站点靠 location.hash 分发，因此任何形如
   href="#xxx" 的页内锚点都会被 route() 当成路由读走，匹配不到就回落首页
   —— 答题卡题号、跳过导航都因此必须自行 preventDefault 后手动滚动。
   ===================================================================== */

/* ---------- 路由表：精确匹配优先，其次按顺序尝试带参模式 ---------- */
/* 拆成表驱动而非长 if 链，是为了让「一共有哪些页面」一眼可读。
   精确表先查、模式表后查，与原先的 if 顺序等价：下方所有精确路径
   都不会被任何模式抢先命中（/topic/reading 之类虽然形如 /topic/:x，
   但精确表先查，行为与改前一致）。 */
const TOPIC_STARTERS = {
  '/topic/reading':      exams => Topic.start(exams),
  '/topic/listening':    exams => Topic.startListening(exams),
  '/topic/cloze':        exams => Topic.startCloze(exams),
  '/topic/seven':        exams => Topic.startSeven(exams),
  '/topic/grammar':      exams => Topic.startGrammar(exams),
  '/topic/proofreading': exams => Topic.startProofreading(exams),
  '/topic/writing':      exams => Topic.startWriting(exams),
};

const EXACT_ROUTES = {
  '/':                app => UI.home(app.exams),
  /* 「今天」（2026-09-22）：规则引擎产出的每日任务单独成一页。
     任务与 #/dashboard、#/analysis 完全同源（Diagnostic.rules +
     UI.taskCardHtml），本页只是把它提到最外层 —— 改前它只存在于那两页里，
     首页没有任何入口，等于把「今天该干什么」藏在了二级页。 */
  '/today':           () => UI.today(),
  '/dashboard':       app => UI.dashboard(app.exams),
  '/weekly':          () => UI.weekly(),
  '/mistakes':        () => UI.mistakes(Store.getMistakes()),
  /* 不叫 /review：那个前缀已经被 /review/<examId>（看整卷解析）占了，
     两个语义不同的页面共用一个词，日后加参数时必然踩到。 */
  '/review-queue':    () => UI.reviewQueue(Store.getMistakes()),
  '/knowledge':       () => UI.knowledge(Store.getMistakes()),
  /* 分台阶学习：主动按 level 浏览全部知识点、自评掌握度。与 /knowledge
     （从错题出发的知识系谱）互补 —— 这个页面不依赖是否已经做错过题。 */
  '/learn':           () => UI.learn('all'),
  /* 做题方法卡（M1）：五大客观题型的可执行做题流程。步骤词表与
     错题「错在哪一步」标签共用（errStage），方法→归因→回看闭环。 */
  '/methods':         () => UI.methods(),
  /* 参考范文库（2026-09-19）：把各卷 modelAnswer 汇总成一页，按题型筛选、
     可搜索。写作专题选材页与整卷页写作题都从这里进。 */
  '/writing/models':  app => UI.writingModels(app.exams),
  /* 上海专区：真题册（登记框架，数据后补）与考纲词汇（官方词表，
     未人核标灰）单独成页，与全国卷的数据和口径完全分开。 */
  '/shanghai':         () => UI.shanghai(),
  '/shanghai/exams':   () => UI.shanghaiExams(),
  '/shanghai/vocab':   () => UI.shanghaiVocab(),
  /* 同义/近义/反义：以词为中心的「星座」探索，点词展开一串关联词，
     每个词都有专属详情界面（复用词库惰性查询）。 */
  '/synonyms':        () => UI.synonyms('all', ''),
  /* 查词（C4）：词条页。#/word 为搜索首页，#/word/<词形> 为词条详情
     （8 本词书释义 + 同义/近义/反义/词缀派生关系 + 星空入口）。 */
  '/word':            () => UI.wordHome(),
  /* 生词本（C5）：收藏的生词按 1/3/7/15/30 天阶梯复习。 */
  '/words':           () => UI.words(),
  '/vocab-guide':     () => UI.vocabGuide(),
  /* 词组闪卡：4,487 条词组的收藏/翻卡/排期复习（数据层与生词本同构）。 */
  '/phrases':         () => UI.phraseCards(),
  /* 学业分析（E2/E3）+ 学业诊断卷（E1）：画像、每日任务方案与诊断入口。 */
  '/analysis':        () => UI.analysis(),
  '/diagnostic':      () => UI.diagnosticHome(),
  /* 考点/词频透视（F4）：全部真题客观题跑一遍 Diagnose 规则的静态聚合，
     不掺学生数据，同一天两次刷新结果一致（可进快照护栏）。 */
  '/insights':        app => UI.insights(app.exams),
  /* 错题混排重练（F5）：抽 10 道题干完整的客观题打乱重做，答对推进复习阶梯 */
  '/drill':           () => UI.drill(),
  /* 使用指南（2026-09-22）：一页说清这个站点是什么、怎么用、数据边界。
     刻意保持简短 —— 它像前言，不是功能清单。 */
  '/guide':           () => UI.guide(),
  /* 全站搜索（F9）：试卷/知识点/单词/词组四路客户端匹配 */
  '/search':          () => UI.search(UI._searchState.q || ''),
  /* 知识星图 v2：门厅四栏（cat=null）；各类别星图走 PATTERN_ROUTES */
  '/knowledge-graph': () => KnowledgeGraph.init().then(() => {
    KnowledgeGraph.cat = null;
    UI.app().innerHTML = KnowledgeGraph.render();
  }).catch(err => {
    App.renderError(err);
  }),
  /* 数据备份与迁移：导出/导入 gkyy_records_v1 整包（#15）。不叫 /settings，
     因为本站没有别的设置了，单独一个「设置」入口是空壳。 */
  '/data':            () => UI.dataManager(),
  '/topics':          app => UI.topics(app.exams),
  '/simulation':      app => UI.simulation(app.exams),
  '/training':        app => Training.render(app.exams, 'reading', 'all'),
  ...Object.fromEntries(
    Object.entries(TOPIC_STARTERS).map(([path, start]) => [path, app => start(app.exams)])
  ),
};

const PATTERN_ROUTES = [
  {
    /* 错题重做卷（附录 E1）：redo-<原卷号> 不在 __EXAMS__ 里，
       从原卷 + 原记录的客观错题临时组卷。 */
    re: /^\/redo\/([^/]+)$/,
    run: (app, m) => app.openRedo(decodeURIComponent(m[1])),
  },
  {
    re: /^\/mistake\/([^/]+)$/,
    run: (app, m) => UI.mistakeDetail(Number(decodeURIComponent(m[1])), Store.getMistakes()),
  },
  {
    re: /^\/knowledge\/([^/]+)$/,
    run: (app, m) => UI.knowledgeDetail(decodeURIComponent(m[1]), Store.getMistakes()),
  },
  {
    /* 做题方法卡（M1）：#/methods/<sectionKey> 单题型完整流程卡 */
    re: /^\/methods\/([\w-]+)$/,
    run: (app, m) => UI.methodCard(m[1]),
  },
  {
    re: /^\/word\/([^/]+)$/,
    run: (app, m) => UI.wordDetail(decodeURIComponent(m[1])),
  },
  {
    /* 诊断结果（E1）：按记录里的 diagSeed 重放组卷，算子技能表现 */
    re: /^\/diagnostic-result\/([^/]+)$/,
    run: (app, m) => UI.diagnosticResult(decodeURIComponent(m[1])),
  },
  {
    re: /^\/topic\/([^/]+)$/,
    run: (app, m) => UI.topicDetail(m[1]),
  },
  {
    /* 写作专题深链（2026-09-19）：整卷页写作题「去自评」跳这里。
       与写作专题共用一份草稿键，进来时会接管整卷里写的那篇作文。 */
    re: /^\/writing\/([^/]+)\/([^/]+)$/,
    run: (app, m) => Topic.openWritingTask(
      app.exams, decodeURIComponent(m[1]), decodeURIComponent(m[2])),
  },
  {
    re: /^\/training\/([^/]+)\/example$/,
    run: (app, m) => TrainingPage.example(app.exams, m[1]),
  },
  {
    /* 子技能专项（B3）：某题型下按子技能过滤的题目列表，
       如 #/training/cloze/skill/动词词义辨析 */
    re: /^\/training\/([^/]+)\/skill\/([^/]+)$/,
    run: (app, m) => Training.render(app.exams, m[1], 'all', decodeURIComponent(m[2])),
  },
  {
    re: /^\/training\/([^/]+)$/,
    run: (app, m) => Training.render(app.exams, m[1] || 'reading', 'all'),
  },
  {
    /* 独立训练单题：题库读取失败时给出可返回的错误页，不留白屏 */
    re: /^\/training\/([^/]+)\/([^/]+)\/([^/]+)$/,
    run: (app, m) => TrainingPage.show(app.exams, m[1], m[2], m[3]).catch(err => {
      UI.app().innerHTML = '<main class="empty-state"><strong>例题加载失败</strong>'
        + `<p>${UI.esc(err.message)}</p>`
        + `<a class="primary-btn" href="#/training/${m[1]}">返回题型训练</a></main>`;
    }),
  },
  {
    /* 知识星图单类：#/knowledge-graph/语法·句法 —— 可旋转的三维球面星空 */
    re: /^\/knowledge-graph\/([^/]+)$/,
    run: (app, m) => KnowledgeGraph.init().then(() => {
      KnowledgeGraph.cat = decodeURIComponent(m[1]);
      UI.app().innerHTML = KnowledgeGraph.render();
    }).catch(err => App.renderError(err)),
  },
  {
    /* 星图集单图：#/synonyms/syn|near|ant|sim|pre|suf|phr —— 七张可旋转球面星空，
       中心词跨图保持；门厅七栏从这里进 */
    re: /^\/synonyms\/(syn|near|ant|sim|pre|suf|phr)$/,
    run: (app, m) => UI.synPage(m[1]),
  },
  {
    re: /^\/(exam|review|result)\/([^/]+)$/,
    run: (app, m) => app.openPaper(m[1], m[2]),
  },
];

/* 已知业务错误 → 面向用户的中文说明（2026-09-03）。
   命中就只给人话，不再把英文堆栈抛给用户。
   顺序敏感：先匹配更具体的，再匹配兜底。 */
const KNOWN_ERRORS = [
  { re: /QuotaExceeded|配额|存储/i, title: '浏览器存储空间已满',
    body: '进度没能保存下来。请先到「工具 · 数据备份」导出一份，再清理浏览器数据后重新导入。' },
  { re: /没有可用的试卷数据|__EXAMS__/, title: '题库数据没能加载',
    body: 'index.html 同目录下的 data 文件夹可能缺失或被移动了。把整个文件夹放回原处后刷新即可。' },
  { re: /JSON|Unexpected token/, title: '数据文件解析失败',
    body: '题库文件似乎被改动过，格式不正确。重新放一份完整的 data 文件夹即可恢复。' },
  { re: /sections|questions|of undefined|of null/, title: '这套卷子的题目数据不完整',
    body: '试卷文件里缺少题目内容，暂时打不开。可以先换一套卷子练习。' },
];

const App = {
  exams: [],

  async init() {
    try {
      /* 数据已通过 index.html 里的 <script src="data/index.js"> 注入为
         window.__EXAMS__（file:// 双击也能用；改用 fetch 会被 CORS 拦截）。 */
      this.exams = window.__EXAMS__;
      if (!Array.isArray(this.exams) || !this.exams.length) throw Error('当前没有可用的试卷数据');

      await loadKB();
      await this.route();

      window.addEventListener('hashchange', () => this.route().catch(err => this.renderError(err)));
      document.addEventListener('click', e => this.click(e));
      document.addEventListener('change', e => this.change(e));
      document.addEventListener('input', e => this.input(e));
      document.addEventListener('keydown', e => this.hotkey(e));

      /* 考试进行中离开页面前的挽留（2026-09-03）：草稿是保住了，但计时
         会接着走（这正是限时该有的行为），学生容易以为「下次进来重新
         计时」。给一句浏览器自带的提示就够了 —— 也不该做更多，
         强行阻止关闭是恶意网页的做法。 */
      window.addEventListener('beforeunload', e => {
        /* 400ms 防抖窗口的收口（2026-09-19）：关页前把挂起的草稿写落盘，
           否则最后一次作答可能丢在防抖窗口里。flushDraft 自身只在有
           挂起内容时才写，空转无害。 */
        try { Store.flushDraft(); } catch (_) { /* 写失败不拦挽留提示 */ }
        if (!Exam.current || !Exam.timer) return;
        e.preventDefault();
        e.returnValue = '';
      });
      /* PWA 离线补完（2026-09-19，F9）：service worker 只在 http(s) 部署下
         注册——file:// 双击打开是本站主形态，没有 SW 概念，静默跳过维持
         现状；注册失败（老浏览器/受限环境）同样不影响使用。 */
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
      /* 知识星图球面拖拽：pointer 委托，move/up 挂 window 以防出框丢事件。
         星图集（syn-sky）共用同一套委托。 */
      document.addEventListener('pointerdown', e => {
        if (!e.target.closest) return;
        if (e.target.closest('[data-kg-sky]')) KnowledgeGraph.dragStart(e.clientX, e.clientY);
        else if (e.target.closest('[data-syn-sky]')) UI.dragStart(e.clientX, e.clientY);
      });
      window.addEventListener('pointermove', e => {
        if (KnowledgeGraph.dragging) KnowledgeGraph.dragMove(e.clientX, e.clientY);
        else if (UI._skyDrag) UI.dragMove(e.clientX, e.clientY);
      });
      window.addEventListener('pointerup', () => {
        KnowledgeGraph.dragEnd();
        UI.dragEnd();
      });
    } catch (err) {
      this.renderError(err);
    }
  },

  /* 错误页（2026-09-03 修订）：改前直接把 err.message 原样抛给用户，
     学生看到的是 "Cannot read properties of undefined (reading 'sections')"
     这种英文堆栈，只会以为网站整个坏了。现在分两类处理：
       已知业务错误 → 中文标题 + 中文说明 + 下一步操作；
       未知错误     → 中文兜底文案，技术细节默认折叠（反馈时不丢信息，
                      但不占着首屏吓人）。 */
  renderError(err) {
    /* 方法卡「到步直达」的 pending 一并清掉（2026-09-19 复审加固）：
       错误页不是卡页，残留会让下一次进任意卡页时迟到滚动。 */
    this._pendingStep = '';
    const raw = String(err?.message || '');
    const known = KNOWN_ERRORS.find(x => x.re.test(raw));
    const detail = known ? '' : '<details class="error-detail"><summary>技术细节</summary>'
      + `<pre>${UI.esc(raw || '未知错误')}</pre></details>`;

    UI.app().innerHTML = '<main class="empty-state"><strong>'
      + UI.esc(known ? known.title : '这个页面没能打开')
      + '</strong><p>'
      + UI.esc(known ? known.body
        : '页面加载时出了问题。可以先回首页继续做题，已经填过的答案不会丢。')
      + '</p><div class="empty-actions">'
      + '<a class="primary-btn" href="#/">返回首页</a>'
      + '<a class="ghost-btn" href="#/data">导出进度备份</a>'
      + '</div>' + detail + '</main>';
    this.afterRender();
  },

  /* 每次渲染完成后统一补挂的东西。目前只有存储失败警示条 ——
     它插在 #app 内部，而路由是整块 innerHTML 重建，不补挂就会在
     下一次跳转时消失，恰恰是用户最需要看见它的时候。 */
  afterRender() {
    try { if (Store.writeFailed) UI.writeWarning(); } catch (_) { /* 补挂失败不影响页面本身 */ }
    try { this.stripTemplateKickers(); } catch (_) { /* 清理失败不影响页面本身 */ }
  },

  /* 摘掉模板遗留的「大写英文小标」（2026-09-22，用户要求去 AI 模板味）。
     起因：全站 19 个文件 77 处 <span class="eyebrow|reference-kicker"> 都在用
     同一套「中文标题 + 大写英文」句式（ACADEMIC ANALYSIS / LEARNING PATH /
     WRITING STUDIO · DRAFT REVIEW…），这是页面「AI 味」的主要来源。逐处改模板
     容易漏，这里集中摘除：判定标准是**含连续两个及以上大写字母**，所以纯中文的
     小标签（如「本题型核心思路」）原样保留。摘除而非 CSS 隐藏 —— 读屏也不该念它。

     为什么还要 MutationObserver：词组闪卡、星图等页面是「先出骨架、异步数据
     就绪后二次重绘」，二次重绘不走 afterRender，小标会长回来。这里只盯 #app
     子树的新增节点，且只在新增里真的含小标时才动手 —— 自己删自己产生的是
     removedNodes，不会触发循环。 */
  stripTemplateKickers() {
    const strip = box => {
      if (!box) return;
      box.querySelectorAll('.eyebrow, .reference-kicker').forEach(el => {
        if (/[A-Z]{2}/.test(el.textContent || '')) el.remove();
      });
    };
    const box = document.getElementById('app');
    strip(box);
    if (!box || this._kickerObs) return;
    this._kickerObs = new MutationObserver(muts => {
      let need = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('.eyebrow, .reference-kicker'))
            || (n.querySelector && n.querySelector('.eyebrow, .reference-kicker'))) { need = true; break; }
        }
        if (need) break;
      }
      if (need) strip(document.getElementById('app'));
    });
    this._kickerObs.observe(box, { childList: true, subtree: true });
  },

  async route() {
    const path = location.hash.slice(1) || '/';
    /* 非路由 hash（#q-12、#main…）一律忽略：若继续往下走会匹配不到任何
       模式而回落首页，正在进行的考试与已填答案会被当场清空。 */
    if (path[0] !== '/') return;

    /* 真换页前收口挂起的防抖写（2026-09-19）：整卷草稿/专题草稿都是
       400ms 防抖，离开页面的瞬间可能还有最后一次作答没落盘。
       flushDraft 只在有挂起内容时写，初始进入页面时是空转。 */
    try { Store.flushDraft(); } catch (_) { /* 收口失败不拦路由 */ }

    const exact = EXACT_ROUTES[path];
    if (exact) return Promise.resolve(exact(this)).then(() => this.afterRender());

    for (const { re, run } of PATTERN_ROUTES) {
      const m = path.match(re);
      if (m) return Promise.resolve(run(this, m)).then(() => this.afterRender());
    }
    return Promise.resolve(UI.home(this.exams)).then(() => this.afterRender());
  },

  /* 试卷三态：result 看成绩、review 看解析、其余进入答题。
     缺成绩记录时给说明页（2026-09-03）：改前直接 location.replace 到
     答题页，用户看不到任何解释，历史记录还被替换掉、后退也回不去，
     只会以为是自己点错了。有草稿时把「已答 N 题」一并说出来。 */
  async openPaper(mode, examId) {
    /* 错题重做卷（附录 E1）：redo-<原卷号> 不在题库里，必须先于
       Exam.load 分流 —— 按原卷 + 原记录的客观错题确定性还原卷结构。 */
    if (examId.startsWith('redo-')) {
      const srcId = examId.slice(5);
      const src = await Exam.load(srcId);
      const srcRec = Store.getRecord(srcId);
      const redoExam = srcRec ? Redo.build(src, srcRec) : null;
      const record = Store.getRecord(examId);
      if (!redoExam || !record) return UI.noRecord(redoExam || src);
      return mode === 'result'
        ? UI.result(redoExam, record)
        : UI.exam(redoExam, record.answers, 0, 'result');
    }

    const exam = await Exam.load(examId);

    if (mode === 'result' || mode === 'review') {
      const record = Store.getRecord(exam.id);
      if (!record) return UI.noRecord(exam);
      return mode === 'result'
        ? UI.result(exam, record)
        : UI.exam(exam, record.answers, 0, 'result');
    }
    Exam.start(exam);
    UI.exam(exam, Exam.answers, Exam.remaining, 'practice');
  },

  /* 错题重做入口（附录 E1）：无可重做错题时回落到原卷成绩页。 */
  async openRedo(examId) {
    const src = await Exam.load(examId);
    const rec = Store.getRecord(examId);
    const redoExam = rec ? Redo.build(src, rec) : null;
    if (!redoExam) {
      location.replace('#/result/' + examId);
      return;
    }
    Exam.start(redoExam);
    UI.exam(redoExam, Exam.answers, Exam.remaining, 'practice');
  },

  /* ---------------- 点击：data-action 动作表 ----------------
     改前是一条长 if 链，且每个分支都不 return，靠字符串不相等来「跳过」。
     这里换成查表，行为等价但可以一眼看清共有哪些动作。 */
  ACTIONS: {
    submit(app) {
      const total = UI.examQuestionTotal(Exam.current) || 0;
      const answered = UI.countAnswered(Exam.answers);
      const unanswered = Math.max(0, total - answered);
      const message = unanswered
        ? `还有 ${unanswered} 题未作答，确定现在交卷吗？未作答题将按未答处理。`
        : '确定交卷吗？交卷后将立即显示得分与错题。';
      if (confirm(message)) app.submit(false);
    },

    /* 清空错题本（2026-09-03 修订）：破坏性操作的确认弹窗保留，
       但确认之后不再不可逆 —— 内存里留一份备份，10 秒内可撤销。
       此前确认完即永久删除，而错题本里的间隔复习排期是拿时间一次一次
       攒出来的资产，一次误点全部蒸发且无从补救。 */
    'clear-mistakes'() {
      const backup = Store.getMistakes();
      if (!backup.length) return;
      if (!confirm(`清空全部 ${backup.length} 条错题记录？间隔复习的排期也会一并删除。`)) return;
      Store.clearMistakes();
      UI.mistakes([]);
      UI.undoBar(`已清空 ${backup.length} 条错题`, () => {
        /* getMistakes 返回的是倒序列表，存回去要先反正回来 */
        Store.restoreMistakes(backup.slice().reverse());
        UI.mistakes(Store.getMistakes());
      });
    },

    /* 撤销上一步破坏性操作（撤销条上的按钮） */
    'toast-undo'() {
      const fn = UI._undoFn;
      UI._undoFn = null;
      const box = document.getElementById('toast-live');
      if (box) box.classList.remove('show');
      if (fn) { fn(); UI.toast('已撤销。'); }
    },

    /* 收起存储失败警示条。只收本页这一条，不清除 Store.writeFailed ——
       数据依然写不进去，下次渲染还会再挂上，直到写入真正成功为止。 */
    'dismiss-warning'() {
      const bar = document.getElementById('store-warning');
      if (bar) bar.remove();
    },

    'mark-mistake'(app, btn) {
      Store.markMistakeReviewed(Number(btn.dataset.index), '已掌握');
      UI.mistakes(Store.getMistakes());
    },

    'set-mistake-status'(app, btn) {
      Store.markMistakeReviewed(Number(btn.dataset.index), btn.dataset.status || '待回炉');
      UI.mistakes(Store.getMistakes());
    },

    /* 复习队列里的三个按钮。和 set-mistake-status 只差重渲染的目标页 ——
       共用一个动作会把学生从队列弹回错题本，队列刚做的进度就看不见了。
       重渲染后这道题通常已不在队列（排到明天以后），下一道自动顶上来。 */
    'queue-status'(app, btn) {
      Store.markMistakeReviewed(Number(btn.dataset.index), btn.dataset.status || '待回炉');
      UI.reviewQueue(Store.getMistakes());
    },

    /* 知识点详情页的即时重做：只比对字面答案，不改动错题状态 */
    'knowledge-retry'(app, btn) {
      const index = Number(btn.dataset.index);
      const item = Store.getMistakes()[index];
      const input = document.querySelector(`[data-knowledge-retry-input="${index}"]`);
      const result = document.querySelector(`[data-knowledge-retry-result="${index}"]`);
      const mine = (input?.value || '').trim().toLowerCase();
      if (result) {
        result.textContent = mine && UI.eqAnswer(mine, item?.answer)
          ? '答对了，可以标记为已掌握。'
          : '再看一次答案证据，再回到这道题。';
      }
    },

    'knowledge-retry-group'(app, btn) { UI.startRetryGroup(btn.dataset.node); },
    'retry-check'() { UI.checkRetry(); },
    'retry-next'() { UI.retryNext(); },
    'retry-exit'(app, btn) { UI.retryExit(btn.dataset.node); },

    /* #15 跨设备：导出当前 gkyy_records_v1 整包为带日期的 JSON 文件。
       Blob + a[download] 是 file:// 与 http 下都能用的纯前端下载，
       不依赖任何后端。 */
    'export-data'(app) {
      const json = Store.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `高考英语进度_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const box = document.getElementById('sync-result');
      if (box) {
        const d = Store._load();
        box.className = 'sync-result show';
        box.textContent = `已导出 ${Object.keys(d.records || {}).length} 套成绩、`
          + `${Object.keys(d.drafts || {}).length} 份整卷草稿、`
          + `${(d.mistakes || []).length} 条错题、`
          + `${(d.topicRecords || []).length} 次专题复盘。`;
      }
    },

    /* 触发隐藏的文件选择器：真正的读文件在 change 处理器里做，
       因为 FileReader / file.text() 是异步的，放 click 里不好收口。 */
    'import-data'(app, btn) {
      const input = document.querySelector('[data-import-file]');
      if (input) input.click();
    },

    /* 导入第二步：确认合并 / 取消（handleImport 预览后等待的按钮）。 */
    'import-confirm'(app) { app.confirmImport(); },
    'import-cancel'(app) { app.cancelImport(); },
    'print-page'(app) { app.runPrint(); },

    /* 分台阶学习：自评掌握度。只就地更新 DOM（高亮当前按钮 + 刷新顶部
       统计），不整页重渲染 —— 否则在 38 个节点里翻到一半会被滚回顶部。
       真正落盘在 Store.saveKBMastery，刷新/换设备都不丢。 */
    'kb-mastery'(app, btn) {
      const node = btn.dataset.node, level = btn.dataset.level;
      if (!node || !level) return;
      Store.saveKBMastery(node, level);
      const nodeEl = btn.closest('[data-learn-node]');
      if (nodeEl) {
        nodeEl.querySelectorAll('[data-action="kb-mastery"]')
          .forEach(b => b.classList.toggle('is-active', b === btn));
      }
      UI.refreshLearnCounters();
    },

    /* 同义近义反义：探索框（按钮/回车）把词设为中心，重渲染星座+详情 */
    'syn-explore'(app, btn) {
      const inp = document.getElementById('syn-explore');
      UI.synExplore(inp ? inp.value : '');
    },
    /* 随机取一个词做中心 */
    'syn-random'(app, btn) { UI.synRandom(); },
    /* 点星星 / 词 chip：换它做中心（自带详情界面）。
       球面拖拽后的合成 click 直接吞掉（拖完不该换中心）；门厅词缀芯片、
       词条页关系链跳来时由 synCenter 自动跳到对应单图页。 */
    'syn-star'(app, btn) {
      if (UI._skyDragMoved) { UI._skyDragMoved = false; return; }
      UI.synCenter(btn.dataset.word);
    },
    /* 星图集：切换关系图（同义/近义/反义/前缀/后缀）。
       只换图，中心词、搜索框、下方词族列表一律不动。 */
    'syn-map'(app, btn) { UI.synMap(btn.dataset.map); },
    /* 球面自转开关：rAF 慢转，切页自动停 */
    'syn-spin'() { UI.setSynSpin(!UI._synSpin); UI._renderConstellation(); },
    /* 查词页的关系芯片：以该词/词缀为中心跳到星空（C4 词条页 → 星座）。
       跳转由 synCenter 自己做（未在单图页时自动落 #/synonyms/<map>），
       这里不再抢先改 hash，避免与惰索引就绪后的跳转赛跑。 */
    /* 查词页的「查询」按钮（2026-09-03 新增）：此前只有一个裸输入框，
       回车或失焦才触发，新用户不知道要按回车。空输入不跳走，只把焦点
       请回输入框。 */
    'word-search'() {
      const inp = document.getElementById('word-search');
      const v = (inp?.value || '').trim();
      if (!v) { if (inp) inp.focus(); return; }
      location.hash = '#/word/' + encodeURIComponent(v);
    },

    'word-syn'(app, btn) {
      UI.synCenter(btn.dataset.word);
    },
    /* 生词本（C5）：收藏 / 移除 / 复习判定。收藏与移除后回词条页刷新按钮，
       复习判定后回生词本刷新排期。 */
    'word-add'(app, btn) {
      const word = btn.dataset.word;
      /* addWord 会把词组、含数字的词形拒掉（改前是静默 return，
         学生点了「收藏生词」页面纹丝不动，不知道是失败了还是卡了）。
         现在返回布尔，这里就地给一句反馈。 */
      if (!Store.addWord(word)) {
        UI.toast('这个词形暂时收不进生词本，换个写法试试。');
        return;
      }
      UI.wordDetail(word);
    },
    'word-remove'(app, btn) {
      Store.removeWord(btn.dataset.word);
      if (location.hash === '#/words') UI.words();
      else UI.wordDetail(btn.dataset.word);
    },
    'word-known'(app, btn) {
      Store.reviewWord(btn.dataset.word, true);
      UI.words();
    },
    'word-forgot'(app, btn) {
      Store.reviewWord(btn.dataset.word, false);
      UI.words();
    },
    /* 词组闪卡（#/phrases）：翻面 / 判定 / 移除 / 随机收录。
       翻面只切 CSS 类（.phr-flash.open），不重渲染 —— 重渲染会把
       学生刚翻开的卡扣回去。判定后整页重渲染，下一张自动顶上来。 */
    'phr-flip'(app, btn) {
      const card = btn.closest('[data-phr-flash]');
      if (card) card.classList.toggle('open');
    },
    'phr-known'(app, btn) {
      Store.reviewPhrase(btn.dataset.phr, true);
      UI.phraseCards();
    },
    'phr-forgot'(app, btn) {
      Store.reviewPhrase(btn.dataset.phr, false);
      UI.phraseCards();
    },
    'phr-remove'(app, btn) {
      Store.removePhrase(btn.dataset.phr);
      UI.phraseCards();
    },
    'phr-import'(app, btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      UI.phraseImport();
    },
    /* 星图词组详情卡：收录到/移出闪卡。重渲染词组卡刷新按钮状态。 */
    'phr-toggle'(app, btn) {
      const ph = btn.dataset.phr || '';
      if (!ph) return;
      if (Store.getPhrases()[ph.toLowerCase()]) Store.removePhrase(ph);
      else Store.addPhrase(ph);
      UI.synCenter(ph);
    },
    /* 朗读（浏览器 SpeechSynthesis）：读单词/词组/例句，零版权成本 */
    'speak'(app, btn) { UI.speak(btn.dataset.speak); },

    /* ---------- 节点练测（A9/A10，#/knowledge/<节点>） ----------
     会话在 UI._kbq，作答逐题落盘；盒子级重渲染不整页跳顶。 */
    'kbq-start'(app, btn) { UI.kbqStart(btn.dataset.node, btn.dataset.review === '1'); },
    'kbq-answer'(app, btn) {
      if (btn.disabled) return;
      UI.kbqAnswer(btn.dataset.node, btn.dataset.opt);
    },
    'kbq-fill'(app, btn) {
      const input = document.getElementById('kbq-input');
      UI.kbqFill(btn.dataset.node, input ? input.value : '');
    },
    'kbq-next'(app, btn) { UI.kbqNext(btn.dataset.node); },
    /* ---------- 错题混排重练（F5，#/drill） ----------
       会话在 UI._drill；答对走 markMistakeReviewed 推进阶梯。 */
    'drill-start'(app, btn) { UI.drillStart(); },
    'drill-answer'(app, btn) { UI.drillAnswer(btn.dataset.letter); },
    'drill-next'(app, btn) { UI.drillNext(); },
    'drill-again'(app, btn) { UI.drillStart(); },
    /* 知识星图 v2：点星唤醒（拖拽过则忽略这次点击）；把星转到正面 */
    'kg-star'(app, btn) {
      const kg = KnowledgeGraph;
      if (kg._dragMoved) { kg._dragMoved = false; return; }
      kg.center = btn.dataset.node || null;
      UI.app().innerHTML = kg.render();
      if (kg.center) kg.faceTo(kg.center, () => {
        if (document.querySelector('[data-kg-sky]')) UI.app().innerHTML = kg.render();
      });
    },
    /* 跨类关联：跳到另一张星图并唤醒对应星 */
    'kg-jump'(app, btn) {
      const kg = KnowledgeGraph;
      kg.center = btn.dataset.node;
      const h = '#/knowledge-graph/' + encodeURIComponent(btn.dataset.cat);
      if (location.hash === h) UI.app().innerHTML = kg.render();
      else location.hash = h;
    },
    /* 自转开关（默认关，快照确定性不受影响） */
    'kg-spin'() { KnowledgeGraph.setSpin(!KnowledgeGraph.spin); UI.app().innerHTML = KnowledgeGraph.render(); },
    /* ---------- 学业分析（E1/E3，#/analysis + #/diagnostic） ---------- */
    /* 开始诊断：组卷（seed=当前时间）→ 进入答题态。诊断卷不倒计时。 */
    'diag-start'(app) {
      Diagnostic.build(Date.now()).then(exam => {
        Exam.start(exam);
        UI.exam(exam, Exam.answers, Exam.remaining, 'practice');
      }).catch(err => App.renderError(err));
    },
    /* 今日任务完成勾选：落 taskLog（当日去重），就地重渲染当前页。
       附录 D 起任务卡同时出现在首页「今日方案」与 #/analysis——
       都用 app.route() 重跑当前路由，勾选后两页都不跳走。 */
    'analysis-task-done'(app, btn) {
      Store.setTaskDone(btn.dataset.task);
      app.route();
    },
    /* 主题循环（附录 C1）：纸墨 → 白昼 → 夜间。类挂 <html>（与 index.html
       头部内联脚本同挂点），选择落 localStorage.gkyy_theme，刷新保持。 */
    'theme-cycle'() {
      const r = document.documentElement;
      const next = r.classList.contains('theme-day') ? 'theme-night'
        : r.classList.contains('theme-night') ? '' : 'theme-day';
      r.classList.remove('theme-day', 'theme-night');
      if (next) r.classList.add(next);
      try { localStorage.setItem('gkyy_theme', next ? next.slice(6) : ''); } catch (e) { /* 隐私模式：本次会话内仍生效 */ }
      const btn = document.querySelector('[data-action="theme-cycle"]');
      if (btn) btn.textContent = UI.themeLabel();
    },
    /* 做题页字号（附录 E3）：三档循环的边界由 bumpFs 收口，按钮在
       examBar 上，到边界就地置灰。 */
    'fs-inc'() { UI.bumpFs(1); },
    'fs-dec'() { UI.bumpFs(-1); },
    /* 答题页排版（2026-09-22）：答题卡左右/收起、选项位置。就地改类 +
       落 localStorage，不整页重渲染——重渲染会把正在作答的页面滚回顶部。 */
    'exam-layout'(app, btn) {
      UI.applyExamLayout({ [btn.dataset.kind]: btn.dataset.value });
    },
    /* 词族列表筛选：整页重渲染到对应类型分组（刻意操作） */
    'syn-filter'(app, btn) { UI.synonyms(btn.dataset.filter); },
    /* 词族列表搜索 */
    'syn-search'(app, btn) {
      const q = document.getElementById('syn-list-search');
      UI.synonyms(UI._synState.filter, q ? q.value : '');
    },

    /* 上海考纲词汇：按首字母筛选。再次点击同一字母 = 取消筛选。 */
    'sh-letter'(app, btn) {
      const c = btn.dataset.letter || '';
      UI._shVocab = Object.assign(UI._shVocab || {}, { letter: UI._shVocab?.letter === c ? '' : c });
      document.querySelectorAll('.sh-letters .text-btn').forEach(b =>
        b.classList.toggle('is-on', b.dataset.letter === UI._shVocab.letter && !!UI._shVocab.letter));
      UI.shVocabFill(document.querySelector('[data-sh-vocab-search]')?.value.trim() || '');
    },
  },

  click(e) {
    const el = e.target;
    /* 题型训练的筛选按钮不走 data-action，单独先处理 */
    const filter = e.target.closest('[data-training-filter]');
    if (filter) {
      return Training.render(
        this.exams,
        location.hash.split('/')[2] || 'reading',
        filter.dataset.trainingFilter,
        Training._subskill || null   /* 子技能专项页内切年份不丢过滤 */
      );
    }

    /* 「保存复盘记录」按钮只有 data-save-mistake-note，没有 data-action。
       改前它被写在 data-action 分支之后，而该分支开头就 `if(!b)return`，
       于是这个按钮永远走不到 —— 学生写的复盘笔记点保存毫无反应。
       这里提到 data-action 判定之前。 */
    const noteBtn = e.target.closest('[data-save-mistake-note]');
    if (noteBtn) {
      const note = document.querySelector('[data-mistake-note]')?.value || '';
      Store.updateMistake(Number(noteBtn.dataset.index), { studentNote: note });
      noteBtn.textContent = '已保存复盘记录';
      return;
    }

    /* 整卷页短文改错逐题自评（改对 / 漏改 / 改错）。独立键带 _exam 后缀，
       不与专题页的 gaokao_proof_self_* 冲突。 */
    const proofSelf = e.target.closest('[data-proof-self-exam]');
    if (proofSelf) {
      const examId = Exam.current?.id;
      if (examId) {
        const key = `gaokao_proof_self_exam_${examId}_proofreading`;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch { arr = []; }
        const n = Number(proofSelf.dataset.n);
        const verdict = proofSelf.dataset.proofSelfExam;
        const idx = arr.findIndex(x => String(x.n) === String(n));
        if (idx >= 0) {
          if (arr[idx].verdict === verdict) arr.splice(idx, 1);
          else arr[idx].verdict = verdict;
        } else {
          arr.push({ n, verdict });
        }
        localStorage.setItem(key, JSON.stringify(arr));
        const row = proofSelf.closest('[data-proof-self-row]');
        if (row) row.querySelectorAll('[data-proof-self-exam]').forEach(b =>
          b.classList.toggle('is-active', b.dataset.proofSelfExam === verdict
            && arr.some(x => String(x.n) === String(n) && x.verdict === verdict)));
        const sum = document.querySelector('.proof-self-summary-exam');
        if (sum) sum.textContent = `本次自评：${UI.proofSelfSummaryText(arr)}`;
      }
      return;
    }

    /* 分台阶学习的难度筛选：整页重渲染到对应 level 分组。这是刻意操作
       （点筛选才触发），不像自评那样高频，整页重渲染可接受。 */
    const learnFilter = e.target.closest('[data-learn-filter]');
    if (learnFilter) {
      return UI.learn(learnFilter.dataset.learnFilter);
    }

    /* 点击查词（C6）：带 data-lookup 的阅读区（错题详情 / 知识详情证据 /
       解析页）里点击英文单词 → 词条页。按钮、链接、输入控件内不触发；
       考试作答模式不加 data-lookup，只有解析模式有，避免边考边查。 */
    if (e.target.closest('[data-lookup]')
      && !e.target.closest('a,button,input,textarea,select,label,[data-action]')) {
      const wd = UI.wordFromPoint(e);
      if (wd) {
        location.hash = '#/word/' + encodeURIComponent(wd);
        return;
      }
    }

    /* 方法卡「到步直达」（2026-09-19）：错题归因区与高频步骤聚合的链接带
       data-locstep——记下目标步骤后照常走 hash 路由，卡页渲染完滚动定位；
       若 hash 已是目标（正在卡页内换步），路由不触发，就地直接滚。
       必须放在 ACTIONS 分发之前（同 errstage 分支的理由）。 */
    const locLink = e.target.closest('[data-locstep]');
    if (locLink) {
      const stepId = locLink.getAttribute('data-locstep') || '';
      const href = locLink.getAttribute('href') || '';
      if (location.hash === href) {
        e.preventDefault();
        UI.scrollToStep(stepId);
        return;
      }
      this._pendingStep = stepId;
    }

    /* 错在哪一步（M1）：方法卡步骤标签。点已选中的 chip = 取消归因；
       causeSource 一并清空——碰过归因就按学生的为准。只刷 chips 的
       选中态，不整页重渲染（编辑器是展开状态，整刷会把页面滚走）。
       注意必须放在 ACTIONS 分发之前：chip 没有 data-action，
       走到 `if (!btn) return` 就被拦下了，按钮也不触发 change 事件。 */
    if (el.matches('[data-errstage]')) {
      /* 错题本列表的编辑器有 .cause-editor 外壳；详情页的 chips 直接带
         data-index——两种位置都能定位到同一条错题。 */
      const idx = el.dataset.index != null
        ? Number(el.dataset.index)
        : Number(el.closest('.cause-editor')?.dataset.index);
      const wasOn = el.classList.contains('is-on');
      Store.updateMistake(idx, {
        errStage: wasOn ? '' : el.dataset.errstage,
        causeSource: '',
      });
      const chips = el.closest('.stage-row').querySelectorAll('.stage-chip');
      chips.forEach(c => c.classList.toggle('is-on', !wasOn && c === el));
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = this.ACTIONS[btn.dataset.action];
    if (action) action(this, btn);
  },

  change(e) {
    const el = e.target;

    /* 同义近义反义：探索框 / 列表搜索框回车（或失焦）即时触发。
       这两支原本误放在 click(e) 里且输入框没挂 data 属性，从未生效过；
       2026-08-30 移到 change 并给输入框补上 data-syn-explore /
       data-syn-list-search（js/ui/synonyms.js）。 */
    if (el.matches('[data-syn-explore]')) { UI.synExplore(el.value); return; }
    if (el.matches('[data-syn-list-search]')) { UI.synonyms(UI._synState.filter, el.value); return; }

    /* 查词页搜索框（C4）：回车/失焦跳词条页。空值不动。 */
    if (el.matches('[data-word-search]')) {
      const wv = el.value.trim();
      if (wv) location.hash = '#/word/' + encodeURIComponent(wv);
      return;
    }

    /* #15 跨设备导入：文件选择器选中后读成文本、JSON.parse、合并。
       file.text() 在现代浏览器（含无头 Chrome）都可用，比 FileReader
       省一层回调。失败一律落到同步结果区，不抛到全局。 */
    if (el.matches('input[type=file][data-import-file]')) {
      this.handleImport(el);
      return;
    }

    /* 错题本的错因编辑器：三个控件共享一次写入，任一变化都整组回存。
       causeSource 一并清空 —— 自动判定的标记只在学生没碰过时才成立，
       手改一次之后这条错题的错因就以学生为准（见 js/diagnose.js 头注）。 */
    if (el.matches('[data-cause],[data-subcause],[data-node]')) {
      const box = el.closest('.cause-editor');
      Store.updateMistake(Number(box.dataset.index), {
        cause: box.querySelector('[data-cause]')?.value || '',
        subCause: box.querySelector('[data-subcause]')?.value || '',
        knowledgeNode: box.querySelector('[data-node]')?.value.trim() || '',
        causeSource: '',
      });
      return;
    }

    if (el.matches('input[type=radio][data-qid]')) {
      Exam.set(el.dataset.qid, el.value);
      el.closest('.question')?.querySelectorAll('.option')
        .forEach(x => x.classList.toggle('selected', !!x.querySelector('input')?.checked));
      this.syncSheet();
    }
  },

  input(e) {
    const el = e.target;
    /* 全站搜索（F9）：即打即搜，200ms 节流；只刷结果区，输入框保焦点 */
    if (el.matches('[data-global-search]')) {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => UI.searchFill(el.value.trim()), 200);
      return;
    }
    /* 上海考纲词汇搜索：同款即打即搜，只刷列表区，输入框保焦点 */
    if (el.matches('[data-sh-vocab-search]')) {
      clearTimeout(this._shSearchTimer);
      this._shSearchTimer = setTimeout(() => UI.shVocabFill(el.value.trim()), 200);
      return;
    }
    if (el.matches('[data-qid].fill-input,[data-qid].writing-input,[data-qid].proofreading-input')) {
      Exam.set(el.dataset.qid, el.value);
      this.syncSheet();
    }
  },

  /* 键盘快捷键（F9）：输入控件聚焦时全部让路。
     A–D   考试作答：选中第一个未作答选择题的对应选项
     1/2/3 复习队列 / 错题详情：待回炉 / 复习中 / 已掌握
     空格  词组闪卡翻卡（同 phr-flip）
     /     跳到全站搜索 */
  hotkey(e) {
    const t = e.target;
    if (t && (t.matches('input,textarea,select') || t.isContentEditable)) return;

    /* 焦点落在任意可交互元素上时不接管（2026-09-03）：
       改前只排除了输入框，没排除 button / a。于是只要页面上有翻卡按钮，
       键盘用户 Tab 到「移除」再按空格，就会被 preventDefault 拿去翻卡 ——
       翻卡触发了、移除永远触发不了，闪卡页对键盘用户等于不可用。
       A–D 分支有同样的问题（焦点在按钮上按 A 会去改别的题的答案）。
       [tabindex="-1"] 要排除：a11y.js 给 <main> 设的就是 -1，
       路由切换后焦点常落在 main 上，不该因此废掉全部快捷键。 */
    if (t && t.closest
      && t.closest('a,button,summary,[role="button"],[tabindex]:not([tabindex="-1"])')) return;

    const k = e.key;

    if (/^[a-d]$/i.test(k)) {
      /* 按name分组找第一个尚未作答的选择题，命中该组内对应字母 */
      const groups = {};
      document.querySelectorAll('input[type=radio][data-qid]').forEach(r => {
        (groups[r.name] = groups[r.name] || []).push(r);
      });
      const group = Object.values(groups).find(g => !g.some(r => r.checked));
      if (!group) return;
      const hit = group.find(r => r.value.toUpperCase() === k.toUpperCase());
      if (hit) { hit.click(); e.preventDefault(); }
      return;
    }

    if (k === '1' || k === '2' || k === '3') {
      const status = { 1: '待回炉', 2: '复习中', 3: '已掌握' }[k];
      const btn = document.querySelector(`[data-action="queue-status"][data-status="${status}"]`)
        || document.querySelector(`[data-action="set-mistake-status"][data-status="${status}"]`);
      if (btn) { btn.click(); e.preventDefault(); }
      return;
    }

    if (k === ' ') {
      const btn = document.querySelector('[data-action="phr-flip"]');
      if (btn) { btn.click(); e.preventDefault(); }
      return;
    }

    if (k === '/') {
      const input = document.getElementById('global-search');
      if (input) { input.focus(); }
      else { location.hash = '#/search'; }
      e.preventDefault();
    }
  },

  /* 答题卡进度此前只在整页重渲染时才算一次：作答过程中题号格永远不变绿、
     顶栏「已作答 n/总」也不动，考生无法判断还剩几题——这里就地增量更新，
     不触发重渲染（重渲染会丢失滚动位置与输入焦点）。 */
  syncSheet() {
    const exam = Exam.current;
    if (!exam) return;

    let answered = 0;
    for (const section of exam.sections) {
      if (section.key === 'proofreading' && section.questions[0]) {
        const q = section.questions[0];
        const items = UI.proofreadingItems(q);
        for (const it of items) {
          const key = `${section.key}-${q.id}-${it.n}`;
          const done = String(Exam.answers[key] ?? '').trim() !== '';
          if (done) answered++;
          const dot = document.querySelector(`.sheet-dot[href="#q-${key}"]`);
          if (dot) dot.classList.toggle('done', done);
        }
        continue;
      }
      for (const q of section.questions) {
        const key = `${section.key}-${q.id}`;
        const done = String(Exam.answers[key] ?? '').trim() !== '';
        if (done) answered++;
        const dot = document.querySelector(`.sheet-dot[href="#q-${key}"]`);
        if (dot) dot.classList.toggle('done', done);
      }
    }

    const total = UI.examQuestionTotal(exam);
    const bar = document.querySelector('.progress');
    if (bar) bar.innerHTML = `已作答 <b>${answered}</b> / ${total}`;
    const title = document.querySelector('.sheet-title small');
    if (title) title.textContent = `${answered}/${total}`;
  },

  submit(auto = false) { Exam.submit(auto); },

  /* #15 导入主流程（2026-09-03 改为两步）：改前选中文件的瞬间就直接
     mergeData 合并 —— 学生只是想看看文件里有什么，结果数据已经合进去了，
     没有预览、没有确认、不可反悔。现在拆成：
       第一步  读文件 → 校验 → 展示「即将导入什么」，等用户点确认；
       第二步  import-confirm 动作真正合并。
     解析失败给出明确中文报错，不让一次坏文件把整站带崩。 */
  async handleImport(input) {
    const file = input.files && input.files[0];
    const box = document.getElementById('sync-result');
    if (!file) { input.value = ''; return; }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      /* 结构校验：备份文件是 Store 单键导出的对象，records/mistakes 等
         集合缺一个都算可疑 —— 不校验的话坏文件会在合并时炸出英文堆栈。 */
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('文件内容不是进度备份（应为 JSON 对象）');
      }
      if (!('records' in data) && !('mistakes' in data) && !('topicDrafts' in data)) {
        throw new Error('文件里没有进度数据（缺少成绩/错题等字段）');
      }
      const fmt = this.fmtStats;
      this._pendingImport = data;
      if (box) {
        box.className = 'sync-result show';
        box.innerHTML = `<b>即将导入：</b>${fmt(this.dataStatsOf(data))}<br>`
          + '将与当前设备数据合并：成绩与草稿按较新的一方保留，'
          + '错题按身份去重、复习排期取进展更靠前的一方。<br>'
          + '<div class="sync-confirm">'
          + '<button class="primary-btn" data-action="import-confirm">确认合并</button>'
          + '<button class="ghost-btn" data-action="import-cancel">取消</button>'
          + '</div>';
      }
    } catch (err) {
      this._pendingImport = null;
      if (box) {
        box.className = 'sync-result show error';
        box.textContent = '导入失败：' + (err && err.message || '文件不是有效的进度备份');
      }
    }
    input.value = '';
  },

  /* 第二步：用户确认后真正合并。_pendingImport 只在这里消费一次。 */
  confirmImport() {
    const data = this._pendingImport;
    const box = document.getElementById('sync-result');
    if (!data) return;
    this._pendingImport = null;
    const before = this.dataStats();
    Store.mergeData(data);
    const after = this.dataStats();
    if (box) {
      box.className = 'sync-result show';
      box.innerHTML = '导入完成，已与当前设备数据合并。<br>'
        + `合并前：${this.fmtStats(before)}<br>合并后：${this.fmtStats(after)}`;
    }
    UI.dataManager();
  },

  cancelImport() {
    this._pendingImport = null;
    const box = document.getElementById('sync-result');
    if (box) { box.className = 'sync-result'; box.textContent = '已取消导入，当前数据未做任何改动。'; }
  },

  /* ---------- G3 打印/PDF 导出（2026-09-03） ----------
     错题本 / 复习队列 / 生词本三页的「打印」按钮走这里。
     两件 CSS 干不了的事必须先做：
     ① details 折叠块的内容在关闭时不参与渲染，CSS 无法强制展开——
        纸上要答案和解析，就得先全部 open 再调起打印；
     ② 生词本的行里没有释义（屏幕上为了复习效果刻意不显示），
        打印前异步查一遍词书，把释义注进 .print-meaning（屏幕隐藏，
        打印样式里显示），纸上才是完整的背诵清单。
     window.print() 在 Chrome 里会阻塞到打印对话框关闭，返回后再
     还原折叠状态、撤掉注入的释义，页面 DOM 与打印前完全一致。 */
  async runPrint() {
    const details = Array.from(document.querySelectorAll('details'));
    const openStates = details.map(d => d.open);
    details.forEach(d => { d.open = true; });

    let injected = [];
    if (document.querySelector('.word-row')) {
      injected = await this.injectWordMeanings();
    }

    window.print();

    details.forEach((d, i) => { d.open = openStates[i]; });
    injected.forEach(el => el.remove());
  },

  /* 给生词本每行补释义：查不到的词就留空——纸上留白让学生自己
     回忆，比印一个「未收录」更像一份自测卷。并发发起查询没问题：
     _wordLookupAll 内部的词书/词典分片加载都做了记忆化。 */
  async injectWordMeanings() {
    const rows = Array.from(document.querySelectorAll('.word-row'));
    const spans = await Promise.all(rows.map(async row => {
      const term = row.querySelector('.word-row-term');
      if (!term || row.querySelector('.print-meaning')) return null;
      try {
        const hits = await UI._wordLookupAll(term.textContent.trim());
        const m = hits[0] && hits[0].entry ? hits[0].entry.m : '';
        if (!m) return null;
        const span = document.createElement('span');
        span.className = 'print-meaning';
        span.textContent = m;
        term.after(span);
        return span;
      } catch (_) { return null; }
    }));
    return spans.filter(Boolean);
  },

  /* 统计口径（2026-09-03 抽出）：dataStats() 只看当前设备，预览时还要看
     备份文件里的数据量，两者共用同一个统计函数，数字口径才对得上。 */
  dataStatsOf(d) {
    return {
      records: Object.keys(d.records || {}).length,
      drafts: Object.keys(d.drafts || {}).length,
      mistakes: (d.mistakes || []).length,
      topicRecords: (d.topicRecords || []).length,
    };
  },

  fmtStats(s) {
    return `成绩 ${s.records} 套 · 整卷草稿 ${s.drafts} 份 · `
      + `错题 ${s.mistakes} 条 · 专题复盘 ${s.topicRecords} 次`;
  },

  /* 当前设备数据量统计，导入前后各取一次做 diff 展示。 */
  dataStats() {
    return this.dataStatsOf(Store._load());
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());

/* ---------- 下拉互斥（2026-09-22）----------
   点了另一个，前一个自动收回 —— 全站导航（.site-nav-item）与答题页的排版
   下拉（.exam-set）各自内部互斥。details 的 toggle 事件不冒泡，必须用捕获
   阶段监听；再补「点空白处 / Esc 关闭」，贴近真实网页的手感。 */
(function () {
  const GROUPS = ['.site-nav-item', '.exam-set'];
  const inGroups = el => el && el.tagName === 'DETAILS'
    && GROUPS.some(sel => el.matches(sel));

  /* 手风琴：同一组里只留一个打开 */
  document.addEventListener('toggle', function (e) {
    const d = e.target;
    if (!inGroups(d) || !d.open) return;
    GROUPS.forEach(function (sel) {
      if (!d.matches(sel)) return;
      document.querySelectorAll(sel).forEach(function (x) { if (x !== d) x.open = false; });
    });
  }, true);

  /* 点空白处关闭（点在某个展开菜单内部则保留）*/
  document.addEventListener('click', function (e) {
    const t = e.target;
    GROUPS.forEach(function (sel) {
      document.querySelectorAll(sel + '[open]').forEach(function (x) {
        if (!x.contains(t)) x.open = false;
      });
    });
  });

  /* Esc 关闭全部并归还焦点 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    GROUPS.forEach(function (sel) {
      document.querySelectorAll(sel + '[open]').forEach(function (x) { x.open = false; });
    });
  });
})();
