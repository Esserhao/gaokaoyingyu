/* 移动端答题卡抽屉切换 + 题号跳转（事件委托，抗 SPA 重渲染）
   配合 render.js 注入的 .mobile-sheet-btn / .sheet-scrim / .answer-sheet#asheet。
   纯原生 JS，不引入任何依赖。 */
(function () {
  function setOpen(open) {
    var sheet = document.querySelector('.answer-sheet');
    if (!sheet) return;
    var scrim = document.querySelector('.sheet-scrim');
    var btn = document.querySelector('.mobile-sheet-btn');
    sheet.classList.toggle('open', open);
    if (scrim) scrim.classList.toggle('show', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('sheet-open', open);
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-action="toggle-sheet"]');
    if (toggle) {
      e.preventDefault();
      var sheet = document.querySelector('.answer-sheet');
      setOpen(!(sheet && sheet.classList.contains('open')));
      return;
    }

    var dot = e.target.closest('.sheet-dot');
    if (!dot) return;
    /* 题号是页内锚点（#q-…）。若放任其写入 location.hash，
       hashchange 会让路由匹配不到 /exam/… 而回落到首页，考试现场直接被摧毁。
       这里自己完成滚动定位，绝不碰 hash。 */
    e.preventDefault();
    var id = (dot.getAttribute('href') || '').slice(1);
    var target = id && document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: prefersReduce() ? 'auto' : 'smooth' });
      focusQuestion(target);
    }
    if (window.matchMedia('(max-width: 800px)').matches) setOpen(false);
  });

  function prefersReduce() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* 跳题后把焦点交给该题，键盘用户不必从页首重新 Tab */
  function focusQuestion(el) {
    var field = el.querySelector('input, textarea, select');
    if (field) { field.focus({ preventScroll: true }); return; }
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var sheet = document.querySelector('.answer-sheet.open');
    if (!sheet) return;
    setOpen(false);
    var btn = document.querySelector('.mobile-sheet-btn');
    if (btn) btn.focus();
  });
})();
