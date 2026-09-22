/* =====================================================================
   Review —— 错题的间隔复习排程
   只做一件事：根据「学生对这道题的最新判断」算出下一次该在什么时候
   再见到它。不碰 DOM，不读写 localStorage —— 调用方（js/app.js）拿到
   patch 后交给 Store.markMistakeReviewed 落盘。

   模型是最朴素的固定阶梯，不是 SM-2：
     阶段 0 → 1 天后   阶段 1 → 3 天    阶段 2 → 7 天
     阶段 3 → 15 天    阶段 4 → 30 天   过完最后一档即「毕业」，不再排期
   为什么不做 SM-2：它需要每次复习给 0–5 的质量分，而本站的复习动作只有
   三个按钮（待回炉 / 复习中 / 已掌握）。用三档去驱动六级质量分，
   算出来的间隔精度是假的 —— 不如把阶梯写明白，学生自己看得懂。

   三个按钮如何映射：
     待回炉 → 阶段归零，明天再看（这道题还没会）
     复习中 → 阶段 +1，按阶梯延长
     已掌握 → 阶段 +2，跳过一档；已到顶则毕业，从队列里消失
   「已掌握」跳一档而不是直接毕业，是因为学生点这个按钮时通常刚看完解析，
   当场记得不代表隔周还记得 —— 留一次确认。

   兼容旧数据：2026-08 之前存的错题没有 reviewStage / nextReviewAt，
   dueAt() 回落到 ts（收题时间），也就是「立刻到期」。老错题会一次性
   全部涌进队列，这是对的：它们本来就从未被安排复习过。
   ===================================================================== */

const REVIEW_INTERVALS = [1, 3, 7, 15, 30];

const DAY_MS = 24 * 60 * 60 * 1000;

/* 毕业标记。用 -1 而不是 null/undefined：后两者与「字段缺失」无法区分，
   而字段缺失的语义是「立刻到期」，正好相反。 */
const REVIEW_RETIRED = -1;

const Review = {
  INTERVALS: REVIEW_INTERVALS,
  RETIRED: REVIEW_RETIRED,

  /* ---------- 节点练测的五级台阶（task.md §8.3，纯计算） ----------
     还没开始(未作答) → 有点模糊(<40%) → 有点思路(≥40%)
     → 基本会了(≥70% 且每变体至少对一题)
     → 挺熟了(100% 且走完 1/3/7 天三轮复练，即 retired)。 */
  KBQ_STAGES: [1, 3, 7],

  kbTier(p) {
    if (!p || !p.seen) return { rank: 0, name: '还没开始' };
    const pct = p.correct / p.seen;
    const vs = p.variants || {};
    const hitAll = Object.keys(vs).length > 0
      && Object.keys(vs).every(v => (vs[v].correct || 0) > 0);
    if (p.retired
      || (pct >= 1 && hitAll && (p.reviewStage || 0) >= this.KBQ_STAGES.length)) {
      return { rank: 4, name: '挺熟了' };
    }
    if (pct >= 0.7 && hitAll) return { rank: 3, name: '基本会了' };
    if (pct >= 0.4) return { rank: 2, name: '有点思路' };
    return { rank: 1, name: '有点模糊' };
  },

  stageOf(item) {
    const n = Number(item?.reviewStage);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, REVIEW_INTERVALS.length) : 0;
  },

  /* 到期时刻。缺字段 → 回落 ts → 立刻到期（见文件头「兼容旧数据」）。 */
  dueAt(item) {
    if (!item) return 0;
    if (item.nextReviewAt === REVIEW_RETIRED) return REVIEW_RETIRED;
    return Number(item.nextReviewAt) || Number(item.ts) || 0;
  },

  retired(item) {
    return this.dueAt(item) === REVIEW_RETIRED;
  },

  isDue(item, now = Date.now()) {
    const due = this.dueAt(item);
    return due !== REVIEW_RETIRED && due <= now;
  },

  /* 状态按钮 → 下一次排期。返回的 patch 直接并进错题记录。 */
  schedule(item, status, now = Date.now()) {
    const stage = this.stageOf(item);
    let next;

    if (status === '已掌握') next = stage + 2;
    else if (status === '复习中') next = stage + 1;
    else next = 0;                               /* 待回炉：从头再来 */

    if (next >= REVIEW_INTERVALS.length) {
      /* 已掌握且阶梯走完 → 毕业。待回炉/复习中不会走到这里（next 有上界）。 */
      return { reviewStage: REVIEW_INTERVALS.length, nextReviewAt: REVIEW_RETIRED };
    }
    return {
      reviewStage: next,
      nextReviewAt: now + REVIEW_INTERVALS[next] * DAY_MS,
    };
  },

  /* 今天该复习的错题，最早到期的排最前。
     已掌握且已毕业的不进队列；「已掌握」但还有阶梯没走完的照样要出现 ——
     这正是间隔复习的意义所在。 */
  due(items, now = Date.now()) {
    return items.filter(x => this.isDue(x, now))
      .sort((a, b) => this.dueAt(a) - this.dueAt(b));
  },

  /* 还在排期、但还没到期的（用于「明天有几道」这类提示）。 */
  upcoming(items, now = Date.now()) {
    return items.filter(x => !this.retired(x) && this.dueAt(x) > now)
      .sort((a, b) => this.dueAt(a) - this.dueAt(b));
  },

  /* 一句话状态，错题本每条右侧显示。天数按日历天差算而不是
     (due-now)/86400000 取整：后者会把「明天早上 8 点」在今晚 9 点时
     说成「0 天后」，学生看不懂。 */
  label(item, now = Date.now()) {
    if (this.retired(item)) return '已完成间隔复习';
    const due = this.dueAt(item);
    if (due <= now) return '今天待复习';

    const days = Math.round((this.dayStart(due) - this.dayStart(now)) / DAY_MS);
    if (days <= 0) return '今天待复习';
    if (days === 1) return '明天复习';
    return `${days} 天后复习`;
  },

  dayStart(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  /* 阶段进度，复习队列页显示「第 2 / 5 轮」。毕业时给满值。 */
  progress(item) {
    const stage = this.stageOf(item);
    return {
      round: Math.min(stage + 1, REVIEW_INTERVALS.length),
      total: REVIEW_INTERVALS.length,
      retired: this.retired(item),
    };
  },
};
