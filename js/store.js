/* =====================================================================
   Store —— localStorage 数据层
   全站所有持久化都收在这一个文件、一个 key（gkyy_records_v1）里：
   每次读写都是「整包 JSON 取出 → 改一处 → 整包写回」。数据量是单机
   几十套卷的作答记录，这样做换来的好处是导出/导入只需搬一个键
   （跨设备同步就建立在这个前提上）。

   顶层字段一览：
     records     { <examId>: 成绩记录 }        —— 已交卷
     drafts      { <examId>: 答案表 }          —— 整卷未交卷
     topicDrafts { <草稿键>: {answers,updatedAt} } —— 专题未提交
     topicRecords[ 专题复盘记录 ]
     mistakes    [ 错题项 ]                    —— 正序存，倒序读

   注意 Store 是词法 const，不挂在 window 上，跨 iframe 访问要在
   目标窗口自己 eval（.work/ 下的测试脚本就是这么取的）。
   ===================================================================== */

/* 错题归类唯一口径：知识节点 → 细分错因 → 错因 → 未分类。
   数据层（getKnowledgeStats）与 UI 层（mistakes.js 的 nodeOf）共用，
   普通 <script> 顶层函数声明全局可见，mistakes.js 直接别名引用即可。 */
function classifyKey(x) {
  return x.knowledgeNode || x.subCause || x.cause || '未分类';
}

