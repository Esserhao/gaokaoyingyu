/* 无障碍补齐层：跳过导航链接 + main landmark 标识 + 路由切换播报
   为什么需要 JS：本站是 hash 路由 SPA，每次路由都用 innerHTML 重建 #app，
   静态 HTML 里写死的 id="main" 会被冲掉；这里用 MutationObserver 在每次
   重渲染后把标识重新贴回当前页的 <main>。纯原生，无依赖。 */
(function () {
  var app = document.getElementById('app');
  if (!app) return;

  /* 路由播报区：屏幕阅读器不会自动读出 innerHTML 替换后的新页面，
     这里把新页面的主标题送进 aria-live 区域，让路由切换可被听见。 */
  var live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  document.body.appendChild(live);

  var lastTitle = '';
  var firstTag = true;
  function tag() {
    var main = app.querySelector('main');
    if (!main) return;
    /* 一页只应有一个 main landmark；若渲染层还留了内层 main，降级为 div 语义 */
    var extra = app.querySelectorAll('main');
    for (var i = 1; i < extra.length; i++) extra[i].setAttribute('role', 'presentation');
    if (main.id !== 'main') main.id = 'main';
    main.setAttribute('tabindex', '-1');

    var h = main.querySelector('h1, h2');
    var title = h ? h.textContent.trim().replace(/\s+/g, ' ') : '';
    if (title && title !== lastTitle) {
      lastTitle = title;
      live.textContent = title;
      document.title = title + ' · 高中英语指北';
      /* 焦点迁移（2026-09-19）：hash 路由换页后焦点原本掉在 body，键盘用户
         要从头 Tab 穿过 20+ 导航链接。只在「页面标题变了」（=真的换页了）
         时把焦点交给 main，局部重渲染不抢焦点；首屏也不抢。 */
      if (!firstTag) main.focus({ preventScroll: true });
      firstTag = false;
    }
  }

  tag();
  new MutationObserver(tag).observe(app, { childList: true });

  /* 跳过导航：href="#main" 若落进 location.hash，路由会匹配不到 /exam/… ——
     和答题卡题号同一个坑，所以这里同样自己完成聚焦，绝不碰 hash。 */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.skip-link');
    if (!link) return;
    e.preventDefault();
    var main = document.getElementById('main');
    if (!main) return;
    main.focus({ preventScroll: true });
    main.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  });
})();
