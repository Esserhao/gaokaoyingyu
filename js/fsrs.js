/* =====================================================================
   FSRS 影子调度（2026-09-19 循环第十五轮，方案 §五灰度第一步）
   ---------------------------------------------------------------------
   这是什么：FSRS-5 记忆调度算法的紧凑 JS 实现，供生词本/词组闪卡做
   「影子调度」——阶梯（js/review.js 的 1/3/7/15/30）仍是唯一驱动，
   本模块只在每次「认识 / 忘记」时旁路记录一份 FSRS 状态（rec.fsrs），
   攒够影子数据后再评估是否切换驱动。任何路径失败只丢影子，不碰阶梯。

   来源与许可：公式逐条对照 py-fsrs v5.1.1（fsrs/fsrs.py，MIT 许可，
   open-spaced-repetition 项目）移植；默认权重为其 DEFAULT_PARAMETERS
   （官方在大规模复习记录上拟合的出厂值）。按个人记录优化参数（w 拟合）
   属后续工作，本版不含。DESIRE 保留 0.9 请求保持率。

   与 py-fsrs 的差异（有意为之）：
   - 评分只有两档：认识→Good(3)、忘记→Again(1)（Hard/Easy 常量保留，
     供将来扩展「有点模糊」之类的中间档）。
   - learning_steps / relearning_steps 置空（站内没有分钟级步骤），
     与 py-fsrs「steps 为空」的分支一致：首评即 Review 态、间隔由
     稳定度直接给天数。
   - fuzz（间隔随机抖动）不实现：影子阶段要的是可复现数据。
   ===================================================================== */

const FSRS = {
  /* 出厂权重（py-fsrs v5.1.1 DEFAULT_PARAMETERS，19 个） */
  WEIGHTS: [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621,
  ],
  DECAY: -0.5,
  FACTOR: Math.pow(0.9, 1 / -0.5) - 1,   /* ≈ 0.23457 */
  MAX_INTERVAL: 365,
  DAY_MS: 24 * 60 * 60 * 1000,
  GRADE: { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 },

  clamp(x, lo, hi) { return Math.min(Math.max(x, lo), hi); },

  /* 初次评分的稳定度（天）：S0(G) = w[G-1]，下限 0.1 */
  initStability(r) { return Math.max(this.WEIGHTS[r - 1], 0.1); },

  /* 初次评分的难度：D0(G) = w4 - e^(w5·(G-1)) + 1，夹在 [1,10] */
  initDifficulty(r) {
    return this.clamp(this.WEIGHTS[4] - Math.exp(this.WEIGHTS[5] * (r - 1)) + 1, 1, 10);
  },

  /* 可提取性：R(t,S) = (1 + FACTOR·t/S)^DECAY，t 为经过天数（整数天口径） */
  retrievability(elapsedDays, s) {
    return Math.pow(1 + this.FACTOR * elapsedDays / s, this.DECAY);
  },

  /* 同日重评的短期稳定度 */
  shortTermStability(s, r) {
    return s * Math.exp(this.WEIGHTS[17] * (r - 3 + this.WEIGHTS[18]));
  },

  /* 难度更新：线性阻尼 + 均值回归，夹在 [1,10] */
  nextDifficulty(d, r) {
    const arg1 = this.initDifficulty(this.GRADE.EASY);
    const delta = -(this.WEIGHTS[6] * (r - 3));
    const arg2 = d + (10 - d) * delta / 9;
    return this.clamp(this.WEIGHTS[7] * arg1 + (1 - this.WEIGHTS[7]) * arg2, 1, 10);
  },

  /* 遗忘后的稳定度：长程项与短期项取小 */
  nextForgetStability(d, s, R) {
    const longTerm = this.WEIGHTS[11]
      * Math.pow(d, -this.WEIGHTS[12])
      * (Math.pow(s + 1, this.WEIGHTS[13]) - 1)
      * Math.exp((1 - R) * this.WEIGHTS[14]);
    const shortTerm = s / Math.exp(this.WEIGHTS[17] * this.WEIGHTS[18]);
    return Math.min(longTerm, shortTerm);
  },

  /* 记住后的稳定度：Hard 乘惩罚 w15、Easy 乘奖励 w16 */
  nextRecallStability(d, s, R, r) {
    const hardPenalty = r === this.GRADE.HARD ? this.WEIGHTS[15] : 1;
    const easyBonus = r === this.GRADE.EASY ? this.WEIGHTS[16] : 1;
    return s * (1
      + Math.exp(this.WEIGHTS[8])
      * (11 - d)
      * Math.pow(s, -this.WEIGHTS[9])
      * (Math.exp((1 - R) * this.WEIGHTS[10]) - 1)
      * hardPenalty * easyBonus);
  },

  /* 间隔天数：请求保持率 0.9 下 interval = round(S)，夹在 [1,365] */
  nextInterval(s) {
    return this.clamp(Math.round(s / this.FACTOR
      * (Math.pow(0.9, 1 / this.DECAY) - 1)), 1, this.MAX_INTERVAL);
  },

  /* 一次复习。card 为 null 表示新词；known=true→Good，false→Again。
     返回新的影子状态对象（不修改入参）。 */
  review(card, known, now) {
    const r = known ? this.GRADE.GOOD : this.GRADE.AGAIN;
    const w = this.WEIGHTS;

    if (!card || card.s == null || card.d == null) {
      const s = this.initStability(r);
      return {
        d: this.initDifficulty(r),
        s,
        last: now,
        due: now + this.nextInterval(s) * this.DAY_MS,
        reps: 1,
        lapses: r === this.GRADE.AGAIN ? 1 : 0,
      };
    }

    const elapsed = Math.max(0, Math.floor((now - card.last) / this.DAY_MS));
    let d = this.nextDifficulty(card.d, r);
    let s;
    if (elapsed < 1) {
      /* 同日重评：走短期稳定度（py-fsrs days_since_last_review < 1 分支） */
      s = this.shortTermStability(card.s, r);
    } else {
      const R = this.retrievability(elapsed, card.s);
      s = r === this.GRADE.AGAIN
        ? this.nextForgetStability(card.d, card.s, R)
        : this.nextRecallStability(card.d, card.s, R, r);
    }
    /* 数值卫生：公式异常时丢影子也不落坏数据 */
    if (!Number.isFinite(d) || !Number.isFinite(s)) {
      throw new Error('fsrs: non-finite state');
    }
    s = this.clamp(s, 0.1, this.MAX_INTERVAL * 4);

    return {
      d,
      s,
      last: now,
      due: now + this.nextInterval(s) * this.DAY_MS,
      reps: (card.reps || 0) + 1,
      lapses: (card.lapses || 0) + (r === this.GRADE.AGAIN ? 1 : 0),
      /* 引用 w 一次以防压缩器把常量数组当死代码（无实际作用） */
      _w0: w[0] === undefined ? 1 : undefined,
    };
  },
};