const Store = {
  KEY: 'gkyy_records_v1',

  /* 进程内缓存：首次读取后把整包对象留在内存，后续 _load 只做极廉价的
     浅拷贝，不再反复 JSON.parse（dashboard 一次渲染要 _load 多次，写作
     每键也走 saveDraft→_load）。返回浅拷贝而非原引用，避免调用方原地
     mutate（如 .sort）污染缓存。 */
  _cache: null,
  _saveTimer: null,
  _load() {
    if (this._cache) return { ...this._cache };
    try {
      const raw = JSON.parse(localStorage.getItem(this.KEY)) || {};
      this._cache = raw;
      return { ...raw };
    } catch (e) { this._cache = {}; return {}; }
  },
  /* 同步写盘：先取消可能挂起的防抖写（saveDraft 的高频写），避免迟到的
     防抖写把刚提交/清掉的草稿又写回 localStorage。返回布尔表示是否成功，
     写入失败（隐私模式/配额满/file:// 部分浏览器）时降级为内存态、不抛错，
     防止异常冒泡到调用方（尤其 Exam.submit 整链）导致卡在答题页。

     2026-09-03：失败时除了返回 false，还要置 writeFailed 并立刻挂警示条。
     此前调用方无一人检查返回值，学生做完 120 分钟看到成绩页、刷新后全丢，
     全程零提示 —— 这是系统在谎报成功，比功能缺失更糟。 */
  writeFailed: false,
  _save(data) {
    clearTimeout(this._saveTimer);
    this._cache = { ...data };
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      this.writeFailed = false;
      return true;
    } catch (e) {
      console.warn('[Store] 写入失败，数据未持久化：', e);
      this.writeFailed = true;
      try { if (typeof UI !== 'undefined') UI.writeWarning(); } catch (_) { /* 警示条挂不上也不能连累写入路径 */ }
      return false;
    }
  },

  /* ---------- 作答记录（已交卷） ----------
     record: { answers: {<sectionKey>-<qid>: 值}, submittedAt,
               durationUsed, score, sectionScores, manualSections } */
  saveRecord(examId, record) {
    const data = this._load();
    data.records = data.records || {};
    data.records[examId] = record;
    this._save(data);
  },
  getRecord(examId) {
    const data = this._load();
    return (data.records || {})[examId] || null;
  },
  getBestScore(examId) {
    const r = this.getRecord(examId);
    return r ? r.score : null;
  },

  /* ---------- 整卷草稿（未交卷） ----------
     每答一题就整包回写。交卷后由 clearDraft 删除，
     否则首页「继续练习」会一直指向一套已经交过的卷子。 */
  /* 每答一题都要落盘，但写作长文实时输入高频触发，同步写会卡。
     内存态（_cache）立即更新，写盘防抖 400ms；关键节点（交卷/清草稿）
     由 _save 内部的 clearTimeout 取消挂起写，避免迟到写覆盖最新数据。 */
  saveDraft(examId, answers) {
    const data = this._load();
    data.drafts = data.drafts || {};
    data.drafts[examId] = answers;
    this._cache = data;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(data), 400);
  },
  /* 立即落盘（路由离开/失焦等）：取消防抖并写当前内存态。
     整卷草稿与专题草稿共用这一份内存包，两个挂起写一并收口。 */
  flushDraft() {
    clearTimeout(this._saveTimer);
    clearTimeout(this._topicTimer);
    if (this._cache) this._save(this._cache);
  },
  getDraft(examId) {
    const data = this._load();
    return (data.drafts || {})[examId] || {};
  },
  clearDraft(examId) {
    const data = this._load();
    if (data.drafts) { delete data.drafts[examId]; this._save(data); }
  },

  /* ---------- 整卷计时（2026-09-03 新增） ----------
     examClock: { <examId>: { startedAt } }。只存开考时刻这一个时间戳，
     剩余秒数由 Exam 用挂钟推导 —— 刷新浏览器、关标签几小时后再回来都
     接着走，不会凭空多出一整场时间。此前 start() 每次都把 remaining
     重置为满时长，做到一半刷新就满血复活，「限时模考」形同虚设，
     连成绩页的「用时」也是按重置后的计时倒推出来的假数字。

     只存起点而不每秒回写：一秒一次整包 JSON.stringify 会拖慢写作长文
     的输入。交卷时 clearExamClock，「重新练习」才会重新计时。 */
  getExamClock(examId) {
    return (this._load().examClock || {})[examId] || null;
  },
  saveExamClock(examId, startedAt) {
    const data = this._load();
    data.examClock = data.examClock || {};
    data.examClock[examId] = { startedAt };
    return this._save(data);
  },
  clearExamClock(examId) {
    const data = this._load();
    if (!data.examClock || !data.examClock[examId]) return true;
    delete data.examClock[examId];
    return this._save(data);
  },

  /* ---------- 专题草稿 ----------
     键由 js/topic.js 的 topicDraftKey 生成：'<examId>:<sectionKey>:<材料标签>'。
     阅读专题一份卷有多篇材料，所以第三段不能省。
     2026-09-19 与整卷草稿对齐：改前每敲一键就同步整包 stringify+落盘，
     错题本涨大后打字肉眼可见地卡。内存态立即更新，写盘防抖 400ms，
     路由离开/beforeunload 由 flushDraft 收口。 */
  saveTopicDraft(key, answers) {
    const data = this._load();
    data.topicDrafts = data.topicDrafts || {};
    data.topicDrafts[key] = { answers, updatedAt: Date.now() };
    this._cache = data;
    clearTimeout(this._topicTimer);
    this._topicTimer = setTimeout(() => this._save(this._cache), 400);
  },
  getTopicDraft(key) {
    const data = this._load();
    return (data.topicDrafts || {})[key] || null;
  },
  clearTopicDraft(key) {
    clearTimeout(this._topicTimer);
    const data = this._load();
    if (data.topicDrafts?.[key]) { delete data.topicDrafts[key]; this._save(data); }
  },

  /* ---------- 专题复盘记录 ----------
     只追加不覆盖：同一篇材料可以反复练，仪表盘统计的是「复盘次数」。
     短文改错的 correct 是 null（人工复核），取用时要判空。 */
  saveTopicRecord(record) {
    const data = this._load();
    data.topicRecords = data.topicRecords || [];
    data.topicRecords.push(record);
    this._save(data);
  },
  getTopicRecords() {
    return this._load().topicRecords || [];
  },

  /* ---------- 写作自评（2026-09-19）----------
     写作草稿不走本 Store 的单键（见 js/topic.js writingDraftKey 注释），
     每篇作文一个 gaokao_writing_draft_* 独立键。统计页要的是自评结果——
     这里只读聚合，不做任何写入；键名里 sectionKey 含下划线（writing_app），
     必须用正则截取，不能按 _ 切分。隐私模式拿不到 localStorage 时返回空。 */
  getWritingSelfChecks() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('gaokao_writing_draft_')) continue;
        const m = k.match(/^gaokao_writing_draft_(.+)_(writing_app|writing_cont)_(\d+)$/);
        if (!m) continue;
        let v = null;
        try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { v = null; }
        if (!v) continue;
        const sc = v.selfCheck || {};
        out.push({
          examId: m[1],
          sectionKey: m[2],
          qid: Number(m[3]),
          coverage: sc.coverage || null,
          coherence: sc.coherence || null,
          accuracy: sc.accuracy || null,
          wordcount: Number(sc.wordcount) > 0 ? Number(sc.wordcount) : null,
          savedAt: Number(v.savedAt) || 0,
          hasDraft: typeof v.draft === 'string' && !!v.draft.trim(),
          selfChecked: !!(sc.coverage || sc.coherence || sc.accuracy
            || Number(sc.wordcount) > 0),
        });
      }
    } catch (_) { return []; }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  },

  /* ---------- 错题本 ----------
     写入走字段白名单，不直接 push 调用方给的对象：错题项会被反复读写
     （改错因、标记已掌握、间隔复习），字段范围固定下来才好演进。
     新增字段必须同时加到这里，否则会被静默丢掉 —— 下面 sectionKey
     的注释记录的就是踩过一次的坑。 */
  addMistakes(items) {
    const data = this._load();
    data.mistakes = data.mistakes || [];

    for (const it of items) {
      data.mistakes.push({
        examId: it.examId, examTitle: it.examTitle,
        /* sectionKey 必须留下：exam.js 收错题时写入，错题本用它拼
           「回到对应训练」链接（#/training/<sectionKey>）。此前这里没列，
           字段被白名单丢掉 —— 错题本上那个入口从来不出现，
           错题详情页的训练链接也永远回落到 reading。 */
        sectionKey: it.sectionKey || '',
        qid: it.qid, type: it.type, stem: it.stem,
        myAnswer: it.myAnswer, answer: it.answer, explanation: it.explanation,
        cause: it.cause || '', subCause: it.subCause || '',
        knowledgeNode: it.knowledgeNode || '',
        /* causeSource='auto' 表示这三段是 js/diagnose.js 按解析里的考点
           自动填的，学生一改就抹掉（js/app.js 的 change 分支）。
           错题本靠它区分「自动判定」与「你已确认」两种状态。 */
        causeSource: it.causeSource || '',
        /* 错在哪一步（M1）：方法卡步骤标签（data/methods 的 step.id）。
           收题时不预填——自动判定做不了过程归因，必须学生自己点。 */
        errStage: it.errStage || '',
        /* 间隔复习的两个字段（见 js/review.js）。新收的错题不预排期：
           reviewStage 缺省即 0，nextReviewAt 缺省即回落到 ts，
           语义是「立刻到期」—— 刚做错的题今天就该进复习队列。
           这里仍然显式列出，是因为白名单要能接住导入进来的旧记录
           （#15 跨设备导入会带着已经排好的 nextReviewAt）。 */
        reviewStage: it.reviewStage,
        nextReviewAt: it.nextReviewAt,
        reviewStatus: it.reviewStatus || '',
        ts: Date.now(),
      });
    }
    this._save(data);
  },

  /* 倒序返回：错题本按「最近做错的排在最前」展示。
     注意所有按 index 定位的方法（updateMistake / markMistakeReviewed）
     收到的都是这个倒序列表里的下标，所以要用 length-1-index 换算回来。 */
  getMistakes() {
    const data = this._load();
    return (data.mistakes || []).slice().reverse();
  },

  updateMistake(index, patch) {
    const data = this._load();
    const items = data.mistakes || [];
    const target = items[items.length - 1 - index];
    if (!target) return;
    Object.assign(target, patch, { updatedAt: Date.now() });
    this._save(data);
  },

  /* 归类口径抽到全局 classifyKey（与 js/ui/mistakes.js 的 nodeOf 同一实现），
     不再「改一处要改两处」。 */
  getKnowledgeStats() {
    const stats = {};
    for (const item of this.getMistakes()) {
      const key = classifyKey(item);
      stats[key] = (stats[key] || 0) + 1;
    }
    return stats;
  },

  clearMistakes() {
    const data = this._load();
    data.mistakes = [];
    this._save(data);
  },

  /* 撤销「清空错题本」用：整批写回原样。只由 UI.undoBar 的撤销回调调用，
     不做去重 —— 撤销的语义就是原样还原，去重反而会把数据改坏。 */
  restoreMistakes(items) {
    if (!Array.isArray(items) || !items.length) return true;
    const data = this._load();
    data.mistakes = items;
    return this._save(data);
  },

  /* ---------- 知识点掌握度自评（分台阶学习） ----------
     独立进度线，与错题本 / 复习队列分开：kbMastery: { <nodeId>: '模糊'|'思路'|'掌握' }。
     这是「我先翻一遍知识库、自己标掌握度」的主动学习记录，不依赖是否已经
     做错过某题，所以单独一个字段，不污染 mistakes（错题本的复习状态
     另有 reviewStage/nextReviewAt 那条时间线）。 */
  getKBMastery() {
    return this._load().kbMastery || {};
  },
  saveKBMastery(nodeId, level) {
    if (!nodeId) return;
    const data = this._load();
    data.kbMastery = data.kbMastery || {};
    /* 传合法 level 即写入；传空（如将来要做「清除自评」）则删除该节点自评，
       不让空串残留成一条「未分类」记录。 */
    if (level === '模糊' || level === '思路' || level === '掌握') {
      data.kbMastery[nodeId] = level;
    } else {
      delete data.kbMastery[nodeId];
    }
    this._save(data);
  },

  /* ---------- 分题型历史得分 ----------
     每次交卷后按 section.key 追加一条 {correct, total, submittedAt, examId}。
     仪表盘「能力概览」六行用它算真的分项掌握度，不再共用一个粗略百分比。
     键用 section.key（机器稳定），不用 partTitle（显示文案可能变）。
     主观题（writing_app / writing_cont / proofreading）的 correct/total
     仍是 0/0 —— 这部分靠 #14 自评表走另一条数据线，不在这里混。 */
  addSectionHistory(exam, result) {
    const data = this._load();
    data.sectionHistory = data.sectionHistory || {};
    const submittedAt = result.submittedAt || Date.now();
    for (const section of exam.sections) {
      const lookup = section.partTitle || section.key;
      const ss = result.sectionScores?.[lookup];
      if (!ss) continue;
      (data.sectionHistory[section.key] ||= []).push({
        correct: ss.correct || 0,
        total: ss.total || 0,
        submittedAt,
        examId: exam.id,
      });
    }
    this._save(data);
  },
  getSectionHistory() {
    return this._load().sectionHistory || {};
  },

  /* ---------- 子技能历史得分（task.md §8.4 B2） ----------
     与 sectionHistory 同构：{<subskillId>: [{correct,total,submittedAt,examId}]}。
     键是 js/subskill.js 的 12 个子技能 id（= Diagnose 产出的节点名）。
     题型粒度看不出「阅读不行是推理判断还是细节定位」，这层拆分补的就是它。
     三档度量（生疏/在练/稳定）在 Subskill.tierOf 里算，这里只管落账。
     交卷没有命中任何子技能（如纯语法卷）时整条不写，不留空壳键。 */
  addSubskillHistory(breakdown, submittedAt, examId) {
    if (!breakdown || !Object.keys(breakdown).length) return;
    const data = this._load();
    data.subskillHistory = data.subskillHistory || {};
    const at = submittedAt || Date.now();
    for (const id of Object.keys(breakdown)) {
      const s = breakdown[id];
      (data.subskillHistory[id] ||= []).push({
        correct: s.correct || 0,
        total: s.total || 0,
        submittedAt: at,
        examId,
      });
    }
    this._save(data);
  },
  getSubskillHistory() {
    return this._load().subskillHistory || {};
  },

  /* ---------- 生词本（C5） ----------
     words: { <word>: { addedAt, reviewStage, nextReviewAt } }。
     排期复用 js/review.js 的固定阶梯（1/3/7/15/30 天）：
     收藏即进入阶段 0（明天复习）；「认识」+1 档，「忘记」归零明天再看；
     走完阶梯即毕业（nextReviewAt = -1），记录保留、不再进到期队列。
     跨设备合并取「进展更靠前」的一方（syncMergeWords）。 */
  addWord(word) {
    /* 放宽到接受词组与含数字词形：此前 /^[a-z][a-z'-]*$/ 会把
       "look after"、"covid-19" 直接拒掉，而且静默 return ——
       学生点「收藏生词」，页面纹丝不动，是典型的「点了没反应」。
       上限 40 字符，避免把一整句话收进生词本。
       返回布尔：true 收录成功或已在册，false 词形不合法（调用方据此给反馈）。 */
    const w = (word || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!w || w.length > 40 || !/^[a-z0-9][a-z0-9' \-]*$/.test(w)) return false;
    const data = this._load();
    data.words = data.words || {};
    if (data.words[w]) return true;
    data.words[w] = {
      addedAt: Date.now(),
      reviewStage: 0,
      nextReviewAt: Date.now() + REVIEW_INTERVALS[0] * DAY_MS,
    };
    return this._save(data);
  },
  removeWord(word) {
    const w = (word || '').trim().toLowerCase();
    if (!w) return;
    const data = this._load();
    if (!data.words || !data.words[w]) return;
    delete data.words[w];
    this._save(data);
  },
  getWords() {
    return this._load().words || {};
  },
  /* 复习判定：known=true「认识」（+1 档），false「忘记」（归零明天再看）。
     patch 计算交给 Review.schedule，与错题的排期口径完全一致。 */
  reviewWord(word, known) {
    const w = (word || '').trim().toLowerCase();
    const data = this._load();
    const rec = (data.words || {})[w];
    if (!rec) return;
    Object.assign(rec, Review.schedule(rec, known ? '复习中' : '待回炉'));
    this._save(data);
  },

  /* ---------- 学业分析·每日任务完成记录（task.md E3，2026-08-31 定稿） ----------
     taskLog: { 'YYYY-M-D': [taskId…] }。只记「今天完成了哪些任务」用于当日
     去重；方案本体不持久化（规则引擎 js/diagnostic.js 每次现算）。
     合并按日期取并集（syncMergeTaskLog）。 */
  getTaskLog() {
    return this._load().taskLog || {};
  },
  setTaskDone(taskId, now = Date.now()) {
    const data = this._load();
    data.taskLog = data.taskLog || {};
    const key = (d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate())(new Date(now));
    const arr = data.taskLog[key] || (data.taskLog[key] = []);
    if (!arr.includes(taskId)) arr.push(taskId);
    this._save(data);
  },

  /* ---------- 词组闪卡（#/phrases） ----------
     phrases: { <词组小写>: { addedAt, reviewStage, nextReviewAt } }。
     与生词本完全同构：排期复用 Review.schedule 的 1/3/7/15/30 阶梯，
     收录即明日期、「认识」+1 档、「忘记」归零、走完阶梯毕业。
     合并复用 syncMergeWords（同一数据形状、同一「进展更靠前」口径）。 */
  addPhrase(ph) {
    const k = (ph || '').trim().toLowerCase();
    if (!k) return;
    const data = this._load();
    data.phrases = data.phrases || {};
    if (data.phrases[k]) return;
    data.phrases[k] = {
      addedAt: Date.now(),
      reviewStage: 0,
      nextReviewAt: Date.now() + REVIEW_INTERVALS[0] * DAY_MS,
    };
    this._save(data);
  },
  removePhrase(ph) {
    const k = (ph || '').trim().toLowerCase();
    if (!k) return;
    const data = this._load();
    if (!data.phrases || !data.phrases[k]) return;
    delete data.phrases[k];
    this._save(data);
  },
  getPhrases() {
    return this._load().phrases || {};
  },
  reviewPhrase(ph, known) {
    const k = (ph || '').trim().toLowerCase();
    const data = this._load();
    const rec = (data.phrases || {})[k];
    if (!rec) return;
    Object.assign(rec, Review.schedule(rec, known ? '复习中' : '待回炉'));
    this._save(data);
  },

  /* ---------- 节点练测进度（#/knowledge/<节点> 的题池练测） ----------
     knowledgeProgress: { <节点id>: { seen, correct, variants:{v:{seen,correct}},
                        reviewStage, nextReviewAt, retired } }
     练测作答实时落盘（每题一存），台阶判定用 Review.kbTier 纯函数；
     练到 100% 且每个变体都至少对过一题 → 进入 1/3/7 天复练阶梯；
     三轮复练全对 → retired（挺熟了）。 */
  getKBProgress() {
    return this._load().knowledgeProgress || {};
  },
  saveKBAnswer(node, variant, correct) {
    if (!node) return;
    const data = this._load();
    const all = data.knowledgeProgress || (data.knowledgeProgress = {});
    const p = all[node] || (all[node] = { seen: 0, correct: 0, variants: {} });
    p.seen += 1;
    if (correct) p.correct += 1;
    const v = p.variants[variant] || (p.variants[variant] = { seen: 0, correct: 0 });
    v.seen += 1;
    if (correct) v.correct += 1;
    /* 首次达到「全对且每变体命中」→ 排第一轮复练（明天） */
    if (!p.nextReviewAt && !p.retired
      && p.correct === p.seen && Review.kbTier(p).rank >= 3) {
      p.reviewStage = 0;
      p.nextReviewAt = Date.now() + DAY_MS;
    }
    this._save(data);
  },
  /* 复练结算：全对进下一轮（1→3→7），走完三轮毕业；
     有错则阶段归零，明天重来（复练是验收，不累计 seen/correct）。 */
  reviewKBNode(node, passed) {
    const data = this._load();
    const p = (data.knowledgeProgress || {})[node];
    if (!p) return;
    if (passed) {
      p.reviewStage = (p.reviewStage || 0) + 1;
      if (p.reviewStage >= Review.KBQ_STAGES.length) {
        p.retired = true;
        delete p.nextReviewAt;
      } else {
        p.nextReviewAt = Date.now() + Review.KBQ_STAGES[p.reviewStage] * DAY_MS;
      }
    } else {
      p.reviewStage = 0;
      p.nextReviewAt = Date.now() + DAY_MS;
    }
    this._save(data);
  },

  /* 标记复习结果，顺手把下一次到期时间算好（js/review.js 定阶梯）。
     排程写在这里而不是调用方，是为了让「复习状态」和「下次到期」
     永远同时更新 —— 两个字段分开写迟早会出现「已掌握但明天又到期」
     这种自相矛盾的记录。 */
  markMistakeReviewed(index, status = '待回炉') {
    const data = this._load();
    const items = data.mistakes || [];
    const target = items[items.length - 1 - index];
    if (!target) return;
    target.reviewStatus = status;
    target.reviewedAt = Date.now();
    Object.assign(target, Review.schedule(target, status));
    this._save(data);
  },

  /* ---------- 跨设备导出/导入（#15） ----------
     单键设计（gkyy_records_v1 整包）就是为了这两个操作：
     导出即把整包 JSON 序列化；导入即解析后合并回整包。

     写作草稿（js/topic.js 的 writingDraftKey，独立 localStorage 键）
     故意不在这套机制里 —— 一篇作文上千字，体量、生命周期都和答题
     草稿不同，单独一个键更好清理。所以本导出只搬 gkyy_records_v1，
     写作草稿的跨设备迁移不在 #15 范围内（需在导出页明确告知用户）。 */

  /* 导出：返回当前整包 JSON 字符串。空库也照常导出（便于在另一台设备
     上「以空起步」建立基线）。不在这里塞版本号以外的附加字段，
     避免导入端还要做字段裁剪，也避免把包装字段污染进 store 本体。 */
  exportData() {
    const d = this._load();
    /* examClock 是本机的开考时刻，换台设备毫无意义 —— 剩余时间由挂钟
       推导，导入到新设备只会让计时莫名其妙地已经过半。导出时剔除。 */
    delete d.examClock;
    return JSON.stringify(d);
  },

  /* 导入合并：把 imported（已 JSON.parse 的对象）并入当前数据。
     设计原则 —— 合并而非覆盖：当前设备正在做的、已经排好的，都不该
     被一份导入文件整批冲掉。尤其间隔复习的 reviewStage/nextReviewAt/
     reviewStatus：别台设备可能已经往前排了好几轮，丢了这个就丢了一
     笔时间换来的资产（见 js/review.js 头注「兼容旧数据」）。

     各集合的合并口径见文件底部 sync* 辅助函数：
       records / topicDrafts  按键；冲突取更新时间更新的那条
         （records 用 submittedAt，topicDrafts 用 updatedAt）
       drafts                 按键；整卷未交卷草稿，取作答数更多的一条
         （两者都没有时间戳，用「更完整」近似「更新」）
       topicRecords           无键的追加数组；按签名去重拼接
         （同一篇材料的多次复盘可能两端都有，不能简单拼接否则翻倍）
       mistakes               按 (examId|qid|ts) 去重；
         命中同一条时，复习字段取「进展更靠前」的一方，
         文字字段（错因/知识节点/学生笔记）取当前设备已填的一方 */
  mergeData(imported) {
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
      throw new Error('导入文件不是有效的进度数据');
    }
    const cur = this._load();
    const out = {
      records:      syncMergeKeyed(cur.records, imported.records, syncPickNewer('submittedAt')),
      topicDrafts:  syncMergeKeyed(cur.topicDrafts, imported.topicDrafts, syncPickNewer('updatedAt')),
      drafts:       syncMergeKeyed(cur.drafts, imported.drafts, syncPickMoreAnswers),
      topicRecords: syncMergeTopicRecords(cur.topicRecords, imported.topicRecords),
      mistakes:     syncMergeMistakes(cur.mistakes, imported.mistakes),
      sectionHistory: syncMergeSectionHistory(cur.sectionHistory, imported.sectionHistory),
      subskillHistory: syncMergeSectionHistory(cur.subskillHistory, imported.subskillHistory),
      words:          syncMergeWords(cur.words, imported.words),
      phrases:        syncMergeWords(cur.phrases, imported.phrases),
      taskLog:        syncMergeTaskLog(cur.taskLog, imported.taskLog),
      knowledgeProgress: syncMergeKBProgress(cur.knowledgeProgress, imported.knowledgeProgress),
      kbMastery:      syncMergeMastery(cur.kbMastery, imported.kbMastery),
    };
    this._save(out);
    return out;
  },
};

