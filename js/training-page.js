/* =====================================================================
   学生视角例题教学：先示范思考，再进入独立训练
   两个页面：
     example/showLesson —— 四步拆解一道题（老师示范）
     show               —— 同题型另一道题，自己作答并即时反馈
   模板断行规则同 js/ui/base.js：只用加号拼接，不在模板内换行。
   ===================================================================== */
const TrainingPage = {
  async example(exams, typeKey) {
    const data = await Training.build(exams, typeKey);
    if (!data.items.length) { location.hash = '#/training'; return; }
    /* Training.build 的 items 元素只有 {exam,section,q}，meta 挂在 data 上。
       此前直接把 item 传下去，showLesson 里 meta 为 undefined，
       #/training/<type>/example（首页「分题型训练」卡片的落地页）整条路线都是白屏。 */
    const item = { ...data.items[0], meta: data.meta };
    this.showLesson(item, 0);
  },

  /* 四步法：任务 → 证据 → 比较 → 结论。
     这套步骤全站复用（练习反馈、侧栏提示都引用同一条路径），
     改动措辞前先看 show() 里的 aside 和 reveal() 里的加粗路径。 */
  steps(meta, q, section) {
    const hasPassage = section.passages && section.passages.length;

    return [
      {
        title: '先别急着选答案', label: '第 1 步 · 读懂任务',
        body: `这道${meta.name}题，第一件事不是看选项，而是先弄清楚题目要你判断什么。`
          + '请先读题干，圈出人物、时间、地点、态度或逻辑关系等关键词。',
        hint: '你现在要找的是“题目要求判断的对象”，不是马上猜答案。',
      },
      {
        title: '把线索放回语境', label: '第 2 步 · 找证据',
        /* 有材料的题型（阅读/七选五/完形）回原文定位；
           无材料的题型（语法填空的单句、听力的选项）只能从语境入手。 */
        body: hasPassage
          ? '回到文章中定位与题干相关的句子。'
            + '不要只找一模一样的词，要注意同义替换、转折词和因果关系。'
          : '先判断题目所在的语境，再观察每个选项分别对应哪条线索。'
            + '把“我觉得”变成“原文哪里能证明”。',
        hint: '证据优先于直觉；找到证据后，再比较选项。',
      },
      {
        title: '逐个排除，而不是凭感觉', label: '第 3 步 · 做比较',
        body: '逐项问自己三个问题：选项是否回答了题干？原文是否支持？'
          + '有没有扩大、缩小或偷换概念？'
          + (meta.key === 'grammar'
            ? '语法题还要先判断空格在句中充当什么成分，再决定词形。'
            : ''),
        hint: '如果一个选项“听起来对”，但找不到证据，就先不要选。',
      },
      {
        title: '最后才确定答案', label: '第 4 步 · 得出结论',
        body: '现在把前面的证据和选项进行对应，选择最完整、最符合语境的一项。'
          + '做完后，用一句话说清楚“为什么是它”。',
        hint: q.answer
          ? `本题答案是 ${q.answer}。`
            + '点击“看老师解析”后，我们会把关键证据和排除过程完整展开。'
          : '先写出你的答案，再进入独立练习。',
      },
    ];
  },

  showLesson(item, step = 0) {
    const { meta, q, section, exam } = item;
    const steps = this.steps(meta, q, section);
    const current = steps[Math.min(step, steps.length - 1)];

    /* 例题里的选项是只读展示（没有 input）—— 这一页在讲思路，不收答案。 */
    const opts = (q.options || []).map(o => '<div class="lesson-option">'
      + `<b>${UI.esc(o.letter)}</b><span>${UI.esc(o.text)}</span></div>`).join('');

    const head = '<main class="lesson-page">'
      + UI.referenceHeader({
          brand: `${meta.name} · 例题教学`, brandNote: '老师先示范思路，你再独立练习',
          brandHref: `#/training/${meta.key}`,
          backHref: `#/training/${meta.key}`, backLabel: '返回题型',
        })
      + '<section class="lesson-hero">'
      + `<span class="reference-kicker">GUIDED EXAMPLE · ${UI.esc(meta.en)}</span>`
      + '<h1>先学会怎么想，<em>再开始做题。</em></h1>'
      + '<p>这不是只告诉你答案的解析。'
      + '我们把一道题拆成几个动作，让你知道每一步为什么要这样想。</p>'
      + '</section>';

    const progress = '<div class="lesson-progress">'
      + steps.map((s, i) => `<span class="${i === step ? 'active' : ''} ${i < step ? 'done' : ''}">`
        + `${i + 1}</span>`).join('')
      + `<b>${UI.esc(current.label)}</b></div>`;

    const actions = '<div class="lesson-actions">'
      + (step > 0 ? `<button class="ghost-btn" data-lesson-step="${step - 1}">上一步</button>` : '')
      + (step < steps.length - 1
        ? `<button class="primary-btn" data-lesson-step="${step + 1}">下一步：继续拆解</button>`
        : '<button class="primary-btn" data-lesson-answer>看老师解析</button>')
      + '</div>';

    const paper = '<article class="lesson-paper">'
      + `<div class="lesson-source">${UI.esc(exam.title)} · 第 ${q.id} 题</div>`
      + (section.passages?.length
        ? '<details class="lesson-context" open><summary>先看材料</summary>'
          + `<p>${UI.text(section.passages[0].text)}</p></details>`
        : '')
      + `<h2>${UI.esc(current.title)}</h2>`
      + `<p class="lesson-teach">${UI.text(current.body)}</p>`
      + `<div class="lesson-hint"><b>给你的提示</b><span>${UI.text(current.hint)}</span></div>`
      + `<div class="lesson-question"><span>例题</span><p>${UI.text(q.stem || '')}</p>`
      + (opts ? `<div class="lesson-options">${opts}</div>` : '')
      + '</div>'
      + actions
      + '<div id="lesson-answer"></div></article>';

    const aside = '<aside class="lesson-aside"><span class="reference-kicker">本题型核心思路</span>'
      + `<h2>${UI.esc(meta.name)}</h2><p>${UI.esc(meta.strategy)}</p>`
      + '<div class="aside-line"></div><b>学习目标</b>'
      + '<span>做完这道例题后，你应该能复述出解题步骤，'
      + '而不是只记住一个字母。</span></aside>';

    document.getElementById('app').innerHTML = head + progress
      + `<div class="lesson-grid">${paper}${aside}</div></main>`;

    /* 这一页每步都整体重渲染，所以事件在渲染后重新绑定；
       用 onclick 而非 addEventListener，避免重渲染后重复累加。 */
    document.querySelectorAll('[data-lesson-step]')
      .forEach(btn => btn.onclick = () => this.showLesson(item, Number(btn.dataset.lessonStep)));
    document.querySelector('[data-lesson-answer]')
      ?.addEventListener('click', () => this.reveal(item));
  },

  reveal(item) {
    const { q } = item;
    const box = document.getElementById('lesson-answer');

    box.innerHTML = '<div class="teacher-answer">'
      + '<span class="reference-kicker">TEACHER\'S WALKTHROUGH</span><h3>老师带你复盘</h3>'
      + `<p><b>答案：</b>${UI.esc(q.answer || '请结合题目要求完成表达')}</p>`
      + '<p><b>为什么：</b>先用题干确定任务，再用材料或语境找到证据，'
      + '最后排除不符合题意、扩大范围或偷换概念的选项。'
      + '你可以把这条路径记成：<strong>任务 → 证据 → 比较 → 结论</strong>。</p>'
      /* 解析字段在题库里绝大多数是结构化对象（summary/question/evidence/answer），
         原来这里用 UI.text 直接拼，String(对象) 得到 "[object Object]" ——
         例题页的「结合本题」整段是坏的。必须走 explanationHtml，
         它同时兼容老数据的纯字符串形态。 */
      + (q.explanation
        ? `<div class="explanation"><b>结合本题</b>${UI.explanationHtml(q.explanation)}</div>`
        : '')
      + `<a class="primary-btn" href="#/training/${item.meta?.key || item.section.key}`
      + `/${item.exam.id}/${item.q.id}">现在自己做一题 →</a></div>`;
  },

  /* 独立训练：同题型的具体一题，作答后即时反馈。
     找不到对应题目（题库改过、链接过期）就退回题型列表，不留白屏。 */
  async show(exams, typeKey, id, qid) {
    const data = await Training.build(exams, typeKey);
    const found = data.items.find(x => x.exam.id === id && String(x.q.id) === String(qid));
    if (!found) { location.hash = `#/training/${typeKey}`; return; }

    const item = { ...found, meta: data.meta };
    const { meta, q, section, exam } = item;

    const opts = (q.options || []).map(o => '<label class="training-option">'
      + `<input type="radio" name="training-answer" value="${UI.esc(o.letter)}">`
      + `<span>${UI.esc(o.letter)}</span>${UI.esc(o.text)}</label>`).join('');

    const head = '<main class="training-practice"><header class="reference-header">'
      + `<a class="reference-brand" href="#/training/${typeKey}"><span class="brand-mark">英</span>`
      + `<span><b>${UI.esc(meta.name)} · 独立训练</b><small>${UI.esc(exam.title)}</small></span></a>`
      + `<a class="mistake-link" href="#/training/${typeKey}">返回题型</a></header>`;

    const paper = '<article class="practice-paper">'
      + `<div class="practice-kicker">${UI.esc(meta.en)} · ${UI.esc(exam.year)} `
      + `${UI.esc(exam.paper)}</div>`
      + `<h1>第 ${q.id} 题</h1>`
      + (section.passages?.length
        ? `<div class="practice-passage"><b>${UI.esc(section.passages[0].label || '阅读材料')}</b>`
          + `<p>${UI.text(section.passages[0].text)}</p></div>`
        : '')
      + `<p class="practice-stem">${UI.text(q.stem || '')}</p>`
      + '<div class="training-options">'
      + (opts || '<textarea id="training-free" placeholder="写下你的答案"></textarea>')
      + '</div>'
      + '<div class="practice-actions"><button class="primary-btn" data-training-submit>提交答案</button>'
      + `<a class="ghost-btn" href="#/training/${typeKey}">换一道</a></div>`
      + '<div id="training-feedback"></div></article>';

    const aside = '<aside class="training-aside"><span class="reference-kicker">遇到卡题时</span>'
      + '<h2>先回到四步法</h2>'
      + '<p>任务 → 证据 → 比较 → 结论。不要跳过找证据这一步。</p></aside>';

    document.getElementById('app').innerHTML = head
      + `<div class="practice-grid">${paper}${aside}</div></main>`;

    document.querySelector('[data-training-submit]').onclick = () => this.judge(q);
  },

  /* 判分口径与 exam.js 的 isCorrect 一致：去空白 + 忽略大小写。
     没有 answer 的主观题一律走「先别急着看答案」分支。 */
  judge(q) {
    const picked = document.querySelector('input[name="training-answer"]:checked')?.value;
    const val = picked || document.getElementById('training-free')?.value || '';
    const ok = q.answer != null && UI.eqAnswer(val, q.answer);

    document.getElementById('training-feedback').innerHTML =
      `<div class="training-feedback ${ok ? 'ok' : 'bad'}">`
      + `<b>${ok ? '回答正确' : '这次先别急着看答案'}</b>`
      + (q.answer ? `<span>参考答案：${UI.esc(q.answer)}</span>` : '')
      + '<p>回想刚才的步骤：你找到题干任务了吗？你能指出支持答案的证据吗？</p>'
      /* 同 reveal()：解析是结构化对象，必须走 explanationHtml，
         原来的 UI.text 会把整段渲染成 "[object Object]"。 */
      + (q.explanation
        ? `<div class="explanation"><b>结合本题</b>${UI.explanationHtml(q.explanation)}</div>`
        : '')
      + '</div>';
  },
};
