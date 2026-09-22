/* =====================================================================
   KnowledgeGraph —— 知识星图 v2（#/knowledge-graph）
   用户定稿：一张 50 节点的大平图「太紧太密没有意义」，改为
   四张按类别独立的星图（语法·句法 25 / 语法·词法 13 / 词汇·用法 8 /
   写作·表达 4），门厅四栏进入；每张图是可拖拽旋转的三维球面星空，
   点一颗星：球体把它转到正面、它和关联节点一起亮起、关联链点亮，
   跨类关联在知识卡里给出跳转（点过去唤醒另一张星图上的对应星）。

   确定性护栏：球面基坐标（斐波那契球）与默认姿态固定，同数据渲染
   逐字节一致；拖拽/自转只改 DOM 属性不走 innerHTML，快照安全。
   ===================================================================== */

/* 四类的门厅配色与一句话介绍（顺序即门厅栏序） */
const KG_CATS = {
  '语法·句法': { color: '#f4c86a', blurb: '从句、非谓语、时态语态——句子的骨架。' },
  '语法·词法': { color: '#86b6f2', blurb: '冠词、介词、代词、比较结构——用词的规矩。' },
  '词汇·用法': { color: '#6fd3a4', blurb: '词义辨析、搭配、构词——词汇的深浅。' },
  '写作·表达': { color: '#f2938c', blurb: '应用文与读后续写的谋篇、衔接与润色。' },
};

const KG_R = 225;                 /* 球面半径（viewBox 900×560 内） */
const KG_CX = 450, KG_CY = 272;   /* 球心 */
const KG_GOLDEN = 2.399963229728653;