/* =====================================================================
   #15 合并辅助函数（文件作用域，不挂 window）
   命名统一 sync* 前缀，避免与站内其它全局函数撞名。
   ===================================================================== */

/* 按键合并：两端都有的键交给 pick(a,b) 决定留哪条，只有一端有的直接留。
   pick 返回较「新/完整」的那条。空集合统一当 {} 处理。 */
function syncMergeKeyed(curMap, impMap, pick) {
  const a = curMap || {}, b = impMap || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const k of keys) {
    const ca = a[k], cb = b[k];
    out[k] = (ca && cb) ? pick(ca, cb) : (ca || cb);
  }
  return out;
}

/* 通用「更新时间更大者胜」：selector 取出时间戳字段。
   缺字段的当作 0，于是「有时间的」一方自然胜出。 */
function syncPickNewer(field) {
  return (a, b) => ((b?.[field] || 0) > (a?.[field] || 0)) ? b : a;
}

/* 整卷草稿没有时间戳，用「作答数更多」近似「更新」：
   一份写满一半的草稿比一份只点了一题的更有保留价值。 */
function syncPickMoreAnswers(a, b) {
  const count = v => v ? Object.values(v).filter(x => String(x ?? '').trim() !== '').length : 0;
  return count(b) > count(a) ? b : a;
}

