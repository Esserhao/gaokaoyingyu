/* =====================================================================
   Service Worker（2026-09-19，PWA 离线补完）
   只在 http(s) 下被注册（app.js 按协议守卫）；file:// 双击打开是本站
   主形态，没有 SW 概念，行为完全不变。

   策略（只对同源 GET 生效，外链如 DeepSeek 一律直连）：
   - 页面导航：网络优先，失败回退缓存里的 index.html（离线能开站）。
   - 其余同源资源：stale-while-revalidate——缓存秒开、后台更新、下次
     访问生效。大文件（词典分片 10MB+、examfreq 1.4MB、上海考纲词）不
     预缓存，首次在线用到即入缓存。
   - shell 有改动想立刻生效：把 CACHE 版本号 +1（旧缓存整代清除）。
   ===================================================================== */
const CACHE = 'gkyy-v1';
const SHELL = ['index.html', 'manifest.json', 'assets/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* Range 请求直接放行（2026-09-19 复审修正）：<audio> 的 seek 会让浏览器发
     Range，支持 Range 的托管回 206 分片——206 一旦被 put 进缓存，后续
     caches.match 命中错位分片会损坏播放。放行交给浏览器/网络自理。 */
  if (req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* 导航（含 start_url）：在线拿最新的 index.html，离线回退缓存。 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  /* 同源静态资源：缓存优先 + 后台刷新。只缓存 200 全量响应（206/206 分片
     与 opaque 一律不进缓存）；后台刷新挂 waitUntil，页面早关也能写完。 */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => hit);
      e.waitUntil(net);
      return hit || net;
    })
  );
});
