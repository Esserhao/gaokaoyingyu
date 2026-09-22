/* =====================================================================
   试卷库与入口页：首页、专题总览、真题模拟列表
   （输出必须与重构前逐字节一致，断行方式见 js/ui/base.js 顶部说明）
   ===================================================================== */

/* 专题总览的七张卡片。抽成命名字段的表，是因为原来写成位置数组
   ['path-teal','01','reading',…]，第 4、5 个元素是两段中文长句，
   一行 130 列往外撑，且读的人得数第几个位置才知道哪段是简介。

   no（序号）里写作卡是 '04'，与七选五重号 —— 原始设计就是这样，
   照原样保留：改它会让页面输出与重构前不一致，要修请单独提。 */
const TOPIC_CARDS = [
  { cls: 'path-teal', no: '01', key: 'reading', name: '阅读专题',
    desc: '完整文章 + 全部问题，训练信息定位、推理与主旨概括。', cta: '进入阅读专题' },
  { cls: 'path-blue', no: '02', key: 'listening', name: '听力专题',
    desc: '围绕一组听力材料，训练预测、捕捉和核对信息。', cta: '进入听力专题' },
  { cls: 'path-purple', no: '03', key: 'cloze', name: '完形专题',
    desc: '在完整语篇中训练上下文、词义和篇章逻辑。', cta: '进入完形专题' },
  { cls: 'path-amber', no: '04', key: 'seven', name: '七选五专题',
    desc: '在完整语篇中训练段落主旨、衔接线索和结构判断。', cta: '进入七选五专题' },
  { cls: 'path-teal', no: '05', key: 'grammar', name: '语法填空专题',
    desc: '在完整语篇中训练词性、词形、时态和固定搭配。', cta: '进入语法填空专题' },
  { cls: 'path-amber', no: '06', key: 'proofreading', name: '短文改错专题',
    desc: '用规范格式完成删、加、改，并对照逐处解析。', cta: '进入短文改错专题' },
  { cls: 'path-amber', no: '04', key: 'writing', name: '写作专题',
    desc: '从审题、列要点到成文，完成一个完整写作任务。', cta: '进入写作专题' },
];

/* 「继续练习」横幅只认这五个题型：写作与短文改错的草稿键格式不同，
   不参与草稿恢复。键名同 js/topic.js 的 topicDraftKey 第二段。 */
const RESUMABLE_TOPICS = {
  reading: '阅读', listening: '听力', cloze: '完形', seven: '七选五', grammar: '语法填空',
};

