/* 通用英汉词典（AsunDictionary，MIT）—— 查词兜底数据源（C4）。
   由 tools/convert_ecdict.py 从 .work/ecdict_dump.sql 生成，勿手改；
   分片按首字母懒加载（data/vocab/dict/<l>.js），主释义仍以 8 本精选词书优先。 */
window.__DICT_CACHE__ = window.__DICT_CACHE__ || {};
window.__DICT__ = {"meta":{"name":"通用词典（AsunDictionary）","total":121861,"source":"github english-chinese-dict-db（MIT，© 2026 Richasun，汇编自多个开源词库）","file":"dict/<首字母>.js"},"letters":"abcdefghijklmnopqrstuvwxyz"};
window.__DICT__.load = function (letter) {
  if (window.__DICT_CACHE__[letter]) return Promise.resolve(window.__DICT_CACHE__[letter]);
  if (this.letters.indexOf(letter) < 0) return Promise.reject(Error('词典分片不存在'));
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = 'data/vocab/dict/' + letter + '.js';
    s.onload = function () {
      window.__DICT_CACHE__[letter] ? resolve(window.__DICT_CACHE__[letter])
        : reject(Error('词典分片加载失败'));
    };
    s.onerror = function () { reject(Error('词典分片加载失败')); };
    document.head.appendChild(s);
  });
};
