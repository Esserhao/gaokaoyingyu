#!/usr/bin/env python3
"""
词组数据转换脚本
从 lilinji Excel 文件中提取高考/高中词组，归一化后生成 data/vocab/phrases.js
"""
import json
import os
import re
import openpyxl

# 项目根目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_DIR = os.path.join(ROOT, "data", "vocab")
SOURCES_DIR = r"C:\Users\ASUS\AppData\Local\Temp\vocab_check\wordbank\vocab-wordbank-main\sources\lilinji"

# 要处理的词组文件（高考/高中优先）
PHRASE_FILES = [
    ("高中英语常考短语与句型.xlsx", "高中"),
    ("24天突破高考英语必背短语.xlsx", "高考"),
    ("2015PASS图解速记高中短语与句型.xlsx", "高中"),
    ("初中英语常考短语.xlsx", "初中"),
    ("四六级常考词组必备.xlsx", "四六级"),
    ("四六级常考核心词组1500.xlsx", "四六级"),
]


def clean_text(text):
    """清理文本：去除多余空格、换行、特殊标记"""
    if not text:
        return ""
    # 去除换行和首尾空格
    text = str(text).strip()
    # 去除 "na." "un." "det." 等前缀
    text = re.sub(r'^(na|un|det|adj|adv|v|n|prep|pron|conj)\.\s*', '', text)
    # 去除多余空格
    text = re.sub(r'\s+', ' ', text)
    # 去除首尾空白字符
    text = text.strip()
    return text


def extract_phrases():
    """从Excel文件中提取词组数据"""
    phrases = {}  # 用dict去重，key为词组小写
    
    for filename, level in PHRASE_FILES:
        filepath = os.path.join(SOURCES_DIR, filename)
        if not os.path.exists(filepath):
            print(f"跳过不存在的文件: {filename}")
            continue
            
        print(f"处理: {filename}...")
        wb = openpyxl.load_workbook(filepath)
        ws = wb.active
        
        count = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            
            phrase = str(row[0]).strip()
            if not phrase or len(phrase) < 2:
                continue
            
            # 跳过纯中文或非英语词组
            if not re.search(r'[a-zA-Z]', phrase):
                continue
            
            # 释义
            meaning = clean_text(row[3] if len(row) > 3 else "")
            if not meaning or meaning == "无":
                meaning = ""
            
            # 去重（保留第一个来源的详细释义）
            key = phrase.lower()
            if key not in phrases:
                phrases[key] = {
                    "w": phrase,
                    "m": meaning,
                    "level": level,
                    "source": filename
                }
                count += 1
        
        print(f"  提取 {count} 条（去重后累计 {len(phrases)} 条）")
        wb.close()
    
    return phrases