/* 专题复盘是无键的追加数组，按签名去重拼接避免两端都有时翻倍。
   签名含 type + examId + ts + 作答内容；同一篇材料两次复盘若作答
   完全相同才算同一条（不同作答是不同练习，应都留着）。 */
function syncTopicRecordSig(r) {
  const ans = (r && typeof r.answers === 'object' && r.answers) ? JSON.stringify(r.answers) : '';
  return [r?.type, r?.examId, r?.ts, ans].join('|');
}
function syncMergeTopicRecords(curArr, impArr) {
  const seen = new Set();
  const out = [];
  for (const r of [...(curArr || []), ...(impArr || [])]) {
    const sig = syncTopicRecordSig(r);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(r);
  }
  return out;
}

/* 错题按身份去重：同一道题（同 examId + 同 qid）在两端不应变成两条。
   命中同一条时再做字段级合并（见 syncMergeMistake）。

   身份键只用 (examId|qid)，不带入 ts —— 这是刻意的：
   addMistakes 收题时把 ts 写成 Date.now()，导出文件里那道题的 ts 是
   当时收题的时间，两台设备或「导出后再在本机收同一题」ts 几乎必然
   不同。若按 (examId|qid|ts) 去重，同一道题会被拆成两条，更糟的是
   当前设备已排好的复习排期（绑定在那个 ts 上）会和导入端同题但 ts
   不同的那条凑不成一对，排期被静默丢掉。而 (examId|qid) 在同一套卷里
   天然唯一标识一道题，跨设备也稳合，正合适做合并主键。
   同题被收错过多次（不同 ts）在合并时收口成一条，也是错题本该有的形态。 */
