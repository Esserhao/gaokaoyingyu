/* =====================================================================
   错题本 / 知识系谱 / 知识点详情 / 跨试卷重练
   这四块共用一条主线：一道错题 → 错因与知识节点 → 可回炉的训练。
   ===================================================================== */

/* 知识库（data/knowledge/index.js）里没有该节点时的兜底规则。写死在代码里是
   有意的：知识库覆盖语法类节点，而 js/diagnose.js 还会产出「固定短语」
   「词形变化」这类库里没有的节点 —— 缺了下面这张表，详情页就只剩一句
   「先回到具体错题…」的通用话。

   键名必须与 DIAG_RULES 的 node 字段对齐，新增分类要同时补一条规则。
   注意：12 个篇章/词义辨析子技能节点（细节理解、动词词义辨析等）的方法卡
   在 js/subskill.js —— knowledgeDetail 会按「节点 → 家族」先分派到
   子技能版式，轮不到这张表。别把那 12 个键加回来，两处内容会漂移。 */
const NODE_RULES = {
  /* 语法（知识库已覆盖的，这里只留最高频的几个做双保险） */
  主谓一致: '先找真正的主语，再判断谓语形式；插入成分不改变主语。',
  词形变化: '先确定词性，再根据句法位置和上下文判断词形。',
  固定搭配: '不要只看单词意思，要连同常用搭配一起记忆。',
  介词词组: '确认动词、形容词或名词后面需要的介词，再回读整句。',
  粗心大意: '提交前逐项检查题干要求、证据位置和答案格式。',

  /* 语法：知识库现有 50 个节点，这里只留它真没收的几个（由 DIAG_RULES 产出） */
  名词性从句: '先判断从句在主句里作什么成分，再决定用 that、what 还是 whether。',
  固定句型: '句型题记整句框架，先把框架默写出来，再往里填本题的内容。',
  强调句: '去掉 it is / was 与 that 后若句子仍完整，才是强调句而非定语从句。',
  数词: '注意 hundred/thousand 这类词的单复数规则，以及序数词前的冠词。',

  /* 词类：不在 12 个子技能里、也不在知识库，仍需兜底 */
  固定短语: '短语题记整体不记单词，遇到生词先看它与哪个介词或副词搭配。',
};

/* 错题归类的唯一口径：知识节点 → 细分错因 → 错因 → 未分类。
   实现统一抽到了 store.js 的 classifyKey（全局函数），这里只别名引用，
   避免「改一处要改两处」。系谱页、详情页、重练分组都走它。 */
const nodeOf = classifyKey;

/* 错因下拉的取值集合。必须是 js/diagnose.js 能产出的值的超集 ——
   自动判定填进来的值如果不在 <option> 里，select 会显示成「请选择」，
   界面上看着没分类、统计里却已经算了一条，两边对不上。

   「篇章」与那五个篇章细分是随自动分类一起加的：阅读、七选五、听力
   占错题的大头，原来只能勉强归进「句」或留空。 */
const CAUSE_OPTIONS = ['词', '句', '篇章', '粗心大意'];

const SUBCAUSE_OPTIONS = [
  '单词', '词形变化', '语法结构', '句法结构', '固定搭配', '介词词组',
  '细节定位', '推理判断', '主旨概括', '词义猜测', '语篇连贯', '审题/漏看',
];

/* 下拉选项：原始输出里 value 与 ${selected} 之间有一个空格，
   未选中时会留下 `<option value="词" >`。这里照原样生成 ——
   去掉空格会改变输出字节。 */
function causeOption(value, current) {
  return `<option value="${value}" ${current === value ? 'selected' : ''}>${value}</option>`;
}