def add_common_phrase_info(phrases):
    """为常见问题添加补充信息（例句、考点提示等）"""
    # 高考高频词组的补充例句（可扩展）
    common_examples = {
        "above all": {
            "ex": "Above all, we must be honest.",
            "exCn": "最重要的是，我们必须诚实。"
        },
        "according to": {
            "ex": "According to the report, the economy is growing.",
            "exCn": "据报道，经济正在增长。"
        },
        "account for": {
            "ex": "How do you account for the mistake?",
            "exCn": "你如何解释这个错误？"
        },
        "adapt to": {
            "ex": "It took him a while to adapt to the new environment.",
            "exCn": "他花了一段时间才适应新环境。"
        },
        "after all": {
            "ex": "After all, he is only a child.",
            "exCn": "毕竟，他只是个孩子。"
        },
        "agree with": {
            "ex": "I agree with you on this point.",
            "exCn": "在这一点上我同意你的看法。"
        },
        "aim at": {
            "ex": "The program aims at helping poor students.",
            "exCn": "这个项目旨在帮助贫困学生。"
        },
        "ahead of": {
            "ex": "She arrived ahead of time.",
            "exCn": "她提前到达了。"
        },
        "allow for": {
            "ex": "We must allow for delays.",
            "exCn": "我们必须考虑到延误。"
        },
        "answer for": {
            "ex": "You must answer for your actions.",
            "exCn": "你必须对自己的行为负责。"
        },
        "apply for": {
            "ex": "He decided to apply for the job.",
            "exCn": "他决定申请这份工作。"
        },
        "approve of": {
            "ex": "I don't approve of smoking.",
            "exCn": "我不赞成吸烟。"
        },
        "arise from": {
            "ex": "Problems arose from the misunderstanding.",
            "exCn": "问题源于误解。"
        },
        "as a result": {
            "ex": "He worked hard. As a result, he passed the exam.",
            "exCn": "他努力学习，结果通过了考试。"
        },
        "as far as": {
            "ex": "As far as I know, he is still in Beijing.",
            "exCn": "据我所知，他还在北京。"
        },
        "as long as": {
            "ex": "You can go as long as you are back early.",
            "exCn": "你可以去，只要你早点回来。"
        },
        "as well as": {
            "ex": "He is clever as well as hardworking.",
            "exCn": "他很聪明，也很勤奋。"
        },
        "attach to": {
            "ex": "Please attach the file to the email.",
            "exCn": "请把文件附在邮件里。"
        },
        "avoid doing": {
            "ex": "We should avoid making the same mistake.",
            "exCn": "我们应该避免犯同样的错误。"
        },
        "back up": {
            "ex": "Can you back up your argument?",
            "exCn": "你能支持你的论点吗？"
        },
        "base on": {
            "ex": "The movie is based on a true story.",
            "exCn": "这部电影是根据真实故事改编的。"
        },
        "begin with": {
            "ex": "Let's begin with the first question.",
            "exCn": "让我们从第一个问题开始。"
        },
        "believe in": {
            "ex": "Do you believe in ghosts?",
            "exCn": "你相信有鬼吗？"
        },
        "belong to": {
            "ex": "The book belongs to me.",
            "exCn": "这本书是我的。"
        },
        "benefit from": {
            "ex": "Students benefit from regular exercise.",
            "exCn": "学生从规律锻炼中受益。"
        },
        "blame for": {
            "ex": "He was blamed for the accident.",
            "exCn": "他因事故受到指责。"
        },
        "break down": {
            "ex": "The car broke down on the way.",
            "exCn": "车在路上抛锚了。"
        },
        "break in": {
            "ex": "Someone broke in last night.",
            "exCn": "昨晚有人闯入。"
        },
        "break off": {
            "ex": "He broke off in the middle of his speech.",
            "exCn": "他说到一半停了下来。"
        },
        "break out": {
            "ex": "War broke out in 1939.",
            "exCn": "战争爆发于1939年。"
        },
        "break up": {
            "ex": "They broke up last month.",
            "exCn": "他们上个月分手了。"
        },
        "bring about": {
            "ex": "The war brought about many changes.",
            "exCn": "战争带来了许多变化。"
        },
        "bring up": {
            "ex": "She was brought up in London.",
            "exCn": "她在伦敦长大。"
        },
        "build up": {
            "ex": "We need to build up our confidence.",
            "exCn": "我们需要建立信心。"
        },
        "burn down": {
            "ex": "The house burned down.",
            "exCn": "房子烧毁了。"
        },
        "burst into": {
            "ex": "She burst into tears.",
            "exCn": "她突然哭了起来。"
        },
        "call back": {
            "ex": "I'll call you back later.",
            "exCn": "我稍后给您回电话。"
        },
        "call for": {
            "ex": "This calls for immediate action.",
            "exCn": "这需要立即采取行动。"
        },
        "call off": {
            "ex": "The meeting was called off.",
            "exCn": "会议取消了。"
        },
        "call on": {
            "ex": "I'll call on you tomorrow.",
            "exCn": "我明天来拜访你。"
        },
        "call up": {
            "ex": "He called up his mother.",
            "exCn": "他给母亲打了电话。"
        },
        "care about": {
            "ex": "I don't care about money.",
            "exCn": "我不在乎钱。"
        },
        "care for": {
            "ex": "She cares for her grandmother.",
            "exCn": "她照顾她的祖母。"
        },
        "carry on": {
            "ex": "Please carry on with your work.",
            "exCn": "请继续你的工作。"
        },
        "carry out": {
            "ex": "We carried out the plan.",
            "exCn": "我们执行了计划。"
        },
        "catch up with": {
            "ex": "He ran to catch up with his friends.",
            "exCn": "他跑去追赶朋友。"
        },
        "check in": {
            "ex": "We checked in at the hotel.",
            "exCn": "我们在酒店办理了入住。"
        },
        "check out": {
            "ex": "Guests should check out before 12:00.",
            "exCn": "客人应该在12:00前退房。"
        },
        "cheer up": {
            "ex": "Cheer up! Things will get better.",
            "exCn": "振作起来！情况会好转的。"
        },
        "clear up": {
            "ex": "The sky cleared up after the rain.",
            "exCn": "雨后天晴了。"
        },
        "come about": {
            "ex": "How did this come about?",
            "exCn": "这是怎么发生的？"
        },
        "come across": {
            "ex": "I came across an old friend yesterday.",
            "exCn": "我昨天偶然遇到一位老朋友。"
        },
        "come along": {
            "ex": "Come along, we'll be late.",
            "exCn": "快点，我们要迟到了。"
        },
        "come back": {
            "ex": "When will you come back?",
            "exCn": "你什么时候回来？"
        },
        "come from": {
            "ex": "I come from China.",
            "exCn": "我来自中国。"
        },
        "come on": {
            "ex": "Come on, let's go.",
            "exCn": "来吧，我们走吧。"
        },
        "come out": {
            "ex": "The book came out last month.",
            "exCn": "这本书上个月出版了。"
        },
        "come true": {
            "ex": "His dream came true.",
            "exCn": "他的梦想实现了。"
        },
        "come up": {
            "ex": "Something came up at work.",
            "exCn": "工作上出了点事。"
        },
        "come up with": {
            "ex": "She came up with a new idea.",
            "exCn": "她想出了一个新主意。"
        },
        "compare with": {
            "ex": "Compare this with that.",
            "exCn": "把这个和那个比较一下。"
        },
        "concentrate on": {
            "ex": "I need to concentrate on my work.",
            "exCn": "我需要专注于工作。"
        },
        "consist of": {
            "ex": "The team consists of five members.",
            "exCn": "团队由五名成员组成。"
        },
        "cut down": {
            "ex": "We should cut down on waste.",
            "exCn": "我们应该减少浪费。"
        },
        "cut off": {
            "ex": "The electricity was cut off.",
            "exCn": "电源被切断了。"
        },
        "deal with": {
            "ex": "How do you deal with stress?",
            "exCn": "你如何应对压力？"
        },
        "depend on": {
            "ex": "It depends on the weather.",
            "exCn": "这取决于天气。"
        },
        "develop into": {
            "ex": "The small town developed into a big city.",
            "exCn": "小镇发展成了大城市。"
        },
        "devote to": {
            "ex": "He devoted himself to his work.",
            "exCn": "他全身心投入工作。"
        },
        "die down": {
            "ex": "The wind died down.",
            "exCn": "风渐渐平息了。"
        },
        "die out": {
            "ex": "Many species are dying out.",
            "exCn": "许多物种正在灭绝。"
        },
        "do away with": {
            "ex": "We should do away with old rules.",
            "exCn": "我们应该废除旧规则。"
        },
        "do well in": {
            "ex": "She does well in math.",
            "exCn": "她数学学得很好。"
        },
        "draw up": {
            "ex": "They drew up a plan.",
            "exCn": "他们起草了一个计划。"
        },
        "dress up": {
            "ex": "She dressed up for the party.",
            "exCn": "她为聚会盛装打扮。"
        },
        "drop by": {
            "ex": "I'll drop by your house later.",
            "exCn": "我待会儿顺便去你家。"
        },
        "drop out": {
            "ex": "He dropped out of school.",
            "exCn": "他辍学了。"
        },
        "end up": {
            "ex": "We ended up going to the park.",
            "exCn": "我们最终去了公园。"
        },
        "engage in": {
            "ex": "He engaged in various activities.",
            "exCn": "他参加了各种活动。"
        },
        "enter for": {
            "ex": "She entered for the competition.",
            "exCn": "她报名参加了比赛。"
        },
        "escape from": {
            "ex": "He escaped from prison.",
            "exCn": "他越狱了。"
        },
        "exchange for": {
            "ex": "Can I exchange this for a new one?",
            "exCn": "我可以换一个新的吗？"
        },
        "fall asleep": {
            "ex": "He fell asleep quickly.",
            "exCn": "他很快就睡着了。"
        },
        "fall behind": {
            "ex": "Don't fall behind in your studies.",
            "exCn": "学习上不要落后。"
        },
        "fall in love with": {
            "ex": "He fell in love with her at first sight.",
            "exCn": "他对她一见钟情。"
        },
        "fall off": {
            "ex": "The book fell off the table.",
            "exCn": "书从桌子上掉下来了。"
        },
        "feed on": {
            "ex": "Bears feed on fish.",
            "exCn": "熊以鱼为食。"
        },
        "feel like": {
            "ex": "Do you feel like going for a walk?",
            "exCn": "你想去散步吗？"
        },
        "figure out": {
            "ex": "I can't figure out the problem.",
            "exCn": "我解决不了这个问题。"
        },
        "fill in": {
            "ex": "Please fill in the form.",
            "exCn": "请填写表格。"
        },
        "find out": {
            "ex": "I found out the truth.",
            "exCn": "我发现了真相。"
        },
        "focus on": {
            "ex": "Please focus on your work.",
            "exCn": "请专注于你的工作。"
        },
        "get along with": {
            "ex": "I get along well with my classmates.",
            "exCn": "我和同学相处得很好。"
        },
        "get away": {
            "ex": "The thief got away.",
            "exCn": "小偷逃跑了。"
        },
        "get away with": {
            "ex": "He got away with cheating.",
            "exCn": "他作弊逃脱了惩罚。"
        },
        "get back": {
            "ex": "When did you get back?",
            "exCn": "你什么时候回来的？"
        },
        "get by": {
            "ex": "We can get by with what we have.",
            "exCn": "我们靠现有的就能应付。"
        },
        "get down": {
            "ex": "Get down from the tree!",
            "exCn": "从树上下来！"
        },
        "get in": {
            "ex": "What time does the train get in?",
            "exCn": "火车什么时候进站？"
        },
        "get off": {
            "ex": "I get off at the next stop.",
            "exCn": "我下一站下车。"
        },
        "get on": {
            "ex": "Let's get on the bus.",
            "exCn": "我们上车吧。"
        },
        "get on with": {
            "ex": "Get on with your work.",
            "exCn": "继续你的工作。"
        },
        "get out": {
            "ex": "Get out of here!",
            "exCn": "离开这里！"
        },
        "get over": {
            "ex": "It took her weeks to get over the illness.",
            "exCn": "她花了几周才从疾病中恢复。"
        },
        "get rid of": {
            "ex": "We should get rid of bad habits.",
            "exCn": "我们应该改掉坏习惯。"
        },
        "get through": {
            "ex": "I tried calling but couldn't get through.",
            "exCn": "我试着打电话但打不通。"
        },
        "get together": {
            "ex": "Let's get together this weekend.",
            "exCn": "我们周末聚一聚吧。"
        },
        "get up": {
            "ex": "I get up at 7 a.m. every day.",
            "exCn": "我每天早上7点起床。"
        },
        "give away": {
            "ex": "He gave away his old clothes.",
            "exCn": "他把旧衣服送人了。"
        },
        "give back": {
            "ex": "Please give back my book.",
            "exCn": "请把我的书还给我。"
        },
        "give in": {
            "ex": "He refused to give in.",
            "exCn": "他拒绝让步。"
        },
        "give off": {
            "ex": "The flowers give off a sweet smell.",
            "exCn": "花散发出香味。"
        },
        "give out": {
            "ex": "My patience gave out.",
            "exCn": "我的耐心耗尽了。"
        },
        "give up": {
            "ex": "Don't give up trying.",
            "exCn": "不要放弃尝试。"
        },
        "go about": {
            "ex": "How should I go about this task?",
            "exCn": "我该怎么着手这项任务？"
        },
        "go after": {
            "ex": "He's going after a promotion.",
            "exCn": "他正在追求晋升。"
        },
        "go ahead": {
            "ex": "You can go ahead with the plan.",
            "exCn": "你可以继续执行计划。"
        },
        "go along with": {
            "ex": "I'll go along with your suggestion.",
            "exCn": "我同意你的建议。"
        },
        "go around": {
            "ex": "There's a bug going around.",
            "exCn": "有虫子到处爬。"
        },
        "go away": {
            "ex": "Go away, I'm busy.",
            "exCn": "走开，我很忙。"
        },
        "go back": {
            "ex": "I'll never go back to that place.",
            "exCn": "我永远不会回到那个地方。"
        },
        "go by": {
            "ex": "Time goes by quickly.",
            "exCn": "时间过得很快。"
        },
        "go down": {
            "ex": "The sun went down.",
            "exCn": "太阳落山了。"
        },
        "go for": {
            "ex": "Let's go for a walk.",
            "exCn": "我们去散步吧。"
        },
        "go in for": {
            "ex": "She goes in for tennis.",
            "exCn": "她喜欢打网球。"
        },
        "go off": {
            "ex": "The alarm went off.",
            "exCn": "闹钟响了。"
        },
        "go on": {
            "ex": "What's going on here?",
            "exCn": "这里发生什么事了？"
        },
        "go out": {
            "ex": "Let's go out for dinner.",
            "exCn": "我们出去吃晚饭吧。"
        },
        "go over": {
            "ex": "Let's go over the plan again.",
            "exCn": "我们再检查一遍计划。"
        },
        "go through": {
            "ex": "We went through many difficulties.",
            "exCn": "我们经历了许多困难。"
        },
        "go up": {
            "ex": "Prices are going up.",
            "exCn": "价格在上涨。"
        },
        "go without": {
            "ex": "We can go without food for days.",
            "exCn": "我们可以几天不吃东西。"
        },
        "grow up": {
            "ex": "He grew up in Beijing.",
            "exCn": "他在北京长大。"
        },
        "hand down": {
            "ex": "The tradition was handed down from our ancestors.",
            "exCn": "这个传统是祖先传下来的。"
        },
        "hand in": {
            "ex": "Please hand in your homework.",
            "exCn": "请交作业。"
        },
        "hand out": {
            "ex": "He handed out the books.",
            "exCn": "他分发了书本。"
        },
        "hang on": {
            "ex": "Hang on, I'll be back soon.",
            "exCn": "等一下，我马上回来。"
        },
        "hang out": {
            "ex": "I like hanging out with friends.",
            "exCn": "我喜欢和朋友出去玩。"
        },
        "hang up": {
            "ex": "She hung up the phone angrily.",
            "exCn": "她生气地挂了电话。"
        },
        "hear from": {
            "ex": "I haven't heard from him in weeks.",
            "exCn": "我已经好几周没收到他的消息了。"
        },
        "hear of": {
            "ex": "Have you heard of this book?",
            "exCn": "你听说过这本书吗？"
        },
        "help out": {
            "ex": "Can you help out with the housework?",
            "exCn": "你能帮忙做家务吗？"
        },
        "hold on": {
            "ex": "Hold on, please.",
            "exCn": "请稍等。"
        },
        "hold up": {
            "ex": "The traffic held us up.",
            "exCn": "交通堵塞耽误了我们。"
        },
        "hurry up": {
            "ex": "Hurry up or we'll be late.",
            "exCn": "快点，否则我们要迟到了。"
        },
        "insist on": {
            "ex": "He insisted on going with us.",
            "exCn": "他坚持要和我们一起去。"
        },
        "join in": {
            "ex": "Why don't you join in the game?",
            "exCn": "你为什么不参加游戏呢？"
        },
        "joke about": {
            "ex": "Don't joke about his weight.",
            "exCn": "别开他体重的玩笑。"
        },
        "jump out": {
            "ex": "The news jumped out at me.",
            "exCn": "这条新闻引起了我的注意。"
        },
        "keep away": {
            "ex": "Keep away from the fire.",
            "exCn": "远离火源。"
        },
        "keep from": {
            "ex": "I couldn't keep from laughing.",
            "exCn": "我忍不住笑了。"
        },
        "keep on": {
            "ex": "Keep on trying.",
            "exCn": "继续努力。"
        },
        "keep up": {
            "ex": "Can you keep up with the class?",
            "exCn": "你能跟上课程吗？"
        },
        "keep up with": {
            "ex": "It's hard to keep up with technology.",
            "exCn": "很难跟上技术的发展。"
        },
        "kick off": {
            "ex": "The match kicks off at 3 p.m.",
            "exCn": "比赛下午3点开始。"
        },
        "knock down": {
            "ex": "The building was knocked down.",
            "exCn": "大楼被拆除了。"
        },
        "knock out": {
            "ex": "He knocked out his opponent.",
            "exCn": "他击倒了对手。"
        },
        "laugh at": {
            "ex": "Don't laugh at others.",
            "exCn": "不要嘲笑别人。"
        },
        "lay off": {
            "ex": "The company laid off many workers.",
            "exCn": "公司解雇了许多工人。"
        },
        "lead to": {
            "ex": "Hard work leads to success.",
            "exCn": "努力工作通向成功。"
        },
        "learn about": {
            "ex": "I'd like to learn about Chinese culture.",
            "exCn": "我想了解中国文化。"
        },
        "learn from": {
            "ex": "We should learn from our mistakes.",
            "exCn": "我们应该从错误中学习。"
        },
        "leave behind": {
            "ex": "Don't leave your things behind.",
            "exCn": "别落下你的东西。"
        },
        "leave out": {
            "ex": "Don't leave out any details.",
            "exCn": "不要遗漏任何细节。"
        },
        "let alone": {
            "ex": "I can't walk, let alone run.",
            "exCn": "我走都走不了，更别说跑了。"
        },
        "let down": {
            "ex": "Don't let your parents down.",
            "exCn": "不要让父母失望。"
        },
        "let go": {
            "ex": "Let go of my hand.",
            "exCn": "放开我的手。"
        },
        "let out": {
            "ex": "She let out a scream.",
            "exCn": "她发出一声尖叫。"
        },
        "line up": {
            "ex": "Please line up here.",
            "exCn": "请在这里排队。"
        },
        "live on": {
            "ex": "She lives on her pension.",
            "exCn": "她靠养老金生活。"
        },
        "live through": {
            "ex": "He lived through two wars.",
            "exCn": "他经历了两次战争。"
        },
        "live up to": {
            "ex": "The movie lived up to my expectations.",
            "exCn": "这部电影没有辜负我的期望。"
        },
        "look after": {
            "ex": "She looks after her little brother.",
            "exCn": "她照顾她的弟弟。"
        },
        "look ahead": {
            "ex": "Let's look ahead to next year.",
            "exCn": "让我们展望明年。"
        },
        "look at": {
            "ex": "Look at the blackboard.",
            "exCn": "看黑板。"
        },
        "look back": {
            "ex": "Let's look back on our achievements.",
            "exCn": "让我们回顾一下我们的成就。"
        },
        "look down on": {
            "ex": "Don't look down on others.",
            "exCn": "不要看不起别人。"
        },
        "look for": {
            "ex": "I'm looking for my keys.",
            "exCn": "我在找我的钥匙。"
        },
        "look forward to": {
            "ex": "I look forward to seeing you.",
            "exCn": "我期待见到你。"
        },
        "look into": {
            "ex": "The police are looking into the case.",
            "exCn": "警方正在调查此案。"
        },
        "look like": {
            "ex": "What does he look like?",
            "exCn": "他长什么样？"
        },
        "look out": {
            "ex": "Look out! There's a car coming.",
            "exCn": "小心！有车来了。"
        },
        "look over": {
            "ex": "Please look over my essay.",
            "exCn": "请检查一下我的文章。"
        },
        "look through": {
            "ex": "I looked through the report.",
            "exCn": "我浏览了这份报告。"
        },
        "look up": {
            "ex": "Look up the word in the dictionary.",
            "exCn": "在字典里查这个词。"
        },
        "look up to": {
            "ex": "Children look up to heroes.",
            "exCn": "孩子们崇拜英雄。"
        },
        "lose heart": {
            "ex": "Don't lose heart when facing difficulties.",
            "exCn": "面对困难时不要灰心。"
        },
        "make for": {
            "ex": "Let's make for the exit.",
            "exCn": "我们朝出口走吧。"
        },
        "make into": {
            "ex": "We made the room into an office.",
            "exCn": "我们把房间改成了办公室。"
        },
        "make out": {
            "ex": "I can't make out what he's saying.",
            "exCn": "我听不懂他在说什么。"
        },
        "make up": {
            "ex": "She made up a story.",
            "exCn": "她编了一个故事。"
        },
        "make up for": {
            "ex": "How can I make up for my mistake?",
            "exCn": "我怎样才能弥补我的错误？"
        },
        "mix up": {
            "ex": "Don't mix up these two words.",
            "exCn": "不要混淆这两个词。"
        },
        "move on": {
            "ex": "It's time to move on.",
            "exCn": "是时候继续前进了。"
        },
        "now that": {
            "ex": "Now that you're here, let's start.",
            "exCn": "既然你来了，我们开始吧。"
        },
        "occur to": {
            "ex": "It occurred to me that I had forgotten the keys.",
            "exCn": "我突然想起我忘了钥匙。"
        },
        "operate on": {
            "ex": "The doctor operated on the patient.",
            "exCn": "医生给病人做了手术。"
        },
        "ought to": {
            "ex": "You ought to apologize.",
            "exCn": "你应该道歉。"
        },
        "over and over again": {
            "ex": "He said it over and over again.",
            "exCn": "他一遍又一遍地说。"
        },
        "pass away": {
            "ex": "His grandfather passed away last night.",
            "exCn": "他祖父昨晚去世了。"
        },
        "pass by": {
            "ex": "She passed by without noticing me.",
            "exCn": "她从我身边走过，没注意到我。"
        },
        "pass on": {
            "ex": "Please pass on the message.",
            "exCn": "请传递这个消息。"
        },
        "pay attention to": {
            "ex": "Pay attention to your pronunciation.",
            "exCn": "注意你的发音。"
        },
        "pay back": {
            "ex": "I'll pay you back next week.",
            "exCn": "我下周还你钱。"
        },
        "pay for": {
            "ex": "How much did you pay for the book?",
            "exCn": "你买这本书花了多少钱？"
        },
        "pay off": {
            "ex": "His hard work paid off.",
            "exCn": "他的努力得到了回报。"
        },
        "pick out": {
            "ex": "Pick out the best apple.",
            "exCn": "挑出最好的苹果。"
        },
        "pick up": {
            "ex": "Can you pick me up at the station?",
            "exCn": "你能到车站接我吗？"
        },
        "point out": {
            "ex": "He pointed out my mistake.",
            "exCn": "他指出了我的错误。"
        },
        "prevent from": {
            "ex": "Nothing can prevent us from trying.",
            "exCn": "没有什么能阻止我们尝试。"
        },
        "protect from": {
            "ex": "Sunscreen protects us from UV rays.",
            "exCn": "防晒霜保护我们免受紫外线伤害。"
        },
        "provide with": {
            "ex": "The school provides students with books.",
            "exCn": "学校向学生提供书本。"
        },
        "pull down": {
            "ex": "They pulled down the old building.",
            "exCn": "他们拆除了旧楼。"
        },
        "pull out": {
            "ex": "He pulled out a gun.",
            "exCn": "他掏出了一把枪。"
        },
        "pull over": {
            "ex": "The car pulled over to the side.",
            "exCn": "车停到了路边。"
        },
        "pull through": {
            "ex": "He pulled through the illness.",
            "exCn": "他从疾病中恢复了过来。"
        },
        "put away": {
            "ex": "Put away your toys.",
            "exCn": "把玩具收起来。"
        },
        "put back": {
            "ex": "Put the book back on the shelf.",
            "exCn": "把书放回书架。"
        },
        "put down": {
            "ex": "Put down your name here.",
            "exCn": "在这里写下你的名字。"
        },
        "put forward": {
            "ex": "He put forward a proposal.",
            "exCn": "他提出了一个建议。"
        },
        "put off": {
            "ex": "Don't put off until tomorrow what you can do today.",
            "exCn": "今日事今日毕。"
        },
        "put on": {
            "ex": "Put on your coat.",
            "exCn": "穿上你的外套。"
        },
        "put out": {
            "ex": "Put out the fire.",
            "exCn": "把火扑灭。"
        },
        "put together": {
            "ex": "Let's put together a plan.",
            "exCn": "让我们制定一个计划。"
        },
        "put up": {
            "ex": "Can you put me up for the night?",
            "exCn": "你能让我借宿一晚吗？"
        },
        "put up with": {
            "ex": "I can't put up with his behavior.",
            "exCn": "我无法忍受他的行为。"
        },
        "rely on": {
            "ex": "You can rely on me.",
            "exCn": "你可以依靠我。"
        },
        "remind of": {
            "ex": "This reminds me of my childhood.",
            "exCn": "这让我想起了我的童年。"
        },
        "result from": {
            "ex": "His success resulted from hard work.",
            "exCn": "他的成功源于努力工作。"
        },
        "result in": {
            "ex": "The accident resulted in three deaths.",
            "exCn": "事故导致三人死亡。"
        },
        "ring back": {
            "ex": "I'll ring you back later.",
            "exCn": "我稍后给你回电话。"
        },
        "ring up": {
            "ex": "Ring me up when you arrive.",
            "exCn": "你到了给我打电话。"
        },
        "run across": {
            "ex": "I ran across an old photo.",
            "exCn": "我偶然发现了一张旧照片。"
        },
        "run after": {
            "ex": "The dog ran after the cat.",
            "exCn": "狗追猫。"
        },
        "run away": {
            "ex": "Don't run away from problems.",
            "exCn": "不要逃避问题。"
        },
        "run into": {
            "ex": "I ran into an old friend yesterday.",
            "exCn": "我昨天偶遇了一位老朋友。"
        },
        "run out": {
            "ex": "Our food is running out.",
            "exCn": "我们的食物快用完了。"
        },
        "run out of": {
            "ex": "We've run out of time.",
            "exCn": "我们用完了时间。"
        },
        "run over": {
            "ex": "The car ran over a dog.",
            "exCn": "车碾过了一只狗。"
        },
        "rush out": {
            "ex": "People rushed out of the building.",
            "exCn": "人们冲出大楼。"
        },
        "see off": {
            "ex": "I'll see you off at the airport.",
            "exCn": "我去机场送你。"
        },
        "see through": {
            "ex": "I saw through his lies.",
            "exCn": "我识破了他的谎言。"
        },
        "see to": {
            "ex": "I'll see to the arrangements.",
            "exCc": "我来处理安排事项。"
        },
        "send for": {
            "ex": "We sent for a doctor.",
            "exCn": "我们去请了医生。"
        },
        "send out": {
            "ex": "They sent out invitations.",
            "exCn": "他们发出了邀请。"
        },
        "set about": {
            "ex": "We set about the task immediately.",
            "exCn": "我们立即着手这项任务。"
        },
        "set aside": {
            "ex": "Set aside some money for emergencies.",
            "exCn": "留出一些钱应急。"
        },
        "set down": {
            "ex": "He set down his thoughts in a journal.",
            "exCn": "他把想法记在日记里。"
        },
        "set fire to": {
            "ex": "Someone set fire to the house.",
            "exCn": "有人放火烧了房子。"
        },
        "set off": {
            "ex": "We set off early in the morning.",
            "exCn": "我们一大早就出发了。"
        },
        "set out": {
            "ex": "She set out to become a doctor.",
            "exCn": "她立志成为一名医生。"
        },
        "set up": {
            "ex": "He set up his own company.",
            "exCn": "他创办了自己的公司。"
        },
        "settle down": {
            "ex": "He settled down in New York.",
            "exCn": "他在纽约安了家。"
        },
        "shake hands with": {
            "ex": "He shook hands with me.",
            "exCn": "他和我握了手。"
        },
        "share in": {
            "ex": "We share in your happiness.",
            "exCn": "我们分享你的快乐。"
        },
        "show off": {
            "ex": "He's always showing off his new car.",
            "exCn": "他总是在炫耀他的新车。"
        },
        "show up": {
            "ex": "He didn't show up at the meeting.",
            "exCn": "他没有出席会议。"
        },
        "shut down": {
            "ex": "The factory was shut down.",
            "exCn": "工厂关闭了。"
        },
        "shut up": {
            "ex": "Shut up and listen!",
            "exCn": "闭嘴听！"
        },
        "side by side": {
            "ex": "They walked side by side.",
            "exCn": "他们并肩走着。"
        },
        "sign up": {
            "ex": "I signed up for the course.",
            "exCn": "我报名参加了课程。"
        },
        "sit down": {
            "ex": "Please sit down.",
            "exCn": "请坐下。"
        },
        "slow down": {
            "ex": "Slow down, please.",
            "exCn": "请慢一点。"
        },
        "so far": {
            "ex": "So far, everything is going well.",
            "exCn": "到目前为止，一切进展顺利。"
        },
        "sort out": {
            "ex": "Let's sort out this mess.",
            "exCn": "让我们把这团乱麻整理一下。"
        },
        "speak out": {
            "ex": "You should speak out against injustice.",
            "exCn": "你应该大声反对不公正。"
        },
        "speak up": {
            "ex": "Please speak up. We can't hear you.",
            "exCn": "请大声点，我们听不见。"
        },
        "speed up": {
            "ex": "We need to speed up.",
            "exCn": "我们需要加快速度。"
        },
        "stand by": {
            "ex": "I'll stand by you no matter what.",
            "exCn": "不管发生什么，我都会支持你。"
        },
        "stand for": {
            "ex": "What does UFO stand for?",
            "exCn": "UFO代表什么？"
        },
        "stand out": {
            "ex": "She stands out in the crowd.",
            "exCn": "她在人群中很显眼。"
        },
        "stand up": {
            "ex": "Please stand up.",
            "exCn": "请起立。"
        },
        "stay up": {
            "ex": "Don't stay up too late.",
            "exCn": "别熬夜太晚。"
        },
        "step by step": {
            "ex": "Learn step by step.",
            "exCn": "循序渐进地学习。"
        },
        "stick to": {
            "ex": "Stick to the plan.",
            "exCn": "坚持计划。"
        },
        "sum up": {
            "ex": "Let me sum up the main points.",
            "exCn": "让我总结一下要点。"
        },
        "switch off": {
            "ex": "Switch off the lights.",
            "exCn": "关灯。"
        },
        "switch on": {
            "ex": "Switch on the TV.",
            "exCn": "打开电视。"
        },
        "take after": {
            "ex": "He takes after his father.",
            "exCn": "他长得像他父亲。"
        },
        "take apart": {
            "ex": "He took apart the machine.",
            "exCn": "他把机器拆开了。"
        },
        "take away": {
            "ex": "Take away the dirty plates.",
            "exCn": "把脏盘子拿走。"
        },
        "take back": {
            "ex": "I take back what I said.",
            "exCn": "我收回我说的话。"
        },
        "take care of": {
            "ex": "Take care of yourself.",
            "exCn": "照顾好自己。"
        },
        "take down": {
            "ex": "Take down my phone number.",
            "exCn": "记下我的电话号码。"
        },
        "take in": {
            "ex": "I couldn't take in all the information.",
            "exCn": "我无法消化所有信息。"
        },
        "take off": {
            "ex": "The plane took off on time.",
            "exCn": "飞机准时起飞了。"
        },
        "take on": {
            "ex": "She took on more responsibilities.",
            "exCn": "她承担了更多责任。"
        },
        "take out": {
            "ex": "Take out the trash.",
            "exCn": "把垃圾拿出去。"
        },
        "take over": {
            "ex": "She took over the project.",
            "exCn": "她接管了项目。"
        },
        "take part in": {
            "ex": "Did you take part in the meeting?",
            "exCn": "你参加会议了吗？"
        },
        "take place": {
            "ex": "The event took place last week.",
            "exCn": "活动上周举行了。"
        },
        "take pride in": {
            "ex": "He takes pride in his work.",
            "exCn": "他为自己的工作感到自豪。"
        },
        "take up": {
            "ex": "She took up painting as a hobby.",
            "exCn": "她开始把画画当作爱好。"
        },
        "talk about": {
            "ex": "Let's talk about the plan.",
            "exCn": "让我们谈谈计划。"
        },
        "talk over": {
            "ex": "Let's talk it over.",
            "exCn": "让我们商量一下。"
        },
        "tear up": {
            "ex": "He tore up the letter.",
            "exCn": "他把信撕了。"
        },
        "tell from": {
            "ex": "Can you tell the twins from each other?",
            "exCn": "你能区分这对双胞胎吗？"
        },
        "tell apart": {
            "ex": "Can you tell the twins apart?",
            "exCn": "你能区分这对双胞胎吗？"
        },
        "think about": {
            "ex": "I'm thinking about the problem.",
            "exCn": "我在思考这个问题。"
        },
        "think of": {
            "ex": "What do you think of my idea?",
            "exCn": "你觉得我的主意怎么样？"
        },
        "think over": {
            "ex": "Let me think it over.",
            "exCn": "让我仔细考虑一下。"
        },
        "throw away": {
            "ex": "Don't throw away this chance.",
            "exCn": "不要浪费这个机会。"
        },
        "throw off": {
            "ex": "He threw off his coat.",
            "exCn": "他脱掉了外套。"
        },
        "try on": {
            "ex": "Try on this dress.",
            "exCn": "试试这件衣服。"
        },
        "try out": {
            "ex": "Let's try out the new software.",
            "exCn": "让我们试试新软件。"
        },
        "turn around": {
            "ex": "Turn around and face me.",
            "exCn": "转过身来面对我。"
        },
        "turn away": {
            "ex": "He turned away in disgust.",
            "exCn": "他厌恶地转过身去。"
        },
        "turn back": {
            "ex": "It's time to turn back.",
            "exCn": "是时候回头了。"
        },
        "turn down": {
            "ex": "Turn down the music, please.",
            "exCn": "请把音乐关小。"
        },
        "turn into": {
            "ex": "The caterpillar turned into a butterfly.",
            "exCn": "毛毛虫变成了蝴蝶。"
        },
        "turn off": {
            "ex": "Turn off the lights before you leave.",
            "exCn": "离开前关灯。"
        },
        "turn on": {
            "ex": "Turn on the TV.",
            "exCn": "打开电视。"
        },
        "turn out": {
            "ex": "It turned out to be a mistake.",
            "exCn": "结果证明是个错误。"
        },
        "turn over": {
            "ex": "Turn over a new leaf.",
            "exCn": "改过自新。"
        },
        "turn to": {
            "ex": "Turn to page 10.",
            "exCn": "翻到第10页。"
        },
        "turn up": {
            "ex": "He hasn't turned up yet.",
            "exCn": "他还没出现。"
        },
        "use up": {
            "ex": "I've used up all the paper.",
            "exCn": "我用完了所有的纸。"
        },
        "wait for": {
            "ex": "I'm waiting for the bus.",
            "exCn": "我在等公共汽车。"
        },
        "wait on": {
            "ex": "The waiter waited on us.",
            "exCn": "服务员为我们服务。"
        },
        "wake up": {
            "ex": "I wake up at 6 a.m.",
            "exCn": "我早上6点起床。"
        },
        "walk around": {
            "ex": "Let's walk around the park.",
            "exCn": "我们在公园里走走吧。"
        },
        "warm up": {
            "ex": "Always warm up before exercising.",
            "exCn": "运动前要热身。"
        },
        "watch out": {
            "ex": "Watch out for cars.",
            "exCn": "小心车辆。"
        },
        "wear off": {
            "ex": "The pain is wearing off.",
            "exCn": "疼痛正在消退。"
        },
        "wear out": {
            "ex": "My shoes are worn out.",
            "exCn": "我的鞋子穿破了。"
        },
        "work at": {
            "ex": "She works at a bank.",
            "exCn": "她在银行工作。"
        },
        "work on": {
            "ex": "I'm working on a new project.",
            "exCn": "我正在做一个新项目。"
        },
        "work out": {
            "ex": "Can you work out this problem?",
            "exCn": "你能解出这道题吗？"
        },
        "worry about": {
            "ex": "Don't worry about me.",
            "exCn": "别担心我。"
        },
        "write down": {
            "ex": "Write down your name.",
            "exCn": "写下你的名字。"
        },
        "write to": {
            "ex": "I'll write to you next week.",
            "exCn": "我下周给你写信。"
        }
    }
    
    for key, info in common_examples.items():
        if key in phrases:
            phrases[key]["ex"] = info.get("ex", "")
            phrases[key]["exCn"] = info.get("exCn", "")


