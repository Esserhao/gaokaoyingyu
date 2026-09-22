/* =====================================================================
   Diagnose —— 错因自动分类
   交卷收错题时（js/exam.js 的 collectMistakes）给每道错题预填
   cause / subCause / knowledgeNode，错题本上的三个控件从「必须手填」
   变成「可以改」。

   为什么能自动分：题库里 847 道客观题带结构化解析，
   explanation.summary 本来就写着「细节理解题」「考查非谓语动词」
   「动词词义辨析」这类考点名 —— 分类等于把这句话翻译成三段口径，
   不需要理解题目本身。summary 太笼统（只写了文章体裁）时再看
   explanation.question，最后按题型兜底。

   三段口径必须落在 js/ui/mistakes.js 的下拉选项集合里：
   自动填了一个下拉里没有的值，控件会显示成「请选择」，
   数据和界面对不上。CAUSE_OPTIONS / SUBCAUSE_OPTIONS 是那份清单，
   .work/diagnose.html 会逐项校验，改这里要同时改那边。

   knowledgeNode 尽量取 data/knowledge/index.js 里已有的 id
   （非谓语动词 / 定语从句 / 主谓一致 …），这样知识点详情页能直接
   显示知识库的例句与易混点；篇章题类与词义辨析产出的是 12 个子技能
   节点（细节理解、动词词义辨析等），由 js/subskill.js 按子技能版式
   分派方法卡；其余零散节点（固定短语、词形变化等）由
   js/ui/mistakes.js 的 NODE_RULES 提供一句话规则。
   ===================================================================== */

/* 规则表按顺序匹配，命中即停 —— 顺序本身就是口径：
     ① 词义辨析在最前：「考查名词词义辨析｜篇章主旨句」要算辨析，
        不能被后面的「主旨」规则抢走。
     ② 语法结构次之：「非谓语动词（固定搭配）」算非谓语，不算搭配。
     ③ 词类/词形第三，固定搭配第四，篇章题类最后。 */
const DIAG_RULES = [
  /* —— 词义辨析（完形的主力题型） —— */
  { re: /动词(短语|词组)?.{0,4}辨析/, cause: '词', sub: '单词', node: '动词词义辨析' },
  { re: /名词.{0,4}辨析/, cause: '词', sub: '单词', node: '名词词义辨析' },
  { re: /形容词.{0,4}辨析/, cause: '词', sub: '单词', node: '形容词词义辨析' },
  { re: /副词.{0,4}辨析/, cause: '词', sub: '单词', node: '副词词义辨析' },
  { re: /(固定)?(短语|词组|搭配)辨析/, cause: '词', sub: '固定搭配', node: '固定短语' },

  /* —— 语法结构 —— */
  { re: /非谓语|不定式|分词|动名词/, cause: '句', sub: '语法结构', node: '非谓语动词' },
  { re: /定语从句|关系(词|代词|副词)/, cause: '句', sub: '句法结构', node: '定语从句' },
  { re: /状语从句/, cause: '句', sub: '句法结构', node: '状语从句' },
  { re: /(主语|宾语|表语|同位语|名词性)从句/, cause: '句', sub: '句法结构', node: '名词性从句' },
  { re: /主谓一致/, cause: '句', sub: '语法结构', node: '主谓一致' },
  { re: /时态/, cause: '句', sub: '语法结构', node: '动词时态' },
  { re: /语态|被动/, cause: '句', sub: '语法结构', node: '语态' },
  { re: /情态动词/, cause: '句', sub: '语法结构', node: '情态动词' },
  { re: /虚拟语气/, cause: '句', sub: '语法结构', node: '虚拟语气' },
  { re: /倒装/, cause: '句', sub: '句法结构', node: '倒装句' },
  { re: /强调句/, cause: '句', sub: '句法结构', node: '强调句' },
  { re: /固定句型|固定句式|句型/, cause: '句', sub: '句法结构', node: '固定句型' },
  { re: /连词|并列/, cause: '句', sub: '句法结构', node: '连词' },

  /* —— 词类与词形 —— */
  { re: /名词复数|名词的数|复数/, cause: '词', sub: '词形变化', node: '名词的数' },
  { re: /词性转换|词形/, cause: '词', sub: '词形变化', node: '词形变化' },
  { re: /比较级|最高级/, cause: '词', sub: '词形变化', node: '形容词' },
  { re: /数词/, cause: '词', sub: '词形变化', node: '数词' },
  { re: /介词/, cause: '词', sub: '介词词组', node: '介词' },
  { re: /冠词/, cause: '句', sub: '语法结构', node: '冠词' },
  { re: /代词|物主|反身/, cause: '句', sub: '语法结构', node: '代词' },
  { re: /限定词/, cause: '句', sub: '语法结构', node: '限定词' },

  /* —— 固定搭配 —— */
  { re: /固定搭配|固定短语|搭配/, cause: '词', sub: '固定搭配', node: '固定短语' },

  /* —— 篇章题类（阅读、七选五、听力） —— */
  { re: /细节理解|细节题|图表信息/, cause: '篇章', sub: '细节定位', node: '细节理解' },
  { re: /推理判断|推断/, cause: '篇章', sub: '推理判断', node: '推理判断' },
  { re: /主旨|标题|大意|中心/, cause: '篇章', sub: '主旨概括', node: '主旨大意' },
  { re: /词义猜测|猜测/, cause: '篇章', sub: '词义猜测', node: '词义猜测' },
  { re: /观点|态度|写作意图|写作手法/, cause: '篇章', sub: '推理判断', node: '观点态度' },
  { re: /承上启下|上下文|语篇|衔接|过渡|逻辑关系|复现|呼应|收束/,
    cause: '篇章', sub: '语篇连贯', node: '语篇衔接' },
];

