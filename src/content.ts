import type { Language, Section } from './types.js';

const copy = {
  en: {
    newChat:'New conversation', explore:'Explore', recent:'Recent conversations', recentEmpty:'No conversations yet.',
    position:'Ph.D. candidate · NTU', reading:'Reading view ↗', overview:'Overview', research:'Research', publications:'Publication', work:'Work', miscellaneous:'Miscellaneous',
    inputLabel:'Your question', assistantName:'Fuxiang’s assistant', enterHint:'Enter to send', demoNote:'Prototype · Simulated replies.',
    placeholder:'Ask about my research, papers, or journey…', introduction:'Introduction', curated:'From the homepage', simulated:'Simulated reply',
    hero:'Fuxiang Zhang',
    intro:'Fuxiang is a <strong>Ph.D. candidate at <a href="https://www.ntu.edu.sg/" target="_blank" rel="noopener noreferrer">Nanyang Technological University</a></strong>, advised by <a href="https://personal.ntu.edu.sg/boan" target="_blank" rel="noopener noreferrer">Prof. Bo An</a>, and part of the industrial post-graduate program with <a href="https://skywork.ai" target="_blank" rel="noopener noreferrer">Skywork AI</a>.',
    llm:'Large Language Models', rl:'Reinforcement Learning', marl:'Multi-Agent RL', exploreResearch:'Explore my research', findPaper:'Find a paper', contact:'Let’s get in touch',
    selected:'Selected research', allPapers:'All publications ↗', askPaper:'Ask about this paper', researchPaper:'Research paper',
    publicationsDescription:'Papers, technical reports, and open-source code.',
    search:'Search titles or authors…', allYears:'All years', allTopics:'All topics', allTypes:'All types', reports:'Reports & workshops', conference:'Conference papers', journal:'Journal papers',
    clear:'Clear filters', showing:'publications', noResults:'No papers match these filters. Try another title, author, or year.', equal:'* denotes equal contribution. Full author lists are available in paper details.',
    researchTitle:'Research interests', researchDescription:'Explore three research themes through the publications collected on this homepage.',
    llmDescription:'Reasoning, self-verification, and preference alignment in language models. Explore work on how models learn and how their responses can be adapted.',
    rlDescription:'Learning from data, prior knowledge, and interaction. Explore publications on offline reinforcement learning, policy generalization, and model-based learning.',
    marlDescription:'Learning and coordination across multiple agents. Explore work on communication, transferable skills, and multi-agent language-model systems.',
    relatedPapers:'Browse related publications', miscellaneousTitle:'Miscellaneous', miscellaneousDescription:'Education, academic service, and selected honors.',
    workTitle:'Work', workDescription:'Research and industry experience at Skywork AI and Tencent AI Lab.',
    contactTitle:'Contact', contactDescription:'For research questions and collaboration, reach Fuxiang directly.',
    chatTitle:'Ask about my research', chatDescription:'Ask about research, publications, or experience. Replies are simulated.',
    chatTitleShort:'New conversation', send:'Send message', stop:'Stop response', stopped:'Response stopped.', failed:'The reply could not be delivered. Please check that the chat service is running, then try again.',
    retry:'Try again', copy:'Copy reply', copied:'Reply copied.', copyFailed:'Could not copy. You can select and copy the reply text.', thinking:'Preparing a reply…',
    details:'PAPER DETAILS', authors:'AUTHORS', venue:'PUBLICATION', openPaper:'Read paper ↗', openCode:'View code ↗', close:'Close details',
    detailTitle:'Keep the conversation going.', detailDescription:'Discuss this paper. Replies are simulated; refer to the paper for research details.',
    paperPrompt:'Tell me about this paper: ', context:'Discussing', removeContext:'Remove paper context', menuOpen:'Open navigation', menuClose:'Close navigation',
    loadError:'The publication list could not be loaded.', reload:'Reload page', readingFallback:'Open the reading view', latestNote:'Selected from the publications on this homepage.',
    themeLight:'Switch to light theme', themeDark:'Switch to dark theme',
  },
  zh: {
    newChat:'开始新对话', explore:'探索', recent:'最近的对话', recentEmpty:'暂无对话。', position:'博士研究生 · 南洋理工大学', reading:'阅读版 ↗',
    overview:'关于我', research:'研究方向', publications:'论文发表', work:'工作经历', miscellaneous:'其他信息', inputLabel:'你的问题', assistantName:'Fuxiang 的研究助理', enterHint:'按 Enter 发送',
    demoNote:'原型体验 · 对话回复为模拟内容。', placeholder:'聊聊我的研究、论文或学术经历……', introduction:'个人介绍', curated:'来自主页', simulated:'模拟回复',
    hero:'Fuxiang Zhang',
    intro:'Fuxiang 是<strong><a href="https://www.ntu.edu.sg/" target="_blank" rel="noopener noreferrer">南洋理工大学</a>的博士研究生</strong>，导师为 <a href="https://personal.ntu.edu.sg/boan" target="_blank" rel="noopener noreferrer">Bo An 教授</a>，同时参与与 <a href="https://skywork.ai" target="_blank" rel="noopener noreferrer">Skywork AI</a> 合作的产业研究生项目。',
    llm:'大语言模型', rl:'强化学习', marl:'多智能体强化学习', exploreResearch:'探索研究方向', findPaper:'寻找一篇论文', contact:'与我联系', selected:'精选研究', allPapers:'查看全部论文 ↗',
    askPaper:'聊聊这篇论文', researchPaper:'研究论文', publicationsDescription:'论文、技术报告与开源代码。',
    search:'搜索标题或作者……', allYears:'全部年份', allTopics:'全部方向', allTypes:'全部类型', reports:'技术报告与研讨会', conference:'会议论文', journal:'期刊论文',
    clear:'清除筛选', showing:'篇论文', noResults:'没有符合条件的论文，试试其他标题、作者或年份。', equal:'* 表示共同贡献。点击论文标题可查看完整作者列表。',
    researchTitle:'研究方向', researchDescription:'从主页收录的论文出发，探索三个研究主题。',
    llmDescription:'语言模型的推理、自我验证与偏好对齐。探索模型如何学习，以及如何调整其回答以适应不同偏好。',
    rlDescription:'从数据、先验知识和交互中学习。探索离线强化学习、策略泛化和基于模型的学习等相关工作。',
    marlDescription:'多个智能体之间的学习与协作。探索通信、可迁移技能以及多智能体语言模型系统等相关工作。',
    relatedPapers:'浏览相关论文', miscellaneousTitle:'其他信息', miscellaneousDescription:'教育背景、学术服务与主要荣誉。',
    workTitle:'工作经历', workDescription:'在 Skywork AI 与腾讯 AI Lab 的研究及产业项目经历。',
    contactTitle:'联系我', contactDescription:'关于研究问题与合作，请直接联系 Fuxiang。',
    chatTitle:'关于研究，你可以在这里提问', chatDescription:'可以提问研究、论文或经历相关的问题。当前使用模拟回复。',
    chatTitleShort:'新对话', send:'发送消息', stop:'停止响应', stopped:'已停止响应。', failed:'暂时无法获得回复。请检查聊天服务是否已启动，然后重试。',
    retry:'重试', copy:'复制回复', copied:'已复制回复。', copyFailed:'暂时无法复制，请选中回复文字手动复制。', thinking:'正在准备回复……',
    details:'论文详情', authors:'作者', venue:'发表信息', openPaper:'阅读论文 ↗', openCode:'查看代码 ↗', close:'关闭详情',
    detailTitle:'从论文开始一段对话。', detailDescription:'围绕这篇论文提问。回复为模拟内容，研究细节请查阅原文。',
    paperPrompt:'请介绍这篇论文：', context:'正在讨论', removeContext:'移除论文上下文', menuOpen:'打开导航', menuClose:'关闭导航',
    loadError:'论文列表暂时无法加载。', reload:'重新加载', readingFallback:'打开阅读版', latestNote:'从此主页收录的论文中精选。', themeLight:'切换浅色主题', themeDark:'切换深色主题',
  },
};
export type CopyKey = keyof typeof copy.en;
export const translations: Record<Language, Record<CopyKey, string>> = copy;