def generate_output(phrases):
    """生成输出文件"""
    # 转换为列表格式，按字母顺序排序
    phrase_list = sorted(phrases.values(), key=lambda x: x["w"].lower())
    
    # 生成 gaokao-phrases.js 文件（与现有词库格式兼容）
    output_path = os.path.join(VOCAB_DIR, "phrases.js")
    
    # 构建词条数组（简化格式：只保留词组和释义）
    simple_list = []
    for p in phrase_list:
        item = {"w": p["w"], "m": p["m"]}
        if p.get("ex"):
            item["ex"] = p["ex"]
        if p.get("exCn"):
            item["exCn"] = p["exCn"]
        simple_list.append(item)
    
    # 写入文件（与现有词库相同的加载方式）
    js_content = f"window.__VOCAB_CACHE__=window.__VOCAB_CACHE__||{{}};"
    js_content += f"window.__VOCAB_CACHE__['gaokao-phrases']={json.dumps(simple_list, ensure_ascii=False)};"
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"\n生成文件: {output_path}")
    print(f"总词条数: {len(simple_list)}")
    
    # 同时生成一个详细的JSON版本（包含例句和出处）
    detail_path = os.path.join(VOCAB_DIR, "phrases-detail.json")
    with open(detail_path, "w", encoding="utf-8") as f:
        json.dump(phrase_list, f, ensure_ascii=False, indent=2)
    
    print(f"生成详细文件: {detail_path}")
    
    return output_path