/* 「考查名词」这种只写词类、不写考什么的 summary，含义随题型而变：
   完形填空考的是选词（词义辨析），语法填空考的是给出正确形式（词形）。
   所以这一档必须分题型，且要排在通用规则之后。 */
const DIAG_SECTION_RULES = {
  cloze: [
    { re: /考查.{0,3}动词/, cause: '词', sub: '单词', node: '动词词义辨析' },
    { re: /考查.{0,3}名词/, cause: '词', sub: '单词', node: '名词词义辨析' },
    { re: /考查.{0,3}形容词/, cause: '词', sub: '单词', node: '形容词词义辨析' },
    { re: /考查.{0,3}副词/, cause: '词', sub: '单词', node: '副词词义辨析' },
  ],
  grammar: [
    { re: /考查.{0,3}名词/, cause: '词', sub: '词形变化', node: '名词' },
    { re: /考查.{0,3}动词/, cause: '句', sub: '语法结构', node: '动词时态' },
    { re: /考查.{0,3}形容词/, cause: '词', sub: '词形变化', node: '形容词' },
    { re: /考查.{0,3}副词/, cause: '词', sub: '词形变化', node: '副词' },
  ],
};

/* 听力全库 200 题里 140 题没有解析字段，只能看题干。
   Why / What can we learn 这类问「为什么、说明什么」的是推理，
   Where / Who 是场景与人物，其余按细节题处理（占七成，是安全的默认值）。 */
/* 问「为什么 / 说明什么 / 什么关系 / 什么态度」的题干都是推理题。
   拆成数组是为了每条一行看得清，拼起来才是那个长 alternation。 */
const DIAG_INFER_STEMS = [
  'Why',
  'What can we (learn|infer)',
  'What do we know',
  'What does .*(mean|imply)',
  'What is the (probable )?relationship',
  'What is .*attitude',
  'How does .*(feel|sound)',
];

const DIAG_LISTENING = [
  { re: new RegExp('^(' + DIAG_INFER_STEMS.join('|') + ')', 'i'),
    cause: '篇章', sub: '推理判断', node: '推理判断' },
  { re: /^(Where|Who)/i, cause: '篇章', sub: '细节定位', node: '场景与人物' },
  { re: /./, cause: '篇章', sub: '细节定位', node: '听力细节' },
];

/* 解析里既没写考点、题干也认不出来时的最后一档，按题型给。
   听力不在这里：它总能被 DIAG_LISTENING 的兜底规则命中。 */
const DIAG_FALLBACK = {
  reading: { cause: '篇章', sub: '细节定位', node: '细节理解' },
  seven: { cause: '篇章', sub: '语篇连贯', node: '语篇衔接' },
  cloze: { cause: '词', sub: '单词', node: '动词词义辨析' },
  grammar: { cause: '句', sub: '语法结构', node: '词形变化' },
};

const Diagnose = {
  /* 参与匹配的文本：summary 是考点名，question 是逐题分析。
     两段都拼进来，是因为不少题的 summary 只写了文章体裁
     （「本文是记叙文，讲……」），考点写在 question 里。
     老数据的 explanation 是纯字符串，直接当分析文本用。 */
  hintText(item) {
    const e = item.explanation;
    if (!e) return '';
    if (typeof e === 'string') return e;
    return [e.summary, e.question, e.answer].filter(Boolean).join(' ');
  },

  /* 返回 {cause, subCause, knowledgeNode, causeSource:'auto'}；
     题型不认识且无解析时返回 null，交给学生手填 —— 宁可留空，
     也不给一个瞎猜的错因，那会污染知识系谱的统计。 */
  classify(item) {
    const section = item.sectionKey || '';
    const text = this.hintText(item);

    const tables = [DIAG_RULES, DIAG_SECTION_RULES[section] || []];
    for (const table of tables) {
      for (const rule of table) {
        if (rule.re.test(text)) return this.result(rule);
      }
    }

    if (section === 'listening') {
      const stem = String(item.stem || '').trim();
      const hit = DIAG_LISTENING.find(rule => rule.re.test(stem));
      if (hit) return this.result(hit);
    }

    const fallback = DIAG_FALLBACK[section];
    return fallback ? this.result(fallback) : null;
  },

  result(rule) {
    return {
      cause: rule.cause,
      subCause: rule.sub,
      knowledgeNode: rule.node,
      causeSource: 'auto',
    };
  },

  /* 只在字段为空时补：学生改过的错因、或调用方（导入的旧记录）
     已经带了分类，一律不覆盖。 */
  apply(item) {
    if (item.cause || item.subCause || item.knowledgeNode) return item;
    const guess = this.classify(item);
    return guess ? { ...item, ...guess } : item;
  },
};
