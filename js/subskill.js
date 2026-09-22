/* =====================================================================
   Subskill —— 题型专项的子技能层（task.md §8.4，B1/B2）
   题型正确率是粗粒度的：看不出「阅读不行是因为推理判断而非细节定位」。
   这一层把 8 个题型拆成 12 个子技能，给三档度量与方法卡。

   12 个 id 全部取自 js/diagnose.js 产出的 knowledgeNode（同一套口径，
   不另造名字）：8 个篇章题类 + 4 个词义辨析。语法类节点不在这里 ——
   它们归知识体系（#/knowledge/<id> 知识节点页 / #/learn 台阶），两套
   进度故意错开命名，避免学生混成一套。

   「节点 → 家族」映射（§8.4 唯一出口条款）：
     familyOf(node) →
       'skill'   子技能节点 → #/knowledge/<id> 渲染子技能版式（方法卡）
       'grammar' 其余节点   → 现行知识节点版式（KB rule / NODE_RULES 兜底）
     第三种版式「跳字典词条」挂 C4（#/word/<词形>），落地前没有节点
     会归入 dict 家族 —— 不预留死分支，到时在 familyOf 里加一行即可。

   度量口径（§8.4）：三档按该子技能「最近 10 次作答」的正确率算 ——
     生疏 <50% / 在练 50–79% / 稳定 ≥80%。
   数据来源是 store.js 的 subskillHistory（交卷时 Exam.subskillBreakdown
   逐题归类落账），形状与 sectionHistory 相同，合并复用同一函数。
   ===================================================================== */

/* 三档阈值是唯一口径，不要散落到各处判断里（同 task.md A10 的约定）。 */
const SUBSKILL_WINDOW = 10;
const SUBSKILL_TIERS = [
  { min: 80, tier: '稳定' },
  { min: 50, tier: '在练' },
  { min: 0,  tier: '生疏' },
];

const Subskill = {
  /* 12 个子技能定义。method 是方法卡正文（知识详情页子技能版式的
     「一句话规则」位），措辞与错题本 NODE_RULES 同源；词义辨析四条
     按 §8.4 的「动词看搭配与语气 / 名词看指代与复现 / 形容词看褒贬 /
     副词看逻辑关系」开头。section / sectionName 是「去练」入口指向的
     主题型（一个子技能可能由多个题型产出，如推理判断在阅读和听力
     都有，这里只写主练入口）。 */
  subskills: [
    /* —— 篇章能力（阅读为主） —— */
    { id: '细节理解', name: '细节理解', family: '篇章', section: 'reading', sectionName: '阅读理解',
      method: '回原文定位关键词，答案必须能在原文找到对应句，不能靠印象。' },
    { id: '推理判断', name: '推理判断', family: '篇章', section: 'reading', sectionName: '阅读理解',
      method: '推理必须有原文依据，从证据句往前推一步即可，多推一步就是过度推断。' },
    { id: '主旨大意', name: '主旨大意', family: '篇章', section: 'reading', sectionName: '阅读理解',
      method: '先看首尾段与各段首句，再判断哪个选项概括了全文而非某一段。' },
    { id: '词义猜测', name: '词义猜测', family: '篇章', section: 'reading', sectionName: '阅读理解',
      method: '不查词典，从该词所在句的并列、举例或转折结构反推词义。' },
    { id: '观点态度', name: '观点态度', family: '篇章', section: 'reading', sectionName: '阅读理解',
      method: '找作者的评价性词语（形容词、副词、情态动词），不要把转述当作者观点。' },
    { id: '语篇衔接', name: '语篇衔接', family: '篇章', section: 'seven', sectionName: '七选五',
      method: '看空前后两句的指代与连接词，选项要同时接住上文和下文。' },
    /* —— 篇章能力（听力） —— */
    { id: '听力细节', name: '听力细节', family: '篇章', section: 'listening', sectionName: '听力理解',
      method: '听前先扫题干抓关键词，听时只盯这个关键词出现的那一句。' },
    { id: '场景与人物', name: '场景与人物', family: '篇章', section: 'listening', sectionName: '听力理解',
      method: '抓身份词与地点词（称呼、专有名词、动作），不要等听完再回想。' },
    /* —— 词义辨析（完形的主力，题池直接用现成完形选项，见 §8.4 B3） —— */
    { id: '动词词义辨析', name: '词义辨析 · 动词', family: '词义辨析', section: 'cloze', sectionName: '完形填空',
      method: '动词看搭配与语气：把选项代入，看哪个与上下文的动作链条和语气对得上，不要只凭词频。' },
    { id: '名词词义辨析', name: '词义辨析 · 名词', family: '词义辨析', section: 'cloze', sectionName: '完形填空',
      method: '名词看指代与复现：上文给过的信息会在下文换词复现，优先选与原词义一致的。' },
    { id: '形容词词义辨析', name: '词义辨析 · 形容词', family: '词义辨析', section: 'cloze', sectionName: '完形填空',
      method: '形容词看褒贬：先判断作者对被修饰对象的态度是正是负，再在同向选项里挑。' },
    { id: '副词词义辨析', name: '词义辨析 · 副词', family: '词义辨析', section: 'cloze', sectionName: '完形填空',
      method: '副词看逻辑关系：先判断前后句是因果、转折还是递进，再选承接该关系的副词。' },
  ],

  byId(id) {
    return this.subskills.find(s => s.id === id) || null;
  },

  all() {
    return this.subskills.slice();
  },

  /* 节点 → 家族（§8.4 唯一出口条款的分派依据）。
     'skill' 走子技能版式；'grammar' 走现行知识节点版式（含 NODE_RULES
     兜底）。dict 家族待 C4 落地后再引入。 */
  familyOf(node) {
    return this.byId(node) ? 'skill' : 'grammar';
  },

  /* 三档度量：从 subskillHistory 里按「最近 10 次作答」算正确率。
     账本里每条是一次交卷的 {correct,total,submittedAt,examId} 聚合，
     从最新往回整条累计，凑满 10 题即停（最后一条不再拆分）。
     没有任何作答记录时返回 null（界面显示「未练」），不装作有进度。 */
  tierOf(history, id) {
    const arr = (history && history[id]) || [];
    let correct = 0;
    let total = 0;
    for (let i = arr.length - 1; i >= 0 && total < SUBSKILL_WINDOW; i--) {
      correct += arr[i].correct || 0;
      total += arr[i].total || 0;
    }
    if (!total) return null;
    const pct = Math.round(correct / total * 100);
    const hit = SUBSKILL_TIERS.find(t => pct >= t.min);
    return { tier: hit.tier, pct, correct, total };
  },

  /* 徽标（三处 UI 共用：训练页进度板 / 知识详情 / 子技能专项页）。
     cls 对应 css 的 t-ok / t-mid / t-low / t-none。 */
  tierBadge(history, id) {
    const t = this.tierOf(history, id);
    const cls = t ? ({ '稳定': 'ok', '在练': 'mid', '生疏': 'low' }[t.tier] || 'low') : 'none';
    const text = t ? `${t.tier} · 最近 ${t.total} 题 ${t.pct}%` : '未练 · 交一次卷自动开始记录';
    return { cls, text };
  },
};
