/* 定位改写标注（2026-09-19 试点）——「定位句表述 → 选项改写 → 替换手法」。
 *
 * 数据性质（与全站数据铁律一致，如实标注）：
 *   全部条目为 AI 标注、未经人工复核（verified:false）。有意与
 *   data/exams/ 里的 verified 试卷数据分文件存放——核一条，把该条并入
 *   对应试卷 JSON 的 explanation.loc、verified 改 true 并从这里删掉；
 *   全卷核完可在试卷根节点记 locVerified:true。UI（js/ui/base.js 的
 *   locHtml）对 verified:false 的条目渲染「AI 标注 · 未人核」灰签。
 *
 * 结构：window.__LOC__[examId][qid] = { from, to, rule, verified }。
 * 当前范围：三卷阅读 21-35 **全部覆盖**（gk2024-xgk1 / gk2025-new1 /
 * gk2023-xgk1 各 15 条）。人核优先级：先核 gk2025-new1#30（from 相对原文
 * 压缩幅度最大，复审标记），其余条目 from 基本逐字可对。
 */
window.__LOC__ = {
  'gk2024-xgk1': {
    21: {
      from: "Help restore and protect Marin's natural areas…protecting endangered species",
      to: 'C To protect the local ecosystem',
      rule: '具体列举合成概括：restore/protect 保留，自然区域+濒危物种合成上位概念「当地生态系统」',
      verified: false,
    },
    22: {
      from: 'Volunteers aged 10 and over are welcome.',
      to: 'B 10.',
      rule: '数字直给；干扰项 15/18 是文中另有的年龄（附加规定），不是报名门槛——偷换对象',
      verified: false,
    },
    23: {
      from: "We'll be working rain or shine.",
      to: 'B Work even in bad weather.',
      rule: '惯用语代直陈：rain or shine → even in bad weather',
      verified: false,
    },
    24: {
      from: 'some of his coworkers occasionally laugh at his unusual methods',
      to: "A He's odd.",
      rule: '行为证据推性格标签：嘲笑方法「不寻常」→ 觉得他古怪（一步推断，不多推）',
      verified: false,
    },
    25: {
      from: 'he suffered from terrible back pain…he was amazed that he improved after two or three treatments',
      to: 'C He benefited from it as a patient.',
      rule: '身份合成：自己治疗见效 → as a patient 受益（improved = benefited）',
      verified: false,
    },
    26: {
      from: "Farber's treatments eased her dog's suffering so much…her horse, Nappy, moves more easily",
      to: 'D The effectiveness of holistic medicine.',
      rule: '例证归纳段落主旨：狗与马两个见效案例 → 整体疗法有效（examples → effectiveness）',
      verified: false,
    },
    27: {
      from: 'Since 1982, membership…has grown from 30 to over 700',
      to: "A To prove Farber's point.",
      rule: '数字证据证观点：会员 30 → 700+，印证「整体疗法会越来越流行」——举例为论点服务',
      verified: false,
    },
    28: {
      from: 'The benefits of print reading particularly shine through when experimenters move from posing simple tasks',
      to: 'D Become easy to notice.',
      rule: '构词语境猜义：任务越难优势越 shine through（透出来）→ 显而易见',
      verified: false,
    },
    29: {
      from: 'people approach digital texts with a mindset suited to social media, which are often not so serious',
      to: 'A Readers treat digital texts lightly.',
      rule: '心态同义改写：mindset not so serious → treat lightly（不当真）',
      verified: false,
    },
    30: {
      from: 'Audio and video can feel more engaging than text, and so university teachers increasingly turn to them',
      to: "A They can hold students' attention.",
      rule: '因果衔接：more engaging（更吸引人）→ hold attention；and so 后的 turn to 是结果',
      verified: false,
    },
    31: {
      from: "for maximizing learning where mental focus and reflection are called for, educators shouldn't assume all",
      to: 'C Print texts cannot be entirely replaced in education.',
      rule: '末段暗示题：shouldn\'t assume all media are equal 反过来读 → 纸质文本在教育中不可被完全取代（imply 不直说）',
      verified: false,
    },
    32: {
      from: 'most records of biodiversity are often in the form of photos, videos, and other digital records',
      to: 'B They are mostly in electronic form.',
      rule: '列举归纳：photos / videos / digital records → electronic form（具体列举归成类别）',
      verified: false,
    },
    33: {
      from: 'we are increasingly using observational data to investigate how species are responding to global change',
      to: 'C Observational data.',
      rule: '研究对象句：increasingly using X to investigate → 研究焦点就是 X',
      verified: false,
    },
    34: {
      from: 'the aspects of sampling that tend to bias data, like the greater likelihood of a citizen scientist to take',
      to: 'C Improper way of sampling.',
      rule: 'aspects of sampling bias data → 取样方式本身不当致偏（只拍好看的、只记身边的）',
      verified: false,
    },
    35: {
      from: 'Biodiversity apps can use our study results to inform users of oversampled areas and lead them to places',
      to: 'D Give guidance to citizen scientists.',
      rule: '双动词并读：inform users + lead them → 给用户（公民科学家）提供指导；App 是「鼓励请专家确认」而非自雇专家，B 错',
      verified: false,
    },
  },

  /* 2025 全国Ⅰ卷阅读 21-25（2026-09-19 扩卷，同口径，verified:false） */
  'gk2025-new1': {
    21: {
      from: '图表中 road vehicles 一项 74.5%（载客车辆 45.1%、公路货运 29.4%）',
      to: 'C 74.5%.',
      rule: '图表读数定位；45.1% 是子项冒充总项——以偏概全，读图先分总项与子项',
      verified: false,
    },
    22: {
      from: 'TRAINS — Electricity: Some trains are already electrified through rails or wires; others can be made electric',
      to: 'C Trains.',
      rule: '程度对应：already / can be made electric → comparatively easily；难易是对四个板块的全文比较，不是单句判断',
      verified: false,
    },
    23: {
      from: '"We need to speed up the development of green energy, and it will all get used," says Wipke.',
      to: 'B Putting more effort into renewables.',
      rule: '同义替换：speed up the development of green energy → put more effort into renewables（green energy = renewables）',
      verified: false,
    },
    24: {
      from: 'I met a cowboy…a strict father…and a modern-day Juliet…my students…created',
      to: 'D Fictional characters.',
      rule: '列举合成概括：牛仔、严父、现代版朱丽叶都是学生 created 的——人物合成「虚构角色」',
      verified: false,
    },
    25: {
      from: "the problem was the question itself…but writing, in and of itself, simply didn't strike them",
      to: 'D They had little interest in the topic.',
      rule: '因果同义：not strike them as relevant → little interest；C（误解题意）被原文 the question itself…not relevant 明确排除',
      verified: false,
    },
    26: {
      from: 'The results were staggering. The students took on diverse topics and turned in stories, 10 to 20 pages',
      to: 'B Amazing.',
      rule: '后文释义定词义：10-20 页的作品、拓宽视野又打动人心 → staggering = 惊人的（Amazing）',
      verified: false,
    },
    27: {
      from: 'I walked into class believing that writing is important as a means of communication. However, my students…',
      to: 'A Teaching is learning.',
      rule: '谚语匹配：作者进教室想教写作、反被学生教会更深的意义 → 教学相长（Teaching is learning）',
      verified: false,
    },
    28: {
      from: 'transport studies also show declines in pedestrian mobility, especially among young children',
      to: 'C People walk less and drive more.',
      rule: '数据变现象：declines in pedestrian mobility → walk less，家长改用汽车接送 → drive more',
      verified: false,
    },
    29: {
      from: 'Jane Jacobs called on her mayor to champion "New York as a decent place to live, and not just rush through"',
      to: 'A Keep their cities livable.',
      rule: '引语立场概括：decent place to live（宜居）对比 rush through（仅供穿行）→ 保持城市宜居',
      verified: false,
    },
    30: {
      from: 'Although these campaigns were widespread, the reality is that the majority of the western cities were rebuilt around the car',
      to: 'B They turned out largely ineffective.',
      rule: '让步转折定调：Although widespread + 现实仍围绕汽车重建 → 运动基本无效（转折后才是作者态度）',
      verified: false,
    },
    31: {
      from: 'not just rush through…We invest a lot in roads that help us rush through, but we fail to account for',
      to: 'A Why the Rush?',
      rule: '标题题找贯穿词：rush 首尾复现、全文质问匆忙穿行的代价 → Why the Rush?（其余三项无文中支撑）',
      verified: false,
    },
    32: {
      from: 'they have settled in the deep sea and on the Himalayas, stuck inside volcanic rocks, filled the stomachs',
      to: 'C By giving examples.',
      rule: '首段手法判断：深海、喜马拉雅、火山岩、海鸟胃、南极新雪连举实例 → giving examples',
      verified: false,
    },
    33: {
      from: 'this process relies on the water containing enough calcium carbonate to trap the plastics…boiling hard wa…',
      to: 'A The hardness of water.',
      rule: '机制回译常识：calcium carbonate 含量 = 水的硬度（hard water 即硬水）——专业表述回归生活概念',
      verified: false,
    },
    34: {
      from: 'Even bottled water…contains 10 to 1,000 times more microplastics than originally thought.',
      to: 'B The severity of the microplastic problem.',
      rule: 'Even 让步强调：连最「洁净」的瓶装水都远超预想 → 说明微塑料问题的严重性',
      verified: false,
    },
    35: {
      from: '"We should be looking into upgrading drinking water treatment plants so they remove microplastics."',
      to: 'D Potential application of the findings.',
      rule: '建议落点辨析：把发现用于升级自来水厂 = 成果的潜在应用，不是提出新研究方向（B）',
      verified: false,
    },
  },

  /* 2023 新课标Ⅰ卷阅读 21-25（2026-09-19 扩卷，同口径，verified:false） */
  'gk2023-xgk1': {
    21: {
      from: 'We offer the newest bicycles in a wide variety, including basic bikes with foot brake, bikes with hand brake',
      to: 'B It offers many types of bikes.',
      rule: '同义替换：in a wide variety → many types；D 偷换概念：2,500 是自行车数不是门店数',
      verified: false,
    },
    22: {
      from: '1 day (24 hours) €14.75；Each additional day €8.00',
      to: 'C €22.75.',
      rule: '价格表计算：首日 14.75 + 加一天 8.00 = 22.75——定位之后还有一步算术，别选首日价',
      verified: false,
    },
    23: {
      from: 'The tour departs from Dam Square every hour on the hour, starting at 1:00 pm every day.',
      to: 'D Dam Square.',
      rule: '出发地与途经地分离：departs from 才是出发地，A/B/C 是行程里的途经景点——地点词辨析',
      verified: false,
    },
    24: {
      from: 'he loved to explore the woods around his house, observing how nature solved problems',
      to: 'C He had an inquiring mind.',
      rule: '行为归纳性格：爱探索、爱观察、回头再观察——多个例证归成一个特征（求知欲强）',
      verified: false,
    },
    25: {
      from: 'After a few weeks, John added the sludge. He was amazed at the results.',
      to: 'D To test the eco-machine.',
      rule: '目的从结果反推：加污泥后「惊讶于结果」——加它就是为了看生态机器的效果',
      verified: false,
    },
    26: {
      from: 'He also designed an eco-machine to clean canal water in Fuzhou, a city in southeast China.',
      to: 'B To show an application of John\'s idea.',
      rule: '举例目的：福州与南伯灵顿并列，都是生态机器的实际应用——mention 是为了 show application',
      verified: false,
    },
    27: {
      from: 'Then you let these new systems develop their own ways to self-repair.',
      to: 'A Nature can repair itself.',
      rule: '工作机制即理论依据：self-repair（自我修复）→ 自然能自我修复',
      verified: false,
    },
    28: {
      from: 'The goal of this book is to make the case for digital minimalism…then to teach you how to adopt this',
      to: 'B Advocating a simple digital lifestyle.',
      rule: '概念具体化：digital minimalism（数字极简）→ simple digital lifestyle',
      verified: false,
    },
    29: {
      from: 'This process requires you to step away from optional online activities for thirty days.',
      to: 'A Clear-up.',
      rule: '上下文释义定词义：三十天远离可选在线活动、再精选加回 → declutter = 清理',
      verified: false,
    },
    30: {
      from: 'I\'ll draw on an experiment I ran in 2018 in which over 1,600 people agreed to perform a digital declutter',
      to: 'C Practical examples.',
      rule: '实验与参与者故事 = 实际例子；theoretical models 等是反向干扰',
      verified: false,
    },
    31: {
      from: 'You can view these practices as a toolbox meant to aid your efforts to build a minimalist lifestyle that',
      to: 'A Use them as needed.',
      rule: '比喻句意：toolbox（工具箱）服务于你自己的具体情况 → 按需取用',
      verified: false,
    },
    32: {
      from: 'When enough of these errors are averaged together, they cancel each other out, resulting in a more accurate',
      to: 'B The underlying logic of the effect.',
      rule: '段落功能判断：本段讲误差相互抵消的原理 → 效应背后的逻辑，不是实验设计（D 是第 3 段的事）',
      verified: false,
    },
    33: {
      from: 'when crowds were further divided into smaller groups that were allowed to have a discussion, the averages were more accurate',
      to: 'D estimates were not fully independent',
      rule: '让步条件定位：允许讨论 = 估计不再完全独立，准确度反而更高——even if 引导处是答案',
      verified: false,
    },
    34: {
      from: 'the researchers tried to get a better sense of what the group members actually did in their discussion',
      to: 'C The discussion process.',
      rule: 'focus 句直给：what they actually did in their discussion → 讨论过程本身',
      verified: false,
    },
    35: {
      from: 'Although the studies led by Navajas have limitations and many questions remain, the potential implications',
      to: 'D Approving.',
      rule: '态度题看转折后：Although 承认局限，转折后强调潜在影响巨大 → 赞许（Approving）',
      verified: false,
    },
  },
};
