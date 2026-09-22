/* =====================================================================
   星图集（#/synonyms）v3 —— 2026-09-01 对齐知识星图 v2 的形式：
   门厅六栏（#/synonyms）→ 单图页（#/synonyms/<map>）可拖拽旋转的三维
   球面星空：中心词固定在正面（rot 由它的球面基坐标推出，确定性），
   一阶关联 + 词缀门户 + 二阶关联布在斐波那契球上，深度决定星的大小、
   亮度与标签浓淡；拖拽只重投影不走 innerHTML（快照安全）。
   点星唤醒＝换它做中心：球面按新中心重组、它转到正面、链线点亮。
   二阶关联（我的关联词的关联词）半亮细虚线，参考
   robert-mcdermott/ai-knowledge-graph 的 degrees=2 邻域高亮。
   v1 语义全保留：七图各讲一种关系、页签切图保中心、词缀门户星、
   详情卡随图裁剪、门厅保留词缀表与全部词族两张速查表。
   设计：输入一个词 → 夜空里展开与它相连的一串星。连接逻辑有七种，
   **每种关系单独一张图**，页签切换，中心词跨图保持：
     同义（绿，单环） / 近义（蓝，单环，带辨析） / 反义（红，单环）
     形近（粉，单环：词形相近易混淆的词）
     前缀（紫，左翼弧 + 词缀门户星） / 后缀（青，右翼弧 + 词缀门户星）
     词组（橙，单环：含该词的常用词组）
   词缀本身也是一颗星：在派生图上点 un- 这颗门户星换它做中心，展开整个
   un- 家族；词缀做中心时三个词义页签灰置（词缀没有同义近义反义）。
   每颗星（词或词缀）都有专属详情界面，详情卡随当前图裁剪。
   下方「词缀表」是前缀/后缀速查，「全部词族」是同义/近义/反义速查。

   词缀派生数据口径（不编造关系）：data/vocab/affixes.js 提供手写词缀表，
   运行时与高中词书逐词比对，只有「去掉词缀后余下部分仍是词表中的词」
   才建立派生对（含 e 还原 / 双写还原 / i↔y 还原三种安全拼写还原）；
   词缀家族同样只收通过该检验的词（unique 不会混进 un- 家族）。

   词组数据口径（不编造关系）：data/vocab/phrases.js（gaokao-phrases，
   4,487 条清洗后的常用短语）按「首单词」建立倒排索引，词组图的环星是
   以该词开头的常用词组；词组本身也能当中心（kind='phrase'），展开同首
   词的兄弟词组，详情卡给释义与例句。词组中心不做词义页签灰置。

   形近数据口径（不编造关系，纯词形计算）：运行时与**全部词书并集**
   （~7100 词）逐对比对，「编辑距离 ≤2（短词只认 ≤1）」或
   「共享 ≥6 字母词形核」才建对，universe/universal/university（同核）、
   converge/conserve、quite/quiet、accept/except、than/then 这类易混对
   全部命中；每词最多取 10 个形近邻居（按距离→字典序截断，8 名额会
   把 quite/quiet 这种经典易混对挤出去），确定性可重算。
   词库里不存在的词（如 converse）不造假入图。两两比对 ~2500 万对，
   分片异步构建（不冻结页面），只在进形近图/提交探索框时触发一次。

   星空视觉（2026-08-30）：深蓝夜空底 + 固定种子背景星野 + 四角星形
   星点（闪烁）+ 中心辐射线 + 同类相邻星虚线链。坐标零随机（星位由
   中心与词族决定，星野固定种子），同一中心渲染逐字节一致。
   ===================================================================== */