function syncMistakeKey(m) {
  return [m?.examId, m?.qid].join('|');
}
function syncMergeMistakes(curArr, impArr) {
  const byKey = new Map();
  for (const m of (curArr || [])) {
    const k = syncMistakeKey(m);
    if (!byKey.has(k)) byKey.set(k, m);   /* 当前设备同题只留第一份，其余收口 */
  }
  for (const m of (impArr || [])) {
    const k = syncMistakeKey(m);
    const cur = byKey.get(k);
    if (!cur) { byKey.set(k, m); continue; }
    byKey.set(k, syncMergeMistake(cur, m));
  }
  return [...byKey.values()];
}

/* 命中同一条错题时的字段级合并。
   复习字段（reviewStage/nextReviewAt/reviewStatus）取「进展更靠前」的
   一方 —— 这是本功能最不能丢的东西：别台设备往前排好的轮次要保住。
   文字字段（错因/知识节点/学生笔记/解析）取当前设备已填的一方：
   你正握着的这台设备对内容的编辑更可信；当前是 null/undefined（从
   未有过）才用导入端补位。注意空串 '' 是有意义的「学生手改过」，
   不能用 it || imported 当成缺失来覆盖。 */
function syncReviewMoreAdvanced(a, b) {
  const retiredA = a?.nextReviewAt === -1, retiredB = b?.nextReviewAt === -1;
  if (retiredA && !retiredB) return a;
  if (retiredB && !retiredA) return b;
  const sa = a?.reviewStage ?? -1, sb = b?.reviewStage ?? -1;
  if (sb > sa) return b;
  if (sa > sb) return a;
  return ((b?.nextReviewAt || 0) >= (a?.nextReviewAt || 0)) ? b : a;
}
function syncMergeMistake(cur, imp) {
  const merged = { ...cur };
  const adv = syncReviewMoreAdvanced(cur, imp);
  merged.reviewStage = adv.reviewStage;
  merged.nextReviewAt = adv.nextReviewAt;
  merged.reviewStatus = adv.reviewStatus;
  for (const f of ['cause', 'subCause', 'knowledgeNode', 'causeSource', 'studentNote', 'explanation', 'errStage']) {
    if (merged[f] == null && imp[f] != null) merged[f] = imp[f];
  }
  return merged;
}

