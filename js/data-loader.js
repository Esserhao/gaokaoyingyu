/* =====================================================================
   data-loader —— 本地数据按需加载（取代 fetch 本地 JSON）
   本站零构建、常需 file:// 双击打开。但浏览器禁止 file:// 页面用
   fetch 读本地 JSON（CORS: origin 'null'），会直接抛 "Failed to fetch"，
   整站卡在「页面加载失败」。

   解法：把数据 JSON 改成 <script> 注入全局变量的 .js 文件（见
   data/*.js、data/exams/*.js），这里只负责「按需注入 + 读取全局」。
   <script src> 不受 file:// 的 fetch CORS 限制，因此 file:// 与 http
   两种打开方式都能正常工作，且行为完全一致（数据内容不变）。
   ===================================================================== */

/* 每套卷的 JSON 在对应 data/exams/<id>.js 里挂到这个缓存，key 是卷 id。
   用 keyed 缓存而非单一槽位，是因为专题/训练页会并行注入十几套卷的脚本，
   若共用一个槽位会被后来者覆盖。 */
window.__EXAMS_CACHE__ = window.__EXAMS_CACHE__ || {};

/* 按需加载某套卷数据。meta 即 index.json 里的一项（含 id、file 等）。
   已缓存则直接返回；否则注入 data/<path>.js 并等待其 onload，
   再从上面对应的缓存槽位取数据。失败（文件缺失/坏脚本）走 onerror 抛错，
   由调用方按原有口径降级（单套异常只跳过该套）。 */
function loadExamData(meta) {
  const id = meta && meta.id;
  if (!id) return Promise.reject(Error('题库加载失败'));
  if (window.__EXAMS_CACHE__[id]) return Promise.resolve(window.__EXAMS_CACHE__[id]);

  const file = (meta.file || `exams/${id}.json`).replace(/\.json$/, '.js');
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'data/' + file;
    s.onload = () => {
      const data = window.__EXAMS_CACHE__[id];
      data ? resolve(data) : reject(Error('题库加载失败'));
    };
    s.onerror = () => reject(Error('题库加载失败'));
    document.head.appendChild(s);
  });
}
