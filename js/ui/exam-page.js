/* =====================================================================
   答题页与解析页
   mode='practice' 可作答；mode='result' 为解析模式（控件 disabled、
   补 .review/.wrong/.correct 类名，判分信号由 css/app.css 呈现）。
   ===================================================================== */
Object.assign(UI, {
  exam(exam, answers, remaining, mode = 'practice') {
    const answered = UI.countAnswered(answers);
    const total = UI.examQuestionTotal(exam);

    const sections = exam.sections.map(s => this.examSection(s, answers, mode, exam)).join('');

    this.app().innerHTML = this.examBar(exam, answered, total, remaining, mode)
      + '<main class="exam-layout"><div class="exam-content">'
      + (mode === 'result'
        ? '<div class="result-banner"><span>练习完成</span>'
          + '<span class="lookup-hint">点击文章或解析里的英文单词，可直接查词典</span>'
          + `<a href="#/result/${exam.id}">查看成绩概览 →</a></div>`
        : '')
      + '<header class="exam-head">'
      + `<h1 class="exam-title">${this.esc(exam.title)}</h1>`
      + `<p class="exam-meta">${exam.isDiagnostic || exam.isRedo ? '建议用时 ' + exam.duration + ' 分钟' : '考试时间 ' + exam.duration + ' 分钟'} · 满分 ${exam.totalScore} 分 · `
      + (mode === 'practice' ? '答题过程中会自动保存草稿' : '答案解析模式')
      + `${this.examReviewNote(exam)}</p>`
      + this.examListenNote(exam)
      + this.examWords(exam)
      + '</header>' + sections + '</div>'
      + this.answerSheet(exam, answers, answered, total);
  },

  /* 听力边界如实告知（2026-09-15 A-2）：无听力 section 的卷与有听力但
     无音频的卷此前都是静默缺腿——学生做 52 题卷不知道少了听力 30 分。
     四种状态：未收录 / 有音频（正常，播放器渲染在听力节头部，这里不重复提示）/
     无音频有文字稿（对照作答）/ 无音频也无文字稿（如实说没法练，不画饼）。
     第三态的判定必须真去看 transcript（2026-09-19 修订）：改前只看 hasAudio，
     13 套「无音频且文字稿为空」的卷照样渲染「已附听力文字稿」，是兑现不了的承诺。 */
  examListenNote(exam) {
    const hasListening = (exam.sections || []).some(s => s.key === 'listening');
    if (!hasListening) {
      return '<p class="exam-listen-note">本卷未收录听力部分——原始试卷的听力（约 30 分）'
        + '不在其中，成绩折算只含已收录题型。</p>';
    }
    if (!exam.hasAudio) {
      const hasTranscript = (exam.sections || [])
        .filter(s => s.key === 'listening')
        .some(s => s.questions.some(q => String(q.transcript || '').trim()));
      return hasTranscript
        ? '<p class="exam-listen-note">本卷听力暂无音频，各题下方已附听力文字稿，'
          + '按文字稿对照作答；音频补齐后会自动出现播放器。</p>'
        : '<p class="exam-listen-note">本卷听力暂无音频，文字稿也待补——这 30 分暂时没法练，'
          + '先做其余部分；音频与文字稿补齐后会自动出现。</p>';
    }
    return '';
  },

  /* 本卷考点词（附录 E2）：做卷/复盘前扫一眼这套卷出现较多的高考核心词，
     点击直达词条页（词条页里还有考频原句）。数据是生成器的每卷精简榜
     __EXAM_WORDS__（随 index.js 急加载）；诊断卷/没有数据的卷整块不渲染。 */
  examWords(exam) {
    const list = (window.__EXAM_WORDS__ || {})[exam.id];
    if (!list || !list.length) return '';
    return '<details class="exam-words"><summary>考前 2 分钟 · 本卷考点词（'
      + list.length + '）</summary><div class="exam-words-row">'
      + list.map(([w, n]) =>
        `<a class="exam-word-chip" href="#/word/${encodeURIComponent(w)}">`
        + `${this.esc(w)}<small>×${n}</small></a>`).join('')
      + '</div></details>';
  },

  /* 整卷页的节渲染（附录 C2 卷面模式）：有原文的节按「真卷流」排 ——
     每篇原文紧跟它自己的题（题干带 passageLabel，与原文 label 对上号的归一组），
     而不是改前「全部原文 → 全部题目」两段式，学生不用来回滚动对位置。
     单原文节（完形/语法/七选五/读后续写）保持原文在上、题目在下；
     没有原文的节（听力/写作）只出题。对不上号的题收尾兜底，绝不丢题。 */
  examSection(s, answers, mode, exam) {
    const head = `<div class="section-heading"><h2>${this.esc(s.partTitle || s.key)}</h2>`
      + `<b>${s.questions.length} 题</b></div>`
      /* 听力播放器（2026-09-15 A-1）：有音频的卷在听力节头部挂原生播放器。
         preload=none 不抢首屏带宽；真实考试听力只放一遍，提示学生别回听。 */
      + (s.key === 'listening' && exam && exam.hasAudio && exam.audio
        ? '<div class="listen-audio">'
          + `<audio controls preload="none" src="${this.esc(exam.audio)}"></audio>`
          + '<small>听力音频 · 真实考试只放一遍，练习时也建议一遍过</small></div>'
        : '');
    const ps = s.passages || [];

    const passageHtml = p => '<article class="passage"'
      // 点击查词只在解析模式开启：作答时不给查词出口
      + (mode === 'result' ? ' data-lookup' : '')
      + '>'
      + `<b>${this.esc(p.label || '阅读材料')}</b>`
      + `<div>${this.text(p.text)}</div></article>`;

    if (!ps.length) {
      return '<section class="exam-section" id="sec-' + s.key + '">' + head
        + '<div class="question-list">'
        + s.questions.map(q => this.question(q, s, answers, mode, exam)).join('')
        + '</div></section>';
    }

    if (ps.length === 1) {
      return '<section class="exam-section" id="sec-' + s.key + '">' + head
        + '<div class="passages">' + ps.map(passageHtml).join('') + '</div>'
        + '<div class="question-list">'
        + s.questions.map(q => this.question(q, s, answers, mode, exam)).join('')
        + '</div></section>';
    }

    const byLabel = {};
    s.questions.forEach(q => {
      if (q.passageLabel != null) (byLabel[q.passageLabel] = byLabel[q.passageLabel] || []).push(q);
    });
    const used = new Set();
    const groups = ps.map(p => {
      const qs = byLabel[p.label] || [];
      qs.forEach(q => used.add(q));
      return '<div class="passage-group">' + passageHtml(p)
        + (qs.length
          ? '<div class="question-list">'
            + qs.map(q => this.question(q, s, answers, mode, exam)).join('') + '</div>'
          : '')
        + '</div>';
    }).join('');
    const rest = s.questions.filter(q => !used.has(q));
    return '<section class="exam-section" id="sec-' + s.key + '">' + head
      + '<div class="passage-flow">' + groups + '</div>'
      + (rest.length
        ? '<div class="question-list">'
          + rest.map(q => this.question(q, s, answers, mode, exam)).join('') + '</div>'
        : '')
      + '</section>';
  },

  examBar(exam, answered, total, remaining, mode) {
    const untimed = exam.isDiagnostic || exam.isRedo;
    return '<header class="exambar"><div class="exambar-inner">'
      + '<a class="brand" href="#/"><span class="brand-mark">英</span>'
      + `<b>${this.esc(exam.title)}</b></a>`
      + `<span class="progress">已作答 <b>${answered}</b> / ${total}</span>`
      + `<span class="timer${untimed ? '' : ` ${remaining < 300 ? 'urgent' : ''}`}"`
      + `${mode === 'practice' && !untimed ? ' data-exam-timer' : ''}>`
      + `${untimed ? '建议 ' + exam.duration + ' 分钟' : this.time(remaining)}</span>`
      + this.fsToggle()
      + (mode === 'practice'
        ? `<button class="primary-btn" data-action="submit">${exam.isDiagnostic ? '交卷并查看诊断结果' : '交卷并查看成绩'}</button>`
        : '<a class="ghost-btn" href="#/">返回题库</a>')
      + '</div></header>';
  },

  /* 答题卡 + 移动端遮罩与浮动按钮。
     题号是 <a href="#q-…">，但本站是 hash 路由 —— 点击一定会被
     js/ui-sheet.js 拦下（preventDefault 后手动滚动聚焦），
     否则 hash 落进路由会匹配失败并回落首页，正在进行的考试当场清空。
     短文改错拆成 10 处，答题卡相应展开 10 个子题号。 */
  answerSheet(exam, answers, answered, total) {
    const sections = exam.sections.map(s => {
      if (s.key === 'proofreading' && s.questions[0]) {
        const q = s.questions[0];
        const items = UI.proofreadingItems(q);
        const dots = items.map(it => {
          const key = `${s.key}-${q.id}-${it.n}`;
          const v = answers[key];
          const done = v != null && v !== '' ? 'done' : '';
          return `<a class="sheet-dot ${done}" href="#q-${this.esc(key)}">${it.n}</a>`;
        }).join('');
        return '<div class="sheet-section"><span>短文改错</span><div>' + dots + '</div></div>';
      }
      return '<div class="sheet-section">'
        + `<span>${this.esc(s.partTitle || s.key)}</span><div>`
        + s.questions.map(q => {
          const v = answers[`${s.key}-${q.id}`];
          const done = v != null && v !== '' ? 'done' : '';
          return `<a class="sheet-dot ${done}" href="#q-${s.key}-${q.id}">${q.id}</a>`;
        }).join('')
        + '</div></div>';
    }).join('');

    return '<aside class="answer-sheet" id="asheet" aria-label="答题卡">'
      + `<h2 class="sheet-title">答题卡 <small>${answered}/${total}</small></h2>${sections}</aside>`
      + '\n  <div class="sheet-scrim" data-action="toggle-sheet"></div>'
      + '\n  <button class="mobile-sheet-btn" type="button" data-action="toggle-sheet"'
      + ' aria-expanded="false" aria-controls="asheet">'
      + '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">'
      + '<path fill="currentColor" d="M4 5h16v3H4zm0 5.5h16v3H4zm0 5.5h16v3H4z"/>'
      + '</svg>答题卡</button>\n</main>';
  },

  question(q, s, answers, mode, exam) {
    if (q.type === 'proofreading') return this.proofreadingQuestion(q, s, answers, mode);

    const key = `${s.key}-${q.id}`;
    const val = answers[key] ?? '';
    const answer = q.answer ?? q.modelAnswer ?? '';
    const review = mode !== 'practice';
    const correct = review && UI.eqAnswer(val, answer);
    const free = q.type === 'writing';

    /* 听力文字稿（2026-09-15 A-1）：有音频的卷默认折叠（真实考试没有文字稿，
       交卷复盘时再展开）；无音频的卷文字稿就是唯一听力材料，直接展开显示——
       此前两类卷都不渲染 transcript，无音频卷的听力题根本没法做。 */
    const hasAudio = !!(exam && exam.hasAudio && exam.audio);
    const transcript = (s.key === 'listening' && q.transcript)
      ? (hasAudio
        ? '<details class="listen-ts"><summary>听力原文（建议交卷后再看）</summary>'
          + `<p>${this.text(q.transcript)}</p></details>`
        : '<div class="listen-ts listen-ts-open"><b>听力原文</b>'
          + `<p>${this.text(q.transcript)}</p></div>`)
      : '';
    /* 只有参考范文、没有唯一答案的题（两类写作）。措辞必须和客观题分开：
       叫「正确答案」会让学生以为要背下这篇范文。 */
    const model = q.answer == null && answer !== '';

    /* 选项组与题号标题的从属（2026-09-19）：radio 组本身读不出「这是第几题」，
       每个输入用 aria-labelledby 指回题号 h3；h3 已有 aria-label「第 N 题」。 */
    const headId = `qh-${this.esc(key)}`;
    const opts = (q.options || []).map(o => `<label class="option ${val === o.letter ? 'selected' : ''} `
      + `${review && answer === o.letter ? 'correct' : ''}">`
      + `<input type="radio" name="q-${s.key}-${q.id}" value="${this.esc(o.letter)}" data-qid="${key}" `
      + `aria-labelledby="${headId}" ${val === o.letter ? 'checked' : ''} ${review ? 'disabled' : ''}>`
      + `<span class="option-letter">${this.esc(o.letter)}</span>`
      + `<span>${this.esc(o.text)}</span></label>`).join('');

    /* h3 而非 b：72 道题需要成为可跳转的标题层级，读屏用户才能逐题浏览。
       视觉由 css/app.css 的 .q-head>h3 压回原字号。 */
    const head = '<div class="q-head">'
      + `<h3 id="${headId}" aria-label="第 ${q.id} 题">${q.id}</h3>`
      + `<span>${free ? '主观题' : (q.options?.length ? '单项选择' : '填空题')}</span>`
      + (review
        ? `<strong class="mark ${correct ? 'ok' : 'bad'}">`
          + `${correct ? '回答正确' : (model ? '主观题' : '正确答案：' + this.esc(answer))}</strong>`
        : '')
      + '</div>';

    return `<article class="question ${review ? 'review' : ''} `
      + `${review && !correct ? 'wrong' : ''}" id="q-${s.key}-${q.id}">`
      + head
      + `<p class="stem">${this.text(q.stem || '')}</p>`
      + transcript
      + `${opts}`
      + (!opts && !free
        ? `<input class="fill-input" data-qid="${key}" value="${this.esc(val)}" `
          + `aria-label="第 ${q.id} 题作答" ${review ? 'disabled' : ''} placeholder="请输入答案">`
        : '')
      + (free
        ? `<textarea class="writing-input" data-qid="${key}" `
          + `aria-label="第 ${q.id} 题作文输入" ${review ? 'disabled' : ''} `
          + `placeholder="在此输入你的作文答案">${this.esc(val)}</textarea>`
        : '')
      /* 参考范文单独成块：改前挤在题头那一行「正确答案：Dear Chris, …」里，
         既读不了，又暗示这是一份标准答案。这里明确写出「不计入机器评分」。 */
      + (review && model
        ? '<div class="model-answer"><b>参考范文</b>'
          + `<pre>${this.esc(answer)}</pre>`
          + '<p class="model-note">主观题没有唯一正确答案，这一部分不计入机器评分。'
          + '建议对着范文自己批改，重点看要点是否齐全、语言是否通顺。</p></div>'
        : '')
      + (review && q.explanation
        ? `<div class="explanation" data-lookup><b>解析</b>${this.explanationHtml(q.explanation)}`
          + `${this.locHtml(exam && exam.id, q.id)}</div>`
        : '')
      /* 写作题在整卷页到此就断了：给了范文、给了一句「自己批改」，却没有批改的
         地方。这里补一个入口，跳到写作专题的同一道题 —— 那边有草稿、自评表和
         复盘记录，而且会把整卷里写的那篇作文一并接管过去（Topic.takeOverDraft）。
         只在复盘态给：考试进行中跳走等于把整卷丢下，那是另一种伤害。 */
      + (free && review && exam
        ? '<div class="writing-studio-link"><a class="ghost-btn" '
          + `href="#/writing/${encodeURIComponent(exam.id)}/${encodeURIComponent(s.key)}">`
          + '去写作专题自评 · 复盘 →</a>'
          + '<span>草稿、自评与复盘记录都存在本机；范文是对照用的，不是标准答案。</span>'
          + '</div>'
        : '')
      + '</article>';
  },

  /* 短文改错拆 10 小题：每处独立 input（键 proofreading-<qid>-<n>），
     复盘时每题并排参考批改 + 逐处解析，支持按内容自评。 */
  proofreadingItems(q) {
    const modelLines = String(q.modelAnswer || '').split('\n').map(x => x.trim()).filter(Boolean);
    const points = Array.isArray(q.explanation?.points) ? q.explanation.points : [];
    const count = Math.max(modelLines.length, points.length, 10);
    const items = [];
    for (let i = 1; i <= count; i++) {
      items.push({
        n: i,
        model: (modelLines[i - 1] || '').replace(/^\d+[\.、]\s*/, ''),
        analysis: points[i - 1] ? points[i - 1].analysis : '',
      });
    }
    return items;
  },

  /* 全卷题数：短文改错按「10 处」计，其余按题目数。用于答题卡与顶栏计数。 */
  examQuestionTotal(exam) {
    let t = 0;
    for (const s of exam.sections) {
      if (s.key === 'proofreading' && s.questions[0]) t += UI.proofreadingItems(s.questions[0]).length;
      else t += s.questions.length;
    }
    return t;
  },

  /* 整卷页短文改错自评存取（独立键带 _exam 后缀，避免与专题页 _self 冲突）。 */
  loadProofSelfExam(examId) {
    try { return JSON.parse(localStorage.getItem(`gaokao_proof_self_exam_${examId}_proofreading`) || '[]') || []; }
    catch { return []; }
  },
  proofSelfSummaryText(arr) {
    let right = 0, missed = 0, wrong = 0;
    (arr || []).forEach(x => {
      if (x.verdict === 'right') right++;
      else if (x.verdict === 'missed') missed++;
      else if (x.verdict === 'wrong') wrong++;
    });
    return `改对 ${right} · 漏改 ${missed} · 改错 ${wrong}`;
  },

  /* 短文改错单独渲染：一道大题拆成 10 道小题，每题「适当形式填空式」填写。
     不按普通选择题自动判分。 */
  proofreadingQuestion(q, s, answers, mode) {
    const qid = q.id;
    const baseKey = `${s.key}-${qid}`;
    const items = UI.proofreadingItems(q);
    const review = mode !== 'practice';
    const examId = Exam.current?.id || '';
    const selfArr = review ? this.loadProofSelfExam(examId) : [];

    const sub = items.map((it) => {
      const key = `${baseKey}-${it.n}`;
      const val = answers[key] ?? '';
      const head = '<div class="q-head proof-sub-head">'
        + `<h3 aria-label="第 ${qid} 题 第 ${it.n} 处">${qid}.${it.n}</h3>`
        + `<span>第 ${it.n} 处批改</span>`
        + (review ? '<strong class="mark manual">参考批改</strong>' : '')
        + '</div>';
      const input = `<input class="proofreading-input proof-sub-input" data-qid="${this.esc(key)}" `
        + `value="${this.esc(val)}" aria-label="第 ${qid} 题第 ${it.n} 处作答" `
        + `${review ? 'disabled' : ''} `
        + `placeholder="如：把'原词'改为'新词' / 删去'某词' / 在'前词'和'后词'之间加上'所加词'"></input>`;
      let ref = '';
      if (review) {
        const rec = selfArr.find(x => String(x.n) === String(it.n));
        const selfBtns = ['right', 'missed', 'wrong'].map(v => {
          const label = v === 'right' ? '改对' : v === 'missed' ? '漏改' : '改错';
          const active = rec && rec.verdict === v ? ' is-active' : '';
          return `<button type="button" class="proof-self-btn${active}" data-proof-self-exam="${v}" data-n="${it.n}">${label}</button>`;
        }).join('');
        ref = '<div class="proofreading-answer"><b>参考批改</b>'
          + `<pre>${this.esc(it.model || '待补充')}</pre>`
          + (it.analysis ? `<p class="proof-analysis">${this.esc(it.analysis)}</p>` : '')
          + '</div>'
          + '<div class="proof-self" data-proof-self-row="' + it.n + '">'
          + '<span class="proof-self-label">我的判断：</span>' + selfBtns + '</div>';
      }
      return '<article class="question proofreading-sub '
        + `${review ? 'review' : ''}" id="q-${this.esc(key)}">`
        + head + input + UI.proofMethodsHtml('proof-methods-sub') + ref + '</article>';
    }).join('');

    return '<article class="question proofreading-question '
      + `${review ? 'review' : ''}" id="q-${this.esc(baseKey)}">`
      + `<div class="q-head"><h3 aria-label="第 ${qid} 题">${qid}</h3>`
      + '<span>短文改错 · 适当形式填空式批改（共 ' + items.length + ' 处）</span>'
      + (review ? '<strong class="mark manual">参考批改</strong>' : '')
      + '</div>'
      + `<p class="stem">${this.text(q.stem || '')}</p>`
      + '<div class="proofreading-format"><b>答题格式</b>'
      + UI.proofMethodsHtml()
      + '</div>'
      + `<div class="proofreading-material"${review ? ' data-lookup' : ''}>${this.text(q.material || '')}</div>`
      + '<div class="proofreading-subs">' + sub + '</div>'
      + (review ? `<div class="proof-self-summary-exam">本次自评：${this.proofSelfSummaryText(selfArr)}</div>` : '')
      + '</article>';
  },

  /* 成绩页。得分率按客观题实得 / 全卷满分算，因此带主观题的卷子
     天花板不到 100% —— 文案已注明「未计入自动得分」的部分。 */
  result(exam, record) {
    const pct = Math.round(record.score / exam.totalScore * 100);

    /* 结果页的两条说明（2026-09-03）：
       · 自动交卷 —— 改前时间归零直接跳过来，学生只知道「突然就交了」；
       · 存储失败 —— 成绩页看着一切正常，刷新后全没了。这一条必须红。 */
    const notice = (record.autoSubmitted || Store.writeFailed)
      ? '<div class="result-notice' + (Store.writeFailed ? ' is-error' : '') + '" role="status">'
        + (record.autoSubmitted
          ? '<p><b>考试时间已用完，系统已自动交卷。</b>'
            + '上面的得分只统计已作答的题目。</p>'
          : '')
        + (Store.writeFailed
          ? '<p><b>这次成绩没能保存到浏览器。</b>'
            + '刷新页面后会丢失，请先到「工具 · 数据备份」导出一份。</p>'
          : '')
        + '</div>'
      : '';

    const rows = Object.entries(record.sectionScores).map(([k, v]) => {
      const width = v.total ? Math.round(v.correct / v.total * 100) : 0;
      const score = v.manual ? `人工/非客观 ${v.manual} 题` : `${v.correct} / ${v.total}`;
      return `<div><span>${this.esc(k)}</span><b>${score}</b>`
        + `<i><u style="width:${width}%"></u></i></div>`;
    }).join('');

    this.app().innerHTML = this.header('练习结果', true)
      + '<main class="result-page shell"><div class="result-hero">'
      + '<span class="eyebrow">PRACTICE COMPLETE</span><h1>这套真题，<em>完成。</em></h1>'
      + `<div class="score-ring"><strong>${record.score}</strong><span>/ ${exam.totalScore} 分</span></div>`
      + `<p>客观题得分率 ${pct}% · 用时 ${Math.floor(record.durationUsed / 60)} 分钟`
      + (record.manualSections?.length
        ? ` · ${record.manualSections.map(x => this.esc(x.title)).join('、')}未计入自动得分`
        : '')
      + '</p></div>'
      + notice
      + '<div class="result-actions">'
      + `<a class="primary-btn" href="#/review/${exam.id}">查看答案解析</a>`
      + `<a class="ghost-btn" href="#/exam/${exam.id}">重新练习</a>`
      /* 错题重做（附录 E1）：有客观错题才出现；Redo.build 返回 null 时
         这套卷已经没有可重做的错题。顶层 const 不挂 window，用 typeof 守卫。 */
      + ((typeof Redo !== 'undefined' && Redo.build(exam, record))
        ? `<a class="ghost-btn" href="#/redo/${exam.id}">错题重做 →</a>` : '')
      + '<a class="text-btn" href="#/mistakes">打开错题本 →</a>'
      /* 交卷后的承接（附录 C4）：改前结果页只有解析/重做/错题本三个出口，
         学生最想要的「这次暴露了什么弱点 → 接下来干嘛」要点回首页才能找到。 */
      + '<a class="text-btn" href="#/analysis">看看学业分析 →</a></div>'
      + `<div class="score-list">${rows}</div>`
      + `${this.recoveryLinks(record)}</main>`;
  },

  /* 没有成绩记录时的说明页（2026-09-03）：此前 result / review 两种模式
     查不到记录时都 location.replace 回答题页，用户看不到任何解释，历史
     记录还被替换掉、后退也回不去，只会以为是自己点错了。
     有草稿时把「已答 N 题」一并说出来，学生才知道进度还在。 */
  noRecord(exam) {
    const answered = UI.countAnswered(Store.getDraft(exam.id));
    this.app().innerHTML = this.header('练习结果', true)
      + '<main class="empty-state"><strong>这套卷子还没有成绩记录</strong>'
      + '<p>'
      + (answered
        ? `你已经答了 ${answered} 题，草稿还在，但还没有交过卷。交卷后这里会显示得分和错题分析。`
        : '先做一遍，交卷后这里会显示得分与错题分析。')
      + '</p><div class="empty-actions">'
      + `<a class="primary-btn" href="#/exam/${exam.id}">`
      + (answered ? '继续这套卷子' : '开始练习') + '</a>'
      + '<a class="ghost-btn" href="#/">换一套真题</a>'
      + '</div></main>';
  },

  /* 失分模块 → 对应题型的方法训练。只取有客观题且未满分的前 4 个模块。 */
  recoveryLinks(record) {
    const rows = Object.entries(record.sectionScores || {})
      .filter(([, v]) => !v.manual && v.total && v.correct < v.total)
      .slice(0, 4);
    if (!rows.length) return '';

    const items = rows.map(([key, v]) => '<a class="recovery-item" '
      + `href="#/training/${this.esc(key)}/example">`
      + `<span>${this.esc(key)}</span><b>${v.correct}/${v.total}</b>`
      + '<strong>进入方法训练 →</strong></a>').join('');

    return '<section class="recovery-panel"><div class="panel-heading">'
      + '<h2>失分后的回炉建议</h2><span>按本次错题模块进入训练</span></div>'
      + `<div class="recovery-list">${items}</div></section>`;
  },
});