/* 分题型历史得分的合并。sectionHistory 是 {[sectionKey]: [{correct,total,submittedAt,examId}]}。
   两台设备各自交过几次卷，合并就是把同一个 sectionKey 的数组拼起来去重。
   去重键用 (submittedAt|examId)：同一卷同一时间交的记录是同一条；
   不同时间交的（哪怕是同一套卷重做）是不同的练习历史，应都留着。 */
function syncMergeSectionHistory(curMap, impMap) {
  const a = curMap || {}, b = impMap || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const k of keys) {
    const arr = [...(a[k] || []), ...(b[k] || [])];
    const seen = new Set();
    out[k] = arr.filter(r => {
      const sig = [r?.submittedAt, r?.examId].join('|');
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }
  return out;
}

/* 掌握度自评合并：当前设备已填的优先（学生正握着的这台设备对自评更可信）。
   导入端只有「当前设备没填过」的节点才补进来，避免把本机自评整批冲掉。
   键是知识节点 id，数量仅几十个，直接按对象合并即可，无去重/排期之虑。 */
function syncMergeMastery(curMap, impMap) {
  const out = { ...(impMap || {}) };
  for (const k of Object.keys(curMap || {})) out[k] = curMap[k];
  return out;
}

/* 生词本合并（C5）：同一生词取「进展更靠前」的一方 —— 排期是时间累积
   资产，与错题的复习字段同一口径（syncReviewMoreAdvanced）。 */
function syncMergeWords(curMap, impMap) {
  const out = { ...(curMap || {}) };
  for (const k of Object.keys(impMap || {})) {
    out[k] = out[k] ? syncReviewMoreAdvanced(out[k], impMap[k]) : impMap[k];
  }
  return out;
}

/* 每日任务完成记录合并（学业分析 E3）：按日期取并集，同日同任务去重。 */
function syncMergeTaskLog(curMap, impMap) {
  const out = { ...(curMap || {}) };
  for (const k of Object.keys(impMap || {})) {
    out[k] = [...new Set([...(out[k] || []), ...(impMap[k] || [])])];
  }
  return out;
}

/* 节点练测进度合并：按节点逐个取「台阶更高」的一方（Review.kbTier），
   同阶取累计作答较多者；计数类字段（seen/correct/reviewStage/变体）
   都取 max（进度是只增不减的累积量）；复练排期取较早到期的一方 ——
   到期复习丢一天就断档，宁早勿晚；retired 只要一方毕业即毕业。 */
function syncMergeKBProgress(curMap, impMap) {
  const out = { ...(curMap || {}) };
  for (const node of Object.keys(impMap || {})) {
    const a = out[node];
    const b = impMap[node];
    if (!a) { out[node] = { ...b, variants: { ...(b.variants || {}) } }; continue; }
    const rankA = Review.kbTier(a).rank;
    const rankB = Review.kbTier(b).rank;
    const takeB = rankB > rankA
      || (rankB === rankA && (b.seen || 0) > (a.seen || 0));
    const base = takeB ? b : a;
    const other = takeB ? a : b;
    const merged = {
      seen: Math.max(a.seen || 0, b.seen || 0),
      correct: Math.max(a.correct || 0, b.correct || 0),
      reviewStage: Math.max(a.reviewStage || 0, b.reviewStage || 0),
      variants: { ...(base.variants || {}) },
    };
    for (const v of Object.keys(other.variants || {})) {
      const x = merged.variants[v] || {};
      const y = other.variants[v];
      merged.variants[v] = {
        seen: Math.max(x.seen || 0, y.seen || 0),
        correct: Math.max(x.correct || 0, y.correct || 0),
      };
    }
    if (a.retired || b.retired) merged.retired = true;
    const dueA = a.nextReviewAt, dueB = b.nextReviewAt;
    if (typeof dueA === 'number' || typeof dueB === 'number') {
      merged.nextReviewAt = Math.min(
        typeof dueA === 'number' ? dueA : Infinity,
        typeof dueB === 'number' ? dueB : Infinity);
      if (merged.nextReviewAt === Infinity) delete merged.nextReviewAt;
    }
    out[node] = merged;
  }
  return out;
}