Object.assign(UI, {
  /* ---------------------------------------------------------------
     ① 知识系谱：从错题统计出发的节点总览
     --------------------------------------------------------------- */
  /* 左侧按知识库 category 展开树，下方列出实际记录到的节点。
     category 名与节点名一致时才会显示条数，因此新增知识库分类时
     要让 category 与错题里的 knowledgeNode 用同一套名字。 */
  knowledge(items) {
    const stats = {};
    items.forEach(x => { const k = nodeOf(x); stats[k] = (stats[k] || 0) + 1; });

    const catMap = {};
    (KB || []).forEach(k => {
      catMap[k.category] = catMap[k.category] || [];
      catMap[k.category].push(k.name);
    });
    const nodes = Object.entries(catMap)
      .map(([cat, names]) => [cat, names.join(' · ')])
      .filter(([cat]) => cat);

    const tree = nodes.map(([title, desc]) => '<section class="lineage-node"><div>'
      + `<b>${title}</b><span>${desc}</span></div>`
      + `<strong>${stats[title] || 0} 条</strong></section>`).join('');

    const log = Object.entries(stats)
      .map(([k, v]) => `<a href="#/knowledge/${encodeURIComponent(k)}">`
        + `${this.esc(k)} · ${v} 条 →</a>`)
      .join('') || '<p>完成错题标注后，这里会显示你的知识薄弱点。</p>';

    this.app().innerHTML = this.header('错题溯源', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">KNOWLEDGE LINEAGE</span><h1>错题溯源</h1></div>'
      + '<a class="text-btn" href="#/mistakes">返回错题本</a></div>'
      + '<p class="knowledge-intro">'
      + '从错误出发，沿着“错因 → 知识节点 → 可回炉训练”追踪薄弱环节。</p>'
      + `<div class="lineage-tree">${tree}</div>`
      + `<div class="knowledge-log"><h2>已记录的知识节点</h2>${log}</div></main>`;
  },

  /* ---------------------------------------------------------------
     分台阶学习：主动浏览全部知识点、按 level 分层、自评掌握度、追踪进度
     filter: 'all' | '基础' | '进阶' | '挑战'
     设计取舍：自评按钮只用就地 DOM 更新（不整页重渲染），否则在 38 个
     节点里翻到一半点一下就被滚回顶部；难度筛选是刻意操作，才整页重渲染。
     --------------------------------------------------------------- */
  learn(filter) {
    filter = filter || 'all';
    const nodes = (KB || []);
    const mastery = Store.getKBMastery();
    const kbProg = Store.getKBProgress();

    const levels = ['基础', '进阶', '挑战'];
    const counts = { '模糊': 0, '思路': 0, '掌握': 0, '未开始': 0 };
    nodes.forEach(n => {
      const m = mastery[n.id];
      counts[(m === '模糊' || m === '思路' || m === '掌握') ? m : '未开始']++;
    });
    const total = nodes.length;
    const pct = total ? Math.round((counts['掌握'] + counts['思路'] * 0.5) / total * 100) : 0;

    const chips = ['all'].concat(levels).map(f => {
      const label = f === 'all' ? '全部' : f;
      const c = f === 'all' ? total : nodes.filter(n => n.level === f).length;
      return '<button class="learn-filter' + (filter === f ? ' active' : '')
        + `" data-learn-filter="${f}">${this.esc(label)}<b>${c}</b></button>`;
    }).join('');

    const catMap = {};
    nodes.forEach(n => {
      if (filter !== 'all' && n.level !== filter) return;
      (catMap[n.category] = catMap[n.category] || []).push(n);
    });
    /* A11 单元 mini 诊断：按 category（单元）聚合，且不受难度筛选影响
       ——诊断是单元级事实，筛到「基础」时也该看到整个单元的分布。 */
    const catMapAll = {};
    nodes.forEach(n => (catMapAll[n.category] = catMapAll[n.category] || []).push(n));
    const groups = Object.keys(catMap).map(cat => {
      const grid = catMap[cat].map(n => this.learnNode(n, mastery[n.id], kbProg[n.id])).join('');
      const diag = this.unitDiag(catMapAll[cat] || [], mastery, kbProg);
      return '<section class="learn-cat"><h2>' + this.esc(cat)
        + '<span>' + catMap[cat].length + ' 个知识点</span></h2>'
        + diag
        + '<div class="learn-grid">' + grid + '</div></section>';
    }).join('');

    this.app().innerHTML = this.header('知识台阶', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">LEARNING PATH</span><h1>知识台阶</h1></div>'
      + '<a class="text-btn" href="#/knowledge">查看错题溯源</a></div>'
      + '<section class="learn-hero"><div class="learn-hero-head"><p>'
      + `把 ${total} 个高考英语知识点按难度分级，每学完一个标记你的掌握度。</p>`
      + `<div class="learn-progress-num"><b>${counts['掌握']}</b>`
      + `<span>/ ${total} 已掌握</span></div></div>`
      + `<div class="learn-bar"><i style="width:${pct}%"></i></div>`
      + '<div class="learn-legend">'
      + `<span class="lg lg-master">已掌握 ${counts['掌握']}</span>`
      + `<span class="lg lg-idea">有点思路 ${counts['思路']}</span>`
      + `<span class="lg lg-fuzzy">有点模糊 ${counts['模糊']}</span>`
      + `<span class="lg lg-none">未开始 ${counts['未开始']}</span>`
      + '</div></section>'
      + '<div class="learn-filters">' + chips + '</div>'
      + (groups || '<p class="knowledge-intro">该难度下暂无知识点。</p>')
      + '</main>';
  },

  /* A11 单元 mini 诊断（2026-09-03）：把一个单元（category）内全部
     节点的练测判级聚成一条台阶分布条 + 一句可行动建议。
     两种信号不混算：分布条只反映题池练测判级（Review.kbTier），
     自评只在「没练过但自评模糊」时参与薄弱判定。薄弱 = 有点模糊
     （rank 1）的节点——「有点思路」是正常推进中，不算薄弱。 */
  unitDiag(catNodes, mastery, kbProg) {
    const total = catNodes.length;
    if (!total) return '';
    const dist = [0, 0, 0, 0, 0];
    const weak = [];
    catNodes.forEach(n => {
      const p = kbProg[n.id];
      const rank = p && p.seen ? Review.kbTier(p).rank : 0;
      dist[rank]++;
      if (rank === 1 || (rank === 0 && mastery[n.id] === '模糊')) weak.push(n);
    });

    const segs = dist.map((c, r) => c
      ? `<i class="ud-s${r}" style="flex-grow:${c}"></i>` : '').join('');
    const parts = [];
    if (dist[4]) parts.push(`挺熟 ${dist[4]}`);
    if (dist[3]) parts.push(`基本会了 ${dist[3]}`);
    if (dist[2] + dist[1]) parts.push(`在练 ${dist[2] + dist[1]}`);
    if (dist[0]) parts.push(`没练 ${dist[0]}`);

    const links = weak.slice(0, 3).map(n =>
      `<a href="#/knowledge/${encodeURIComponent(n.id)}">${this.esc(n.name)}</a>`).join('、');
    let advice;
    if (weak.length) {
      advice = `薄弱 ${weak.length} 个，先回炉：${links}`
        + (weak.length > 3 ? ` 等 ${weak.length} 个` : '');
    } else if (dist[0] === 0) {
      advice = '这个单元的节点全部练过且都过了「有点思路」线——保持复练节奏。';
    } else if (dist[3] + dist[4] > 0) {
      advice = `练过的都过线了，往下推没练的 ${dist[0]} 个节点。`;
    } else if (dist[0] === total) {
      advice = '这个单元还没开练——从「基础」台阶的节点开始，练一题亮一格。';
    } else {
      advice = '先把有印象的节点推过「基本会了」，再扩新节点。';
    }

    return '<div class="unit-diag">'
      + `<div class="unit-diag-bar">${segs || '<i class="ud-s0" style="flex-grow:1"></i>'}</div>`
      + `<span class="unit-diag-legend">全单元 ${total} 个`
      + (parts.length ? ' · ' + parts.join(' · ') : '') + '</span>'
      + `<p class="unit-diag-advice">${advice}</p></div>`;
  },

  learnNode(n, m, prog) {
    const levelCls = ({ '基础': 'lv-base', '进阶': 'lv-mid', '挑战': 'lv-hard' })[n.level] || 'lv-base';
    /* 练测台阶徽标（A10）：做过题的节点把判级亮出来，与自评互为参照 */
    const tier = prog && prog.seen ? Review.kbTier(prog) : null;
    const tierChip = tier
      ? `<span class="kbq-tier t${tier.rank}" title="题池练测判级">${this.esc(tier.name)}</span>` : '';
    const opts = [
      { key: '模糊', label: '有点模糊', cls: 'ms-fuzzy' },
      { key: '思路', label: '有点思路了', cls: 'ms-idea' },
      { key: '掌握', label: '掌握', cls: 'ms-master' },
    ];
    const btns = opts.map(o =>
      '<button class="learn-ms ' + o.cls + (m === o.key ? ' is-active' : '')
      + `" data-action="kb-mastery" data-node="${this.esc(n.id)}" data-level="${o.key}">`
      + this.esc(o.label) + '</button>'
    ).join('');
    const tags = (n.tags || []).map(t => `<span class="learn-tag">${this.esc(t)}</span>`).join('');

    return '<article class="learn-node ' + levelCls + '" data-learn-node="' + this.esc(n.id) + '">'
      + '<div class="learn-node-head"><div class="learn-node-title">'
      + `<b>${this.esc(n.name)}</b>`
      + `<span class="learn-level ${levelCls}">${this.esc(n.level)}</span>${tierChip}${this.kbFreqChip(n.id)}</div>`
      + `<a class="text-btn learn-detail-link" href="#/knowledge/${encodeURIComponent(n.id)}">详解 →</a></div>`
      + (n.summary ? `<p class="learn-summary">${this.esc(n.summary)}</p>` : '')
      + (tags ? `<div class="learn-tags">${tags}</div>` : '')
      + '<div class="learn-ms-row" role="group" aria-label="' + this.esc(n.name) + ' 掌握度自评">' + btns + '</div>'
      + '</article>';
  },

  /* 自评后就地刷新顶部统计（进度数 / 进度条 / 图例），不整页重渲染。
     与 mark-mistake 那种「整页重渲染」不同：自评是高频微交互，
     整页重渲染会丢掉滚动位置，浏览长列表时体验很糟。 */
  refreshLearnCounters() {
    const nodes = (KB || []);
    const mastery = Store.getKBMastery();
    const counts = { '模糊': 0, '思路': 0, '掌握': 0, '未开始': 0 };
    nodes.forEach(n => {
      const m = mastery[n.id];
      counts[(m === '模糊' || m === '思路' || m === '掌握') ? m : '未开始']++;
    });
    const total = nodes.length;
    const pct = total ? Math.round((counts['掌握'] + counts['思路'] * 0.5) / total * 100) : 0;
    const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    set('.learn-progress-num b', counts['掌握']);
    set('.learn-progress-num span', '/ ' + total + ' 已掌握');
    const bar = document.querySelector('.learn-bar i'); if (bar) bar.style.width = pct + '%';
    set('.lg-master', '已掌握 ' + counts['掌握']);
    set('.lg-idea', '有点思路 ' + counts['思路']);
    set('.lg-fuzzy', '有点模糊 ' + counts['模糊']);
    set('.lg-none', '未开始 ' + counts['未开始']);
  },

  /* ---------------------------------------------------------------
     ② 知识点详情：一句话规则 + 知识库卡片 + 错题证据 + 下一步
     --------------------------------------------------------------- */
  /* related 里的下标就是「即时重练」的 data-index，与 items 的下标无关，
     所以 app.js 的 knowledge-retry 分支必须按同一个 related 重新筛一遍。 */
  /* 「节点 → 家族」分派（task.md §8.4 唯一出口条款）：12 个子技能节点
     （细节理解、动词词义辨析等）在这里渲染成子技能版式 —— 方法卡 +
     三档进度 + 指向子技能专项列表的入口；其余节点走原知识节点版式。
     子技能不在知识库（KB）里，kbCards 为空是预期行为，不是缺数据。 */
  subskillTierBadge(sk) {
    const tb = Subskill.tierBadge(Store.getSubskillHistory(), sk.id);
    return `<em class="subskill-tier t-${tb.cls}">${this.esc(tb.text)}</em>`;
  },

  /* 子技能的「去练」地址：B3 起指向子技能专项列表（按归类过滤的题池），
     而不是题型泛池。 */
  _skillPracticeHref(sk) {
    return `#/training/${sk.section}/skill/${encodeURIComponent(sk.id)}`;
  },

  knowledgeDetail(node, items) {
    const sk = Subskill.byId(node);
    const related = items.filter(x => nodeOf(x) === node);
    const examCount = new Set(related.map(x => x.examTitle).filter(Boolean)).size;

    const causeMap = {};
    related.forEach(x => {
      const k = x.subCause || x.cause || '未分类';
      causeMap[k] = (causeMap[k] || 0) + 1;
    });
    const causeList = Object.entries(causeMap).sort((a, b) => b[1] - a[1]);

    /* 相关知识点取「你在别的节点上错得最多的前 6 个」，用于顺带回炉。 */
    const allStats = {};
    items.forEach(x => { const k = nodeOf(x); allStats[k] = (allStats[k] || 0) + 1; });
    const relatedNodes = Object.keys(allStats).filter(k => k !== node)
      .sort((a, b) => allStats[b] - allStats[a]).slice(0, 6);

    const kbItem = (KB || []).find(k => k.id === node);
    const rule = sk ? sk.method : (kbItem && kbItem.rule) || NODE_RULES[node]
      || '先回到具体错题，观察错误发生在哪一步，再归纳可复用的规则。';
    const eyebrow = sk ? 'SKILL · 题型子技能' : 'KNOWLEDGE NODE';

    this.app().innerHTML = this.header('知识点详情', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + `<span class="eyebrow">${eyebrow}</span><h1>${this.esc(node)}</h1></div>`
      + '<a class="text-btn" href="#/knowledge">返回错题溯源</a></div>'
      + '<section class="knowledge-detail-hero"><b>一句话规则</b>'
      + `<p>${this.esc(rule)}</p>`
      + (sk ? this.subskillTierBadge(sk) : this.kbStrengthBadge(kbItem && kbItem.strength))
      + this.kbFreqChip(node)
      + `<span>已关联 ${related.length} 道错题 · 来自 ${examCount} 套真题</span>`
      + (related.length
        ? '<button class="primary-btn retry-group-btn" data-action="knowledge-retry-group" '
          + `data-node="${this.esc(node)}">跨试卷重练本组（${related.length} 题）</button>`
        : '')
      + (sk ? `<a class="primary-btn" href="${this._skillPracticeHref(sk)}">`
          + `练「${this.esc(sk.name)}」专项题 →</a>` : '')
      + '</section>'
      + this.kbCards(kbItem)
      + (kbItem && !sk ? this.kbQuizShell(node) : '')
      + '<section class="knowledge-detail-grid">'
      + this.kdEvidence(related, examCount)
      + this.kdCauseFreq(causeList)
      + this.kdRelatedNodes(relatedNodes, allStats)
      + '<article class="knowledge-detail-card"><h2>下一步怎么练</h2>'
      + '<ol><li>先复述上面的规则。</li>'
      + '<li>打开一条错误证据，说明自己错在审题、定位还是判断。</li>'
      + '<li>回到对应题型训练，完成一道新题后再检查是否稳定。</li></ol>'
      + `<a class="primary-btn" href="${sk ? this._skillPracticeHref(sk) : '#/training'}">`
      + (sk ? `进入「${this.esc(sk.name)}」专项 →` : '进入分题型训练 →') + '</a></article>'
      + '</section></main>';
  },

  /* 知识库三卡（例句 / 常见错误 / 易混点）。data/knowledge.json 没有
     这个节点时整段不输出，不留空卡片。
     常见错误是 A6 后的三段结构 wrong/right/why（错误句/改正/原因）。 */
  kbCards(kbItem) {
    if (!kbItem) return '';

    const examples = kbItem.examples.map(ex => `<li><p>${this.esc(ex.sentence)}</p>`
      + `<small>${this.esc(ex.source)} · 答案：<b>${this.esc(ex.answer)}</b></small></li>`).join('');
    const errors = kbItem.commonErrors.map(e => '<li>'
      + `<b class="kb-wrong">${this.esc(e.wrong || e.error || '')}</b>`
      + `<span class="kb-right">→ ${this.esc(e.right || '')}</span>`
      + `<small>${this.esc(e.why || e.detail || '')}</small></li>`).join('');
    const confusion = kbItem.confusionPoints.map(c => `<li><b>${this.esc(c.point)}</b>`
      + `<span>${this.esc(c.detail)}</span></li>`).join('');

    /* 要点（逐条配例，2026-09-22）：rule 里原本 ①②③ 连成一整段，挤在屏幕上
       是一坨，不符合阅读习惯。这里把 points 拆成有序列表，每条要点下压一行
       「例 + 点题」。没有 points 的节点（rule 本就是一句话）整段不出。 */
    const points = (kbItem.points || []).map(p => '<li>'
      + `<p class="kb-pt-text">${this.esc(p.text)}</p>`
      + `<p class="kb-pt-ex"><b>例</b><i>${this.esc(p.example)}</i></p>`
      + (p.note ? `<small class="kb-pt-note">${this.esc(p.note)}</small>` : '')
      + '</li>').join('');

    return (points
        ? '<section class="knowledge-detail-grid"><article class="knowledge-detail-card">'
          + '<h2>要点 · 逐条配例</h2><ol class="kb-points">' + points + '</ol></article></section>'
        : '')
      + '<section class="knowledge-detail-grid">'
      + '<article class="knowledge-detail-card"><h2>知识库 · 权威例句</h2>'
      + `<ol class="kb-examples">${examples}</ol></article>`
      + '<article class="knowledge-detail-card"><h2>常见错误</h2>'
      + `<ul class="kb-errors">${errors}</ul></article>`
      + '<article class="knowledge-detail-card"><h2>易混点</h2>'
      + `<ul class="kb-confusion">${confusion}</ul></article></section>`;
  },

  /* 考点频次（2026-09-22）：数据来自 data/knowledge/freq.js（__KB_FREQ__），
     由 tools/build_kb_freq.js 从 16 套真题的解析摘要与短文改错逐处知识点
     统计而来（同一题对同一知识点最多计 1 次）。写作类节点是主观题、摘要里
     没有「考查X」，改用「题型覆盖」口径，措辞与点名次数分开，不混算。 */
  kbFreq(id) {
    const F = window.__KB_FREQ__;
    if (!F || !F.nodes) return null;
    const st = F.nodes[id];
    if (!st) return null;
    const total = (F.meta && F.meta.papers) || 16;
    if (st.kind === 'section') {
      return { label: '题型覆盖', text: `${st.papers}/${total} 套写作卷`, tone: 'section' };
    }
    if (!st.hits) return { label: '考频', text: '真题未直接考查', tone: 'zero' };
    return { label: '考频', text: `${st.hits} 次 · ${st.papers} 卷`, tone: st.hits >= 15 ? 'hot' : 'normal' };
  },

  kbFreqChip(id) {
    const f = this.kbFreq(id);
    if (!f) return '';
    return `<span class="kb-freq kb-freq-${f.tone}" title="真题考频，据题库解析摘要统计">`
      + `<b>${f.label}</b>${this.esc(f.text)}</span>`;
  },

  /* 规则强度徽标（A6）：硬规则 / 多数情况 / 语域相关。诚实标注 ——
     tendency/register 的规则在界面上明说「不是绝对」，不冒充硬规则。 */
  kbStrengthBadge(strength) {
    const map = {
      rule: { cls: 'kb-st-rule', label: '硬规则' },
      tendency: { cls: 'kb-st-tendency', label: '多数情况' },
      register: { cls: 'kb-st-register', label: '语域相关' },
    };
    const s = map[strength];
    return s ? `<span class="kb-strength ${s.cls}" title="规则强度">${s.label}</span>` : '';
  },

  /* ==================== 节点练测（题池 8 题，A9/A10） ====================
     questions.js 惰加载；会话状态在 UI._kbq（刷新即丢，进度已逐题落盘）。
     练测模式：作答实时 Store.saveKBAnswer；到 100% 且每变体命中 →
     自动排 1/3/7 复练。复练模式（review=true）：结算走 Store.reviewKBNode，
     全对进下一轮，走完三轮毕业（挺熟了），不累计 seen/correct。 */
  _kbqP: null,

  kbQuestions() {
    if (this._kbqP) return this._kbqP;
    this._kbqP = new Promise(resolve => {
      if (window.__KBQ__) return resolve();
      const s = document.createElement('script');
      s.src = 'data/knowledge/questions.js';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
    return this._kbqP;
  },

  /* 页面骨架（同步输出，快照确定性）；内容 _kbqReady 后回填。
     每次整页渲染都清掉陈旧会话：会话是内存态，重进页面即作废，
     该展示什么由已落盘的进度（复练到期/已排期）决定。 */
  kbQuizShell(node) {
    this._kbq = null;
    this.kbQuestions().then(() => {
      const box = document.querySelector('[data-kbq-box]');
      if (box && box.dataset.node === node) this._kbqRender(node);
    });
    return '<section class="knowledge-detail-grid"><article class="knowledge-detail-card" '
      + `data-kbq-box data-node="${this.esc(node)}"><h2>节点练测</h2>`
      + '<p class="kbq-loading">题库加载中…</p></article></section>';
  },

  /* 盒子级重渲染：作答/翻题只刷新盒子，不整页跳顶 */
  _kbqRender(node) {
    const box = document.querySelector('[data-kbq-box]');
    if (!box || box.dataset.node !== node || !window.__KBQ__) return;
    box.innerHTML = this._kbqBody(node);
  },

  _kbqBody(node) {
    const bank = window.__KBQ__.questions[node] || [];
    if (!bank.length) return '<p class="kbq-loading">本节点暂无练习题。</p>';
    const prog = Store.getKBProgress()[node];
    const tier = Review.kbTier(prog);
    const vs = (prog && prog.variants) || {};
    const variantsMeta = (window.__KBQ__.variants || {})[node] || [];
    const hitCount = variantsMeta.filter(v => (vs[v] && vs[v].correct > 0)).length;

    const head = '<h2>节点练测 '
      + `<span class="kbq-tier t${tier.rank}">${this.esc(tier.name)}</span></h2>`
      + '<p class="kbq-meta">已答 ' + ((prog && prog.seen) || 0)
      + ' · 对 ' + ((prog && prog.correct) || 0)
      + ` · 变体命中 ${hitCount} / ${variantsMeta.length || '—'}`
      + (prog && prog.retired ? ' · 已走完 1/3/7 复练' : '') + '</p>';

    const s = this._kbq;
    if (s && s.node === node && s.done) return head + this._kbqSummary(node, bank, prog);
    if (s && s.node === node) return head + this._kbqFlow(node, bank, prog);

    /* 无会话：到复练期 → 复练入口；否则 → 开始/再练入口 */
    const due = prog && !prog.retired && typeof prog.nextReviewAt === 'number'
      && prog.nextReviewAt <= Date.now();
    let entry;
    if (due) {
      entry = '<p class="kbq-note">间隔复练到期了（第 '
        + ((prog.reviewStage || 0) + 1) + ' / ' + Review.KBQ_STAGES.length + ' 轮）。'
        + '重做本节点 8 题，全对才算过。</p>'
        + '<button class="primary-btn" data-action="kbq-start" data-node="' + this.esc(node)
        + '" data-review="1">开始间隔复练 →</button>';
    } else if (prog && prog.nextReviewAt && !prog.retired) {
      entry = '<p class="kbq-note">全部答对且每变体命中，已排第 '
        + ((prog.reviewStage || 0) + 1) + ' / ' + Review.KBQ_STAGES.length
        + ' 轮复练（' + this.esc(this._kbqDueLabel(prog.nextReviewAt)) + '）。</p>'
        + '<button class="text-btn" data-action="kbq-start" data-node="' + this.esc(node)
        + '">提前再练一轮（不计复练）</button>';
    } else {
      entry = '<button class="primary-btn" data-action="kbq-start" data-node="'
        + this.esc(node) + '">'
        + (prog && prog.seen ? '再练一轮（8 题）' : '开始练测（8 题）') + ' →</button>'
        + (prog && prog.retired ? '' : '<p class="kbq-note">答完全对且每个变体都命中，'
          + '会自动安排 1/3/7 天三轮间隔复练，走完即「挺熟了」。</p>');
    }
    return head + entry;
  },

  _kbqDueLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    const days = Math.ceil((ts - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
    return days <= 0 ? '今天' : days + ' 天后（'
      + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日）';
  },

  /* 会话内的单题流：题干 → 作答 → 判定与解析 → 下一题/结算 */
  _kbqFlow(node, bank, prog) {
    const s = this._kbq;
    const q = bank[s.order[s.idx]];
    const badge = q.verified ? '' : '<span class="kbq-unverified" title="机器自编，待人工复核">未复核</span>';
    const parts = ['<p class="kbq-progress">'
      + (s.review ? '间隔复练 · ' : '')
      + `第 ${s.idx + 1} / ${s.order.length} 题 · 变体「${this.esc(q.variant)}」 ${badge}</p>`
      + `<p class="kbq-stem">${this.esc(q.stem)}</p>`];

    if (!s.answered) {
      if (q.kind === 'choice') {
        parts.push('<div class="kbq-opts">' + q.options.map((o, i) => {
          const letter = 'ABCD'[i];
          return `<button class="kbq-opt" data-action="kbq-answer" data-node="${this.esc(node)}"`
            + ` data-opt="${letter}"><b>${letter}.</b> ${this.esc(o.replace(/^[A-D][.、] */, ''))}</button>`;
        }).join('') + '</div>');
      } else {
        parts.push('<div class="kbq-fill-row">'
          + `<input id="kbq-input" data-node="${this.esc(node)}" autocomplete="off" placeholder="输入答案（英文）">`
          + `<button class="primary-btn" data-action="kbq-fill" data-node="${this.esc(node)}">检查答案</button></div>`);
      }
    } else {
      const ok = s.answered.correct;
      if (q.kind === 'choice') {
        parts.push('<div class="kbq-opts">' + q.options.map((o, i) => {
          const letter = 'ABCD'[i];
          const cls = letter === q.answer ? ' is-right'
            : (letter === s.answered.opt ? ' is-wrong' : '');
          return `<span class="kbq-opt${cls}"><b>${letter}.</b> ${this.esc(o.replace(/^[A-D][.、] */, ''))}</span>`;
        }).join('') + '</div>');
      } else {
        parts.push(`<p class="kbq-fill-result ${ok ? 'is-right' : 'is-wrong'}">`
          + `你的答案：${this.esc(s.answered.text || '（空）')} · 正确答案：<b>${this.esc(q.answer)}</b></p>`);
      }
      parts.push(`<p class="kbq-explain ${ok ? 'is-right' : 'is-wrong'}">`
        + (ok ? '✓ 答对了。' : '✗ 答错了。') + this.esc(q.explain) + '</p>');
      const last = s.idx + 1 >= s.order.length;
      parts.push('<button class="primary-btn" data-action="kbq-next" data-node="'
        + this.esc(node) + '">' + (last ? '看结算 →' : '下一题 →') + '</button>');
    }
    return parts.join('');
  },

  /* 会话动作（app.js ACTIONS 调用） */
  kbqStart(node, review) {
    const bank = (window.__KBQ__ && window.__KBQ__.questions[node]) || [];
    if (!bank.length) return;
    const order = bank.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this._kbq = { node, review: !!review, order, idx: 0, right: 0, answered: null, done: false };
    this._kbqRender(node);
  },

  kbqAnswer(node, opt) {
    const s = this._kbq;
    if (!s || s.node !== node || s.answered) return;
    const q = (window.__KBQ__.questions[node] || [])[s.order[s.idx]];
    if (!q) return;
    const correct = opt === q.answer;
    s.answered = { opt, correct };
    if (correct) s.right += 1;
    /* 复练是验收，不累计 seen/correct；结算在 kbqNext 的 done 分支 */
    if (!s.review) Store.saveKBAnswer(node, q.variant, correct);
    this._kbqRender(node);
  },

  kbqFill(node, text) {
    const s = this._kbq;
    if (!s || s.node !== node || s.answered) return;
    const q = (window.__KBQ__.questions[node] || [])[s.order[s.idx]];
    if (!q) return;
    const norm = x => String(x || '').trim().toLowerCase()
      .replace(/[.,!?;:]+$/, '').replace(/[ \t]+/g, ' ');
    const correct = norm(text) === norm(q.answer);
    s.answered = { text: String(text || '').trim(), correct };
    if (correct) s.right += 1;
    if (!s.review) Store.saveKBAnswer(node, q.variant, correct);
    this._kbqRender(node);
  },

  kbqNext(node) {
    const s = this._kbq;
    if (!s || s.node !== node || !s.answered) return;
    s.answered = null;
    s.idx += 1;
    if (s.idx >= s.order.length) {
      s.done = true;
      if (s.review) Store.reviewKBNode(node, s.right === s.order.length);
    }
    this._kbqRender(node);
  },

  /* 结算视图（done 状态下 _kbqBody 拼不上，单独在 flow 后追加——
     用独立方法在 kbqNext 的 done 分支后由 _kbqRender 渲染） */
  _kbqSummary(node, bank, prog) {
    const s = this._kbq;
    const tier = Review.kbTier(prog);
    const passedAll = s.right === s.order.length;
    let note;
    if (s.review) {
      note = passedAll
        ? (prog && prog.retired
          ? '三轮复练全部通过，本节点已毕业：挺熟了。'
          : `复练通过，下一轮排在 ${this._kbqDueLabel(prog.nextReviewAt)}。`)
        : '复练有错，阶段归零，明天再来一轮。';
    } else {
      const due = prog && prog.nextReviewAt && !prog.retired;
      note = passedAll && tier.rank >= 3
        ? (due
          ? '全对！第 ' + ((prog.reviewStage || 0) + 1) + ' / '
            + Review.KBQ_STAGES.length + ' 轮复练排在 '
            + this._kbqDueLabel(prog.nextReviewAt) + '。'
          : '全对！本节点已毕业：挺熟了。')
        : '继续加油：答完全对且每个变体都命中，就会进入间隔复练。';
    }
    return '<p class="kbq-progress">本轮 ' + s.right + ' / ' + s.order.length + ' 题</p>'
      + `<p class="kbq-explain ${passedAll ? 'is-right' : 'is-wrong'}">${this.esc(note)}</p>`
      + `<button class="primary-btn" data-action="kbq-start" data-node="${this.esc(node)}"`
      + (s.review ? ' data-review="1"' : '') + '>再来一轮</button>';
  },

  kdEvidence(related, examCount) {
    const rows = related.map((x, i) => '<div class="knowledge-evidence">'
      + `<b>${i + 1}. ${this.esc(x.examTitle)} · 第 ${this.esc(x.qid)}</b>`
      + `<p>${this.text(x.stem || '暂无题干')}</p>`
      + `<small>你的答案：${this.esc(x.myAnswer || '未作答')} · `
      + `正确答案：${this.esc(x.answer || '')}</small>`
      + '<div class="knowledge-retry">'
      + `<label>即时重练 <input data-knowledge-retry-input="${i}" placeholder="重新输入答案"></label>`
      + `<button class="text-btn" data-action="knowledge-retry" data-index="${i}">检查答案</button>`
      + `<span data-knowledge-retry-result="${i}"></span></div>`
      + '<a class="text-btn" href="#/mistakes">回到错题本 →</a></div>').join('');

    return '<article class="knowledge-detail-card" data-lookup>'
      + `<h2>真题例句与你的错误（跨 ${examCount} 套卷）`
      + '<small class="lookup-hint">点例句中的单词可查词典</small></h2>'
      + (rows || '<p>暂时没有关联错题。完成练习并标注错因后，这里会自动出现。</p>')
      + '</article>';
  },

  kdCauseFreq(causeList) {
    const body = causeList.length
      ? '<ul class="cause-freq">'
        + causeList.map(c => `<li><span>${UI.esc(c[0])}</span><b>${c[1]} 次</b></li>`).join('')
        + '</ul><p class="cause-note">'
        + '你在该节点最常见的错因已标出，回炉时优先覆盖高频错因。</p>'
      : '<p>暂无错因记录。</p>';

    return `<article class="knowledge-detail-card"><h2>常见错误模式</h2>${body}</article>`;
  },

  kdRelatedNodes(relatedNodes, allStats) {
    const body = relatedNodes.length
      ? '<div class="related-nodes">'
        + relatedNodes.map(k => `<a class="related-node" href="#/knowledge/${encodeURIComponent(k)}">`
          + `${UI.esc(k)} · ${allStats[k]} 条</a>`).join('')
        + '</div>'
      : '<p>暂时没有其他知识节点记录。</p>';

    return '<article class="knowledge-detail-card"><h2>相关知识点</h2>'
      + '<p class="cause-note">你常错的其他知识节点，可一并回炉：</p>'
      + body + '</article>';
  },

  /* ---------------------------------------------------------------
     ③ 单题复盘页
     --------------------------------------------------------------- */
  /* index 是错题本数组下标，直接用于 Store.updateMistake，
     所以清空错题后旧链接会失效 —— 这里给出明确空态而不是白屏。 */
  mistakeDetail(index, items) {
    const x = items[index];
    if (!x) {
      this.app().innerHTML = this.header('错题详情', true)
        + '<main class="empty-state"><strong>暂时找不到这道错题</strong>'
        + '<p>这条记录可能已被清空，或索引已经变化。</p>'
        + '<a class="primary-btn" href="#/mistakes">返回错题本</a></main>';
      return;
    }

    const node = nodeOf(x);
    /* 步骤展示：优先「错在哪一步」（M1 与方法卡共用词表），
       老数据的 errorStep / 缺省兜底在后。 */
    const step = this.stageLabel(x.errStage) || x.errorStep || '判断规则';

    const answerCard = '<article class="mistake-detail-card"><h2>答案与证据</h2>'
      + '<div class="answer-compare">'
      + `<span>你的答案 <b>${this.esc(x.myAnswer || '未作答')}</b></span>`
      + `<span>标准答案 <b>${this.esc(x.answer || '待人工确认')}</b></span></div>`
      + (x.explanation
        ? '<details open><summary>查看解析</summary>'
          + `<div class="explanation" data-lookup>${this.explanationHtml(x.explanation)}`
          + `${this.locHtml(x.examId, x.qid)}</div></details>`
        : '')
      + '</article>';

    /* 三个状态按钮走 data-action=set-mistake-status；
       「保存复盘记录」只有 data-save-mistake-note，由 app.js 里
       data-action 判定之前的分支单独处理。 */
    const locateCard = '<article class="mistake-detail-card"><h2>错误定位</h2>'
      + '<div class="review-tags">'
      + `<span>错因：${this.esc(x.cause || '待确认')}</span>`
      + `<span>细分：${this.esc(x.subCause || '待确认')}</span>`
      + `<span>步骤：${this.esc(step)}</span>`
      + `<span>状态：${this.esc(x.reviewStatus || '待回炉')}</span>`
      + `<span>排期：${this.esc(Review.label(x))}</span>`
      /* 自动判定的错因在详情页也要标出来：这一页没有编辑控件，
         学生得知道眼前这三段是机器给的，改要回错题本列表改。 */
      + (x.causeSource === 'auto'
        ? '<span class="cause-auto">自动判定 · 回错题本可修正</span>'
        : '')
      + '<div class="review-status-actions" role="group" aria-label="更新复习状态">'
      + ['待回炉', '复习中', '已掌握'].map(s => '<button class="text-btn" '
        + `data-action="set-mistake-status" data-index="${index}" data-status="${s}">`
        + `${s}</button>`).join('')
      + '</div>'
      /* 错在哪一步（M1）：详情页是复盘主场，步骤归因在这里直接可改。
         chips 自带 data-index（此页没有 .cause-editor 外壳）。 */
      + this.stageChips(x.sectionKey, x.errStage, index)
      + '</div>'
      + '<label class="detail-label">我为什么会错'
      + '<textarea data-mistake-note placeholder="写下当时的思路，以及下次要检查什么">'
      + `${this.esc(x.studentNote || '')}</textarea></label>`
      + `<button class="primary-btn" data-save-mistake-note data-index="${index}">保存复盘记录</button>`
      + '</article>';

    this.app().innerHTML = this.header('错题详情', true)
      + '<main class="mistake-detail-page shell"><div class="library-head"><div>'
      + '<span class="eyebrow">MISTAKE REVIEW</span><h1>把这道错题，<em>复盘到底。</em></h1></div>'
      + '<a class="text-btn" href="#/mistakes">返回错题本</a></div>'
      + '<section class="mistake-detail-hero">'
      + `<span>${this.esc(x.examTitle)} · 第 ${this.esc(x.qid)} 题</span>`
      + `<h2>${this.esc(x.type || '客观题')}</h2>`
      + `<p data-lookup>${this.text(x.stem || '暂无题干')}</p>`
      + '<small class="lookup-hint">点击题干或解析里的英文单词，可直接查词典</small></section>'
      + `<section class="mistake-detail-grid">${answerCard}${locateCard}</section>`
      + '<section class="mistake-next"><div><b>连接到知识节点</b>'
      + `<p>${this.esc(node)} · 从具体错误回到可复习的规则。</p></div>`
      + `<a class="ghost-btn" href="#/knowledge/${encodeURIComponent(node)}">查看知识点详情 →</a>`
      + `<a class="text-btn" href="#/training/${this.esc(x.sectionKey || 'reading')}/example">`
      + '进入对应训练</a>'
      + '</section></main>';
  },

  /* ---------------------------------------------------------------
     ④ 错题本列表
     --------------------------------------------------------------- */
  /* 每条错题带三件事：答案对比、状态操作、错因标注下拉。
     错因由 js/diagnose.js 在交卷时按解析里的考点预填，
     下拉里显示的是自动判定结果 —— 学生的工作从「从零标注」
     变成「核对并纠正」，改动一次就把 causeSource 抹掉。 */
  mistakes(items) {
    /* 队列入口放在错题本顶部而不只在总览里：学生的习惯路径是
       「打开错题本 → 往下滑」，到期条数要在这条路径上出现，
       否则复习队列这一页只有从仪表盘才能到。 */
    const due = Review.due(items).length;
    const tools = items.length
      ? '<span>'
        + `<a class="text-btn" href="#/review-queue">复习队列${due ? `（${due}）` : ''}</a> `
        + '<a class="text-btn" href="#/knowledge">查看错题溯源</a> '
        + '<button class="text-btn" data-action="clear-mistakes">清空记录</button>'
        + '<button class="text-btn" data-action="print-page">打印</button></span>'
      : '';

    const body = items.length
      ? items.map((x, i) => this.mistakeItem(x, i)).join('')
      : '<div class="empty-state"><strong>还没有错题</strong>'
        + '<p>完成一套练习后，答错的题目会自动收录到这里。</p>'
        + '<a class="primary-btn" href="#/">去做一套真题</a></div>';

    this.app().innerHTML = this.header('错题本', true)
      + '<main class="mistakes shell"><div class="library-head"><div>'
      + '<span class="eyebrow">REVIEW LOG</span><h1>错题本</h1></div>'
      + `${tools}</div>`
      /* 阶段归因聚合（M1）：同一方法步骤错 ≥2 次才亮，只错一次不说明方法问题 */
      + this.stageSummary(items)
      + `${body}</main>`;
  },

  mistakeItem(x, i) {
    const actions = '<div class="mistake-actions">'
      + `<a class="text-btn" href="#/mistake/${i}">打开详情 →</a>`
      + `<span class="mistake-status">${this.esc(x.reviewStatus || '待回炉')}</span>`
      /* 排期状态与复习状态是两件事：前者是「什么时候再见」，后者是
         「上次见时会不会」。两个都显示，否则「已掌握」的题在队列里
         突然消失，学生不知道是被排到 30 天后还是彻底毕业了。 */
      + `<span class="review-due">${this.esc(Review.label(x))}</span>`
      + `<button class="text-btn" data-action="mark-mistake" data-index="${i}">`
      + `${x.reviewStatus === '已掌握' ? '已标记掌握' : '标记为已掌握'}</button>`
      + '<span class="review-status-actions">'
      + ['待回炉', '复习中'].map(s => '<button class="text-btn" data-action="set-mistake-status" '
        + `data-index="${i}" data-status="${s}">${s}</button>`).join('')
      + '</span>'
      /* sectionKey 由 Store.addMistakes 保留，缺了这个字段就没有回训练的入口 */
      + (x.sectionKey
        ? `<a class="text-btn" href="#/training/${this.esc(x.sectionKey)}">回到对应训练 →</a>`
        : '')
      + '</div>';

    /* auto 标记只在学生没动过错因时出现，提示这三格是机器填的、需要核对。 */
    const auto = x.causeSource === 'auto'
      ? '<span class="cause-auto">自动判定 · 可修正</span>'
      : '';

    const editor = `<div class="cause-editor" data-index="${i}">`
      + '<label>错因：<select data-cause><option value="">请选择</option>'
      + CAUSE_OPTIONS.map(v => causeOption(v, x.cause)).join('')
      + '</select></label>'
      + '<label>细分：<select data-subcause><option value="">请选择</option>'
      + SUBCAUSE_OPTIONS.map(v => causeOption(v, x.subCause)).join('')
      + '</select></label>'
      + `<label>知识节点：<input data-node value="${this.esc(x.knowledgeNode || '')}" `
      + 'placeholder="如：介词 + 名词"></label>'
      /* 错在哪一步（M1）：与方法卡共用词表的步骤 chips，主观题题型不出这行 */
      + this.stageChips(x.sectionKey, x.errStage, i)
      + auto + '</div>';

    return '<article class="mistake-item"><div class="mistake-top">'
      + `<b>${i + 1}. ${this.esc(x.examTitle)}</b>`
      + `<span>第 ${x.qid} 题 · ${this.esc(x.type || '客观题')}</span></div>`
      + `<p>${this.text(x.stem)}</p>`
      + `<div class="mistake-answer">你的答案：${this.esc(x.myAnswer || '未作答')}　`
      + `正确答案：<b>${this.esc(x.answer || '')}</b></div>`
      + (x.explanation
        ? '<details><summary>查看解析</summary>'
          + `<div class="explanation">${this.explanationHtml(x.explanation)}</div></details>`
        : '')
      + actions + editor + '</article>';
  },
  /* ---------------------------------------------------------------
     ⑤ 跨试卷整组连续重练
     把同一知识节点下散落在各套卷子里的错题串成一个序列，逐题重做。
     状态存在 UI._retry（内存，刷新即丢）——它只是一次会话内的临时练习，
     不写 localStorage，避免和错题本本身的复习状态互相污染。
     --------------------------------------------------------------- */
  startRetryGroup(node) {
    const items = Store.getMistakes().filter(x => nodeOf(x) === node);
    if (!items.length) { this.knowledgeDetail(node, Store.getMistakes()); return; }
    this._retry = { node, items, index: 0, correct: 0, judged: [] };
    this.renderRetryQuestion();
  },

  renderRetryQuestion() {
    const r = this._retry;
    if (!r) return;
    const x = r.items[r.index];
    const total = r.items.length;
    const pct = Math.round(r.index / total * 100);

    this.app().innerHTML = this.header('跨试卷重练', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + `<span class="eyebrow">CROSS-PAPER RETRY</span><h1>${this.esc(r.node)}</h1></div>`
      + `<a class="text-btn" href="#" data-action="retry-exit" data-node="${this.esc(r.node)}">退出重练</a>`
      + '</div><section class="retry-progress">'
      + `<div class="retry-bar"><i style="width:${pct}%"></i></div>`
      + `<span>第 ${r.index + 1} / ${total} 题 · 来自 ${this.esc(x.examTitle || '')}</span></section>`
      + '<section class="retry-card">'
      + `<span class="retry-type">${this.esc(x.type || '客观题')} · 第 ${this.esc(x.qid)} 题</span>`
      + `<p class="retry-stem">${this.text(x.stem || '暂无题干')}</p>`
      + '<label class="retry-label">你的答案<input data-retry-input placeholder="输入答案后检查"></label>'
      + '<div class="retry-actions"><button class="primary-btn" data-action="retry-check">检查</button>'
      + '<button class="text-btn" data-action="retry-next">跳过这题</button></div>'
      + '<p class="retry-result" data-retry-result></p>'
      + (x.explanation
        ? '<details><summary>看提示</summary>'
          + `<div class="explanation">${this.explanationHtml(x.explanation)}</div></details>`
        : '')
      + '</section></main>';
  },

  /* 判分口径：答案长度 ≤20 才做自动比对（大小写不敏感）。
     读后续写、应用文这类长答案没法机器判，直接给出标准答案让学生自判，
     且不计入 correct —— 宁可少算分，也不给假的「答对了」。 */
  checkRetry() {
    const r = this._retry;
    if (!r) return;
    const x = r.items[r.index];
    const input = document.querySelector('[data-retry-input]');
    const mine = ((input && input.value) || '').trim();
    const answer = String(x.answer || '').trim();
    const isShort = answer.length > 0 && answer.length <= 20;

    let msg;
    if (!mine) {
      msg = '先输入你的答案再检查。';
    } else if (!isShort) {
      msg = '这题答案较长，请对照下方解析自行判断；标准答案：' + answer;
    } else if (mine.toLowerCase() === answer.toLowerCase()) {
      r.correct++;
      msg = '答对了，可以标记为已掌握。';
    } else {
      msg = '再想想。标准答案：' + answer;
    }

    const result = document.querySelector('[data-retry-result]');
    if (result) result.textContent = msg;

    /* 检查按钮一次性：否则反复点「检查」会把 correct 累加多次。 */
    const checkBtn = document.querySelector('[data-action="retry-check"]');
    if (checkBtn) { checkBtn.disabled = true; checkBtn.textContent = '已检查'; }
    const skipBtn = document.querySelector('[data-action="retry-next"]');
    if (skipBtn) skipBtn.textContent = r.index + 1 >= r.items.length ? '查看结果 →' : '下一题 →';
  },

  retryNext() {
    const r = this._retry;
    if (!r) return;
    r.index++;
    if (r.index >= r.items.length) this.renderRetrySummary();
    else this.renderRetryQuestion();
  },

  renderRetrySummary() {
    const r = this._retry;
    if (!r) return;
    const total = r.items.length;

    this.app().innerHTML = this.header('跨试卷重练', true)
      + '<main class="knowledge-page shell"><div class="library-head"><div>'
      + `<span class="eyebrow">RETRY SUMMARY</span><h1>${this.esc(r.node)}</h1></div>`
      + '<a class="text-btn" href="#/knowledge">返回错题溯源</a></div>'
      + '<section class="retry-summary"><h2>本组重练完成</h2>'
      + `<div class="retry-score"><b>${r.correct}</b><span>/ ${total} 题答对</span></div>`
      + `<p>这组题来自 ${total} 道真题，跨越不同试卷。`
      + '把答错的题回到错题本再复盘一次。</p>'
      + '<div class="report-actions"><a class="primary-btn" href="#/mistakes">回到错题本 →</a>'
      + `<a class="ghost-btn" href="#" data-action="retry-exit" data-node="${this.esc(r.node)}">`
      + '查看知识点详情</a></div></section></main>';

    this._retry = null;
  },

  retryExit(node) {
    this._retry = null;
    this.knowledgeDetail(node, Store.getMistakes());
  },

  /* ---------------------------------------------------------------
     ⑥ 复习队列：今天该回炉的错题
     错题本是「全部错题的档案」，按录入时间倒序，做久了会有上百条，
     学生打开只会往下滑两屏就关掉。这一页只回答一个问题：
     现在该看哪几道。排期规则在 js/review.js。

     下标必须取自 Store.getMistakes() 的原始位置（见 Review.due 前的
     entries 映射）—— 筛过一遍再用筛后下标去 markMistakeReviewed，
     改的会是另一道题。
     --------------------------------------------------------------- */
  reviewQueue(items) {
    const entries = items.map((x, i) => ({ x, i }));
    const due = Review.due(entries.map(e => e.x))
      .map(x => entries.find(e => e.x === x));
    const soon = Review.upcoming(entries.map(e => e.x)).slice(0, 6);
    const retired = items.filter(x => Review.retired(x)).length;

    const body = due.length
      ? due.map(({ x, i }) => this.queueItem(x, i)).join('')
      : '<div class="empty-state"><strong>今天没有到期的错题</strong>'
        + `<p>${items.length
          ? '排期里的题还没到复习时间，可以去做新的练习。'
          : '完成一套练习后，答错的题会自动排入复习队列。'}</p>`
        + '<a class="primary-btn" href="#/mistakes">打开错题本</a></div>';

    const nextUp = soon.length
      ? '<section class="dashboard-panel queue-upcoming"><div class="panel-heading">'
        + '<h2>接下来的排期</h2><span>按到期时间排列</span></div>'
        + soon.map(x => '<div class="queue-upcoming-row">'
          + `<span>${this.esc(x.knowledgeNode || x.subCause || x.type || '错题')}</span>`
          + `<b>${this.esc(Review.label(x))}</b></div>`).join('')
        + '</section>'
      : '';

    this.app().innerHTML = this.header('复习队列', true)
      + '<main class="mistakes shell"><div class="library-head"><div>'
      + '<span class="eyebrow">SPACED REVIEW</span><h1>今天该复习什么</h1></div>'
      + '<span><a class="text-btn" href="#/mistakes">打开错题本</a>'
      + (due.length
        ? ' <button class="text-btn" data-action="print-page">打印</button>'
        : '') + '</span></div>'
      + '<section class="queue-hero">'
      + `<div><b>${due.length}</b><span>道今天到期</span></div>`
      + `<div><b>${Review.upcoming(items).length}</b><span>道在排期中</span></div>`
      + `<div><b>${retired}</b><span>道已完成全部轮次</span></div>`
      + `<p>复习按 ${Review.INTERVALS.join(' / ')} 天的间隔递进：`
      + '答得上来就往后拉长，答不上来就退回明天。</p></section>'
      + body + nextUp + '</main>';
  },

  /* 队列里的一条。比错题本的条目更紧：只有题干、答案、轮次和三个按钮，
     解析折叠着 —— 先自己想，再看答案，否则复习就退化成读解析。 */
  queueItem(x, i) {
    const p = Review.progress(x);

    return '<article class="mistake-item"><div class="mistake-top">'
      + `<b>${this.esc(x.examTitle)} · 第 ${x.qid} 题</b>`
      + `<span>第 ${p.round} / ${p.total} 轮 · ${this.esc(x.type || '客观题')}</span></div>`
      + `<p>${this.text(x.stem)}</p>`
      + '<details><summary>显示答案</summary>'
      + `<div class="mistake-answer">你当时答：${this.esc(x.myAnswer || '未作答')}　`
      + `正确答案：<b>${this.esc(x.answer || '')}</b></div>`
      + (x.explanation
        ? `<div class="explanation">${this.explanationHtml(x.explanation)}</div>`
        : '')
      + '</details>'
      + '<div class="mistake-actions">'
      + `<a class="text-btn" href="#/mistake/${i}">打开详情 →</a>`
      + '<span class="review-status-actions" role="group" aria-label="这道题现在会了吗">'
      + ['待回炉', '复习中', '已掌握'].map(s => '<button class="text-btn" '
        + `data-action="queue-status" data-index="${i}" data-status="${s}">${s}</button>`).join('')
      + '</span></div></article>';
  },
});
