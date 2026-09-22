/* =====================================================================
   知识点考察频率（2026-09-22，用户拍板口径：站点自证·点名次数）

   做什么：把 16 套真题里「解析摘要 / 短文改错逐处知识点」明确点到的知识
   点统计出来 —— 同一道题对同一知识点最多计 1 次，输出每节点的
   点名次数(hits) / 涉及卷数(papers) / 年份(years)。

   为什么复用真题解析而不是新写规则：解析摘要（explanation.summary）与
   短文改错的 errorType/knowledgeNode 是题库里本来的受控字段，等于命题人
   自己的口径；站内错题自动分类（js/diagnose.js）也读同一批字段，两处
   不会各说各话。

   为什么写作类节点单列：写作是主观题，解析摘要里没有「考查X」。这 4 个
   节点改用「题型覆盖」口径（写作节在 16 套里出现几套），并在界面上用
   不同措辞标注，绝不混进点名次数里充数。

   用法：node tools/build_kb_freq.js
   产出：data/knowledge/freq.js  window.__KB_FREQ__ = {meta, nodes}
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.window = {};
global.window.__EXAMS_CACHE__ = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data/exams')).filter(x => x.endsWith('.js'))) {
  eval(fs.readFileSync(path.join(ROOT, 'data/exams/' + f), 'utf8'));
}
const exams = Object.values(global.window.__EXAMS_CACHE__);

// 解析摘要里的受控标签（「考查X」/「X题」）→ 知识节点。
// 用否定前瞻避免「名词」被「名词性从句 / 名词词义辨析」带偏。
const PATTERNS = {
  '非谓语动词': [/非谓语/],
  '定语从句': [/定语从句/],
  '名词性从句': [/名词性从句/],
  '状语从句': [/状语从句/],
  '动词时态': [/时态/],
  '主谓一致': [/主谓一致/],
  '情态动词': [/情态动词(?!表推测|\s*\+\s*have)/],
  '情态动词表推测': [/情态动词[^。]{0,6}推测/],
  '情态动词+have done': [/情态动词[^。]{0,6}have\s*done/i],
  '虚拟语气': [/虚拟语气/],
  '倒装句': [/倒装/],
  '强调句': [/强调句/],
  '被动语态': [/被动|语态/],
  'it的用法': [/形式主语|形式宾语/],
  '独立主格结构': [/独立主格/],
  'there be 句型': [/there\s*be/i],
  '比较结构': [/比较级|比较结构/],
  '直接引语与间接引语': [/引语/],
  '省略句': [/省略/],
  '祈使句与感叹句': [/祈使|感叹/],
  '主将从现': [/主将从现/],
  '定语从句that与which的选择': [/that\s*与\s*which|that与which/],
  '介词+关系代词': [/介词\s*\+\s*关系代词/],
  'as引导的定语从句': [/as\s*引导的定语从句/i],
  '名词': [/名词(?!性从句|词义辨析|辨析)/],
  '代词': [/代词(?!辨析)/],
  '冠词': [/冠词/],
  '介词': [/介词/],
  '形容词': [/形容词(?!词义辨析|辨析)/],
  '副词': [/副词(?!词义辨析|辨析)/],
  '连词': [/连词/],
  '限定词': [/限定词/],
  '数词': [/数词/],
  '不定代词': [/不定代词/],
  '指代词辨析': [/指代/],
  '倍数表达法': [/倍数/],
  'so与such的区别': [/so\s*与\s*such|such\s*与\s*so/],
  '易混动词辨析': [/动词词义辨析|动词辨析/],
  '固定搭配辨析': [/固定搭配|固定短语|固定结构/],
  '短语动词': [/短语动词|动词短语/],
  '易混名词辨析': [/名词词义辨析|名词辨析/],
  '易混形容词副词辨析': [/形容词词义辨析|副词词义辨析/],
  '近义词辨析': [/近义词辨析/],
  '词性转换（派生法）': [/词性转换|派生/],
  '动词接续（doing与to do）': [/动词接续|接续/],
  'need与dare的用法': [/need[^。]{0,6}dare|dare[^。]{0,6}need/i],
};
// 写作类：主观题，无「考查X」标签 → 用题型覆盖口径
const WRITING_SECTIONS = {
  '写作高级句型': ['writing_app', 'writing_cont'],
  '写作衔接与过渡': ['writing_app', 'writing_cont'],
  '读后续写技巧': ['writing_cont'],
  '应用文写作结构': ['writing_app'],
};

const ids = Object.keys(PATTERNS).concat(Object.keys(WRITING_SECTIONS));
const nodes = {};
ids.forEach(id => { nodes[id] = { hits: 0, papers: new Set(), years: new Set() }; });

let scanned = 0;
for (const ex of exams) {
  for (const s of (ex.sections || [])) {
    // 写作类：题型覆盖
    for (const [id, keys] of Object.entries(WRITING_SECTIONS)) {
      if (keys.indexOf(s.key) >= 0) {
        const st = nodes[id];
        if (!st.papers.has(ex.id)) { st.papers.add(ex.id); st.years.add(ex.year); }
      }
    }
    for (const q of (s.questions || [])) {
      const e = q.explanation || {};
      // 汇总该题的「信号文本」：摘要 + 短文改错逐处 errorType/knowledgeNode
      let text = String(e.summary || '');
      if (Array.isArray(e.points)) {
        e.points.forEach(p => { text += ' ' + (p.errorType || '') + ' ' + (p.knowledgeNode || ''); });
      }
      // 短文改错整题不计入 hits（它没有单题摘要），但逐处标签已并入 text
      if (!text.trim()) continue;
      scanned++;
      for (const [id, pats] of Object.entries(PATTERNS)) {
        if (pats.some(re => re.test(text))) {
          const st = nodes[id];
          st.hits++;
          st.papers.add(ex.id);
          st.years.add(ex.year);
        }
      }
    }
  }
}

const out = { meta: {
  rule: '据 16 套真题的解析摘要（explanation.summary）与短文改错逐处知识点统计；同一道题对同一知识点最多计 1 次。写作类为「题型覆盖」（该写作节在几套卷里出现），不用点名次数。',
  source: 'data/exams/*.js 的 explanation.summary / explanation.points[].errorType|knowledgeNode',
  papers: exams.length,
}, nodes: {} };
Object.keys(nodes).forEach(id => {
  const st = nodes[id];
  out.nodes[id] = {
    hits: st.hits,
    papers: st.papers.size,
    years: [...st.years].sort(),
    kind: WRITING_SECTIONS[id] ? 'section' : 'point',
  };
});

const OUT = path.join(ROOT, 'data/knowledge/freq.js');
const body = JSON.stringify(out).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/<\//g, '<\\/');
fs.writeFileSync(OUT, "window.__KB_FREQ__ = JSON.parse('" + body + "');\n", 'utf8');

const rows = Object.entries(out.nodes).sort((a, b) => b[1].hits - a[1].hits);
console.log('扫描题数:', scanned, '| 卷数:', exams.length);
console.log('有考频的节点:', rows.filter(r => r[1].hits > 0).length, '/ 覆盖节点表', rows.length);
rows.forEach(([id, v]) => console.log('  ' + String(v.hits).padStart(4) + '次 ' + String(v.papers).padStart(2) + '卷 ' + (v.kind === 'section' ? '[题型覆盖] ' : '') + id));
console.log('OK ->', OUT, '（' + fs.statSync(OUT).size + ' bytes）');
