/* =====================================================================
   「今天」——纯今日方案页（#/today，2026-09-22）
   ---------------------------------------------------------------------
   为什么单独开这一页：规则引擎（Diagnostic.rules）与任务卡
   （UI.taskCardHtml）其实早就存在，但它们只出现在 #/dashboard 的
   「今天的方案」和 #/analysis 的「今天的方案」里 —— 两处都要学生
   先想到去点「学习总览」或「学业分析」才看得到，首页没有任何入口。
   等于把「今天该干什么」藏在了二级页。本页把它提到最外层，并且
   由首页 hero 下方那条 .today-strip 直达。

   本页不重写任何规则、不新增任何口径：
     input 装配 → Diagnostic.inputFromStore
     任务产出   → Diagnostic.rules
     任务卡     → UI.taskCardHtml（与 #/analysis、#/dashboard 同一张）
   也不放统计图表 —— 那是 #/dashboard 的职责。本页只回答一件事：
   今天做什么。
   ===================================================================== */

window.UI = window.UI || {};
Object.assign(UI, {
  today() {
    const now = Date.now();
    const input = Diagnostic.inputFromStore(now);
    const tasks = Diagnostic.rules(input);
    const done = input.taskDone;

    const d = new Date(now);
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const dateText = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + week;

    /* 一句话现状：只挑三个最有用的数字，不做画像（画像在 #/dashboard）。
       没有任何记录时不留白，直接给下一步。 */
    const exams = Object.keys(Store._load().records || {})
      .filter(id => !id.startsWith('diag-') && !id.startsWith('redo-')).length;
    const pending = input.mistakes.filter(x => x.reviewStatus !== '已掌握').length;
    const bits = [];
    if (exams) bits.push('已练 ' + exams + ' 套真题');
    if (pending) bits.push(pending + ' 道错题待回炉');
    if (!bits.length) bits.push('还没有开始 —— 先做一套真题，或做一次 24 题的诊断');

    const remain = tasks.filter(t => !done.has(t.id));

    this.app().innerHTML = this.header('今天', true)
      + '<main class="today-page shell">'
      + '<div class="library-head today-head"><div>'
      + '<h1>今天</h1>'
      + `<p class="today-date">${dateText} · ${this.esc(bits.join(' · '))}</p></div>`
      + '<a class="text-btn" href="#/dashboard">学习总览 →</a></div>'
      + (tasks.length
        ? '<p class="today-lead">' + (remain.length
            ? '今天有 ' + remain.length + ' 件事，做完可以勾掉。'
            : '今天安排的 ' + tasks.length + ' 件事都完成了。')
          + '</p>'
          + tasks.map(t => this.taskCardHtml(t)).join('')
        : '<section class="word-card"><p class="word-note">今天没有到期的复习，'
          + '也没有需要回炉的知识点。</p>'
          + '<p class="word-note">可以 <a href="#/simulation">做一套整卷</a> 保持手感，'
          + '或者去 <a href="#/learn">知识台阶</a> 提前练一个节点。</p></section>')
      + '</main>';
  },
});
