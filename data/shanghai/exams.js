/* 上海高考英语真题册 —— 上海专区数据（window.__SH_EXAMS__）
   定位（2026-09-07，用户拍板）：先立界面框架与登记结构，数据后续人工提供。
   ⚠ 与全国卷（data/exams/）完全分开：上海卷题型制式不同（春考/秋考；听力 +
   语法与词汇 + 小猫钓鱼 + 阅读 + 翻译 + 概要写作），评分、卷面均独立，
   禁止复用 Exam 的 legacy/new 折算口径。

   收卷约定（供将来填数据时遵守）：
   - 每套卷一条：{ id, year, season, title, source, verified, sections? }
     season ∈ '春考' | '秋考' | '一模' | '二模'；
   - verified=false 时界面标灰「未人核」；source 不得编造；
   - 只有完整题目数据（sections）的卷子才可进「可做题」流程，
     其余一律登记行（卷名 + 外部链接或空态）。 */
window.__SH_EXAMS__ = {
  name: '上海高考英语真题',
  updated: '2026-09-07',
  papers: [
    /* 示例结构（首批数据就位后按此填）：
    {
      id: 'sh2024-qiukao',
      year: 2024,
      season: '秋考',
      title: '2024 年上海高考英语（秋考）',
      source: '',            // 来源链接或说明，不得编造
      verified: false,
      sections: null,        // null = 仅登记；数组 = 可做题
    },
    */
  ],
};
