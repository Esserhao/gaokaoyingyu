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

    /* 2026-09-22 二轮（用户：「主页 AI 味也很重」）：hero 从「AI landing page 的
       口号大字」改为「页面标题 + 事实行」。原来 60px 斜体衬线口号占掉首屏四分之一
       却不提供任何信息 —— 学生进来要的是真题列表，不是一句 slogan。现在标题
       26px、只陈述事实，真题列表直接提到首屏。 */
    const hero = '<main class="reference-home">'
      + this.referenceHeader({
          brand: '高中英语指北', brandNote: '真题 · 限时 · 解析', brandHref: '#/',
        })
      + '<section class="reference-hero">'
      + `<h1>高考英语真题 <span>${exams.length} 套</span></h1>`
      + '<p>听力音频 · 逐题解析 · 范文库 · 答错的题自动进错题本，'
      + '每个知识点还标着高考考过几次。</p></section>';

    /* 原分类导航条（历年真题/分题型训练/专题训练/真题模拟）与四步路径
       卡指向完全相同的页面，同一页 6 个重复入口；升级版全站主导航
       （siteNav，随 referenceHeader 渲染）统一承载这些入口，此处不再
       重复。真题数量并入下方「历年真题」栏目标题。 */

    /* 四步学习路径（task.md §8.2）：00 知识体系（知识台阶）→ 01 题型方法
       → 02 完整材料应用 → 03 整卷检验。入口已由主导航承载，这排卡片
       保留作学习路径的叙述与引导。 */
    const path = '<section class="learning-path">'
      + '<div class="path-heading"><h2>备考的四步顺序</h2></div>'
      + '<ol class="path-list">'
      + '<li><a href="#/learn"><span>00</span><b>知识台阶</b>'
      + '<small>按台阶逐个吃透语法点，模糊到掌握看得见</small></a></li>'
      + '<li><a href="#/training"><span>01</span><b>分题型训练</b>'
      + '<small>把一道题讲透，学会解题步骤</small></a></li>'
      + '<li><a href="#/topics"><span>02</span><b>专题训练</b>'
      + '<small>在完整材料中应用方法</small></a></li>'
      + '<li><a href="#/simulation"><span>03</span><b>真题考试模拟</b>'
      + '<small>按真实节奏完成整套试卷</small></a></li>'
      + '</ol></section>';

    /* 这里用 div 而非 main：a11y.js 只认第一个 main 作为 landmark，
       嵌套第二个 main 会让读屏用户看到两个「主要内容」区。 */
    /* 做到一半的真题：信息已并入工作台的「继续上次」，这里只取数据。
       （2026-09-22 四轮：原先的 .topics-resume-banner 横幅撤掉 —— 它和
       「我的」区块表达的是同一件事，同时出现只会让首页更长。） */
    const papersWithDraft = exams
      .map(e => ({ e, n: UI.countAnswered(Store.getDraft(e.id)) }))
      .filter(x => x.n > 0);

    /* 工作台：返回空串即「还没有我的数据」，此时首页走目录形态。 */
    const desk = this.homeDesk(exams, papersWithDraft);

    /* 上海专区独立入口（2026-09-07）：上海卷制式/词汇与全国卷不同，
       单列成区不混排；真题册暂为登记框架、词汇为官方考纲词表。 */
    /* 词数取 __VOCAB__.books 的元数据：data/vocab/index.js 是首屏脚本，
       books 一定有值；而 sh-kaogang.js 是懒加载的，直接读 __SH_VOCAB__
       在首页会拿到 undefined → 显示「0 词」（2026-09-22 修）。 */
    const shBook = ((window.__VOCAB__ || {}).books || []).find(b => b.id === 'sh-kaogang');
    const shVocabN = shBook
      ? shBook.total
      : ((window.__SH_VOCAB__ || {}).words || []).length;
    const shTrack = '<section class="sh-entry">'
      + '<div class="sh-entry-head"><h2>上海卷专区</h2>'
      + '<p>上海卷分春秋两考、有翻译和概要写作，词汇要求也单列——这里的上海材料'
      + '独立成套，不和全国卷混在一起。</p></div>'
      + '<ul class="sh-entry-list">'
      + '<li><a href="#/shanghai/exams"><b>上海真题册</b>'
      + '<small>历年卷登记与练习 · 框架已就位，卷子陆续上架</small></a></li>'
      + '<li><a href="#/shanghai/vocab"><b>上海考纲词汇</b>'
      + `<small>${shVocabN} 词 · 考试院官方词表 · 未人工复核</small></a></li>`
      + '</ul></section>';

    /* 年份分组抽成函数：工作台形态下只展开最近两年，其余收进 details ——
       练过的学生主要看「我的」，翻旧卷是低频动作，不必占据首屏。 */
    const yearGroup = year => '<section class="reference-year">'
      + `<h2>${year}年英语真题</h2><div class="paper-list">`
      + exams.filter(e => e.year === year).map(e => this.paperRow(e)).join('')
      + '</div></section>';
    const shownYears = desk ? years.slice(0, 2) : years;
    const restYears = desk ? years.slice(2) : [];
    const list = '<div class="reference-list">'
      + `<div class="section-line"><h2>历年真题</h2><span>${exams.length} 套真题 · 选择一套开始</span></div>`
      + shownYears.map(yearGroup).join('')
      + (restYears.length
        ? '<details class="years-more"><summary>展开其余 '
          + `${restYears.length} 个年份（${restYears[0]}–${restYears[restYears.length - 1]} 年）`
          + '</summary>' + restYears.map(yearGroup).join('') + '</details>'
        : '')
      + '</div>';

    /* 「今天」入口条（2026-09-22）：把藏在二级页的每日方案提到首屏。 */
    const todayStrip = this.todayStripHtml();

    /* 区块顺序（2026-09-22 二轮）：真题列表提到「备考四步」之前。
       原来解释性的四步说明压在列表上方，每次进来都得滚过它才看到卷子。 */
    /* 状态感知（2026-09-22 四轮）：
       有「我的」数据 → 今天 + 我的 + 近年真题 + 上海；
       还没练过     → 今天 + 全部真题 + 上海 + 备考四步。
       「备考四步」只对新用户有意义，练过的人不需要被再教一次怎么用这个站。 */
    const body = desk
      ? todayStrip + desk + list + shTrack
      : todayStrip + list + shTrack + path;

    this.app().innerHTML = hero + body
      + '<footer class="reference-footer">题目仅供学习交流 · 答题记录保存在当前设备 · '
      + '<a href="#/mistakes">查看错题本</a> · <a href="#/guide">使用指南</a></footer></main>';
  },

  /* 首页「今天」入口条（2026-09-22）——
     规则引擎产出的每日任务（Diagnostic.rules）早就存在，但只出现在
     #/dashboard 与 #/analysis 两页里：学生得先想到去点「学习总览」或
     「学业分析」才看得到，等于把「今天该干什么」藏在了二级页。
     这里把最关键的入口提到首屏。有未完成任务 → 强调底色（该被看见）；
     全清 → 中性底色（不抢眼，只报个平安）。
     诊断引擎不可用时静默返回空串，首页不受影响。 */
  todayStripHtml() {
    let input, tasks;
    try {
      input = Diagnostic.inputFromStore(Date.now());
      tasks = Diagnostic.rules(input);
    } catch (_) { return ''; }
    const remain = tasks.filter(t => !input.taskDone.has(t.id));
    const head = remain.length
      ? `<b>今天 · ${remain.length} 件事</b>`
      : '<b>今天的任务都完成了</b>';
    const desc = remain.length
      ? remain.slice(0, 2).map(t => t.title).join(' · ')
      : '可以去知识台阶提前练一个节点';
    return `<a class="today-strip${remain.length ? '' : ' is-clear'}" href="#/today">`
      + head + `<span>${this.esc(desc)}</span>`
      + `<strong>${remain.length ? '去看 →' : '看看 →'}</strong></a>`;
  },

  /* 首页工作台（2026-09-22 四轮）——「状态感知」首页：
     练过的人打开首页，先看「我的」（上次练到哪、多少错题待回炉、多少生词到期、
     哪个知识点反复错），真题列表退居其次且默认只展开最近两年；
     没练过的人（homeDesk 返回空串）保持目录形态 —— 他没有「我的」可看，
     卷子才是有用的。这样同一页照顾两类用户，不靠堆砌也不用猜。
     数据全部走已有的 Store / Review 接口，口径与 #/analysis 一致。 */
  homeDesk(exams, drafts) {
    const mistakes = Store.getMistakes();
    const open = mistakes.filter(x => x.reviewStatus !== '已掌握');
    const dueMistakes = Review.due(open);
    const words = Object.entries(Store.getWords() || {}).map(([w, r]) => ({ word: w, ...r }));
    const dueWords = Review.due(words);

    /* 反复错的知识点：同一节点错 ≥2 次，取最多的那个（与 #/analysis 同口径）。 */
    const cnt = {};
    mistakes.forEach(m => {
      if (m.reviewStatus === '已掌握' || !m.knowledgeNode) return;
      cnt[m.knowledgeNode] = (cnt[m.knowledgeNode] || 0) + 1;
    });
    const weak = Object.entries(cnt).filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])[0];

    /* 一条「我的」数据都没有 → 返回空串，首页走目录形态（见 home()）。
       判据与 #/dashboard 的「有记录」口径一致：整卷记录 / 草稿 / 错题 / 生词。
       注意这里不能无条件 push 一行 —— 那样新用户也会看到一张空工作台。 */
    const myRecords = Object.keys(Store._load().records || {})
      .filter(id => !id.startsWith('diag-') && !id.startsWith('redo-')).length;
    if (!myRecords && !drafts.length && !mistakes.length && !words.length) return '';

    const rows = [];
    rows.push(drafts.length
      ? ['继续上次', this.esc(drafts[0].e.title) + ' · 已答 ' + drafts[0].n + ' 题',
         '#/exam/' + drafts[0].e.id]
      : ['再练一套', '已经练过 ' + myRecords + ' 套，还有 ' + (exams.length - myRecords) + ' 套',
         '#/simulation']);
    if (mistakes.length) {
      rows.push(['待回炉错题',
        (dueMistakes.length ? dueMistakes.length + ' 道今天到期 · ' : '') + '共 ' + mistakes.length + ' 道',
        dueMistakes.length ? '#/review-queue' : '#/mistakes']);
    }
    if (words.length) {
      rows.push(['我的生词',
        words.length + ' 个已收藏' + (dueWords.length ? ' · ' + dueWords.length + ' 个今天到期' : ''),
        '#/words']);
    }
    if (weak) {
      rows.push(['薄弱知识节点', this.esc(weak[0]) + '（' + weak[1] + ' 次）',
        '#/knowledge/' + encodeURIComponent(weak[0])]);
    }

    return '<section class="home-desk"><div class="section-line"><h2>我的</h2>'
      + '<a class="text-btn" href="#/dashboard">学习总览 →</a></div>'
      + '<ul class="desk-list">'
      + rows.map(([k, v, href]) => `<li><a href="${href}">`
          + `<b>${k}</b><span>${v}</span><strong>→</strong></a></li>`).join('')
      + '</ul></section>';
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
    /* 2026-09-22 二轮：全新卷不再把「开始练习」重复 16 遍——整行本身就是链接，
       每行都挂一句同样的 CTA 是列表页最明显的模板腔。只在真有进度/成绩时出文字，
       其余情况右侧只留一个箭头。 */
    const status = answered > 0
      ? `继续作答 · 已答 ${answered} 题`
      : best != null ? `上次 ${best} 分 · 重做` : '';
    return `<a class="paper-row ${review ? 'needs-review' : ''}" href="#/exam/${e.id}">`
      + `<span class="row-index">${e.paper.includes('新') ? '新' : '卷'}</span>`
      + `<span class="row-main"><b>${this.esc(e.title)}</b>`
      + `<small>${this.esc(this.regionText(e.region))} · ${e.questionCount} 题 · ${e.duration} 分钟`
      + `${this.listenBadge(e)}${this.reviewBadge(e)}</small></span>`
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
        + `<b>你有 ${openDrafts.length} 个专题练习尚未完成</b>`
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
