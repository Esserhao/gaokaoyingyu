/* =====================================================================
   错题重做卷（2026-09-05，纪要附录 E1）
   「上次错的，这次会不会了」——从某套整卷的落账记录里抽出客观错题，
   连同它们引用的原文，临时重组一套小卷重做。设计定稿要点：

   · 只收 reading / seven / cloze / grammar 四类客观节（与诊断卷同口径）；
     听力缺音频、写作与短文改错是主观自评，都不进重做卷。
     原卷未作答的客观题按失分点一并重做（自动交卷的卷子尤其需要）。
   · 卷对象不进 __EXAMS__：id 固定为 redo-<原卷号>，交卷落账、草稿、
     结果页全部走 Exam 通用链路；结果/解析页按前缀还原卷结构。
   · isRedo 标记让 exam.js 跳过能力历史（sectionHistory/subskillHistory）
     与错题重复收集——重做是检验，不是新的训练数据；重做结果看本次
     记录本身。
   · 多篇阅读只保留被错题引用的原文；单原文节整篇保留。
   · 无可重做错题（全对或错题全在主观节）时 build 返回 null，
     调用方据此隐藏入口。
   ===================================================================== */
const Redo = {
  OBJ_SECTION: { reading: 1, seven: 1, cloze: 1, grammar: 1 },

  /* 由原卷 + 原记录构建重做卷；无客观错题时返回 null。
     eq 不传时运行时取 UI.eqAnswer（调用点都在页面上下文）。 */
  build(exam, record, eq) {
    if (!exam || !record || !record.answers) return null;
    const eqFn = eq || (window.UI && UI.eqAnswer)
      || ((a, b) => String(a ?? '').trim().toLowerCase()
        === String(b ?? '').trim().toLowerCase());

    const sections = [];
    let score = 0, count = 0;
    for (const s of exam.sections) {
      if (!this.OBJ_SECTION[s.key]) continue;
      const qs = s.questions.filter(q => {
        const ans = q.answer ?? '';
        if (ans === '') return false;
        return !eqFn(record.answers[`${s.key}-${q.id}`], ans);
      });
      if (!qs.length) continue;
      const ps = s.passages || [];
      const passages = ps.length > 1
        ? ps.filter(p => qs.some(q => q.passageLabel === p.label))
        : ps;
      sections.push({
        key: s.key,
        partTitle: (s.partTitle || s.key) + ' · 错题',
        questions: qs,
        passages,
      });
      score += qs.reduce((a, q) => a + (q.score || 0), 0);
      count += qs.length;
    }
    if (!count) return null;

    /* 建议用时按分数占比折算原卷时长（原卷 120 分钟是按 150 分配的） */
    const srcTotal = exam.totalScore || 150;
    const duration = Math.max(5,
      Math.round((exam.duration || 120) * score / srcTotal));

    return {
      id: 'redo-' + exam.id,
      title: exam.title + ' · 错题重做',
      year: exam.year, paper: exam.paper, region: exam.region,
      format: exam.format,
      duration,
      totalScore: score,
      isRedo: true,
      redoOf: exam.id,
      redoCount: count,
      hasAudio: false,
      sections,
    };
  },
};