def update_index_js(phrases_file):
    """更新 index.js 注册新词库"""
    index_path = os.path.join(VOCAB_DIR, "index.js")
    
    # 读取现有 index.js
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 检查是否已存在
    if '"gaokao-phrases"' in content:
        print("index.js 中已存在 gaokao-phrases，跳过")
        return
    
    # 构建新的词库条目
    new_entry = '{"id":"gaokao-phrases","name":"高考英语必背短语与词组","level":"高考","total":' + str(len(phrases_file)) + ',"source":"lilinji","file":"phrases.js"}'
    
    # 在 books 数组开头插入新条目
    # 找到第一个 { 之后的位置
    insert_pos = content.find('{"id"')
    if insert_pos > 0:
        new_content = content[:insert_pos] + new_entry + ",\n" + content[insert_pos:]
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"已更新 index.js，注册新词库 gaokao-phrases")
    else:
        print("无法更新 index.js，请手动添加")


if __name__ == "__main__":
    print("开始提取词组数据...")
    phrases = extract_phrases()
    
    print(f"\n去重后共 {len(phrases)} 条词组")
    
    # 添加常见例句
    print("补充常见词组例句...")
    add_common_phrase_info(phrases)
    
    # 生成输出文件
    output_path = generate_output(phrases)
    
    # 更新索引
    update_index_js(phrases)
    
    print("\n完成！")