// From the supplied CV: education/work (p. 1), service/awards (p. 4).
export const journeySections: Section[] = [
  {
    id: "education",
    title: {"en": "Education", "zh": "教育经历"},
    type: "timeline",
    entries: [
      {
        date: {"en": "Jan. 2025 – Present", "zh": "2025 年 1 月 — 至今"},
        title: {"en": "Nanyang Technological University", "zh": "南洋理工大学"},
        role: {"en": "Ph.D. candidate · Singapore", "zh": "博士研究生 · 新加坡"},
        description: {"en": "College of Computing and Data Science (CCDS), advised by Prof. Bo An.", "zh": "计算与数据科学学院（CCDS），导师为 Bo An 教授。"},
        links: [
          {"url": "https://www.ntu.edu.sg/", "label": "NTU"},
          {"url": "https://personal.ntu.edu.sg/boan", "label": "Bo An"}
        ]
      },
      {
        date: {"en": "Sept. 2021 – Jun. 2024", "zh": "2021 年 9 月 — 2024 年 6 月"},
        title: {"en": "Nanjing University", "zh": "南京大学"},
        role: {"en": "Master’s degree · School of Artificial Intelligence", "zh": "硕士学位 · 人工智能学院"},
        description: {"en": "Member of the LAMDA Group, advised by Prof. Yang Yu and Prof. Zongzhang Zhang. The group is led by Prof. Zhi-Hua Zhou.", "zh": "LAMDA 研究组成员，导师为 Yang Yu 教授和 Zongzhang Zhang 教授。研究组由 Zhi-Hua Zhou 教授带领。"},
        links: [
          {"url": "http://www.lamda.nju.edu.cn/MainPage.ashx", "label": "LAMDA"},
          {"url": "https://www.lamda.nju.edu.cn/zhangzz/", "label": "Zongzhang Zhang"}
        ]
      },
      {
        date: {"en": "Sept. 2017 – Jun. 2021", "zh": "2017 年 9 月 — 2021 年 6 月"},
        title: {"en": "Nanjing University", "zh": "南京大学"},
        role: {"en": "Bachelor’s degree · Computer Science and Technology", "zh": "学士学位 · 计算机科学与技术系"},
        description: {"en": "Completed undergraduate studies in the Department of Computer Science and Technology.", "zh": "在计算机科学与技术系完成本科学习。"}
      }
    ]
  },
  {
    id: "experience",
    title: {"en": "Research & industry experience", "zh": "研究与工作经历"},
    type: "timeline",
    entries: [
      {
        date: {"en": "Oct. 2024 – Present", "zh": "2024 年 10 月 — 至今"},
        title: {"en": "Skywork AI", "zh": "Skywork AI"},
        role: {"en": "Researcher · Singapore", "zh": "研究员 · 新加坡"},
        description: {"en": "Participating in an industrial post-graduate program (IPP), with contributions to reasoning models, reward models, video generation, and AI agents.", "zh": "参与产业研究生项目（IPP），研究和项目经历涵盖推理模型、奖励模型、视频生成与 AI 智能体。"},
        links: [
          {"url": "https://skywork.ai", "label": "Skywork AI"}
        ],
        bullets: [
          {
            title: "SkyReels-V4",
            paperId: "paper-1",
            description: {"en": "Worked on data processing pipelines for SFT preprocessing, captioning, and quality selection.", "zh": "参与 SFT 数据预处理、视频描述生成及质量筛选等数据处理流程。"}
          },
          {
            title: "DeRL-SWE-32B",
            paperId: "paper-3",
            description: {"en": "Trained a coding model on an agentless scaffold for software engineering. In September 2025, it achieved 61.8% on SWE-bench Verified with test-time compute scaling and 47.4% in a single attempt.", "zh": "训练基于 agentless 框架的软件工程代码模型。2025 年 9 月，在 SWE-bench Verified 上通过测试时计算扩展取得 61.8% 的成绩，单次尝试成绩为 47.4%。"}
          },
          {
            title: "Skywork-OR1",
            paperId: "paper-4",
            description: {"en": "Worked on reinforcement learning training and helped develop a multi-stage adaptive-entropy training schedule for the reasoning models released in May 2025.", "zh": "参与 2025 年 5 月发布的推理模型的强化学习训练，并协助设计多阶段自适应熵训练调度。"}
          },
          {
            title: "Skywork-Reward-V2",
            paperId: "paper-5",
            description: {"en": "Contributed to the reward-model project, whose team found that careful data curation and selection substantially improved performance.", "zh": "参与奖励模型项目；团队发现，精细的数据整理和筛选能够显著改善模型表现。"}
          },
          {
            title: {"en": "Website & slide-generation agents", "zh": "网页与幻灯片生成智能体"},
            description: {"en": "Worked on industrial AI-agent projects. The slide-generation pipeline replaced proprietary APIs with locally trained open-source models to reduce cost and latency.", "zh": "参与产业 AI 智能体项目。幻灯片生成流程采用本地训练的开源模型替代专有 API，从而降低成本和延迟。"}
          }
        ]
      },
      {
        date: {"en": "Jun. 2023 – Apr. 2024", "zh": "2023 年 6 月 — 2024 年 4 月"},
        title: {"en": "Tencent AI Lab", "zh": "腾讯 AI Lab"},
        role: {"en": "Research intern · Shenzhen, China", "zh": "研究实习生 · 中国深圳"},
        description: {"en": "Joined the Rhino-Bird Research Program, studying reinforcement learning and large foundation models for game AI. Investigated how LLMs can supply knowledge and experience to improve the training of traditional RL agents.", "zh": "参与犀牛鸟研究计划，研究强化学习与大规模基础模型在游戏 AI 中的结合，探索如何利用 LLM 提供的知识和经验改善传统强化学习智能体的训练。"},
        bullets: [
          {
            title: {"en": "Related publication · TNNLS 2025", "zh": "相关论文 · TNNLS 2025"},
            paperId: "paper-18",
            description: {"en": "Improving Sample Efficiency of Reinforcement Learning with Background Knowledge from Large Language Models.", "zh": "Improving Sample Efficiency of Reinforcement Learning with Background Knowledge from Large Language Models。"}
          }
        ]
      }
    ]
  },
  {
    id: "service",
    title: {"en": "Academic service", "zh": "学术服务"},
    type: "list",
    entries: [
      {
        date: {"en": "2024 – 2026", "zh": "2024 — 2026"},
        title: {"en": "ICLR · ICML · NeurIPS", "zh": "ICLR · ICML · NeurIPS"},
        description: {"en": "Reviewer / program committee member.", "zh": "审稿人 / 程序委员会成员。"}
      },
      {
        date: {"en": "2023 – 2026", "zh": "2023 — 2026"},
        title: {"en": "AAAI", "zh": "AAAI"},
        description: {"en": "Reviewer / program committee member.", "zh": "审稿人 / 程序委员会成员。"}
      },
      {
        title: {"en": "IEEE TNNLS", "zh": "IEEE TNNLS"},
        description: {"en": "Journal reviewer.", "zh": "期刊审稿人。"}
      }
    ]
  },
  {
    id: "awards",
    title: {"en": "Honors & awards", "zh": "荣誉与奖励"},
    type: "list",
    entries: [
      {
        date: {"en": "2021 – 2024", "zh": "2021 — 2024"},
        title: {"en": "First-Class Scholarship", "zh": "一等奖学金"},
        description: {"en": "Nanjing University.", "zh": "南京大学。"}
      },
      {
        date: {"en": "2021 · 2024", "zh": "2021 · 2024"},
        title: {"en": "Outstanding Graduate", "zh": "优秀毕业生"},
        description: {"en": "Nanjing University, bachelor’s (2021) and master’s (2024).", "zh": "南京大学本科（2021）及硕士（2024）优秀毕业生。"}
      },
      {
        date: {"en": "2020", "zh": "2020"},
        title: {"en": "Gold Award · Algorithm Design Competition", "zh": "算法设计竞赛金奖"},
        description: {"en": "16th Algorithm Design Competition, Nanjing University.", "zh": "南京大学第十六届算法设计竞赛。"}
      },
      {
        date: {"en": "2019", "zh": "2019"},
        title: {"en": "Second Prize · CUMCM", "zh": "全国大学生数学建模竞赛二等奖"},
        description: {"en": "China Undergraduate Mathematical Contest in Modeling.", "zh": "全国大学生数学建模竞赛（CUMCM）。"}
      }
    ]
  }
];