Object.assign(UI, {
  /* 未完成的专题草稿 → 统一的「可恢复」列表。
     专题总览的续做横幅（下方 topics）与学习总览的续做面板
     （js/ui/dashboard.js 的 dashContinue）原来各写一份筛选逻辑
     和各自一张题型表，两处要手动保持一致；现在收在这一个方法里，
     调用方各取所需字段。返回顺序即 topicDrafts 的键序，要按时间
     排序由调用方自己 sort。 */
  openTopicDrafts() {
    return Object.entries(Store._load().topicDrafts || {}).map(([key, d]) => {
      const type = key.split(':').find(s => RESUMABLE_TOPICS[s]);
      if (!type || !d || !d.answers) return null;
      const answered = UI.countAnswered(d.answers);
      if (!answered) return null;
      return {
        type, answered,
        label: RESUMABLE_TOPICS[type],
        route: '#/topic/' + type,
        examId: key.split(':')[0],
        updatedAt: d.updatedAt || 0,
      };
    }).filter(Boolean);
  },

  home(exams) {
    const years = [...new Set(exams.map(e => e.year))].sort((a, b) => b - a);

    const hero = '<main class="reference-home">'
      + this.referenceHeader({
          brand: '高考英语真题在线', brandNote: '学会方法，再把方法用进考试', brandHref: '#/',
        })
      + '<section class="reference-hero">'
      + '<span class="reference-kicker">GAOKAO ENGLISH · LEARN THE LOGIC</span>'
      + '<h1>不只做对，<br><em>还要知道为什么。</em></h1>'
      + '<p>从一道题的思考步骤，到一整套真题的考试状态。</p></section>';

    /* 原分类导航条（历年真题/分题型训练/专题训练/真题模拟）与四步路径
       卡指向完全相同的页面，同一页 6 个重复入口；升级版全站主导航
       （siteNav，随 referenceHeader 渲染）统一承载这些入口，此处不再
       重复。真题数量并入下方「历年真题」栏目标题。 */

    /* 四步学习路径（task.md §8.2）：00 知识体系（知识台阶）→ 01 题型方法
       → 02 完整材料应用 → 03 整卷检验。入口已由主导航承载，这排卡片
       保留作学习路径的叙述与引导。 */
    const path = '<section class="learning-path">'
      + '<div class="path-heading"><span class="reference-kicker">LEARNING PATH</span>'
      + '<h2>四步，从零基础到上考场</h2></div>'
      + '<div class="path-grid">'
      + '<a class="path-item path-amber" href="#/learn"><span>00</span><b>知识台阶</b>'
      + '<small>按台阶逐个吃透语法点，模糊到掌握看得见</small><strong>从零开始 →</strong></a>'
      + '<a class="path-item path-purple" href="#/training"><span>01</span><b>分题型训练</b>'
      + '<small>把一道题讲透，学会解题步骤</small><strong>先学方法 →</strong></a>'
      + '<a class="path-item path-teal" href="#/topics"><span>02</span><b>专题训练</b>'
      + '<small>在完整材料中应用方法</small><strong>进入专题 →</strong></a>'
      + '<a class="path-item path-blue" href="#/simulation"><span>03</span><b>真题考试模拟</b>'
      + '<small>按真实节奏完成整套试卷</small><strong>开始模拟 →</strong></a>'
      + '</div></section>';

    /* 这里用 div 而非 main：a11y.js 只认第一个 main 作为 landmark，
       嵌套第二个 main 会让读屏用户看到两个「主要内容」区。 */
    /* 做到一半的真题（2026-09-03）：改前首页完全看不出哪套卷有草稿，
       学生只能凭记忆去列表里找。横幅样式复用专题总览的续做条，
       最多列 5 套，更多的落到下方列表里看。 */
    const papersWithDraft = exams
      .map(e => ({ e, n: UI.countAnswered(Store.getDraft(e.id)) }))
      .filter(x => x.n > 0);
    const resumeBanner = papersWithDraft.length
      ? '<div class="topics-resume-banner">'
        + `<b>↻ 有 ${papersWithDraft.length} 套真题做到一半</b>`
        + '<div class="topics-resume-links">'
        + papersWithDraft.slice(0, 5).map(x =>
            `<a href="#/exam/${x.e.id}">继续 ${this.esc(x.e.title)}（已答 ${x.n} 题）</a>`).join('')
        + (papersWithDraft.length > 5
          ? `<span>其余 ${papersWithDraft.length - 5} 套见下方列表</span>` : '')
        + '</div></div>'
      : '';

    /* 上海专区独立入口（2026-09-07）：上海卷制式/词汇与全国卷不同，
       单列成区不混排；真题册暂为登记框架、词汇为官方考纲词表。 */
    const shVocabN = (window.__SH_VOCAB__ || { words: [] }).words.length;
    const shTrack = '<section class="sh-entry">'
      + '<div class="sh-entry-head"><span class="reference-kicker">SHANGHAI TRACK</span>'
      + '<h2>上海卷专区</h2>'
      + '<p>上海卷分春秋两考、有翻译和概要写作，词汇要求也单列——这里的上海材料'
      + '独立成套，不和全国卷混在一起。</p></div>'
      + '<div class="sh-entry-grid">'
      + '<a class="sh-entry-card" href="#/shanghai/exams"><b>上海真题册</b>'
      + '<small>历年卷登记与练习 · 框架已就位，卷子陆续上架</small>'
      + '<strong>进入真题册 →</strong></a>'
      + '<a class="sh-entry-card" href="#/shanghai/vocab"><b>上海考纲词汇</b>'
      + `<small>${shVocabN} 词 · 考试院官方词表 · 未人工复核</small>`
      + '<strong>背上海考纲词 →</strong></a>'
      + '</div></section>';

    const list = '<div class="reference-list">'
      + resumeBanner
      + `<div class="section-line"><h2>历年真题</h2><span>${exams.length} 套真题 · 选择一套开始</span></div>`
      + years.map(year => '<section class="reference-year">'
        + `<h2>${year}年高考英语真题</h2><div class="paper-list">`
        + exams.filter(e => e.year === year).map(e => this.paperRow(e)).join('')
        + '</div></section>').join('')
      + '</div>';

    this.app().innerHTML = hero + path + shTrack + list
      + '<footer class="reference-footer">题目仅供学习交流 · 答题记录保存在当前设备 · '
      + '<a href="#/mistakes">查看错题本</a></footer></main>';
  },

  /* 省份折叠（2026-09-03）：全国甲卷这类卷子会把「（四川、云南、贵州、
     广西、西藏）」整串塞进 region，试卷行一行小字被撑得换行两三次，
     信息密度反而下降 —— 学生要看的只是「这是哪套卷」。超过 3 个省份
     时收成「XX、XX、XX 等 N 个省份」，完整列表点进试卷后仍可见。 */
  regionText(region) {
    const r = String(region || '');
    const m = r.match(/（(.+)）/);
    if (!m) return r;
    const parts = m[1].split('、');
    if (parts.length <= 3) return r;
    return r.replace(/（.+）/, `（${parts.slice(0, 3).join('、')} 等 ${parts.length} 个省份）`);
  },

  /* 试卷行：显示历史最高分（有记录时），并标注人工审稿状态。
     草稿状态（2026-09-03）：改前有草稿的卷子和全新卷子长得一模一样，
     都写「开始练习」——学生记不清做到哪了，点进去才发现答案还在。
     现在三种状态：有草稿 → 「继续作答 · 已答 N 题」（点进去草稿自动
     恢复）；有成绩无草稿 → 「上次 X 分 · 重做」；全新 → 「开始练习」。 */
  paperRow(e) {
    const best = Store.getBestScore(e.id);
    const answered = UI.countAnswered(Store.getDraft(e.id));
    const review = e.quality === 'review_required' && !e.proofreadingConfirmed;
    const status = answered > 0
      ? `继续作答 · 已答 ${answered} 题`
      : best != null ? `上次 ${best} 分 · 重做` : '开始练习';
    return `<a class="paper-row ${review ? 'needs-review' : ''}" href="#/exam/${e.id}">`
      + `<span class="row-index">${e.paper.includes('新') ? '新' : '卷'}</span>`
      + `<span class="row-main"><b>${this.esc(e.title)}</b>`
      + `<small>${this.esc(this.regionText(e.region))} · ${e.questionCount} 题 · ${e.duration} 分钟</small>`
      + `${this.listenBadge(e)}${this.reviewBadge(e)}</span>`
      + `<span class="row-status">${status} <strong>→</strong></span></a>`;
  },

  /* 听力徽标（2026-09-15 A-2）：有音频 / 有题无音频 / 未收录听力 三级，
     学生进卷前就知道这卷的听力边界。hasListening 由 gen_data_js.py 从
     卷子 sections 派生（index.json 不手填）。 */
  listenBadge(e) {
    if (e.hasAudio) return '<em class="listen-badge has-audio">含听力音频</em>';
    if (e.hasListening === false) return '<em class="listen-badge">未收录听力</em>';
    return '<em class="listen-badge">听力暂无音频</em>';
  },

  /* 数据边界要对学生可见：哪套卷的答案已人工确认、哪套还待审稿 */
  reviewBadge(e) {
    if (e.proofreadingConfirmed) return `<em class="quality-note confirmed">短文改错已人工确认</em>`;
    if (e.quality === 'review_required') {
      return `<em class="quality-note">${this.esc(e.reviewNote || '部分题目待人工审稿')}</em>`;
    }
    return '';
  },

  examReviewNote(exam) {
    const pr = (exam.sections || []).find(s => s.key === 'proofreading');
    const confirmed = pr && pr.questions
      && pr.questions.some(q => q.explanation && q.explanation.reviewStatus === 'human_confirmed');
    if (confirmed) return ` · <span class="exam-quality-confirmed">短文改错已人工确认</span>`;
    if (exam.meta && exam.meta.quality === 'review_required') {
      return ` · <span class="exam-quality-warning">题库含待人工审稿内容</span>`;
    }
    return '';
  },

  /* 专题总览。卡片表见文件顶部 TOPIC_CARDS，
     可恢复草稿的题型见 RESUMABLE_TOPICS。 */
  topics(exams) {
    const openDrafts = this.openTopicDrafts();

    const resumeBanner = openDrafts.length
      ? '<div class="topics-resume-banner">'
        + `<b>↻ 你有 ${openDrafts.length} 个专题练习尚未完成</b>`
        + '<div class="topics-resume-links">'
        + openDrafts.map(d => `<a href="${d.route}">`
          + `继续${d.label}专题（已答 ${d.answered} 题）</a>`).join('')
        + '</div></div>'
      : '';

    const cards = TOPIC_CARDS.map(c => `<a class="program-card ${c.cls}" href="#/topic/${c.key}">`
      + `<span>${c.no}</span><b>${c.name}</b><small>${c.desc}</small>`
      + `<strong>${c.cta} →</strong></a>`).join('');

    this.app().innerHTML = this.header('专题训练', true)
      + `<main class="program-page">${resumeBanner}`
      + '<div class="program-hero"><span class="reference-kicker">TOPIC STUDIOS</span>'
      + '<h1>专题训练</h1>'
      + '<p>用完整文章、完整语篇和完整任务，把已经学会的方法真正用起来。</p></div>'
      + `<div class="program-grid">${cards}</div>`
      + '<div class="program-note"><b>专题训练和分题型训练有什么不同？</b>'
      + '<p>分题型训练教你某一种题怎么想；'
      + '专题训练让你面对完整材料，连续使用多种方法。</p></div></main>';
  },

  simulation(exams) {
    const rows = exams.map(e => `<a class="simulation-row" href="#/exam/${e.id}">`
      + `<span class="row-index">${e.year}</span>`
      + `<span><b>${this.esc(e.title)}</b>`
      + `<small>${this.esc(this.regionText(e.region))} · ${e.questionCount} 题 · ${e.duration} 分钟</small>`
      + `${this.reviewBadge(e)}</span><strong>开始模拟 →</strong></a>`).join('');

    this.app().innerHTML = this.header('真题考试模拟', true)
      + '<main class="program-page"><div class="program-hero">'
      + '<span class="reference-kicker">FULL EXAM MODE</span><h1>真题考试模拟</h1>'
      + '<p>按真实试卷顺序作答，限时完成，交卷后统一查看成绩与解析。'
      + '标记为“待人工复核”的试卷，主观题和短文改错不计入机器评分。</p></div>'
      + `<div class="simulation-list">${rows}</div>`
      + '<div class="program-note"><b>模拟考试会记录什么？</b>'
      + '<p>总分、分模块得分、作答时间、错题位置，'
      + '以及下一步建议训练的题型。</p></div></main>';
  },

  simulationSelect(exams) { this.simulation(exams); },

  /* 尚未编排内容的专题占位页（reading/listening/cloze/writing 之外的 kind
     会落到 reading 文案）。真正有内容的专题走 Topic.start*，不经过这里。 */
  topicDetail(kind) {
    const labels = {
      reading: ['阅读专题', '完整文章中的综合阅读训练'],
      listening: ['听力专题', '一组材料中的预测、捕捉与核对'],
      cloze: ['完形专题', '完整语篇中的上下文逻辑'],
      writing: ['写作专题', '从审题到成文的完整任务'],
    };
    const x = labels[kind] || labels.reading;

    this.app().innerHTML = this.header('专题训练', true)
      + '<main class="program-page"><div class="program-hero">'
      + `<span class="reference-kicker">TOPIC PRACTICE</span><h1>${x[0]}</h1><p>${x[1]}</p></div>`
      + '<div class="empty-state"><strong>专题内容正在编排</strong>'
      + '<p>这里将按完整材料组织练习，不拆成单独题型。'
      + '先去分题型训练学习方法，再回来完成专题。</p>'
      + '<a class="primary-btn" href="#/training">先学解题方法</a></div></main>';
  },
});