window.UI = window.UI || {};
/* 七图的品牌色（门厅栏 + 球面星与链线用） */
const SYN_MAP_COLOR = {
  syn: '#6fd3a4', near: '#86b6f2', ant: '#f2938c', sim: '#f0a3c2',
  pre: '#b48ef2', suf: '#5ac8d8', phr: '#f4b86a',
};
/* 球面星空几何（与知识星图 v2 同尺寸，两页视觉统一） */
const SYN_SKY = { W: 900, H: 560, CX: 450, CY: 272, R: 208 };
Object.assign(UI, {
  /* 页面级状态：
       center 当前中心（词形，或紫金大星上的词缀形如 'un-'，或词组图上的词组）
       kind   'word' | 'affix' | 'phrase'；affixKey / affixKind 词缀中心的键值与前后缀
       map    当前星图 'syn' | 'near' | 'ant' | 'sim' | 'pre' | 'suf' | 'phr'（默认同义图）
       filter / query 用于下方词族列表 */
  _synState: { center: 'big', kind: 'word', map: 'syn', filter: 'all', query: '' },
  _synIdx: null,
  _affixIdx: null,
  _affixP: null,
  _phrIdx: null,
  _phraseP: null,
  _formIdx: null,
  _formP: null,

  /* 七张星图的元信息：页签顺序、显示名、一句话说明（图例用） */
  _SYN_MAPS: [
    { id: 'syn', name: '同义', desc: '意思相近，多数语境可互换', shape: 'ring' },
    { id: 'near', name: '近义', desc: '意思接近但有细微差别，点开看辨析', shape: 'ring' },
    { id: 'ant', name: '反义', desc: '意思相反', shape: 'ring' },
    { id: 'sim', name: '形近', desc: '词形相近容易混淆的词——对比着记最牢', shape: 'ring' },
    { id: 'pre', name: '前缀', desc: '加前缀派生的词，点 un- 这类门户星看整个家族', shape: 'left' },
    { id: 'suf', name: '后缀', desc: '加后缀派生的词，点 -ment 这类门户星看整个家族', shape: 'right' },
    { id: 'phr', name: '词组', desc: '含这个词的常用词组，点词组星看释义与例句', shape: 'ring' }
  ],
  /* 一张图上最多画多少颗环星（其余留在详情卡里，避免星图挤成一团） */
  _SYN_STAR_CAP: 14,

  /* 由 window.__SYN__.groups 构建 词→关系 倒排索引（记忆化）
     notes 额外记「近义词对之间的辨析」，供近义图详情卡显示——
     一个词可能属于多个词族，辨析必须按「与谁近义」一对一存，不能只存一个。 */
  _synIndex() {
    if (this._synIdx) return this._synIdx;
    const groups = (window.__SYN__ && window.__SYN__.groups) || [];
    const idx = {};
    groups.forEach(g => {
      g.words.forEach(w => {
        const k = w.toLowerCase();
        let ent = idx[k];
        if (!ent) ent = idx[k] = { syn: [], near: [], ant: [], meaning: g.meaning, note: g.note || '', notes: [] };
        g.words.forEach(o => {
          if (o.toLowerCase() === k) return;
          const rel = g.type;
          const ow = o.toLowerCase();
          if (!ent[rel].includes(ow)) ent[rel].push(ow);
          if (rel === 'near' && g.note && !ent.notes.some(n => n.w === ow)) {
            ent.notes.push({ w: ow, note: g.note });
          }
        });
      });
    });
    this._synIdx = idx;
    return idx;
  },

  /* 词在词族里的共享释义（用于详情卡片上下文） */
  _wordMeaning(word) {
    const e = this._synIndex()[word.toLowerCase()];
    return e ? e.meaning : '';
  },

  /* 与某个近义词之间的辨析（近义图详情卡用） */
  _wordNote(word, other) {
    const e = this._synIndex()[word.toLowerCase()];
    if (!e) return '';
    const hit = (e.notes || []).find(n => n.w === String(other || '').toLowerCase());
    return hit ? hit.note : '';
  },

  /* 某张图的星：ring = 环（或翼）上的星，gate = 中心近旁的词缀门户星。
     页签数量与星座渲染共用此函数，保证「页签上的数 = 图上真有的星数」。
       词义图：ring = 该关系的词（同义/近义/反义各取各的）
       派生图：ring = 该 kind 的派生词（带词缀小标），gate = 本词含有的该 kind 词缀
       词缀中心：只有它所属那张图有内容（un- → 前缀图），其余返回空 */
  _synStars(map) {
    const st = this._synState;
    const idx = this._synIndex();
    const ax = this._affixIdx || { byWord: {}, byAffix: {}, derive: {} };
    const center = st.center;
    const ring = [], gate = [];
    const push = (arr, w, tag) => {
      if (w === center || arr.some(s => s.w === w)) return;
      arr.push({ w, tag: tag || '' });
    };

    if (st.kind === 'affix') {
      const kind = st.affixKind || (ax.byAffix[st.affixKey] || {}).kind || 'pre';
      if (map !== kind) return { ring, gate };
      ((ax.byAffix[st.affixKey] || { words: [] }).words).forEach(w => push(ring, w));
      return { ring, gate };
    }

    if (map === 'syn' || map === 'near' || map === 'ant') {
      ((idx[center] || {})[map] || []).forEach(w => push(ring, w));
      return { ring, gate };
    }

    /* 形近图：词形计算关系（惰索引），只对词中心；词缀/词组中心无形近 */
    if (map === 'sim') {
      if (st.kind !== 'word') return { ring, gate };
      const fi = this._formIdx;
      if (!fi) return { ring, gate };
      (fi[center.toLowerCase()] || []).forEach(w => push(ring, w));
      return { ring, gate };
    }

    /* 词组图：词中心 → 以该词开头的常用词组；词组中心 → 同首单词的兄弟词组 */
    if (map === 'phr') {
      const pi = this._phrIdx;
      if (!pi) return { ring, gate };
      if (st.kind === 'phrase') {
        const self = pi.byPhrase[center.toLowerCase()];
        const fw = self ? ((self.w.match(/^[a-zA-Z']+/) || [''])[0].toLowerCase()) : '';
        (pi.byFirst[fw] || []).forEach(w => {
          if (w.toLowerCase() !== center.toLowerCase()) push(ring, w);
        });
        return { ring, gate };
      }
      (pi.byFirst[center.toLowerCase()] || []).forEach(w => push(ring, w));
      return { ring, gate };
    }

    (ax.derive[center] || []).forEach(d => {
      if (d.kind === map) push(ring, d.w, this._affixDisplay(d.a, d.kind));
    });
    ((ax.byWord[center] || {})[map] || []).forEach(a => push(gate, this._affixDisplay(a, map)));
    return { ring, gate };
  },

  /* 页签行：七张图各带星数；词缀做中心时词义/形近页签灰置（词缀无这些关系） */
  _renderMapTabs() {
    const box = document.getElementById('syn-map-tabs');
    if (!box) return;
    const st = this._synState;
    const isAffix = st.kind === 'affix';
    const counts = {};
    this._SYN_MAPS.forEach(m => {
      const s = this._synStars(m.id);
      counts[m.id] = s.ring.length + s.gate.length;
    });
    box.innerHTML = '<div class="syn-map-tabs-inner">'
      + this._SYN_MAPS.map(m => {
        const off = isAffix && m.shape === 'ring';   // 词义/形近图对词缀中心无意义
        return `<button class="syn-map-tab syn-map-tab-${m.id}${st.map === m.id ? ' active' : ''}"`
          + ` data-action="syn-map" data-map="${m.id}"`
          + (off ? ' disabled title="词缀无同义/近义/反义关系"' : '')
          + ` aria-pressed="${st.map === m.id ? 'true' : 'false'}">`
          + `<span class="syn-map-tab-name">${m.name}</span>`
          + `<span class="syn-map-tab-n">${counts[m.id]}</span></button>`;
      }).join('')
      + '</div>';
  },

  /* 切图：只换关系图，中心词/搜索框/词族列表一律不动。
     词缀中心不允许切到词义图（页签已 disabled，这里是同一道闸）。 */
  synMap(map) {
    const st = this._synState;
    if (!this._SYN_MAPS.some(m => m.id === map)) return;
    if (st.kind === 'affix' && (map === 'syn' || map === 'near' || map === 'ant' || map === 'sim')) return;
    st.map = map;
    this._renderConstellation();
  },

  /* ---------- 词缀派生索引（惰性构建，一次构建后记忆化） ----------
     依赖高中词书（highschool，惰加载）+ data/vocab/affixes.js 词缀表。
     产出：
       byWord  { unhappy: {pre:['un'], suf:['ness']} }   词里实际含有的词缀
       byAffix { un: {kind:'pre', words:[...]}, ... }    词缀家族（只收通过检验的词）
       derive  { unhappy: [{w:'happy', a:'un', kind:'pre'},
                          {w:'unhappiness', a:'un', kind:'pre'}], ... } 派生对（双向）
     检验口径：去词缀后余下部分必须仍是词表中的词；后缀做三种安全拼写
     还原（去 e / 去双写 / i↔y），前缀只做直接截取。词形巧合（如 really
     按 re- 配到 ally）不另行排除 —— 关系只声明词形派生，不声明词义。 */
  _affixReady() {
    if (this._affixP) return this._affixP;
    this._affixP = new Promise(resolve => {
      const done = () => { this._buildAffixIndex(); resolve(); };
      if (window.__VOCAB__ && window.__VOCAB__.load) {
        window.__VOCAB__.load('highschool').then(done).catch(done);
      } else done();
    });
    return this._affixP;
  },

  _buildAffixIndex() {
    if (this._affixIdx) return this._affixIdx;
    const table = window.__AFFIX__ || { prefixes: [], suffixes: [] };
    const cache = window.__VOCAB_CACHE__ || {};
    const words = (cache.highschool || [])
      .map(x => (x.w || '').toLowerCase())
      .filter(w => /^[a-z]+$/.test(w));
    const wordSet = new Set(words);
    const byWord = {}, byAffix = {}, derive = {};

    const restore = stem => [stem, stem.replace(/e$/, ''), stem.replace(/(.)\1$/, '$1'),
      stem.replace(/i$/, 'y'), stem + 'e', stem + 'y']
      .find(t => t.length >= 3 && wordSet.has(t)) || null;

    const link = (w, base, a, kind) => {
      (derive[w] || (derive[w] = [])).push({ w: base, a, kind });
      (derive[base] || (derive[base] = [])).push({ w, a, kind });
    };

    table.prefixes.forEach(p => {
      const list = [];
      words.forEach(w => {
        if (w.length - p.a.length < 3 || !w.startsWith(p.a)) return;
        const base = w.slice(p.a.length);
        if (!wordSet.has(base)) return;
        list.push(w);
        ((byWord[w] || (byWord[w] = { pre: [], suf: [] })).pre).push(p.a);
        link(w, base, p.a, 'pre');
      });
      if (list.length) byAffix[p.a] = { kind: 'pre', words: list };
    });

    table.suffixes.forEach(s => {
      const list = [];
      words.forEach(w => {
        if (w.length - s.a.length < 3 || !w.endsWith(s.a)) return;
        const base = restore(w.slice(0, w.length - s.a.length));
        if (!base) return;
        list.push(w);
        ((byWord[w] || (byWord[w] = { pre: [], suf: [] })).suf).push(s.a);
        link(w, base, s.a, 'suf');
      });
      if (list.length) byAffix[s.a] = { kind: 'suf', words: list };
    });

    /* 确定性：派生对去重 + 双向列表按词排序；家族词表排序 */
    Object.keys(derive).forEach(k => {
      const seen = new Set();
      derive[k] = derive[k]
        .filter(d => { const sig = d.w + '|' + d.a + d.kind; if (seen.has(sig)) return false; seen.add(sig); return true; })
        .sort((x, y) => (x.w < y.w ? -1 : x.w > y.w ? 1 : 0));
    });
    Object.keys(byAffix).forEach(k => byAffix[k].words.sort());
    this._affixIdx = { byWord, byAffix, derive, wordSet };
    return this._affixIdx;
  },

  /* ---------- 形近索引（惰性构建，分片异步，完成后一次性赋 _formIdx） ----------
     纯词形计算（不编造关系）：对全部词书并集（~7100 词）两两比对，
       · 编辑距离 ≤2（<5 字母的短词只认 ≤1）—— quite/quiet、
         accept/except、converge/conserve、than/then 这类易混对；
       · 或共享 ≥6 字母词形核 —— universe/universal/university。
     邻居按（距离→字典序）排序后每词截前 10 个，确定性可重算。
     ~2500 万对分片跑（每片 700 词，setTimeout 让出主线程），构建期间
     _formIdx 保持 null（页签/星座自然显示 0 星），完成后 synPage 的
     .then 回调重绘一次。词库里不存在的词（如 converse）不造假入图。 */
  _formReady() {
    if (this._formP) return this._formP;
    this._formP = new Promise(resolve => {
      const done = () => { this._buildFormIndex(() => resolve()); };
      const V = window.__VOCAB__;
      if (V && V.load && V.books && V.books.length) {
        Promise.all(V.books.map(b => V.load(b.id).catch(() => {}))).then(done, done);
      } else done();
    });
    return this._formP;
  },

  _buildFormIndex(onDone) {
    if (this._formIdx) { if (onDone) onDone(); return this._formIdx; }
    if (this._formBuilding) { this._formDoneCbs.push(onDone); return null; }
    this._formBuilding = true;
    this._formDoneCbs = [onDone];
    const cache = window.__VOCAB_CACHE__ || {};
    const words = [...new Set(Object.keys(cache).flatMap(id => (cache[id] || [])
      .map(x => (x.w || '').toLowerCase())
      .filter(w => /^[a-z]{4,}$/.test(w))))].sort();
    const CAP = 10;   /* 8 会把 quite/quiet 这类 d2 同距对按字典序挤掉 */
    const nbr = {};
    words.forEach(w => { nbr[w] = []; });
    const lcp = (a, b) => {
      let i = 0;
      const n = Math.min(a.length, b.length);
      while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
      return i;
    };
    const levCap2 = (a, b) => {          /* 有界编辑距离，>2 提前返回 3 */
      const m = a.length, n = b.length;
      let prev = new Array(n + 1), cur = new Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        cur[0] = i;
        let rowMin = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
          const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
          if (cur[j] < rowMin) rowMin = cur[j];
        }
        if (rowMin > 2) return 3;
        const t = prev; prev = cur; cur = t;
      }
      return prev[n];
    };
    let i = 0;
    const CHUNK = 700;
    const step = () => {
      const end = Math.min(i + CHUNK, words.length);
      for (; i < end; i++) {
        const a = words[i];
        for (let j = i + 1; j < words.length; j++) {
          const b = words[j];
          if (Math.abs(a.length - b.length) > 2) continue;
          let d;
          if (lcp(a, b) >= 6) d = 1;                     /* 同词形核家族 */
          else {
            d = levCap2(a, b);
            if (d > 2) continue;
            if (d === 2 && (a.length < 5 || b.length < 5)) continue;  /* 短词只认 ≤1 */
          }
          nbr[a].push({ w: b, d });
          nbr[b].push({ w: a, d });
        }
      }
      if (i < words.length) { setTimeout(step, 0); return; }
      /* 构建完成：排序截断，一次性赋 _formIdx（此前保持 null），再兑现回调 */
      Object.keys(nbr).forEach(k => {
        nbr[k].sort((x, y) => x.d - y.d || (x.w < y.w ? -1 : x.w > y.w ? 1 : 0));
        nbr[k] = nbr[k].slice(0, CAP).map(o => o.w);
      });
      this._formIdx = nbr;
      this._formBuilding = false;
      const cbs = this._formDoneCbs || [];
      this._formDoneCbs = [];
      cbs.forEach(cb => { if (cb) cb(); });
    };
    step();
    return null;
  },

  /* ---------- 词组索引（惰性构建，一次构建后记忆化） ----------
     依赖 gaokao-phrases 词组书（惰加载，data/vocab/phrases.js）。
     产出：
       byFirst  { get: ['get up', 'get over', …] }   首单词 → 词组列表
       byPhrase { 'get up': {w,m,ex?,exCn?} }         词组 → 词条
       firstSet { get, … }                            有词组的首单词集合
     口径：只收有中文释义的词条（清洗时已滤掉无释义条目）；首单词取
     词组开头连续英文字母；词组间关系只声明「共享首单词」，不编造别的关联。 */
  _phraseReady() {
    if (this._phraseP) return this._phraseP;
    this._phraseP = new Promise(resolve => {
      const done = () => { this._buildPhraseIndex(); resolve(); };
      if (window.__VOCAB__ && window.__VOCAB__.load) {
        window.__VOCAB__.load('gaokao-phrases').then(done).catch(done);
      } else done();
    });
    return this._phraseP;
  },

  _buildPhraseIndex() {
    if (this._phrIdx) return this._phrIdx;
    const list = (window.__VOCAB_CACHE__ || {})['gaokao-phrases'] || [];
    const byFirst = {}, byPhrase = {};
    const firstOf = w => (((w || '').match(/^[a-zA-Z']+/) || [''])[0].toLowerCase());
    list.forEach(p => {
      if (!p || !p.w || !p.m) return;
      const k = p.w.toLowerCase();
      if (byPhrase[k]) return;
      byPhrase[k] = p;
      const f = firstOf(p.w);
      if (!f) return;
      (byFirst[f] || (byFirst[f] = [])).push(p.w);
    });
    Object.keys(byFirst).forEach(k => byFirst[k].sort());
    this._phrIdx = { byFirst, byPhrase, firstSet: new Set(Object.keys(byFirst)) };
    return this._phrIdx;
  },

  /* 词缀显示形：前缀 un-，后缀 -ment */
  _affixDisplay(key, kind) { return kind === 'pre' ? key + '-' : '-' + key; },

  /* 输入串匹配词缀（容忍带/不带连字符）：返回 {key} 或 null。
     词命中优先于词缀命中（调用方保证先查词索引）。 */
  _matchAffix(t) {
    const idx = this._affixIdx;
    if (!idx) return null;
    const bare = t.replace(/^-+/, '').replace(/-+$/, '');
    return idx.byAffix[bare] ? { key: bare } : null;
  },

  /* 主入口（#/synonyms 门厅）：六栏星图入口 + 探索框 + 词缀表 + 全部词族。
     单图球面在 #/synonyms/<map>（synPage）；探索框在门厅提交后由
     synCenter 自动跳到对应单图页。门厅统计只用同步可得的数据
     （词族/词缀表都是同步脚本），不受惰加载时序影响（快照确定性）。 */
  synonyms(filter, query) {
    if (filter !== undefined) this._synState.filter = filter;
    if (query !== undefined) this._synState.query = query;
    const st = this._synState;
    const table = window.__AFFIX__ || { prefixes: [], suffixes: [] };
    const groups = (window.__SYN__ && window.__SYN__.groups) || [];
    const cols = this._SYN_MAPS.map(m => {
      const s = this._synStars(m.id);
      const cnt = s.ring.length + s.gate.length;
      return `<a class="syn-gate-col" href="#/synonyms/${m.id}" style="--sync:${SYN_MAP_COLOR[m.id]}">`
        + `<span class="syn-gate-kicker" style="color:${SYN_MAP_COLOR[m.id]}">${m.name}</span>`
        + `<b class="syn-gate-count">${cnt}</b>`
        + `<span class="syn-gate-sub">颗星 · 中心「${this.esc(st.center)}」</span>`
        + `<p class="syn-gate-blurb">${this.esc(m.desc)}</p>`
        + '<span class="syn-gate-go">进入星图 →</span></a>';
    }).join('');
    UI.app().innerHTML = '<main class="syn-page" id="syn-gate">'
      + '<header class="syn-hero">'
      + '<h1>星图集</h1>'
      + '<p>以词为中心的关系星空，七张图各讲一种关系：'
      + '同义 / 近义 / 反义 / 形近 / 前缀 / 后缀 / 词组。点进一张图，拖动旋转、'
      + '点任意星换它做中心——与它相连的词会一起亮起；'
      + '每颗星都有专属详情界面，切图时中心词保持。</p>'
      + '<div class="syn-explore-row">'
      + `<input id="syn-explore" class="syn-explore-input" data-syn-explore value="${this.esc(st.center)}" placeholder="输入一个词，如 big / happy / increase">`
      + '<button class="primary-btn" data-action="syn-explore">展开星座</button>'
      + '<button class="text-btn" data-action="syn-random">随机一个词</button>'
      + '</div>'
      + '<div id="syn-explore-hint" class="syn-hint"></div>'
      + '</header>'
      + `<div class="syn-gate">${cols}</div>`
      + `<section class="kg-stats"><div><b>${groups.length}</b><span>词族</span></div>`
      + `<div><b>${table.prefixes.length + table.suffixes.length}</b><span>词缀</span></div>`
      + `<div><b>${this._SYN_MAPS.length}</b><span>星图</span></div></section>`
      + '<section class="syn-affixes-wrap"><div class="syn-groups-head">'
      + '<h2>词缀表</h2><span class="syn-affix-note">点词缀展开它的家族；'
      + '派生关系按「去词缀后仍是词表中的词」计算</span></div>'
      + '<div id="syn-affixes" class="syn-affixes"></div></section>'
      + '<section class="syn-groups-wrap">'
      + '<div class="syn-groups-head"><h2>全部词族</h2>'
      + '<div class="syn-filters">'
      + `<button data-action="syn-filter" data-filter="all" class="syn-filter ${st.filter === 'all' ? 'active' : ''}">全部</button>`
      + `<button data-action="syn-filter" data-filter="syn" class="syn-filter ${st.filter === 'syn' ? 'active' : ''}">同义</button>`
      + `<button data-action="syn-filter" data-filter="near" class="syn-filter ${st.filter === 'near' ? 'active' : ''}">近义</button>`
      + `<button data-action="syn-filter" data-filter="ant" class="syn-filter ${st.filter === 'ant' ? 'active' : ''}">反义</button>`
      + `<input id="syn-list-search" class="syn-list-search" data-syn-list-search value="${this.esc(st.query)}" placeholder="筛选词族…">`
      + '<button class="text-btn" data-action="syn-search">搜索</button>'
      + '</div></div>'
      + '<div id="syn-groups" class="syn-groups"></div>'
      + '</section>'
      + '</main>';
    this._renderGroupList();
    this._renderAffixTable();
  },

  /* 单图页（#/synonyms/<map>）：门厅栏点进来。探索框与页签（切图保中心）
     保留在本页；词缀/词组索引惰加载就绪后重绘一次（若仍在本页）。 */
  synPage(map) {
    const st = this._synState;
    if (this._SYN_MAPS.some(m => m.id === map)) st.map = map;
    const meta = this._SYN_MAPS.find(m => m.id === st.map) || this._SYN_MAPS[0];
    UI.app().innerHTML = '<main class="syn-page">'
      + '<header class="syn-hero">'
      + '<div class="library-head"><div>'
      + `<span class="eyebrow" style="color:${SYN_MAP_COLOR[meta.id]}">${this.esc(meta.name)} · WORD STAR MAP</span>`
      + '<h1>星图集</h1></div>'
      + '<a class="text-btn" href="#/synonyms">← 星图门厅</a></div>'
      + '<div class="syn-explore-row">'
      + `<input id="syn-explore" class="syn-explore-input" data-syn-explore value="${this.esc(st.center)}" placeholder="输入一个词，如 big / happy / increase">`
      + '<button class="primary-btn" data-action="syn-explore">展开星座</button>'
      + '<button class="text-btn" data-action="syn-random">随机一个词</button>'
      + '</div>'
      + '<div id="syn-explore-hint" class="syn-hint"></div>'
      + '</header>'
      + '<section class="syn-constellation-wrap">'
      + '<div id="syn-map-tabs" class="syn-map-tabs"></div>'
      + '<div id="syn-constellation" class="syn-constellation syn-sky" data-syn-sky></div></section>'
      + '<section id="syn-detail" class="syn-detail"></section>'
      + '</main>';
    this._renderConstellation();
    this._affixReady().then(() => {
      if (document.querySelector('[data-syn-sky]')) this._renderConstellation();
    });
    this._phraseReady().then(() => {
      if (document.querySelector('[data-syn-sky]')) this._renderConstellation();
    });
    this._formReady().then(() => {
      if (document.querySelector('[data-syn-sky]')) this._renderConstellation();
    });
    /* 考频星等（附录 G1）：examfreq 数据就绪后重绘一次，星随真题卷次
       变大变亮。首次渲染不等它（与词缀/词组/形近索引同一回填模式）。 */
    this._freqReady().then(() => {
      if (document.querySelector('[data-syn-sky]')) this._renderConstellation();
    });
  },

  /* 词缀速查表：前缀/后缀两组芯片，点任意词缀换它做星座中心 */
  _renderAffixTable() {
    const box = document.getElementById('syn-affixes');
    if (!box) return;
    const table = window.__AFFIX__ || { prefixes: [], suffixes: [] };
    const row = (title, list, kind) => '<div class="syn-affix-row">'
      + `<b class="syn-affix-row-title">${title}</b>`
      + '<div class="syn-affix-chips">'
      + list.map(p => `<button class="syn-chip syn-chip-aff" data-action="syn-star" `
        + `data-word="${this._affixDisplay(p.a, kind)}">${this._affixDisplay(p.a, kind)}</button>`).join('')
      + '</div></div>';
    box.innerHTML = row('前缀', table.prefixes, 'pre') + row('后缀', table.suffixes, 'suf');
  },

  /* 星座区 v3：三维球面星空。
     中心词固定转正面（确定性：rot 由 hub 基坐标推出，渲染即落位）；
     一阶关联 + 词缀门户 + 二阶关联（仅词义图）布在斐波那契球上，
     深度决定星的大小/亮度/标签浓淡；拖拽只重投影不走 innerHTML。
     所有坐标由中心与词族决定，不含随机数（背景星野固定种子），
     同一中心 + 同一图渲染结果逐字节一致，受快照护栏约束。 */
  /* 星等（附录 G1）：真题考频 → 星体缩放与加亮。
     papers = 该词形在真题中出现的卷次（0–16），映射到 1.0–1.55 倍星体、
     最多 +0.25 透明度；词缀/词组/无考频的词返回 1（默认星等）。
     数据由 _freqReady 懒加载，未就绪时全部按默认画，就绪后整图重绘。 */
  _freqScale(w) {
    const p = (((window.__EXAM_FREQ__ || {}).words || {})[String(w || '').toLowerCase()] || {}).papers || 0;
    if (!p) return { s: 1, op: 0 };
    const t = Math.min(p, 16) / 16;
    return { s: 1 + 0.55 * t, op: 0.25 * t };
  },

  _renderConstellation() {
    const wrap = document.getElementById('syn-constellation');
    if (!wrap) return;
    const st = this._synState;
    this._renderMapTabs();          // 页签星数随中心变，与星座同批重绘
    const center = st.center;
    const map = st.map;
    const meta = this._SYN_MAPS.find(m => m.id === map) || this._SYN_MAPS[0];
    const { ring, gate } = this._synStars(map);
    const cap = this._SYN_STAR_CAP;
    const shown = ring.slice(0, cap);          // 图上画的；其余留给详情卡
    const second = this._synSecond(map, shown);
    const color = SYN_MAP_COLOR[map] || '#6fd3a4';

    /* 节点表：hub 最前（rot 把它转正面）→ 环星 → 词缀门户 → 二阶 */
    const nodes = [{ id: center, kind: 'hub' }];
    shown.forEach(s => nodes.push({ id: s.w, kind: 'ring', tag: s.tag }));
    gate.forEach(s => nodes.push({ id: s.w, kind: 'gate' }));
    second.forEach(s => nodes.push({ id: s.w, kind: 'g2', via: s.via }));

    const n = nodes.length;
    const bases = nodes.map((nd, i) => {
      const y = 1 - 2 * (i + 0.5) / n;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.399963229728653;
      return { x: +(r * Math.cos(a) * SYN_SKY.R).toFixed(2),
               y: +(y * SYN_SKY.R).toFixed(2),
               z: +(r * Math.sin(a) * SYN_SKY.R).toFixed(2) };
    });
    const hb = bases[0], hh = Math.hypot(hb.x, hb.z);
    this._synRot = { x: Math.atan2(hb.y, hh), y: Math.atan2(-hb.x, hb.z) };
    const rot = this._synRot;
    this._skyNodeBase = {};                    // 供拖拽重投影查基坐标
    nodes.forEach((nd, i) => { this._skyNodeBase[nd.id] = bases[i]; });

    const P = bases.map(b => this._skyProject(b, rot));
    const dOf = p => (p.z + SYN_SKY.R) / (2 * SYN_SKY.R);

    let svg = '';
    let seed = 20260830;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 60; i++) {
      svg += `<circle cx="${(rnd() * SYN_SKY.W).toFixed(1)}" cy="${(rnd() * SYN_SKY.H).toFixed(1)}" `
        + `r="${(0.6 + rnd() * 1.1).toFixed(2)}" class="syn-bgstar${i % 5 === 0 ? ' syn-bgstar-tw' : ''}"/>`;
    }

    const idxOf = new Map(nodes.map((nd, i) => [nd.id, i]));
    const line = (ia, ib, cls, kind, baseOp) => {
      const dAvg = (dOf(P[ia]) + dOf(P[ib])) / 2;
      return `<line class="${cls}" data-ea="${this.esc(nodes[ia].id)}" data-eb="${this.esc(nodes[ib].id)}" data-kind="${kind}"`
        + ` x1="${P[ia].x.toFixed(1)}" y1="${P[ia].y.toFixed(1)}" x2="${P[ib].x.toFixed(1)}" y2="${P[ib].y.toFixed(1)}"`
        + ` style="opacity:${(baseOp * (0.45 + 0.55 * dAvg)).toFixed(2)}"/>`;
    };
    nodes.forEach((nd, i) => {
      if (nd.kind === 'ring') svg += line(0, i, `syn-line syn-line-${map}`, 'ring', 0.65);
      else if (nd.kind === 'gate') svg += line(0, i, `syn-line-gate syn-line-gate-${map}`, 'gate', 0.5);
      else if (nd.kind === 'g2') {
        const via = idxOf.get(nd.via);
        if (via !== undefined) svg += line(via, i, 'syn-line-g2', 'g2', 0.3);
      }
    });

    /* 星：按深度从远到近画（近的盖住远的） */
    const draw = nodes.map((nd, i) => ({ nd, i, p: P[i] })).sort((u, v) => u.p.z - v.p.z);
    draw.forEach(({ nd, i, p }) => {
      const d = dOf(p);
      let s, op, fill;
      if (nd.kind === 'hub') { s = 1.7; op = 1; fill = '#ffd98a'; }
      else if (nd.kind === 'ring') { s = 0.42 + 0.5 * d; op = 0.35 + 0.65 * d; fill = color; }
      else if (nd.kind === 'gate') { s = 0.36 + 0.42 * d; op = 0.35 + 0.65 * d; fill = color; }
      else { s = 0.3 + 0.35 * d; op = 0.18 + 0.28 * d; fill = color; }
      /* 星等（附录 G1）：真题考频放大星体并加亮，无考频星保持原样 */
      const fq = this._freqScale(nd.id);
      s *= fq.s;
      op = Math.min(1, op + fq.op);
      const clickable = nd.kind !== 'hub';
      svg += `<g class="syn-snode syn-snode-${nd.kind}" data-nid="${this.esc(nd.id)}"`
        + (clickable ? ` data-action="syn-star" data-word="${this.esc(nd.id)}" role="button" tabindex="0" aria-label="${this.esc(nd.id)}"` : '')
        + ` data-bx="${bases[i].x}" data-by="${bases[i].y}" data-bz="${bases[i].z}"`
        + ` style="opacity:${op.toFixed(2)};${clickable ? 'cursor:pointer' : ''}">`
        + (nd.tag ? `<text class="syn-star-tag" x="${p.x.toFixed(1)}" y="${(p.y - 16).toFixed(1)}" text-anchor="middle" fill="${fill}">${this.esc(nd.tag)}</text>` : '')
        + `<path fill="${fill}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s.toFixed(3)}) translate(-12,-12)"`
        + ` d="M12 1.5 L14.4 9.6 L22.5 12 L14.4 14.4 L12 22.5 L9.6 14.4 L1.5 12 L9.6 9.6 Z"/>`
        + `<text x="${p.x.toFixed(1)}" y="${(p.y + 22).toFixed(1)}" text-anchor="middle" fill="${fill}" style="opacity:${(0.3 + 0.7 * d).toFixed(2)}">${this.esc(nd.id)}</text>`
        + '</g>';
    });

    let html = `<div class="syn-sky-tools">`
      + `<button class="text-btn" data-action="syn-spin">⟳ 自转：${this._synSpin ? '开' : '关'}</button>`
      + `<span class="kg-hint">${shown.length} 颗一阶${gate.length ? ` + ${gate.length} 颗门户` : ''}${second.length ? ` + ${second.length} 颗二阶（半亮）` : ''}`
      + `${window.__EXAM_FREQ__ ? ' · 星越大越亮＝真题出现越多' : ''} —— 拖动旋转，点星唤醒</span></div>`
      + `<svg class="syn-svg" viewBox="0 0 ${SYN_SKY.W} ${SYN_SKY.H}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`
      + `<div class="syn-legend syn-legend-${map}" aria-hidden="true">`
      + `<i class="syn-dot syn-dot-${map}"></i>${meta.name} · ${meta.desc}</div>`;

    if (!shown.length && !gate.length) {
      /* 空图引导：直接告诉用户这个词在哪张图里有内容，并给一键跳过去 */
      const alt = this._SYN_MAPS.find(m => {
        if (st.kind === 'affix' && m.shape === 'ring') return false;
        const s = this._synStars(m.id);
        return s.ring.length + s.gate.length > 0;
      });
      let tip = `「${this.esc(center)}」在「${meta.name}」图里还没有收录的词。`;
      if (alt) {
        const as = this._synStars(alt.id);
        tip += `<button class="syn-empty-jump" data-action="syn-map" data-map="${alt.id}">`
          + `去「${alt.name}」图看 ${as.ring.length + as.gate.length} 颗星 →</button>`;
      } else {
        tip += '换一个词试试（如 big / happy / increase）。';
      }
      html += `<p class="syn-no-stars">${tip}</p>`;
    } else if (ring.length > cap) {
      html += `<p class="syn-trunc-note">图上显示前 ${cap} 颗，共 ${ring.length} 颗，全部见下方详情卡。</p>`;
    }
    wrap.innerHTML = html;

    const det = document.getElementById('syn-detail');
    if (det) {
      det.innerHTML = st.kind === 'affix' ? this._affixCard(st.affixKey)
        : st.kind === 'phrase' ? this._phraseCard(center) : this._detailCard(center);
      if (st.kind !== 'affix' && st.kind !== 'phrase') this._synFillVocab(center);
    }
  },

  /* 二阶关联（参考 ai-knowledge-graph 的 degrees=2 邻域高亮）：
     仅词义/形近图（syn/near/ant/sim）且词中心——我的关联词的关联词，半亮显示。
     确定性：按一阶顺序展开、去重，截前 10 个。 */
  _synSecond(map, shown) {
    const st = this._synState;
    const okType = map === 'syn' || map === 'near' || map === 'ant' || map === 'sim';
    if (st.kind !== 'word' || !okType) return [];
    const nbrOf = map === 'sim'
      ? (w => this._formIdx ? (this._formIdx[w.toLowerCase()] || []) : [])
      : (w => ((this._synIndex()[w.toLowerCase()] || {})[map] || []));
    const seen = new Set([st.center.toLowerCase()]);
    shown.forEach(s => seen.add(s.w.toLowerCase()));
    const out = [];
    shown.forEach(s => {
      nbrOf(s.w).forEach(w2 => {
        const k = w2.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ w: w2, via: s.w });
      });
    });
    return out.slice(0, 10);
  },

  /* 球面投影：绕 Y 轴再绕 X 轴（与知识星图同口径） */
  _skyProject(b, rot) {
    const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
    const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
    const x1 = b.x * cy + b.z * sy;
    const z1 = -b.x * sy + b.z * cy;
    return { x: SYN_SKY.CX + x1, y: SYN_SKY.CY + (b.y * cx - z1 * sx), z: b.y * sx + z1 * cx };
  },

  /* 拖拽/自转中按基坐标重投影（只改属性，不走 innerHTML，快照安全） */
  _skyReproject(svg) {
    const rot = this._synRot;
    const stars = [...svg.querySelectorAll('g[data-nid]')];
    const at = {};
    stars.forEach(g => {
      at[g.dataset.nid] = this._skyProject(
        { x: +g.dataset.bx, y: +g.dataset.by, z: +g.dataset.bz }, rot);
    });
    stars.forEach(g => {
      const p = at[g.dataset.nid];
      const d = (p.z + SYN_SKY.R) / (2 * SYN_SKY.R);
      const kind = g.classList.contains('syn-snode-hub') ? 'hub'
        : g.classList.contains('syn-snode-gate') ? 'gate'
        : g.classList.contains('syn-snode-g2') ? 'g2' : 'ring';
      let s, op;
      if (kind === 'hub') { s = 1.7; op = 1; }
      else if (kind === 'ring') { s = 0.42 + 0.5 * d; op = 0.35 + 0.65 * d; }
      else if (kind === 'gate') { s = 0.36 + 0.42 * d; op = 0.35 + 0.65 * d; }
      else { s = 0.3 + 0.35 * d; op = 0.18 + 0.28 * d; }
      g.querySelector('path').setAttribute('transform',
        `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s.toFixed(3)}) translate(-12,-12)`);
      const tg = g.querySelector('text.syn-star-tag');
      if (tg) { tg.setAttribute('x', p.x.toFixed(1)); tg.setAttribute('y', (p.y - 16).toFixed(1)); }
      const t = g.querySelector('text:not(.syn-star-tag)');
      if (t) { t.setAttribute('x', p.x.toFixed(1)); t.setAttribute('y', (p.y + 22).toFixed(1)); t.style.opacity = (0.3 + 0.7 * d).toFixed(2); }
      g.style.opacity = op.toFixed(2);
    });
    svg.querySelectorAll('line[data-ea]').forEach(ln => {
      const a = at[ln.dataset.ea], b = at[ln.dataset.eb];
      if (!a || !b) return;
      ln.setAttribute('x1', a.x.toFixed(1)); ln.setAttribute('y1', a.y.toFixed(1));
      ln.setAttribute('x2', b.x.toFixed(1)); ln.setAttribute('y2', b.y.toFixed(1));
      const dAvg = ((a.z + b.z) / 2 + SYN_SKY.R) / (2 * SYN_SKY.R);
      const base = { ring: 0.65, gate: 0.5, g2: 0.3 }[ln.dataset.kind] || 0.5;
      ln.style.opacity = (base * (0.45 + 0.55 * dAvg)).toFixed(2);
    });
  },

  /* 球面拖拽（App.init 的 pointer 委托调进来；接口与 KnowledgeGraph 对齐） */
  dragStart(x, y) { this._skyDrag = { x, y, moved: false }; },
  dragMove(x, y) {
    const dg = this._skyDrag;
    if (!dg) return;
    const dx = x - dg.x, dy = y - dg.y;
    if (!dg.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    dg.moved = true;
    this._synRot = { x: Math.max(-1.25, Math.min(1.25, this._synRot.x + dy * 0.005)),
                     y: this._synRot.y + dx * 0.005 };
    dg.x = x; dg.y = y;
    const svg = document.querySelector('[data-syn-sky] svg');
    if (svg) this._skyReproject(svg);
  },
  dragEnd() {
    if (this._skyDrag && this._skyDrag.moved) this._skyDragMoved = true;
    this._skyDrag = false;
  },

  /* 自转：rAF 慢转；离开本页（svg 不在了）自动停（默认关，快照不受影响） */
  setSynSpin(on) {
    this._synSpin = !!on;
    if (!on) return;
    const step = () => {
      if (!this._synSpin) return;
      const svg = document.querySelector('[data-syn-sky] svg');
      if (!svg) { this._synSpin = false; return; }
      this._synRot = { x: this._synRot.x, y: this._synRot.y + 0.003 };
      this._skyReproject(svg);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* 单个词的详情「界面」：词书释义 + **当前这张图**的关系链（随图裁剪）
       同义图 → 只列同义；近义图 → 近义 + 与每个近义词的辨析；
       反义图 → 只列反义；前缀/后缀图 → 该 kind 的派生词 + 本词词缀。
     卡底固定「查词条」链接，与查词模块（#/word/<词>）单向互通。
     （一张图只讲一种关系，详情卡就只给这一种——把四种全堆上来，
       等于把刚拆开的五张图又合回一张。） */
  _detailCard(word) {
    const map = this._synState.map;
    const e = this._synIndex()[word.toLowerCase()] || { syn: [], near: [], ant: [], notes: [] };
    const chip = (w, tag) => `<button class="syn-chip syn-chip-${map}" data-action="syn-star" data-word="${this.esc(w)}">`
      + `${this.esc(w)}${tag ? `<small class="syn-chip-tag">${this.esc(tag)}</small>` : ''}</button>`;
    const none = txt => `<span class="syn-rel-none">${txt}</span>`;
    let body = '';

    if (map === 'syn' || map === 'near' || map === 'ant') {
      const title = { syn: '同义', near: '近义', ant: '反义' }[map];
      const arr = e[map] || [];
      body = `<div class="syn-rel syn-rel-${map}"><b>${title}</b>`
        + (arr.length ? arr.map(w => chip(w)).join('') : none(`暂无收录的${title}词`))
        + '</div>';
      if (map === 'near') {
        /* 辨析按「与谁近义」一对一取：一个词可能属于多个词族，
           直接拿 ent.note 会把别的词族的辨析张冠李戴。 */
        const notes = (e.notes || []).filter(x => arr.includes(x.w));
        if (notes.length) {
          body += '<div class="syn-near-notes">'
            + notes.map(x => `<p class="syn-near-note"><b>${this.esc(x.w)}</b>：${this.esc(x.note)}</p>`).join('')
            + '</div>';
        }
      }
    } else if (map === 'sim') {
      /* 形近图：词形计算关系全量列出（环上截 14，这里不裁） */
      const fi = this._formIdx || {};
      const list = fi[word.toLowerCase()] || [];
      body = `<div class="syn-rel syn-rel-sim"><b>形近词</b>`
        + (list.length ? list.map(w => chip(w)).join('') : none('词表中暂无与它形近的词'))
        + '</div>';
      body += '<p class="syn-derive-rule">形近关系按词形计算（编辑距离 ≤2 或共享 6+ 字母词形核），'
        + '只声明「长得像、易混淆」，不声明词义——正好用来对比辨析。</p>';
    } else if (map === 'phr') {
      /* 词组图：词中心 → 以该词开头的常用词组芯片（全量，不裁剪） */
      const pi = this._phrIdx || { byFirst: {} };
      const list = pi.byFirst[word.toLowerCase()] || [];
      body = `<div class="syn-rel syn-rel-phr"><b>常用词组</b>`
        + (list.length
          ? list.map(p => chip(p)).join('')
          : none('暂无以该词开头的常用词组'))
        + '</div>';
      body += '<p class="syn-derive-rule">词组按「以该词开头」归族，'
        + '点词组星可换它做中心，看释义与例句。</p>';
    } else {
      const ax = this._affixIdx || { byWord: {}, derive: {} };
      const kindName = map === 'pre' ? '前缀' : '后缀';
      const list = (ax.derive[word.toLowerCase()] || []).filter(d => d.kind === map);
      const own = (ax.byWord[word.toLowerCase()] || {})[map] || [];
      body = `<div class="syn-rel syn-rel-${map}"><b>${kindName}派生</b>`
        + (list.length
          ? list.map(d => chip(d.w, this._affixDisplay(d.a, d.kind))).join('')
          : none(`暂无${kindName}派生词`))
        + '</div>';
      if (own.length) {
        body += `<div class="syn-rel syn-rel-${map}"><b>本词${kindName}</b>`
          + own.map(a => chip(this._affixDisplay(a, map))).join('') + '</div>';
      }
      body += `<p class="syn-derive-rule">派生关系按「去掉${kindName}后仍是词表中的词」计算，`
        + '只声明词形派生，不声明词义'
        + (own.length ? `；点${kindName}可换它做中心，展开整个家族` : '') + '。</p>';
    }

    return '<div class="syn-detail-card">'
      + `<div class="syn-detail-head"><h3>${this.esc(word)}</h3>`
      + `<span class="syn-detail-meaning">${this.esc(this._wordMeaning(word))}</span></div>`
      + '<div id="syn-detail-vocab"><span class="syn-loading">查询词书中…</span></div>'
      + `<div class="syn-rel-block">${body}</div>`
      + `<div class="syn-detail-foot"><a class="syn-to-word" href="#/word/${encodeURIComponent(word)}">查词条 →</a></div>`
      + '</div>';
  },

  /* 词缀的详情「界面」：含义 + 家族词表（全部可点回词中心） */
  _affixCard(key) {
    const idx = this._affixIdx || { byAffix: {} };
    const info = idx.byAffix[key] || { kind: 'pre', words: [] };
    const table = window.__AFFIX__ || { prefixes: [], suffixes: [] };
    const def = (info.kind === 'pre' ? table.prefixes : table.suffixes).find(x => x.a === key);
    const disp = this._affixDisplay(key, info.kind);
    const kindName = info.kind === 'pre' ? '前缀' : '后缀';
    const cap = 40;
    const chips = info.words.slice(0, cap).map(w =>
      `<button class="syn-chip syn-chip-aff" data-action="syn-star" data-word="${this.esc(w)}">${this.esc(w)}</button>`).join('');
    return '<div class="syn-detail-card">'
      + `<div class="syn-detail-head"><h3>${this.esc(disp)}</h3>`
      + `<span class="syn-kind-badge">${kindName}</span>`
      + `<span class="syn-detail-meaning">${this.esc(def ? def.m : '')}</span></div>`
      + `<p class="syn-affix-count">词形派生 family：${info.words.length} 个词`
      + (info.words.length > cap ? `（下面显示前 ${cap} 个）` : '') + '</p>'
      + `<div class="syn-affix-family">${chips}</div>`
      + '<p class="syn-affix-rule">家族只收「去掉' + kindName + '后仍是词表中的词」的派生词，'
      + '如 ' + this.esc(disp) + ' 的成员都能拆回一个词表词。</p>'
      + '</div>';
  },

  /* 词组的详情「界面」：释义 + 例句 + 同首单词的兄弟词组。
     词组中心不做词义页签灰置（部分词组本身在词族里），只是其它图自然无星。
     卡头附朗读（浏览器语音）与「收进闪卡」（#/phrases，与生词本同排期）。 */
  _phraseCard(ph) {
    const idx = this._phrIdx || { byPhrase: {}, byFirst: {} };
    const self = idx.byPhrase[ph.toLowerCase()];
    const f = self ? ((self.w.match(/^[a-zA-Z']+/) || [''])[0].toLowerCase()) : '';
    const sibs = (idx.byFirst[f] || []).filter(w => w.toLowerCase() !== ph.toLowerCase());
    const saved = !!Store.getPhrases()[ph.toLowerCase()];
    return '<div class="syn-detail-card">'
      + `<div class="syn-detail-head"><h3>${this.esc(ph)}</h3>`
      + '<span class="syn-kind-badge">词组</span>'
      + this.speakBtn(ph)
      + `<button class="text-btn phr-save-btn" data-action="phr-toggle" data-phr="${this.esc(ph)}">`
      + `${saved ? '✓ 已在闪卡' : '+ 收进闪卡'}</button></div>`
      + (self && self.m ? `<div class="syn-vocab-m">${this.esc(self.m)}</div>` : '')
      + (self && self.ex ? `<div class="syn-vocab-ex">${this.esc(self.ex)}</div>` : '')
      + (self && self.exCn ? `<div class="syn-vocab-excn">${this.esc(self.exCn)}</div>` : '')
      + (sibs.length
        ? `<div class="syn-rel syn-rel-phr"><b>同首词（${this.esc(f)}）的词组</b>`
          + sibs.map(w => `<button class="syn-chip syn-chip-phr" data-action="syn-star" data-word="${this.esc(w)}">${this.esc(w)}</button>`).join('')
          + '</div>'
        : '')
      + '</div>';
  },

  /* 异步从词库（惰加载 highschool，含例句）查该词详情，回填到详情卡 */
  _synFillVocab(word) {
    const el = document.getElementById('syn-detail-vocab');
    if (!el) return;
    this._synLookup(word).then(entry => {
      const box = document.getElementById('syn-detail-vocab');
      if (!box) return; // 页面已切换
      if (!entry) {
        box.innerHTML = '<p class="syn-vocab-none">词书未收录该词条，可参考上方词族释义。</p>';
        return;
      }
      box.innerHTML = '<div class="syn-vocab">'
        + `<div class="syn-vocab-w">${this.esc(entry.w)}`
        + (entry.pos ? ` <span class="syn-vocab-pos">${this.esc(entry.pos)}</span>` : '')
        + (entry.ph ? ` <span class="syn-vocab-ph">${this.esc(entry.ph)}</span>` : '')
        + '</div>'
        + (entry.m ? `<div class="syn-vocab-m">${this.esc(entry.m)}</div>` : '')
        + (entry.ex ? `<div class="syn-vocab-ex">${this.esc(entry.ex)}</div>` : '')
        + (entry.exCn ? `<div class="syn-vocab-excn">${this.esc(entry.exCn)}</div>` : '')
        + '<div class="syn-vocab-src">来源：高中词汇（含例句）</div>'
        + '</div>';
    });
  },

  /* 在已加载词书中查词条。查找顺序固定：highschool 最完整（含音标与
     双语例句）优先，其余按词书表顺序 —— 不按缓存插入顺序，否则查到
     哪本书取决于访问过哪些页面，同一词的详情卡内容会漂。 */
  _synLookup(word) {
    return new Promise(resolve => {
      const cache = window.__VOCAB_CACHE__ || {};
      const find = list => (list || []).find(x => (x.w || '').toLowerCase() === word.toLowerCase());
      const search = () => {
        const order = ['highschool',
          ...((window.__VOCAB__ && window.__VOCAB__.books) || []).map(b => b.id)];
        const seen = new Set();
        for (const id of order) {
          if (seen.has(id)) continue;
          seen.add(id);
          const r = find(cache[id]);
          if (r) return r;
        }
        return null;
      };
      const hit = search();
      if (hit) return resolve(hit);
      if (window.__VOCAB__ && window.__VOCAB__.load) {
        window.__VOCAB__.load('highschool').then(() => resolve(search())).catch(() => resolve(null));
      } else resolve(null);
    });
  },

  /* 把某词（或词组或词缀）设为中心。
     词缀/词组索引是惰加载的，先确保就绪再判中心类型（记忆化，只等一次）；
     不在本页（门厅或别的页面）时设完中心后跳到对应单图页——
     门厅探索框、词缀芯片、词组卡因此都能一键唤醒球面星空。 */
  synCenter(word) {
    word = (word || '').trim().toLowerCase();
    if (!word) return;
    if (this._phrIdx && this._affixIdx && this._formIdx) return this._synCenterGo(word);
    this._synCenterP = (this._synCenterP
      || Promise.all([this._phraseReady(), this._affixReady(), this._formReady()]))
      .then(() => this._synCenterGo(word));
    return this._synCenterP;
  },

  /* synCenter 的实际执行体（惰索引已就绪） */
  _synCenterGo(word) {
    if (!word) return;
    const idx = this._synIndex();
    const key = Object.keys(idx).find(k => k.toLowerCase() === word);
    const ax = this._affixIdx;
    const pi = this._phrIdx;
    /* 形近索引里的词（词书并集，可能无词条/无词义关系）也允许做中心——
       形近图的环星、converge/conserve 这类易混词正是靠它才能点亮。 */
    const inVocab = key || (ax && ax.wordSet && ax.wordSet.has(word))
      || !!(this._formIdx && this._formIdx[word]);
    const isPhrase = !inVocab && pi && !!pi.byPhrase[word];
    const aff = (!inVocab && !isPhrase) ? this._matchAffix(word) : null;
    if (!inVocab && !aff && !isPhrase) {
      const h = document.getElementById('syn-explore-hint');
      if (h) h.textContent = '词库未收录「' + word + '」，换一个试试（如 big / happy / increase / un-）。';
      return;
    }
    const h = document.getElementById('syn-explore-hint'); if (h) h.textContent = '';
    const inp = document.getElementById('syn-explore');
    if (isPhrase) {
      const p = pi.byPhrase[word];
      this._synState.center = p.w;
      this._synState.kind = 'phrase';
      delete this._synState.affixKey;
      delete this._synState.affixKind;
      if (inp) inp.value = p.w;
    } else if (inVocab) {
      this._synState.center = key || word;
      this._synState.kind = 'word';
      delete this._synState.affixKey;
      delete this._synState.affixKind;
      if (inp) inp.value = key || word;
    } else {
      const kind = this._affixIdx.byAffix[aff.key].kind;
      this._synState.center = this._affixDisplay(aff.key, kind);
      this._synState.kind = 'affix';
      this._synState.affixKey = aff.key;
      this._synState.affixKind = kind;
      this._synState.map = kind;   /* 词缀中心自动落在它所属那张图 */
      if (inp) inp.value = this._synState.center;
    }
    /* 不在单图页（门厅/词书页跳来）：归位到有内容的图，再跳过去唤醒球面 */
    if (!document.querySelector('[data-syn-sky]')) {
      this._synAutoMap();
      location.hash = '#/synonyms/' + this._synState.map;
      return;
    }
    this._renderConstellation();
  },

  /* 整页进入时的归位：当前图若是空的，自动落到第一张有内容的图。
     只在进入页面时做这一次——页签切换与换中心都严格保持用户所在的那张图。 */
  _synAutoMap() {
    const st = this._synState;
    const count = m => { const s = this._synStars(m.id); return s.ring.length + s.gate.length; };
    const cur = this._SYN_MAPS.find(m => m.id === st.map) || this._SYN_MAPS[0];
    if (count(cur) > 0) return;
    const hit = this._SYN_MAPS.find(m => count(m) > 0);
    if (hit) st.map = hit.id;
  },

  /* 探索框（按钮 / 回车）：置为中心 */
  synExplore(val) {
    this.synCenter(val);
  },

  synRandom() {
    const idx = this._synIndex();
    const keys = Object.keys(idx);
    if (!keys.length) return;
    const k = keys[Math.floor(Math.random() * keys.length)];
    this.synCenter(k);
  },

  /* 下方「全部词族」列表渲染（受 filter + query 控制） */
  _renderGroupList() {
    const box = document.getElementById('syn-groups');
    if (!box) return;
    const st = this._synState;
    let groups = (window.__SYN__ && window.__SYN__.groups) || [];
    if (st.filter !== 'all') groups = groups.filter(g => g.type === st.filter);
    if (st.query) {
      const q = st.query.toLowerCase();
      groups = groups.filter(g => g.meaning.toLowerCase().includes(q)
        || g.words.some(w => w.toLowerCase().includes(q))
        || (g.note || '').toLowerCase().includes(q));
    }
    if (!groups.length) { box.innerHTML = '<p class="syn-empty">没有匹配的词族。</p>'; return; }
    const label = { syn: '同义', near: '近义', ant: '反义' };
    box.innerHTML = groups.map(g => {
      const words = g.words.map(w =>
        `<button class="syn-chip syn-chip-${g.type}" data-action="syn-star" data-word="${this.esc(w.toLowerCase())}">${this.esc(w)}</button>`
      ).join('');
      return '<div class="syn-group syn-group-' + g.type + '">'
        + '<div class="syn-group-head">'
        + `<span class="syn-badge syn-badge-${g.type}">${label[g.type]}</span>`
        + `<span class="syn-group-meaning">${this.esc(g.meaning)}</span></div>`
        + `<div class="syn-group-words">${words}</div>`
        + (g.note ? `<p class="syn-group-note">辨析：${this.esc(g.note)}</p>` : '')
        + '</div>';
    }).join('');
  },
});