const KnowledgeGraph = {
  cat: null,      /* 当前类别；null = 门厅四栏 */
  center: null,   /* 居中（点亮）的节点 id */
  rot: { x: -0.35, y: 0.55 },  /* 默认姿态：固定值保证快照确定性 */
  spin: false,    /* 自转开关（默认关） */
  dragging: false,

  init() { return Promise.resolve(); },

  kb() { return window.__KB__ || []; },

  /* related[] → 无向唯一边对（两端都必须是现存节点） */
  edges() {
    const kb = this.kb();
    const ids = new Set(kb.map(n => n.id));
    const seen = new Set();
    const out = [];
    kb.forEach(n => (n.related || []).forEach(r => {
      if (!ids.has(r)) return;
      const key = [n.id, r].sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push([n.id, r]); }
    }));
    return out;
  },

  /* 类内边 / 跨类边（门厅与图头统计用） */
  catEdges(cat) {
    const catOf = {};
    this.kb().forEach(n => { catOf[n.id] = n.category; });
    let inside = 0, cross = 0;
    this.edges().forEach(([a, b]) => {
      if (catOf[a] === cat && catOf[b] === cat) inside++;
      else if (catOf[a] === cat || catOf[b] === cat) cross++;
    });
    return { inside, cross };
  },

  /* 斐波那契球：类内第 i 颗星的球面基坐标（确定性） */
  baseMap(cat) {
    const nodes = this.kb().filter(n => n.category === cat);
    const map = {};
    nodes.forEach((n, i) => {
      const y = 1 - 2 * (i + 0.5) / nodes.length;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * KG_GOLDEN;
      map[n.id] = {
        x: +(r * Math.cos(a) * KG_R).toFixed(2),
        y: +(y * KG_R).toFixed(2),
        z: +(r * Math.sin(a) * KG_R).toFixed(2),
      };
    });
    return map;
  },

  /* 姿态 rot 下把球面点投到屏幕 */
  project(b, rot) {
    const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
    const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
    const x1 = b.x * cy + b.z * sy;
    const z1 = -b.x * sy + b.z * cy;
    const y2 = b.y * cx - z1 * sx;
    const z2 = b.y * sx + z1 * cx;
    return { x: KG_CX + x1, y: KG_CY + y2, z: z2 };
  },

  /* 让某颗星转到正面所需的姿态（点击唤醒时用） */
  faceRot(b) {
    const h = Math.hypot(b.x, b.z);
    return { x: Math.atan2(b.y, h), y: Math.atan2(-b.x, b.z) };
  },

  /* ---------- 门厅：四栏 ---------- */
  renderGate(kb) {
    const cats = Object.keys(KG_CATS);
    const cols = cats.map(cat => {
      const c = KG_CATS[cat];
      const nodes = kb.filter(n => n.category === cat);
      const e = this.catEdges(cat);
      const preview = nodes.slice(0, 4).map(n =>
        `<span class="kg-gate-chip">${this.esc(n.name)}</span>`).join('');
      return `<a class="kg-gate-col" href="#/knowledge-graph/${encodeURIComponent(cat)}"`
        + ` style="--kgc:${c.color}">`
        + `<span class="kg-gate-kicker" style="color:${c.color}">${this.esc(cat)}</span>`
        + `<b class="kg-gate-count">${nodes.length}</b>`
        + `<span class="kg-gate-sub">个知识点 · ${e.inside} 条类内关联${e.cross ? ` · ${e.cross} 条跨类` : ''}</span>`
        + `<p class="kg-gate-blurb">${this.esc(c.blurb)}</p>`
        + `<span class="kg-gate-chips">${preview}</span>`
        + `<span class="kg-gate-go">进入星图 →</span></a>`;
    }).join('');
    const edges = this.edges().length;
    return `<main class="knowledge-page shell">
      <div class="library-head"><div>
        <span class="eyebrow">KNOWLEDGE STAR MAP</span><h1>知识点星图</h1></div>
        <a class="text-btn" href="#/knowledge">返回错题溯源</a></div>
      <p class="kg-gate-hint">${kb.length} 个知识点分成四个星座，各自是一张可以转动的球面星空。
        点进一个类别，拖动星空旋转；点一颗星，它和与它关联的知识点会一起亮起。</p>
      <div class="kg-gate">${cols}</div>
      <section class="kg-stats"><div><b>${kb.length}</b><span>知识节点</span></div>
        <div><b>${edges}</b><span>关联链线</span></div>
        <div><b>${cats.length}</b><span>星图</span></div></section>
    </main>`;
  },

  /* ---------- 单类星图：三维球面 ---------- */
  renderSky(kb, cat) {
    const c = KG_CATS[cat];
    const nodes = kb.filter(n => n.category === cat);
    const base = this.baseMap(cat);
    const ids = new Set(nodes.map(n => n.id));
    const edges = this.edges().filter(([a, b]) => ids.has(a) && ids.has(b));
    const center = this.center && ids.has(this.center) ? this.center : null;

    /* 邻接表：居中时点亮谁 */
    const linked = new Set();
    if (center) edges.forEach(([a, b]) => {
      if (a === center) linked.add(b);
      if (b === center) linked.add(a);
    });

    /* 背景星野：固定种子 */
    let svg = '';
    let seed = 20260901;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 60; i++) {
      svg += `<circle cx="${(rnd() * 900).toFixed(1)}" cy="${(rnd() * 560).toFixed(1)}" `
        + `r="${(0.6 + rnd() * 1.1).toFixed(2)}" class="syn-bgstar${i % 5 === 0 ? ' syn-bgstar-tw' : ''}"/>`;
    }

    /* 链线：先画（永远在星下层），透明度按两端深度 */
    svg += edges.map(([a, b]) => {
      const p1 = this.project(base[a], this.rot), p2 = this.project(base[b], this.rot);
      const on = center && (a === center || b === center);
      const d = ((p1.z + p2.z) / 2 + KG_R) / (2 * KG_R);
      const op = center ? (on ? 0.9 : 0.05) : +(0.10 + 0.38 * d).toFixed(2);
      return `<line class="kg-line${center ? (on ? ' kg-line-on' : ' kg-line-off') : ''}"`
        + ` data-ea="${a}" data-eb="${b}"`
        + ` x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}"`
        + ` x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"`
        + ` style="opacity:${op}"/>`;
    }).join('');

    /* 星：按深度从远到近画（近的盖住远的）；位置/大小/亮度随深度 */
    const drawn = nodes.map(n => ({ n, p: this.project(base[n.id], this.rot) }))
      .sort((u, v) => u.p.z - v.p.z);
    svg += drawn.map(({ n, p }) => {
      const d = (p.z + KG_R) / (2 * KG_R);
      const isC = n.id === center;
      const dim = center && !isC && !linked.has(n.id);
      const s = (0.42 + 0.55 * d) * (isC ? 1.7 : 1);
      const op = dim ? 0.16 : (isC ? 1 : +(0.30 + 0.70 * d).toFixed(2));
      return `<g class="kg-star${isC ? ' kg-star-on' : ''}${dim ? ' kg-dim' : ''}"`
        + ` data-action="kg-star" data-node="${n.id}" role="button" tabindex="0"`
        + ` aria-label="${n.name}" data-bx="${base[n.id].x}" data-by="${base[n.id].y}" data-bz="${base[n.id].z}"`
        + ` style="opacity:${op}">`
        + `<path class="kg-star-glyph" fill="${c.color}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`
        + ` scale(${s.toFixed(3)}) translate(-12,-12)"`
        + ` d="M12 1.5 L14.4 9.6 L22.5 12 L14.4 14.4 L12 22.5 L9.6 14.4 L1.5 12 L9.6 9.6 Z"/>`
        + `<text class="kg-star-label" x="${p.x.toFixed(1)}" y="${(p.y + 19).toFixed(1)}"`
        + ` text-anchor="middle" fill="${isC ? '#ffffff' : c.color}"`
        + ` style="opacity:${(0.25 + 0.75 * d).toFixed(2)}">${n.name}</text></g>`;
    }).join('');

    const e = this.catEdges(cat);
    const crossCnt = e.cross;

    /* 知识卡：居中节点（含关联清单）或提示 */
    let card;
    if (center) {
      const n = kb.find(x => x.id === center);
      const m = Store.getKBMastery()[center];
      const mText = m ? `自评：${m}` : '未自评 · 去「知识台阶」或错题本里标一次';
      const rels = (n.related || []).map(r => {
        const rn = kb.find(x => x.id === r);
        if (!rn) return '';
        return rn.category === cat
          ? `<button class="kg-rel-chip" data-action="kg-star" data-node="${r}">${this.esc(r)}</button>`
          : `<button class="kg-rel-chip kg-rel-cross" data-action="kg-jump" data-cat="${rn.category}"`
            + ` data-node="${r}">${this.esc(r)}<i>${this.esc(rn.category)}</i></button>`;
      }).join('');
      card = '<section class="knowledge-detail-card" id="kg-card">'
        + `<div class="syn-detail-head"><h3>${n.name}</h3>`
        + `<span class="syn-kind-badge" style="background:${c.color};color:#1f2430">${n.category}</span>`
        + `<span class="syn-detail-meaning">${this.esc(mText)}</span></div>`
        + `<p class="kg-summary">${this.esc(n.summary)}</p>`
        + `<p class="kg-rule"><b>一句话规则</b>${this.esc(n.rule)}</p>`
        + '<div class="kg-freq">' + UI.kbFreqChip(n.id) + '</div>'
        + (Array.isArray(n.points) && n.points.length
          ? '<ol class="kg-points">' + n.points.map(p =>
              `<li><b>${this.esc(p.text)}</b><i>${this.esc(p.example)}</i></li>`).join('') + '</ol>'
          : '')
        + (rels ? `<p class="kg-rel-label">关联知识点（点它唤醒）：</p><div class="kg-rel-list">${rels}</div>` : '')
        + '<div class="kg-actions">'
        + `<a class="primary-btn" href="#/knowledge/${encodeURIComponent(center)}">查看知识详情 →</a>`
        + '<a class="ghost-btn" href="#/learn">去知识台阶</a>'
        + '<button class="text-btn" data-action="kg-star" data-node="">熄灭 · 看全图</button>'
        + '</div></section>';
    } else {
      card = '<section class="knowledge-detail-card" id="kg-card">'
        + '<p class="word-note">拖动星空旋转（手机上直接拖）。点一颗星：'
        + '球会把它转到正面，它和关联的知识点一起亮起、链线点亮；'
        + '跨类别的关联会带你跳到另一张星图。</p></section>';
    }

    return `<main class="knowledge-page shell">
      <div class="library-head"><div>
        <span class="eyebrow" style="color:${c.color}">${this.esc(cat)} · STAR MAP</span>
        <h1>${this.esc(cat)}星图</h1></div>
        <a class="text-btn" href="#/knowledge-graph">← 四张星图</a></div>
      <div class="kg-sky-tools">
        <button class="text-btn" data-action="kg-spin">⟳ 自转：${this.spin ? '开' : '关'}</button>
        <span class="kg-hint">${nodes.length} 颗星 · ${edges.length} 条类内关联${crossCnt ? ` · ${crossCnt} 条通向别的星图` : ''} —— 拖动旋转，点星唤醒</span>
      </div>
      <div class="syn-constellation kg-sky" data-kg-sky>
        <svg viewBox="0 0 900 560" class="syn-svg" preserveAspectRatio="xMidYMid meet">${svg}</svg>
      </div>
      ${card}
    </main>`;
  },

  render() {
    const kb = this.kb();
    if (!kb.length) {
      return '<main class="empty-state"><strong>知识库为空</strong>'
        + '<p>data/knowledge/index.js 未加载或没有节点。</p>'
        + '<a class="primary-btn" href="#/knowledge">返回错题溯源</a></main>';
    }
    /* 全站主导航：星图页与其他内容页一致，顶部常驻（零 JS 下拉）。 */
    if (!this.cat || !KG_CATS[this.cat]) return UI.siteNav() + this.renderGate(kb);
    return UI.siteNav() + this.renderSky(kb, this.cat);
  },

  /* ---------- 交互：拖拽旋转 / 自转 / 转到正面 ---------- */

  /* 拖拽中不重排 DOM，只按 data-* 基坐标重投影，快照与 innerHTML 都不受影响 */
  reproject(svg) {
    const rot = this.rot;
    const cat = this.cat;
    const center = this.center;
    let linked = null;
    if (center) {
      linked = new Set();
      this.edges().forEach(([a, b]) => {
        if (a === center) linked.add(b);
        if (b === center) linked.add(a);
      });
    }
    svg.querySelectorAll('line[data-ea]').forEach(ln => {
      const p1 = this.project(this.baseLookup(ln.dataset.ea, cat), rot);
      const p2 = this.project(this.baseLookup(ln.dataset.eb, cat), rot);
      ln.setAttribute('x1', p1.x.toFixed(1)); ln.setAttribute('y1', p1.y.toFixed(1));
      ln.setAttribute('x2', p2.x.toFixed(1)); ln.setAttribute('y2', p2.y.toFixed(1));
      const on = center && (ln.dataset.ea === center || ln.dataset.eb === center);
      const d = ((p1.z + p2.z) / 2 + KG_R) / (2 * KG_R);
      ln.style.opacity = center ? (on ? 0.9 : 0.05) : +(0.10 + 0.38 * d).toFixed(2);
    });
    svg.querySelectorAll('g[data-node]').forEach(g => {
      const p = this.project(this.baseLookup(g.dataset.node, cat), rot);
      const d = (p.z + KG_R) / (2 * KG_R);
      const isC = g.dataset.node === center;
      const dim = center && !isC && !(linked && linked.has(g.dataset.node));
      const s = (0.42 + 0.55 * d) * (isC ? 1.7 : 1);
      g.querySelector('path').setAttribute('transform',
        `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s.toFixed(3)}) translate(-12,-12)`);
      const t = g.querySelector('text');
      t.setAttribute('x', p.x.toFixed(1));
      t.setAttribute('y', (p.y + 19).toFixed(1));
      g.style.opacity = dim ? 0.16 : (isC ? 1 : +(0.30 + 0.70 * d).toFixed(2));
      t.style.opacity = (0.25 + 0.75 * d).toFixed(2);
    });
  },

  _baseCache: null,   /* {cat, map} —— baseMap 很便宜，但拖拽每帧查表缓存更稳 */
  baseLookup(id, cat) {
    if (!this._baseCache || this._baseCache.cat !== cat) {
      this._baseCache = { cat, map: this.baseMap(cat) };
    }
    return this._baseCache.map[id];
  },

  dragStart(x, y) { this.dragging = { x, y, moved: false }; },
  dragMove(x, y) {
    const dg = this.dragging;
    if (!dg) return;
    const dx = x - dg.x, dy = y - dg.y;
    if (!dg.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    dg.moved = true;
    this.rot = {
      x: Math.max(-1.25, Math.min(1.25, this.rot.x + dy * 0.005)),
      y: this.rot.y + dx * 0.005,
    };
    dg.x = x; dg.y = y;
    const svg = document.querySelector('[data-kg-sky] svg');
    if (svg) this.reproject(svg);
  },
  dragEnd() {
    if (this.dragging && this.dragging.moved) this._dragMoved = true;
    this.dragging = false;
  },

  /* 点击唤醒：球体把该星转到正面（短缓动），结束后的重渲染修正遮挡次序 */
  faceTo(nodeId, done) {
    const b = this.baseLookup(nodeId, this.cat);
    if (!b) { if (done) done(); return; }
    const t = this.faceRot(b);
    const cur = { ...this.rot };
    let dy = t.y - cur.y;
    dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const dx = t.x - cur.x;
    const t0 = performance.now(), D = 480;
    const step = now => {
      const svg = document.querySelector('[data-kg-sky] svg');
      const k = Math.min(1, (now - t0) / D);
      const e = 1 - Math.pow(1 - k, 3);
      this.rot = { x: cur.x + dx * e, y: cur.y + dy * e };
      if (svg) this.reproject(svg);
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  },

  /* 自转：rAF 慢转；页面切走（svg 不在了）自动停 */
  setSpin(on) {
    this.spin = !!on;
    if (!on) return;
    const step = () => {
      if (!this.spin) return;
      const svg = document.querySelector('[data-kg-sky] svg');
      if (!svg) { this.spin = false; return; }
      this.rot = { x: this.rot.x, y: this.rot.y + 0.003 };
      this.reproject(svg);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  esc(v) { return UI.esc(v == null ? '' : String(v)); },
};
