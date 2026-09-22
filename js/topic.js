/* =====================================================================
   专题训练：以完整材料为单位，完成同一篇文章 / 语篇 / 任务的全部问题
   与「分题型训练」（js/training.js）的分工：那边一次一道题、跨年份横向
   对比；这边一次一整篇材料，先连续做完，再统一复盘。

   七个专题（阅读 / 听力 / 完形 / 七选五 / 语法填空 / 短文改错 / 写作）
   的流程完全同构，只有文案和判分单位不同，所以本文件的组织方式是：
     ① 上半部分是公共设施（选材、空态、选材页、作答页骨架、判分、复盘页）
     ② 下半部分每个专题只写「差异」——start / render / submit / report 四个薄壳

   模板断行规则同 js/ui/base.js：只用加号拼接，不在模板内换行。
   ===================================================================== */

/* 写作类节（含短文改错）。选材页筛选用它、整卷深链校验也用它 ——
   同一份清单只写一处，日后加题型不会漏改。 */
const WRITING_SECTION_KEYS = ['writing_app', 'writing_cont', 'proofreading'];

const Topic = {
  activeData: null,

  esc(v = '') { return UI.esc(v); },
  text(v = '') { return UI.text(v); },

  /* =============== 公共设施 =============== */

  /* 逐套试卷拉 JSON，用 pickSections 挑出本专题能用的部分。
     单套数据异常（404、JSON 坏）只跳过该套，不影响其余试卷 ——
     题库是逐年补录的，任何一年缺文件都不该让整个专题打不开。 */
  async loadCandidates(exams, pickSections) {
    /* 并行拉取所有试卷（改用按需注入的 loadExamData，file:// 下 fetch 会被
       CORS 拦截），单套异常只跳过该套（题库逐年补录，缺文件不应让整个
       专题打不开）。 */
    const got = await Promise.all(exams.map(async meta => {
      try {
        const exam = await loadExamData(meta);
        if (!exam) return [];
        return pickSections(exam).map(section => ({ meta, exam, section }));
      } catch (_) { return []; }
    }));
    return got.flat();
  },

  /* 题库里还没有该专题材料时的落地页。不能只显示空白 ——
     给一条明确的下一步（进对应题型的教学页）。 */
  emptyState(title, strong, typeKey, ctaLabel) {
    UI.app().innerHTML = `${UI.header(title, true)}`
      + `<main class="program-page"><div class="empty-state"><strong>${strong}</strong>`
      + '<p>可以先进入分题型训练继续练习。</p>'
      + `<a class="primary-btn" href="#/training/${typeKey}/example">${ctaLabel}</a></div></main>`;
  },

  renderLoading(title = '阅读专题', message = '正在准备一篇完整阅读材料') {
    UI.app().innerHTML = `${UI.header(title, true)}`
      + '<main class="topic-workspace"><div class="topic-loading"><span class="loading-dot"></span>'
      + `<b>${this.esc(message)}</b>`
      + '<p>我们会把材料和整组问题一起载入，先完成，再统一复盘。</p></div></main>';
  },

  /* 选材页骨架。extra 供写作专题插入文章类型筛选栏。 */
  pickerPage({ title, kicker, headline, lead, cards, extra = '' }) {
    UI.app().innerHTML = `${UI.header(title, true)}`
      + '<main class="program-page topic-picker"><div class="program-hero">'
      + `<span class="reference-kicker">${kicker}</span><h1>${headline}</h1>`
      + `<p>${lead}</p></div>${extra}`
      + `<div class="topic-choice-grid">${cards}</div></main>`;
  },
  /* --- 草稿：键形如 '<examId>:<sectionKey>:<passageLabel|full>'。
     首页与专题总览页的「继续练习」横幅按这个格式解析，改格式要同步改
     js/ui/dashboard.js 的 dashContinue 和 js/ui/library.js 的 topics。 --- */
  topicDraftKey(data, suffix = '') {
    return `${data.meta.id}:${data.section.key}:${suffix || data.activePassage?.label || 'full'}`;
  },
  loadTopicAnswers(data, suffix = '') {
    return Store.getTopicDraft(this.topicDraftKey(data, suffix))?.answers || {};
  },
  saveTopicAnswers(data, answers, suffix = '') {
    Store.saveTopicDraft(this.topicDraftKey(data, suffix), answers);
  },
  topicDraftFlag(data, suffix = '') {
    const d = Store.getTopicDraft(this.topicDraftKey(data, suffix));
    const answered = d ? UI.countAnswered(d.answers) : 0;
    return answered ? `<span class="topic-draft-flag">↻ 继续上次（已答 ${answered} 题）</span>` : '';
  },

  /* 收答案：单选取 checked，填空取 [data-topic-q]。两者都没有就是空串。 */
  collect(section) {
    const answers = {};
    section.questions.forEach(q => {
      const key = `${section.key}-${q.id}`;
      answers[key] = document.querySelector(`input[name="topic-${q.id}"]:checked`)?.value
        || document.querySelector(`[data-topic-q="${key}"]`)?.value || '';
    });
    return answers;
  },

  /* 选项与题卡：五个专题（听力/七选五/完形/阅读 + 语法填空的题头）共用。 */
  optionsHtml(q, value) {
    return (q.options || []).map(o => '<label class="topic-option">'
      + `<input type="radio" name="topic-${q.id}" value="${this.esc(o.letter)}" `
      + `${value === o.letter ? 'checked' : ''}>`
      + `<span class="option-letter">${this.esc(o.letter)}</span>`
      + `<span>${this.esc(o.text)}</span></label>`).join('');
  },

  /* unit 是计数单位：阅读/听力叫「问题」，完形/七选五/语法填空叫「空格」。 */
  questionCard(i, q, unit, inner) {
    return `<article class="topic-question" id="topic-q-${q.id}">`
      + `<div class="topic-q-head"><span>${unit} ${String(i + 1).padStart(2, '0')}</span>`
      + `<b>第 ${q.id} 题</b></div>${inner}</article>`;
  },
  /* --- 作答页骨架。两种版式：
       有材料 → topic-grid-layout（左材料右题目）
       无材料 → topic-question-only（听力：作答阶段不给文字稿） --- */
  workspacePage(o) {
    const head = `<main class="topic-workspace${o.variant ? ' ' + o.variant : ''}">`
      + this.referenceHeader({
          brand: o.brand, brandNote: o.brandNote, brandHref: '#/topics',
          backHref: '#/topics', backLabel: '返回专题',
        })
      + `<section class="topic-intro"><span class="reference-kicker">${o.kicker}</span>`
      + `<h1>${o.headline}</h1><p>${o.lead}</p>`
      + `<div class="topic-meta">${o.metaItems.map(x => `<span>${x}</span>`).join('')}</div></section>`
      + (o.progress || '');

    const panel = `<div class="topic-panel-head"><b>${o.panelTitle}</b><span>${o.panelNote}</span></div>`
      + o.questions
      + `<button class="primary-btn topic-submit" ${o.submitAttr}>提交本专题</button>`
      + `<p class="topic-submit-note">${o.note}</p>`;

    const body = o.paper
      ? '<div class="topic-grid-layout" data-layout="topic-grid-layout">'
        + '<article class="topic-reading-paper">'
        + `<div class="topic-paper-label">${o.paper.label}</div><h2>${o.paper.title}</h2>`
        + `<div class="topic-passage">${o.paper.text}</div></article>`
        + `<aside class="topic-question-panel">${panel}</aside></div>`
      : `<div class="topic-question-only" data-layout="topic-question-only">${panel}</div>`;

    UI.app().innerHTML = head + body + '</main>';
  },

  /* 「更换材料」条。只有阅读、听力、完形三个专题有 —— 其余专题一份卷
     只有一篇语篇，换材料等于换卷，走返回选材页即可。 */
  progressBar(label, value, count, action, actionLabel) {
    return `<div class="topic-progress"><span>${label}</span><b>${value}</b>`
      + `<small>完成 ${count} 题后提交专题</small>`
      + `<button class="text-btn" ${action}>${actionLabel}</button></div>`;
  },

  /* --- 判分：口径与 js/exam.js 的 isCorrect 一致（去空白 + 忽略大小写）。
     直接转发 UI.eqAnswer，三处判定收口到一处。 --- */
  sameAnswer(mine, answer) {
    return UI.eqAnswer(mine, answer);
  },

  gradeObjective(section, questions = section.questions) {
    const answers = this.collect({ ...section, questions });
    const scored = questions.filter(q => q.answer != null);
    const correct = scored.filter(q => this.sameAnswer(answers[`${section.key}-${q.id}`], q.answer));
    return { answers, correct: correct.length, total: scored.length };
  },

  /* 客观题专题（阅读 / 听力 / 完形 / 七选五 / 语法填空）的提交是同一件事：
     判分 → 落盘 → 进复盘页。五个专题只在 type 和 report 上不同。 */
  submitObjective(data, type, report) {
    const { meta, section } = data;
    const g = this.gradeObjective(section, this.scopedQuestions(data));
    const record = {
      examId: meta.id, title: meta.title, completedAt: Date.now(),
      answers: g.answers, correct: g.correct, total: g.total,
    };
    this.saveTopicResult(data, type, record);
    report.call(this, data, record);
  },

  pct(record) {
    return record.total ? Math.round(record.correct / record.total * 100) : 0;
  },

  /* 复盘页会清掉草稿：这一组已经做完并看过答案，留着草稿只会让
     首页「继续练习」横幅一直挂着一个已完成的专题。 */
  saveTopicResult(data, type, record) {
    Store.saveTopicRecord({
      type, examId: record.examId, title: record.title,
      completedAt: record.completedAt, correct: record.correct, total: record.total,
      ...(record.manual ? { manual: true } : {}),
    });
    Store.clearTopicDraft(this.topicDraftKey(data));
  },
  /* 参与判分与复盘的题目：阅读专题按文章过滤后存在 activeQuestions 上，
     其余专题就是整个 section 的全部题目。 */
  scopedQuestions(data) {
    return data.activeQuestions || data.section.questions;
  },

  /* 选材卡片。attrs 是各专题自己的 data-* 钩子（阅读还要带 passage 序号）。 */
  choiceCard(attrs, extraClass, line, title, note, flag = '') {
    return `<button class="topic-choice${extraClass ? ' ' + extraClass : ''}" ${attrs}>`
      + `<span>${line}</span><b>${title}</b><small>${note}</small>${flag}</button>`;
  },

  metaLine(meta, withRegion = false) {
    return `${this.esc(meta.year)} · ${this.esc(meta.paper || '')}`
      + (withRegion ? ` · ${this.esc(meta.region || '')}` : '');
  },

  /* 完形 / 七选五 / 语法填空的选材条件相同：一篇语篇 + 一组题。 */
  passageSection(exam, key) {
    const s = exam.sections.find(x => x.key === key && x.passages?.length && x.questions?.length);
    return s ? [s] : [];
  },

  /* --- 复盘页骨架。六个专题的复盘页版式一致，只有文案、计分块和逐题行不同。 --- */
  reportPage(o) {
    UI.app().innerHTML = `${UI.header(o.title, true)}`
      + '<main class="topic-report"><section class="report-hero">'
      + `<span class="reference-kicker">TOPIC REPORT · ${o.kicker}</span>`
      + `<h1>${o.headline}</h1><p>${o.sub}</p>`
      + `<div class="report-score">${o.score}</div></section>`
      + `<section class="report-advice"><b>${o.advice}</b><p>${o.adviceBody}</p></section>`
      + `<div class="topic-review-list"><h2>${o.listTitle}</h2>${o.rows}</div>`
      + '<div class="report-actions">'
      + `<a class="primary-btn" href="#/training/${o.key}/example">${o.ctaLabel}</a>`
      + '<a class="ghost-btn" href="#/topics">选择其他专题</a>'
      + `<a class="text-btn" href="#/topic/${o.key}">再做一次</a></div></main>`;
  },

  scoreBlock(record) {
    return `<b>${record.correct}</b><span>/ ${record.total} 正确</span>`
      + `<strong>${this.pct(record)}%</strong>`;
  },
  /* 逐题渲染。inner(q, value, key) 由各专题给出：单选题给选项组，
     语法填空给输入框，阅读没有选项时退化成文本域。 */
  questionsHtml(section, questions, answers, unit, inner) {
    return questions.map((q, i) => {
      const key = `${section.key}-${q.id}`;
      return this.questionCard(i, q, unit, inner(q, answers[key] || '', key));
    }).join('');
  },

  stemBlock(q) {
    return `<div class="topic-q-stem">${this.text(q.stem || `第 ${q.id} 题`)}</div>`;
  },

  /* 完形与七选五的题体完全一样：题干 + 一组单选。 */
  choiceInner(q, value) {
    return this.stemBlock(q) + `<div class="topic-options">${this.optionsHtml(q, value)}</div>`;
  },

  /* 作答即存草稿。suffix 用默认值即可 —— topicDraftKey 会自己按
     activePassage 区分阅读专题的不同文章。 */
  bindAutosave(data, selector, event, questions = data.section.questions) {
    const section = data.section;
    document.querySelectorAll(selector).forEach(el => el.addEventListener(event,
      () => this.saveTopicAnswers(data, this.collect({ ...section, questions }))));
  },

  bindClick(selector, handler) {
    document.querySelector(selector)?.addEventListener('click', handler);
  },

  /* --- 复盘逐题行。listening 额外加一个类，且详情区放文字稿而非解析。 --- */
  reviewRow(o) {
    return `<article class="topic-review-row${o.extraClass ? ' ' + o.extraClass : ''} `
      + `${o.ok ? 'is-correct' : 'is-wrong'}">`
      + `<div><span>${o.unit} ${o.no}</span><b>第 ${o.id} 题</b></div>`
      + `<strong>${o.ok ? o.okText : o.badText}</strong>`
      + `<p>你的答案：${o.mine}　标准答案：${o.answer}</p>${o.detail}</article>`;
  },

  explanationDetails(q, summary) {
    return q.explanation
      ? `<details><summary>${summary}</summary>`
        + `<div class="explanation">${UI.explanationHtml(q.explanation)}</div></details>`
      : '';
  },

  objectiveRows(data, record, o) {
    const { section } = data;
    return this.scopedQuestions(data).map((q, i) => {
      const mine = record.answers[`${section.key}-${q.id}`] || '未作答';
      return this.reviewRow({
        ...o, ok: this.sameAnswer(mine, q.answer || ''),
        no: String(i + 1).padStart(2, '0'), id: q.id,
        mine: this.esc(mine), answer: this.esc(q.answer || o.answerFallback || ''),
        detail: o.detail ? o.detail(q) : this.explanationDetails(q, o.summary),
      });
    }).join('');
  },
  /* =============== ① 阅读专题 =============== */
  /* 阅读是唯一「一份卷有多篇材料」的专题：选材粒度是 passage，
     题目按 q.passageLabel 归属，所以草稿键也带文章标签。 */

  async loadReading(exams) {
    const candidates = await this.loadCandidates(exams, exam => {
      const s = exam.sections.find(x => x.key === 'reading' && x.passages?.length && x.questions?.length);
      if (!s) return [];
      /* 过滤过短的材料：题库里有「广告/告示」类不足百字的语篇，
         单独拿出来做专题练习没有意义。 */
      const passages = s.passages.filter(p => String(p.text || '').trim().length > 120);
      return passages.length ? [{ ...s, passages }] : [];
    });
    if (!candidates.length) throw Error('暂时没有可用的阅读专题材料');
    return candidates;
  },

  async start(exams) {
    this.renderLoading();
    this.renderPicker(await this.loadReading(exams));
  },

  renderPicker(candidates) {
    const cards = candidates.flatMap(data => data.section.passages.map((p, i) => this.choiceCard(
      `data-topic-choice="${this.esc(data.meta.id)}" data-topic-passage="${i}"`, '',
      this.metaLine(data.meta),
      this.esc(p.label || `阅读材料 ${i + 1}`),
      `${data.section.questions.filter(q => q.passageLabel === p.label).length} 道题 · 点击开始整组练习`,
      this.topicDraftFlag(data, p.label)))).join('');

    this.pickerPage({
      title: '阅读专题', kicker: 'READING STUDIO · CHOOSE A PASSAGE',
      headline: '先选一篇文章，<em>完整做完。</em>',
      lead: '选择真实试卷中的一篇阅读材料，先独立完成整组问题，提交后统一复盘。',
      cards,
    });

    document.querySelectorAll('[data-topic-choice]').forEach(btn => btn.onclick = () => {
      const data = candidates.find(x => x.meta.id === btn.dataset.topicChoice);
      const passageIndex = Number(btn.dataset.topicPassage);
      data.activePassage = data.section.passages[passageIndex];
      this.render(data, this.loadTopicAnswers(data, data.activePassage?.label), passageIndex);
    });
  },

  render(data, answers, passageIndex = 0) {
    const { meta, section } = data;
    const passage = section.passages[passageIndex] || section.passages[0];
    const related = section.questions.filter(q => q.passageLabel === passage.label);
    data.activePassage = passage;
    data.activeQuestions = related;
    this.activeData = data;
    const label = this.esc(passage.label || '阅读材料');

    /* 阅读题绝大多数是四选一，但个别年份的开放题没有 options，
       退化成文本域也要能存草稿，所以 data-topic-q 一定要带上。 */
    const questions = this.questionsHtml(section, related, answers, '问题', (q, value, key) =>
      `<p>${this.text(q.stem || '')}</p><div class="topic-options">`
      + (this.optionsHtml(q, value)
        || `<textarea class="topic-free" data-topic-q="${key}" placeholder="写下你的答案"></textarea>`)
      + '</div>');

    this.workspacePage({
      brand: '阅读专题训练', brandNote: '完整材料 · 完成后统一复盘',
      kicker: 'READING STUDIO · FULL PASSAGE',
      headline: '一篇文章，<em>完整做完。</em>',
      lead: '先像考试一样完成整组问题，不在途中公布答案。提交后，我们再一起看每道题分别调用了什么方法。',
      metaItems: [this.esc(meta.title), `${related.length} 道阅读题`, '建议先独立完成'],
      progress: this.progressBar('当前材料', label, related.length, 'data-topic-change', '更换文章'),
      paper: { label, title: this.esc(meta.title), text: this.text(passage.text) },
      panelTitle: '整组问题', panelNote: '暂不显示答案',
      questions, submitAttr: 'data-topic-submit',
      note: '提交后将显示：总正确率、各题型任务、错题原因和下一步建议。',
    });

    this.bindAutosave(data, 'input[name^="topic-"], [data-topic-q]', 'input', related);
    this.bindAutosave(data, 'input[name^="topic-"]', 'change', related);
    this.bindClick('[data-topic-submit]', () => this.submit(data));
    this.bindClick('[data-topic-change]', () => this.start(App.exams));
  },

  submit(data) { this.submitObjective(data, 'reading', this.report); },

  report(data, record) {
    const { meta } = data;
    const good = this.pct(record) >= 80;
    this.reportPage({
      title: '阅读专题复盘', kicker: 'READING', key: 'reading',
      headline: '这篇文章，<em>复盘完成。</em>',
      sub: `${this.esc(meta.title)} · ${record.total} 道题`,
      score: this.scoreBlock(record),
      advice: good
        ? '整体完成得不错，下一步练速度和稳定性。'
        : '先别只看分数，找出自己卡在解题链条的哪一步。',
      adviceBody: good
        ? '你可以进入下一篇阅读专题，尝试减少回看次数。'
        : '建议回到分题型训练，重点复习“题干任务 → 原文证据 → 选项比较”这条路径。',
      listTitle: '逐题复盘',
      rows: this.objectiveRows(data, record, {
        unit: '问题', okText: '思路暂时通过', badText: '建议回看这一步',
        answerFallback: '见参考表达', summary: '查看本题基础解析',
      }),
      ctaLabel: '回到分题型教学',
    });
  },
  /* =============== ② 听力专题 =============== */
  /* 作答阶段刻意不给文字稿（版式是 topic-question-only）——
     一上来就能看到原文，这个专题就退化成阅读了。 */

  async startListening(exams) {
    this.renderLoading('听力专题', '正在准备一组听力材料');
    const candidates = await this.loadCandidates(exams, exam => {
      const s = exam.sections.find(x => x.key === 'listening' && x.questions?.length
        && x.questions.some(q => q.transcript));
      return s ? [s] : [];
    });
    if (!candidates.length) {
      return this.emptyState('听力专题', '暂时没有可用的听力材料', 'listening', '进入听力教学');
    }
    this.renderListeningPicker(candidates);
  },

  renderListeningPicker(candidates) {
    const cards = candidates.map(data => this.choiceCard(
      `data-listening-choice="${this.esc(data.meta.id)}"`, 'listening-choice',
      this.metaLine(data.meta), '听力整组训练',
      `${data.section.questions.length} 道题 · 听前预测与听后核对`,
      this.topicDraftFlag(data))).join('');

    this.pickerPage({
      title: '听力专题', kicker: 'LISTENING STUDIO · CHOOSE A PAPER',
      headline: '先听懂信息，<em>再完成整组题。</em>',
      lead: '先看题目预测场景，作答时不显示原文；提交后再逐题打开听力原文，复盘关键信息。',
      cards,
    });

    document.querySelectorAll('[data-listening-choice]').forEach(btn => btn.onclick = () =>
      this.renderListening(candidates.find(x => x.meta.id === btn.dataset.listeningChoice)));
  },

  renderListening(data, answers = this.loadTopicAnswers(data)) {
    const { meta, section } = data;
    const questions = this.questionsHtml(section, section.questions, answers, '问题', (q, value) =>
      `<p>${this.text(q.stem || '')}</p>`
      + `<div class="topic-options">${this.optionsHtml(q, value)}</div>`);

    this.workspacePage({
      variant: 'listening-workspace',
      brand: '听力专题训练', brandNote: '先预测 · 再作答 · 最后复盘',
      kicker: 'LISTENING STUDIO · FULL SET',
      headline: '先听懂信息，<em>再判断选项。</em>',
      lead: '作答阶段只保留题干与选项，提交后才逐题显示原文，避免一开始依赖文字。',
      metaItems: [this.esc(meta.title), `${section.questions.length} 道听力题`, '建议先独立完成'],
      progress: this.progressBar('当前试卷', '听力整组', section.questions.length,
        'data-listening-change', '更换试卷'),
      panelTitle: '整组问题', panelNote: '暂不显示听力原文',
      questions, submitAttr: 'data-listening-submit',
      note: '提交后将显示：正确率、逐题原文、答案和听力策略建议。',
    });

    this.bindAutosave(data, 'input[name^="topic-"]', 'change');
    this.bindClick('[data-listening-submit]', () => this.submitListening(data));
    this.bindClick('[data-listening-change]', () => this.startListening(App.exams));
  },

  submitListening(data) { this.submitObjective(data, 'listening', this.reportListening); },

  reportListening(data, record) {
    const { meta } = data;
    const good = this.pct(record) >= 80;
    this.reportPage({
      title: '听力专题复盘', kicker: 'LISTENING', key: 'listening',
      headline: '这一组听力，<em>复盘完成。</em>',
      sub: `${this.esc(meta.title)} · ${record.total} 道题`,
      score: this.scoreBlock(record),
      advice: good
        ? '整体完成得不错，下一步练习预测和速度。'
        : '先回看错题原文，找出是没听到、没听懂，还是被干扰项带走。',
      adviceBody: good
        ? '可以换一套听力，先读选项再开始作答。'
        : '建议回到分题型训练，重点复习“读选项预测 → 抓关键信息 → 排除干扰”。',
      listTitle: '逐题听后复盘',
      /* 听力的详情区放文字稿：错在哪一句，只有对着原文才看得出来。
         解析走 explanationHtml —— 题库里听力解析同样是结构化对象，
         原来用 text() 会整段渲染成 "[object Object]"。 */
      rows: this.objectiveRows(data, record, {
        unit: '问题', extraClass: 'listening-review',
        okText: '信息捕捉通过', badText: '建议回听并定位线索',
        detail: q => '<details><summary>查看听力原文与复盘提示</summary>'
          + `<p>${this.text(q.transcript || '暂无文字稿')}</p>`
          + (q.explanation
            ? `<p><b>基础解析：</b></p>${UI.explanationHtml(q.explanation)}`
            : '')
          + '</details>',
      }),
      ctaLabel: '回到听力教学',
    });
  },
  /* =============== ③ 完形专题 =============== */

  async startCloze(exams) {
    this.renderLoading('完形专题', '正在准备一篇完整语篇');
    const candidates = await this.loadCandidates(exams, exam => this.passageSection(exam, 'cloze'));
    if (!candidates.length) {
      return this.emptyState('完形专题', '暂时没有可用的完形材料', 'cloze', '进入完形教学');
    }
    this.renderClozePicker(candidates);
  },

  renderClozePicker(candidates) {
    const cards = candidates.map(data => this.choiceCard(
      `data-cloze-choice="${this.esc(data.meta.id)}"`, 'cloze-choice',
      this.metaLine(data.meta),
      this.esc(data.section.passages[0].label || '完形语篇'),
      `${data.section.questions.length} 道题 · 完整语篇训练`,
      this.topicDraftFlag(data))).join('');

    this.pickerPage({
      title: '完形专题', kicker: 'CLOZE STUDIO · CHOOSE A TEXT',
      headline: '一篇语篇，<em>完整做完。</em>',
      lead: '先通读文章把握主线，再连续完成所有空格，提交后统一查看上下文逻辑。',
      cards,
    });

    document.querySelectorAll('[data-cloze-choice]').forEach(btn => btn.onclick = () =>
      this.renderCloze(candidates.find(x => x.meta.id === btn.dataset.clozeChoice)));
  },

  renderCloze(data, answers = this.loadTopicAnswers(data)) {
    const { meta, section } = data;
    const passage = section.passages[0];
    this.activeData = data;

    this.workspacePage({
      brand: '完形专题训练', brandNote: '完整语篇 · 完成后统一复盘',
      kicker: 'CLOZE STUDIO · FULL TEXT',
      headline: '先读懂主线，<em>再填每一空。</em>',
      lead: '先像考试一样通读和作答，不在途中公布答案。提交后，我们再一起看每个空格依赖了什么上下文。',
      metaItems: [this.esc(meta.title), `${section.questions.length} 道完形题`, '建议先独立完成'],
      progress: this.progressBar('当前语篇', '完形填空', section.questions.length,
        'data-cloze-change', '更换语篇'),
      paper: { label: '完整语篇', title: this.esc(meta.title), text: this.text(passage.text) },
      panelTitle: '整组空格', panelNote: '暂不显示答案',
      questions: this.questionsHtml(section, section.questions, answers, '空格',
        (q, value) => this.choiceInner(q, value)),
      submitAttr: 'data-cloze-submit',
      note: '提交后将显示：总正确率、上下文逻辑和逐题基础解析。',
    });

    this.bindAutosave(data, 'input[name^="topic-"]', 'change');
    this.bindClick('[data-cloze-submit]', () => this.submitCloze(data));
    this.bindClick('[data-cloze-change]', () => this.startCloze(App.exams));
  },

  submitCloze(data) { this.submitObjective(data, 'cloze', this.reportCloze); },

  reportCloze(data, record) {
    const { meta } = data;
    const good = this.pct(record) >= 80;
    this.reportPage({
      title: '完形专题复盘', kicker: 'CLOZE', key: 'cloze',
      headline: '这篇语篇，<em>复盘完成。</em>',
      sub: `${this.esc(meta.title)} · ${record.total} 道题`,
      score: this.scoreBlock(record),
      advice: good
        ? '整体完成得不错，下一步练习速度与语篇连贯性。'
        : '不要只背答案，回看每个空格依赖的是哪一句上下文。',
      adviceBody: good
        ? '可以换一篇新语篇，尝试减少回读。'
        : '建议回到分题型训练，重点复习“通读主线 → 定位语境 → 比较选项 → 回读验证”。',
      listTitle: '逐空复盘',
      rows: this.objectiveRows(data, record, {
        unit: '空格', okText: '上下文判断通过', badText: '建议回看语篇',
        summary: '查看本题基础解析',
      }),
      ctaLabel: '回到完形教学',
    });
  },
  /* =============== ④ 七选五专题 =============== */
  /* 七选五、语法填空、短文改错一份卷只有一篇语篇，换材料等于换卷，
     所以这三个专题的作答页没有「更换材料」条。 */

  async startSeven(exams) {
    this.renderLoading('七选五专题', '正在准备一篇完整语篇');
    const candidates = await this.loadCandidates(exams, exam => this.passageSection(exam, 'seven'));
    if (!candidates.length) {
      return this.emptyState('七选五专题', '暂时没有可用的七选五材料', 'seven', '进入七选五教学');
    }
    this.renderSevenPicker(candidates);
  },

  renderSevenPicker(candidates) {
    const cards = candidates.map((data, i) => this.choiceCard(
      `data-seven-choice="${i}"`, 'seven-choice',
      this.metaLine(data.meta, true),
      this.esc(data.section.passages[0].label || '七选五语篇'),
      `${data.section.questions.length} 道题 · 完整语篇训练`,
      this.topicDraftFlag(data))).join('');

    this.pickerPage({
      title: '七选五专题', kicker: 'SEVEN CHOICE · FULL TEXT',
      headline: '先读语篇，<em>再补全结构。</em>',
      lead: '先通读文章把握段落逻辑，再完成所有空格。提交后统一回看上下文证据与段落衔接。',
      cards,
    });

    document.querySelectorAll('[data-seven-choice]').forEach(btn => btn.onclick = () =>
      this.renderSeven(candidates[Number(btn.dataset.sevenChoice)]));
  },

  renderSeven(data, answers = this.loadTopicAnswers(data)) {
    const { meta, section } = data;
    const passage = section.passages[0];

    this.workspacePage({
      variant: 'seven-workspace',
      brand: '七选五专题训练', brandNote: '完整语篇 · 结构衔接 · 统一复盘',
      kicker: 'SEVEN CHOICE · FULL TEXT',
      headline: '先看段落关系，<em>再补全空格。</em>',
      lead: '不要只找单句线索，先判断每个空在段落中的功能，再用上下文证据核对选项。',
      metaItems: [this.esc(meta.title), `${section.questions.length} 道七选五题`, '建议先独立完成'],
      paper: {
        label: '完整语篇', title: this.esc(passage.label || meta.title),
        text: this.text(passage.text),
      },
      panelTitle: '整组空格', panelNote: '暂不显示答案',
      questions: this.questionsHtml(section, section.questions, answers, '空格',
        (q, value) => this.choiceInner(q, value)),
      submitAttr: 'data-seven-submit',
      note: '提交后将显示：正确率、上下文证据和段落衔接提示。',
    });

    this.bindAutosave(data, 'input[name^="topic-"]', 'change');
    this.bindClick('[data-seven-submit]', () => this.submitSeven(data));
  },

  submitSeven(data) { this.submitObjective(data, 'seven', this.reportSeven); },

  reportSeven(data, record) {
    const { meta } = data;
    this.reportPage({
      title: '七选五专题复盘', kicker: 'SEVEN CHOICE', key: 'seven',
      headline: '这篇语篇，<em>结构复盘完成。</em>',
      sub: `${this.esc(meta.title)} · ${record.total} 道题`,
      score: this.scoreBlock(record),
      advice: this.pct(record) >= 80
        ? '段落逻辑掌握得不错，下一步练速度和整体结构。'
        : '先回看每个空前后的句子，确认它在段落中承担什么功能。',
      adviceBody: '建议复述：先看段落主旨，再看空格功能，最后用代词、复现词和逻辑词核对。',
      listTitle: '逐空复盘',
      rows: this.objectiveRows(data, record, {
        unit: '空格', okText: '段落衔接通过', badText: '建议回看前后段落',
        summary: '查看本题解析',
      }),
      ctaLabel: '回到七选五教学',
    });
  },

  /* =============== ⑤ 语法填空专题 =============== */
  /* 唯一用文本框而非单选的判分专题：答案是词形，判分仍按去空白 +
     忽略大小写比对，拼写错误会算错——这与真实评分一致。 */

  async startGrammar(exams) {
    this.renderLoading('语法填空专题', '正在准备一篇完整语篇');
    const candidates = await this.loadCandidates(exams, exam => this.passageSection(exam, 'grammar'));
    if (!candidates.length) {
      return this.emptyState('语法填空专题', '暂时没有可用的语法填空材料', 'grammar', '进入语法填空教学');
    }
    this.renderGrammarPicker(candidates);
  },

  renderGrammarPicker(candidates) {
    const cards = candidates.map((data, i) => this.choiceCard(
      `data-grammar-choice="${i}"`, 'grammar-choice',
      this.metaLine(data.meta, true),
      this.esc(data.section.passages[0].label || '语法填空语篇'),
      `${data.section.questions.length} 个空格 · 完整语篇训练`,
      this.topicDraftFlag(data))).join('');

    this.pickerPage({
      title: '语法填空专题', kicker: 'GRAMMAR STUDIO · FULL TEXT',
      headline: '先读懂语篇，<em>再判断词形。</em>',
      lead: '先通读文章理解语境，再完成每个空格。提交后统一复盘词性、词形、时态和固定搭配。',
      cards,
    });

    document.querySelectorAll('[data-grammar-choice]').forEach(btn => btn.onclick = () =>
      this.renderGrammar(candidates[Number(btn.dataset.grammarChoice)]));
  },

  renderGrammar(data, answers = this.loadTopicAnswers(data)) {
    const { meta, section } = data;
    const passage = section.passages[0];

    this.workspacePage({
      variant: 'grammar-workspace',
      brand: '语法填空专题训练', brandNote: '完整语篇 · 词形判断 · 统一复盘',
      kicker: 'GRAMMAR STUDIO · FULL TEXT',
      headline: '先看语境，<em>再填写词形。</em>',
      lead: '先判断空格在句中的作用，再检查词性、单复数、时态、语态和固定搭配。',
      metaItems: [this.esc(meta.title), `${section.questions.length} 个语法空格`, '建议先独立完成'],
      paper: {
        label: '完整语篇', title: this.esc(passage.label || meta.title),
        text: this.text(passage.text),
      },
      panelTitle: '整组空格', panelNote: '暂不显示答案',
      questions: this.questionsHtml(section, section.questions, answers, '空格',
        (q, value, key) => this.stemBlock(q)
          + `<input class="topic-free grammar-input" data-topic-q="${this.esc(key)}" `
          + `value="${this.esc(value)}" placeholder="填写适当的词或词形">`),
      submitAttr: 'data-grammar-submit',
      note: '提交后将显示：正确率、答案、逐空解析和词形判断提示。',
    });

    this.bindAutosave(data, '[data-topic-q]', 'input');
    this.bindClick('[data-grammar-submit]', () => this.submitGrammar(data));
  },

  submitGrammar(data) { this.submitObjective(data, 'grammar', this.reportGrammar); },

  reportGrammar(data, record) {
    const { meta } = data;
    this.reportPage({
      title: '语法填空专题复盘', kicker: 'GRAMMAR', key: 'grammar',
      headline: '这篇语篇，<em>词形复盘完成。</em>',
      sub: `${this.esc(meta.title)} · ${record.total} 个空格`,
      score: this.scoreBlock(record),
      advice: this.pct(record) >= 80
        ? '词形判断比较稳定，下一步练习速度和语篇理解。'
        : '先定位每个空在句中的成分，再判断词性与词形。',
      adviceBody: '建议复述：先读语境 → 判断句法位置 → 确认词性 → 检查时态、数和搭配。',
      listTitle: '逐空复盘',
      rows: this.objectiveRows(data, record, {
        unit: '空格', okText: '词形判断通过', badText: '建议回看句法位置',
        summary: '查看本题解析',
      }),
      ctaLabel: '回到语法填空教学',
    });
  },
  /* =============== ⑥ 短文改错专题 =============== */
  /* 唯一不自动判分的判分类专题：答案是「删去 X / 把 A 改为 B」这类动作
     描述，写法千变万化，机器比对只会给出假的对错。所以落盘时
     correct: null、manual: true，复盘页并排给出参考批改让学生自判。 */

  async startProofreading(exams) {
    this.renderLoading('短文改错专题', '正在准备短文改错材料');
    const candidates = await this.loadCandidates(exams, exam => {
      const s = exam.sections.find(x => x.key === 'proofreading' && x.questions?.length);
      return s ? [s] : [];
    });
    if (!candidates.length) {
      return this.emptyState('短文改错专题', '暂时没有可用的短文改错材料',
        'proofreading', '进入短文改错教学');
    }
    this.renderProofreadingPicker(candidates);
  },

  renderProofreadingPicker(candidates) {
    const cards = candidates.map((data, i) => this.choiceCard(
      `data-proofreading-choice="${i}"`, 'proofreading-choice',
      this.metaLine(data.meta, true), '短文改错专项复盘',
      '10 处错误 · 规范批改格式 · 参考解析')).join('');

    this.pickerPage({
      title: '短文改错专题', kicker: 'PROOFREADING · REVIEW STUDIO',
      headline: '先找出错误，<em>再写清修改动作。</em>',
      lead: '按“删去、增加、把原词改为新词”的规范格式完成批改。网站不把它当普通选择题自动评分。',
      cards,
    });

    document.querySelectorAll('[data-proofreading-choice]').forEach(btn => btn.onclick = () =>
      this.renderProofreading(candidates[Number(btn.dataset.proofreadingChoice)]));
  },

  /* 与整卷页共用 UI.proofreadingItems：modelAnswer 十行参考与
     explanation.points 十条解析对齐，缺行取最大值补空，单一数据源。 */
  proofreadingItems(q) { return UI.proofreadingItems(q); },

  /* 改错的答案键是 proofreading-<序号>，与题号无关（一道大题十处批改），
     所以不能复用 collect()。 */
  collectProof(items) {
    const answers = {};
    items.forEach(it => {
      const key = `proofreading-${it.n}`;
      answers[key] = document.querySelector(`[data-proof-q="${key}"]`)?.value || '';
    });
    return answers;
  },

  renderProofreading(data, answers = this.loadTopicAnswers(data)) {
    const { meta, section } = data;
    const q = section.questions[0];
    const items = this.proofreadingItems(q);
    const savedSelf = this.loadProofSelf(data);

    const questions = items.map((it, i) => {
      const key = `proofreading-${it.n}`;
      return `<article class="topic-question" id="topic-proof-${it.n}">`
        + `<div class="topic-q-head"><span>批改 ${String(i + 1).padStart(2, '0')}</span>`
        + `<b>第 ${it.n} 处</b></div>`
        + `<div class="topic-q-stem"><b>找出并修改第 ${it.n} 处错误</b></div>`
        + `<input class="topic-free" data-proof-q="${this.esc(key)}" `
        + `value="${this.esc(answers[key] || '')}" `
        + 'placeholder="如：把‘原词’改为‘新词’ / 删去‘某词’ / 在‘前词’和‘后词’之间加上‘所加词’">'
        + UI.proofMethodsHtml('proof-methods-sub') + '</article>';
    }).join('');

    this.workspacePage({
      variant: 'proofreading-workspace',
      brand: '短文改错专题训练', brandNote: '完整语篇 · 逐处批改 · 统一复盘',
      kicker: 'PROOFREADING STUDIO · FULL TEXT',
      headline: '先找出错误，<em>再写清动作。</em>',
      lead: '按“删去、增加、把原词改为新词”的规范格式完成批改。提交后统一复盘每一处。',
      metaItems: [this.esc(meta.title), `${items.length} 处错误`, '建议先独立完成'],
      paper: {
        label: '原文', title: this.esc(meta.title),
        text: this.text(q.material || q.stem || ''),
      },
      panelTitle: '逐处批改', panelNote: '暂不显示答案',
      questions, submitAttr: 'data-proofreading-submit',
      note: savedSelf.length
        ? '<div class="proof-self-banner">上次自评：' + this.proofSelfSummaryText(savedSelf) + '</div>'
        : '提交后将显示：参考批改格式、逐处解析和动作判断提示。',
    });

    document.querySelectorAll('[data-proof-q]').forEach(input => input.addEventListener('input',
      () => this.saveTopicAnswers(data, this.collectProof(items))));
    this.bindClick('[data-proofreading-submit]', () => this.submitProofreading(data, items));
  },

  submitProofreading(data, items) {
    const answers = this.collectProof(items);
    this.saveTopicResult(data, 'proofreading', {
      examId: data.meta.id, title: data.meta.title, completedAt: Date.now(),
      correct: null, total: items.length, manual: true,
    });
    this.reportProofreading(data, items, answers);
  },

  reportProofreading(data, items, answers) {
    const rows = items.map((it, i) => `<article class="topic-review-row">`
      + `<div><span>批改 ${String(i + 1).padStart(2, '0')}</span><b>第 ${it.n} 处</b></div>`
      + `<p class="proof-mine"><b>你的批改：${this.esc(answers[`proofreading-${it.n}`] || '未填写')}</b></p>`
      + `<p class="proof-ref"><b>参考批改：${this.esc(it.model)}</b></p>`
      + (it.analysis
        ? `<details><summary>查看本题解析</summary>`
          + `<div class="explanation">${this.esc(it.analysis)}</div></details>`
        : '')
      + `<div class="proof-self" data-proof-self-row="${it.n}">`
        + '<span class="proof-self-label">我的判断：</span>'
        + '<button class="proof-self-btn" data-proof-self="right" data-n="' + it.n + '">改对</button>'
        + '<button class="proof-self-btn" data-proof-self="missed" data-n="' + it.n + '">漏改</button>'
        + '<button class="proof-self-btn" data-proof-self="wrong" data-n="' + it.n + '">改错</button>'
        + '</div>'
      + '</article>').join('');

    this.reportPage({
      title: '短文改错专题复盘', kicker: 'PROOFREADING', key: 'proofreading',
      headline: '这篇短文，<em>复盘完成。</em>',
      sub: `${this.esc(data.meta.title)} · ${items.length} 处批改`,
      score: `<b>人工</b><span>/ ${items.length} 处批改</span><strong>复核</strong>`,
      advice: '这类题先判断错误动作，再确认具体词语。',
      adviceBody: '建议按顺序复盘：通读语篇 → 定位异常 → 判断删/加/改 → 检查格式与拼写。',
      listTitle: '逐处复盘', rows, ctaLabel: '回到短文改错教学',
    });

    /* 短文改错自评：每处由学生自判「改对 / 漏改 / 改错」，存独立键，
       不进 gkyy_records_v1，因此不影响 #15 的导出/合并。 */
    const selfState = this.loadProofSelf(data);
    const applySummary = () => {
      const list = document.querySelector('.topic-review-list');
      if (!list) return;
      let sum = list.querySelector('.proof-self-summary');
      if (!sum) {
        sum = document.createElement('div');
        sum.className = 'proof-self-summary';
        list.appendChild(sum);
      }
      sum.textContent = '本次自评：' + this.proofSelfSummaryText(selfState);
    };
    const markActive = () => {
      document.querySelectorAll('[data-proof-self]').forEach(btn => {
        const rec = selfState.find(x => String(x.n) === String(btn.dataset.n));
        btn.classList.toggle('is-active', !!rec && rec.verdict === btn.dataset.proofSelf);
      });
    };
    document.querySelectorAll('[data-proof-self]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = selfState.findIndex(x => String(x.n) === String(btn.dataset.n));
        if (idx >= 0) {
          if (selfState[idx].verdict === btn.dataset.proofSelf) selfState.splice(idx, 1);
          else selfState[idx].verdict = btn.dataset.proofSelf;
        } else {
          selfState.push({ n: Number(btn.dataset.n), verdict: btn.dataset.proofSelf });
        }
        this.saveProofSelf(data, selfState);
        markActive();
        applySummary();
      });
    });
    markActive();
    applySummary();
  },

  /* 短文改错自评的存取与汇总。独立键，绕开 Store，避免触碰 #15 合并。 */
  proofSelfKey(data) {
    return `gaokao_proof_self_${data.meta.id}_${data.section.key}`;
  },
  loadProofSelf(data) {
    try { return JSON.parse(localStorage.getItem(this.proofSelfKey(data)) || '[]') || []; }
    catch { return []; }
  },
  saveProofSelf(data, arr) {
    localStorage.setItem(this.proofSelfKey(data), JSON.stringify(arr));
  },
  proofSelfSummaryText(arr) {
    let right = 0, missed = 0, wrong = 0;
    arr.forEach(x => {
      if (x.verdict === 'right') right++;
      else if (x.verdict === 'missed') missed++;
      else if (x.verdict === 'wrong') wrong++;
    });
    return `改对 ${right} · 漏改 ${missed} · 改错 ${wrong}`;
  },
  /* =============== ⑦ 写作专题 =============== */
  /* 与前六个专题不同构：写作没有可判分的答案，本站只做三件事 ——
     提供任务、保存草稿、生成一段可复制的点评提示词。
     文章绝不自动上传：复制之后由学生自己粘贴、自己发送。 */

  startWriting(exams) { this.renderWritingPicker(exams); },

  /* 深链：整卷页的写作题点「去自评」跳到这里（#/writing/<examId>/<sectionKey>）。
     两个页面的草稿本来各存各的 —— 整卷页写过的作文存在答题草稿里，
     专题存在独立键里。学生刚在整卷里辛辛苦苦写完一篇，跳过来却是一片空白，
     那这个入口就等于逼人重抄一遍。所以进来先尝试接管（见 takeOverDraft）。 */
  async openWritingTask(exams, examId, sectionKey) {
    this.renderLoading('写作专题', '正在准备这道写作任务');
    try {
      const meta = (exams || []).find(e => e.id === examId);
      if (!meta) {
        return this.emptyState('写作专题', '没有找到这套试卷', 'writing_app', '进入写作专题');
      }
      const exam = await loadExamData(meta);
      const section = (exam.sections || []).find(
        s => s.key === sectionKey && WRITING_SECTION_KEYS.includes(s.key) && s.questions?.length);
      if (!section) {
        return this.emptyState('写作专题', '这套卷子没有这道写作题', 'writing_app', '进入写作专题');
      }
      this.renderWriting({ meta, exam, section }, this.takeOverDraft(meta, section));
    } catch (err) {
      App.renderError(err);
    }
  },

  /* 从整卷那边把作文接过来。整卷的作答键形如 '<sectionKey>-<qid>'：
     进行中的存在 SaveDraft（drafts[examId]），已交卷的存在答卷记录里。
     优先取未交卷的草稿 —— 那是学生此刻正在写的那一篇。
     返回 null 表示整卷那边也是空的，没什么可接管。 */
  takeOverDraft(meta, section) {
    const q = section.questions[0];
    const key = `${section.key}-${q.id}`;
    const pick = v => (v && String(v).trim()) ? String(v) : null;
    return pick(Store.getDraft(meta.id)[key]) || pick(Store.getRecord(meta.id)?.answers?.[key]);
  },

  /* 文章类型只能从题干措辞反推（题库没有这个字段）。用途仅是选材页的
     分组筛选，判错不影响做题，所以按关键词优先级从窄到宽依次匹配。 */
  writingType(data) {
    const key = data.section.key;
    const stem = String(data.section.questions?.[0]?.stem || '');
    if (key === 'writing_cont') return '读后续写';
    if (key === 'proofreading') return '短文改错';
    if (/邮件|email|信|邀请|回复|通知|申请|倡议|建议/.test(stem)) return '应用文·书信通知';
    if (/图表|调查|数据|百分比|报告/.test(stem)) return '应用文·图表报告';
    if (/投稿|征文|短文/.test(stem)) return '应用文·短文投稿';
    return '应用文·任务写作';
  },

  async renderWritingPicker(exams) {
    const candidates = await this.loadCandidates(exams, exam => exam.sections.filter(
      s => WRITING_SECTION_KEYS.includes(s.key) && s.questions?.length));
    if (!candidates.length) {
      return this.emptyState('写作专题', '暂时没有可用的写作任务', 'writing_app', '进入写作教学');
    }

    const typed = candidates.map((data, index) => ({ data, index, type: this.writingType(data) }));
    const groups = ['应用文写作', '读后续写', '短文改错'];
    /* 「应用文写作」是一组（书信/图表/投稿/任务四个细分类型），其余两组是精确匹配。 */
    const matchesGroup = (type, group) =>
      group === '应用文写作' ? type.startsWith('应用文') : type === group;

    const tabs = groups.map((group, index) => '<button class="writing-filter '
      + `${index === 0 ? 'is-active' : ''}" data-writing-filter="${this.esc(group)}">${group}`
      + `<span>${typed.filter(item => matchesGroup(item.type, group)).length}</span></button>`).join('');

    const cards = typed.map(({ data, index, type }) => this.choiceCard(
      `data-writing-choice="${index}" data-writing-type="${this.esc(type)}"`, 'writing-choice',
      this.metaLine(data.meta, true),
      this.esc(data.section.partTitle || type),
      `${this.esc(type)} · 第 ${data.section.questions[0].id} 题 · 写作任务与外部点评`)).join('');

    /* 范文页的入口。短文改错没有范文（它按「改对几处」计分），
       所以这里的篇数只数应用文与读后续写这两类。 */
    const modelCount = typed.filter(item =>
      item.data.section.key === 'writing_app' || item.data.section.key === 'writing_cont').length;

    this.pickerPage({
      title: '写作专题', kicker: 'WRITING STUDIO · DRAFT REVIEW',
      headline: '先完成文章，<em>再获得点评。</em>',
      lead: '先按文章类型选择练习，再进入草稿、点评与修改复盘。年份、卷型和考试地区均保留在题卡中。',
      extra: '<div class="writing-models-entry"><a href="#/writing/models">'
        + '<b>历年参考范文 →</b>'
        + `<span>${modelCount} 篇考场范文，按题型分类、可搜索、可对照自己的文章</span></a></div>`
        + `<nav class="writing-filters" aria-label="文章类型筛选">${tabs}</nav>`,
      cards,
    });

    /* 筛选用 hidden 而非重渲染：卡片里可能已有输入焦点，重建会打断操作。 */
    const filterCards = group => document.querySelectorAll('[data-writing-choice]')
      .forEach(btn => btn.hidden = !matchesGroup(btn.dataset.writingType, group));

    document.querySelectorAll('[data-writing-filter]').forEach(btn => btn.onclick = () => {
      document.querySelectorAll('[data-writing-filter]')
        .forEach(item => item.classList.toggle('is-active', item === btn));
      filterCards(btn.dataset.writingFilter);
    });
    document.querySelectorAll('[data-writing-choice]').forEach(btn => btn.onclick = () =>
      this.renderWriting(candidates[Number(btn.dataset.writingChoice)]));
    filterCards('应用文写作');
  },

  /* 写作草稿不走 Store：内容是整篇作文（可能上千字），与答题草稿的
     体量、生命周期都不同，单独一个 localStorage 键更好清理。 */
  writingDraftKey(data, q) {
    return `gaokao_writing_draft_${data.meta.id}_${data.section.key}_${q.id}`;
  },

  renderWriting(data, takeover = null) {
    const q = data.section.questions[0];
    const draftKey = this.writingDraftKey(data, q);
    const saved = JSON.parse(localStorage.getItem(draftKey) || '{}');
    const sc = saved.selfCheck || {};
    /* 从整卷页跳进来、专题里还没有草稿：把整卷那篇接过来并立刻落盘。
       只提示不落盘不行 —— 学生看一眼、切走，作文就又回到整卷那边去了。 */
    const tookOver = !saved.draft && !!takeover;
    if (tookOver) {
      saved.draft = takeover;
      localStorage.setItem(draftKey, JSON.stringify({
        draft: takeover, feedback: saved.feedback || '',
        selfCheck: saved.selfCheck || {}, savedAt: Date.now(),
      }));
    }
    const requiredWords = (() => {
      const m = String(q.stem || q.prompt || '').match(/(\d+)\s*词/);
      return m ? Number(m[1]) : null;
    })();

    const prompt = q.stem || q.prompt || q.text || '请根据原题要求完成写作。';
    const status = tookOver
      ? '已把你在整卷里写的作文接到这里。确认后点「保存草稿」，再复制点评材料。'
      : (saved.draft
        ? '已恢复上次草稿。'
        : '点击“复制点评材料”后，粘贴到 DeepSeek 对话框即可。');

    const task = '<section class="writing-task-card"><div class="topic-paper-label">写作任务</div>'
      + `<h2>${this.esc(data.section.partTitle || '写作任务')}</h2>`
      + `<div class="topic-passage">${this.text(prompt)}</div>`
      + '<textarea class="writing-draft" data-writing-draft '
      + `placeholder="在这里粘贴或输入你的作文内容">${this.esc(saved.draft || '')}</textarea>`
      + '<div class="writing-toolbar"><span>草稿只保存在当前浏览器。</span>'
      + '<button class="ghost-btn" data-writing-save>保存草稿</button>'
      + '<button class="primary-btn" data-writing-copy>复制点评材料</button>'
      + '<a class="ghost-btn" href="https://chat.deepseek.com/" target="_blank" '
      + 'rel="noopener noreferrer">打开网页版 DeepSeek</a></div>'
      + `<p class="writing-copy-status" data-writing-status>${status}</p></section>`;

    const guide = '<section class="writing-review-guide"><b>点评完成后，回到这里记录结果</b>'
      + '<textarea class="writing-feedback" data-writing-feedback '
      + 'placeholder="可粘贴 DeepSeek 的关键点评，或记录自己准备修改的 3 个地方">'
      + `${this.esc(saved.feedback || '')}</textarea>`
      + '<div class="writing-toolbar">'
      + '<button class="ghost-btn" data-writing-feedback-save>保存复盘记录</button>'
      + '<span>复盘记录也只保存在当前浏览器。</span></div>'
      + '<div class="writing-privacy-note">隐私提醒：提交前请确认文章中没有姓名、学校、'
      + '联系方式等个人信息。外部网页的登录、发送和结果读取由学生自行完成。</div></section>';

    const dim = (label, field) => '<label class="selfcheck-dim"><span>' + label + '</span>'
      + '<select data-self-dim="' + field + '">'
      + '<option value=""' + (sc[field] ? '' : ' selected') + '>未评</option>'
      + '<option value="reach"' + (sc[field] === 'reach' ? ' selected' : '') + '>达标</option>'
      + '<option value="partial"' + (sc[field] === 'partial' ? ' selected' : '') + '>基本达标</option>'
      + '<option value="miss"' + (sc[field] === 'miss' ? ' selected' : '') + '>待加强</option>'
      + '</select></label>';
    const selfCheckSection = '<section class="writing-selfcheck"><b>对照点评，给自己的文章打个分</b>'
      + '<p class="writing-selfcheck-desc">四项各选一档；词数填实际字数。记录后下次打开自动恢复。</p>'
      + dim('要点覆盖', 'coverage') + dim('篇章连贯', 'coherence') + dim('语言准确', 'accuracy')
      + '<label class="selfcheck-wordcount">词数（实际）'
        + '<input type="number" min="0" data-self-wordcount value="' + (sc.wordcount || '') + '" placeholder="如 85"></label>'
      + (requiredWords ? '<span class="selfcheck-required">词数要求：约 ' + requiredWords + ' 词（自动识别）</span>' : '')
      + '<textarea class="writing-feedback" data-self-note placeholder="还想记一笔的：比如最想改的 1 处">'
        + this.esc(sc.note || '') + '</textarea>'
      + '<div class="writing-toolbar"><button class="ghost-btn" data-writing-selfcheck-save>保存自评</button>'
        + '<span>自评与草稿一起保存在当前浏览器。</span></div></section>';

    UI.app().innerHTML = `${UI.header('写作专题', true)}`
      + '<main class="writing-workspace program-page"><section class="program-hero">'
      + '<span class="reference-kicker">WRITING STUDIO · DRAFT REVIEW</span>'
      + '<h1>把文章交给点评助手，<em>但先由你确认。</em></h1>'
      + `<p>${this.esc(data.meta.title)} · 第 ${q.id} 题。网站只负责生成复制内容，不会自动上传学生文章。</p>`
      + `</section>${task}${guide}${selfCheckSection}</main>`;

    this.bindClick('[data-writing-copy]', () => this.copyWriting(data, draftKey));
    this.bindClick('[data-writing-save]', () => this.saveWritingDraft(draftKey));
    this.bindClick('[data-writing-feedback-save]', () => this.saveWritingDraft(draftKey));
    this.bindClick('[data-writing-selfcheck-save]', () => this.saveWritingDraft(draftKey));
  },

  saveWritingDraft(draftKey) {
    const draft = document.querySelector('[data-writing-draft]')?.value || '';
    const feedback = document.querySelector('[data-writing-feedback]')?.value || '';
    const selfCheck = this.collectWritingSelfCheck();
    localStorage.setItem(draftKey, JSON.stringify({ draft, feedback, selfCheck, savedAt: Date.now() }));
    const status = document.querySelector('[data-writing-status]');
    if (status) status.textContent = '草稿、复盘记录与自评已保存在当前浏览器。';
  },

  /* 收集写作自评：三档维度 + 实际词数 + 备注。空值写成 null，保持对象精简。 */
  collectWritingSelfCheck() {
    const dim = f => {
      const v = document.querySelector(`[data-self-dim="${f}"]`)?.value || '';
      return v || null;
    };
    const wcRaw = document.querySelector('[data-self-wordcount]')?.value;
    const wc = (wcRaw !== undefined && wcRaw !== '' && Number(wcRaw) > 0) ? Number(wcRaw) : null;
    const note = document.querySelector('[data-self-note]')?.value || '';
    return {
      coverage: dim('coverage'), coherence: dim('coherence'), accuracy: dim('accuracy'),
      wordcount: wc,
      note: note.trim() || null,
    };
  },

  /* 只写剪贴板，不发网络请求。提示词刻意要求「不要替我重写全文」——
     直接拿到成品作文对学生没有训练价值。 */
  async copyWriting(data, draftKey) {
    const draft = document.querySelector('[data-writing-draft]')?.value.trim();
    const status = document.querySelector('[data-writing-status]');
    if (!draft) {
      if (status) status.textContent = '请先输入或粘贴作文内容。';
      return;
    }
    this.saveWritingDraft(draftKey);

    const q = data.section.questions[0];
    const prompt = '请按高考英语写作评分标准点评下面这篇文章：先给总评，再分别分析任务完成、'
      + '语言准确性、词汇与句式、篇章结构，并指出 3 个最值得修改的地方。'
      + '不要直接替我重写全文，最后请给出可执行的修改顺序。\n\n'
      + `【试卷】${data.meta.title}\n【题目】${q.stem || q.prompt || ''}\n【学生文章】\n${draft}`;

    try {
      await navigator.clipboard.writeText(prompt);
      if (status) status.textContent = '点评材料已复制。请打开网页版 DeepSeek，粘贴后由你确认并发送。';
    } catch (_) {
      if (status) status.textContent = '浏览器未授权自动复制，请手动复制文章和点评提示词。';
    }
  },
};
