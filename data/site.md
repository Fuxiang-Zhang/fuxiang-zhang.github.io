# Fuxiang Zhang

Position: Ph.D. student · NTU · Singapore
Email: zfx.agi@gmail.com
Links: [GitHub](https://github.com/mansicer), [Google Scholar](https://scholar.google.com/citations?user=GZRrWXAAAAAJ), [LinkedIn](https://www.linkedin.com/in/fuxiang-zhang-2b7bb418a/), [X](https://x.com/fuxiang_z)

## Bio
Command: /bio
Summary: Print biography and contact links

I am a Ph.D. student at the College of Computing and Data Science, [Nanyang Technological University](https://www.ntu.edu.sg/), starting from January 2025, advised by Prof. [Bo An](https://personal.ntu.edu.sg/boan). I am part of an industrial post-graduate program (IPP) with [Skywork AI](https://skywork.ai). I obtained my Master's and Bachelor's degrees from Nanjing University. During my time at Nanjing University, I was a member of the [LAMDA](http://www.lamda.nju.edu.cn/MainPage.ashx) group, in a reinforcement learning team led by Prof. [Yang Yu](https://www.lamda.nju.edu.cn/yangyu/) and Prof. [Zongzhang Zhang](https://www.lamda.nju.edu.cn/zhangzz/).

## Research
Command: /research
Summary: Print research interests and directions

### Reasoning and Agentic LLMs: Post-training and Test-time Alignment

Beyond my industrial work on LLMs, I am interested in how post-training (specifically, reinforcement learning) and test-time scaling can align models toward targeted values and capabilities:

[[paper:q-adapter]]

[[paper:skywork-reward-v2]]

#### Reasoning models

I train reasoning models with reinforcement learning on math and coding benchmarks, including large-scale training recipes and agentic coding models for software engineering.

[[paper:skywork-or1]]

[[paper:derl-swe]]

[[paper:self-verification]]

#### Multi-agent LLM systems

I study how to stabilize reinforcement learning when multiple LLM agents are trained together.

[[paper:dr-mas]]

#### Test-time alignment

I explore test-time methods that align models beyond verifiable-only domains, such as realigning preferences through reward decomposition without retraining.

[[paper:rear]]

### Reinforcement Learning and Multi-agent Reinforcement Learning

I have several topics of interest in the field of RL and MARL:

[[paper:multi-modal-imitation]]

#### Multi-agent cooperation

I study multi-agent imitation, communication, and offline training in challenging cooperative tasks such as StarCraft II and multi-joint locomotion control.

[[paper:multi-agent-imitation]]

[[paper:incentive-communication]]

[[paper:coordination-skills]]

[[paper:concentrative-coordination]]

[[paper:continual-coordination]]

#### Offline RL

I address the data-efficiency challenge of training RL policies from offline data, particularly under scarce-data and multi-task settings.

[[paper:offline-task-representation]]

[[paper:dataset-constraint]]

[[paper:policy-rehearsing]]

#### Exploration and exploitation in RL

I investigate the exploration–exploitation trade-off in RL training through LLM guidance, logical induction, and more direct optimization schemes built on a learned environment dynamics model.

[[paper:llm-background-knowledge]]

[[paper:logical-induction]]

[[paper:model-gradient]]

## Papers
Command: /papers
Summary: Print publications, code, and paper details
Cards: publications

All of my publications, technical reports first, then conference and journal papers. Click a title for details.

## Work
Command: /work
Summary: Print research and industry experience

My research and industry experience.

### Skywork AI
Role: Researcher
Location: Singapore
Period: Oct. 2024 – Present

Participating in an industrial post-graduate program (IPP), with contributions to reasoning models, reward models, video generation, and AI agents.

- **SkyReels-V4**

  Worked on data processing pipelines for SFT preprocessing, captioning, and quality selection.

  [[paper:skyreels-v4]]

- **DeRL-SWE-32B**

  Trained a coding model on an agentless scaffold for software engineering. In September 2025, it achieved 61.8% on SWE-bench Verified with test-time compute scaling and 47.4% in a single attempt.

  [[paper:derl-swe]]

- **Skywork-OR1**

  Worked on reinforcement learning training and helped develop a multi-stage adaptive-entropy training schedule for the reasoning models released in May 2025.

  [[paper:skywork-or1]]

- **Skywork-Reward-V2**

  Contributed to the reward-model project, whose team found that careful data curation and selection substantially improved performance.

  [[paper:skywork-reward-v2]]

- **Website & slide-generation agents**

  Worked on industrial AI-agent projects. The slide-generation pipeline replaced proprietary APIs with locally trained open-source models to reduce cost and latency.

### Tencent AI Lab
Role: Research intern
Location: Shenzhen, China
Period: Jun. 2023 – Apr. 2024

Joined the Rhino-Bird Research Program, studying reinforcement learning and large foundation models for game AI. Investigated how LLMs can supply knowledge and experience to improve the training of traditional RL agents.

[[paper:llm-background-knowledge]]

## Education
Command: /education
Summary: Print degrees and institutions

### Nanyang Technological University
Role: Ph.D. student
Location: Singapore
Period: Jan. 2025 – Present
Links: [NTU](https://www.ntu.edu.sg/), [Bo An](https://personal.ntu.edu.sg/boan)

College of Computing and Data Science (CCDS), advised by Prof. Bo An.

### Nanjing University
Role: Master’s degree · School of Artificial Intelligence
Period: Sept. 2021 – Jun. 2024
Links: [LAMDA](http://www.lamda.nju.edu.cn/MainPage.ashx), [Yang Yu](https://www.lamda.nju.edu.cn/yangyu/), [Zongzhang Zhang](https://www.lamda.nju.edu.cn/zhangzz/), [Zhi-Hua Zhou](https://cs.nju.edu.cn/zhouzh/)

Member of the LAMDA Group, advised by Prof. Yang Yu and Prof. Zongzhang Zhang. The group is led by Prof. Zhi-Hua Zhou.

### Nanjing University
Role: Bachelor’s degree · Computer Science and Technology
Period: Sept. 2017 – Jun. 2021

Completed undergraduate studies in the Department of Computer Science and Technology.

## Miscellaneous
Command: /misc
Summary: Print academic service and honors

### Service

- **ICLR · ICML · NeurIPS**
  Role: Reviewer / program committee member
  Period: 2024 – 2026

- **AAAI**
  Role: Reviewer / program committee member
  Period: 2023 – 2026

- **IEEE TNNLS**
  Role: Journal reviewer

### Awards

- **First-Class Scholarship**
  Role: Nanjing University
  Period: 2021 – 2024

- **Outstanding Graduate**
  Role: Nanjing University · bachelor’s and master’s
  Period: 2021 · 2024

- **Gold Award · 16th Algorithm Design Competition**
  Role: Nanjing University
  Period: 2020

- **Second Prize · CUMCM**
  Role: China Undergraduate Mathematical Contest in Modeling
  Period: 2019

## Publications
Id: publications

### SkyReels-V4: Multi-modal Video-Audio Generation, Inpainting and Editing Model
Id: skyreels-v4
Authors: Guibin Chen, Dixuan Lin, Jiangping Yang, Youqiang Zhang, Zhengcong Fei, Debang Li, Sheng Chen, Chaofeng Ao, Nuo Pang, Yiming Wang, Yikun Dou, Zheng Chen, Mingyuan Fan, Tuanhui Li, Mingshan Chang, Hao Zhang, Xiaopeng Sun, Jingtao Xu, Yuqiang Xie, Jiahua Wang, Zhiheng Xu, Weiming Xiong, Yuzhe Jin, Baoxuan Gu, Binjie Mao, Yunjie Yu, Jujie He, Yuhao Feng, Shiwen Tu, Chaojie Wang, Rui Yan, Wei Shen, Jingchen Wu, Peng Zhao, Xuanyue Zhong, Zhuangzhuang Liu, Kaifei Wang, Fuxiang Zhang, Weikai Xu, Wenyan Liu, Binglu Zhang, Yu Shen, Tianhui Xiong, Bin Peng, Liang Zeng, Xuchen Song, Haoxiang Guo, Peiyu Wang, Max W. Y. Lam, Chien-Hung Liu, Yahui Zhou
Venue: Technical Report
Venue short: Technical Report
Year: 2026
Topic: Large Language Models
Paper: https://arxiv.org/abs/2602.21818

SkyReels V4 is a unified multi modal video foundation model for joint video audio generation, inpainting, and editing. The model adopts a dual stream Multimodal Diffusion Transformer (MMDiT) architecture, where one branch synthesizes video and the other generates temporally aligned audio, while sharing a powerful text encoder based on the Multimodal Large Language Models (MLLM). SkyReels V4 accepts rich multi modal instructions, including text, images, video clips, masks, and audio references. By combining the MLLMs multi modal instruction following capability with in context learning in the video branch MMDiT, the model can inject fine grained visual guidance under complex conditioning, while the audio branch MMDiT simultaneously leverages audio references to guide sound generation. On the video side, we adopt a channel concatenation formulation that unifies a wide range of inpainting style tasks, such as image to video, video extension, and video editing under a single interface, and naturally extends to vision referenced inpainting and editing via multi modal prompts. SkyReels V4 supports up to 1080p resolution, 32 FPS, and 15 second duration, enabling high fidelity, multi shot, cinema level video generation with synchronized audio. To make such high resolution, long-duration generation computationally feasible, we introduce an efficiency strategy: Joint generation of low resolution full sequences and high-resolution keyframes, followed by dedicated super-resolution and frame interpolation models. To our knowledge, SkyReels V4 is the first video foundation model that simultaneously supports multi-modal input, joint video audio generation, and a unified treatment of generation, inpainting, and editing, while maintaining strong efficiency and quality at cinematic resolutions and durations.

### Dr. MAS: Stable Reinforcement Learning for Multi-Agent LLM Systems
Id: dr-mas
Authors: Lang Feng, Longtao Zheng, Shuo He, Fuxiang Zhang, Bo An
Venue: ICLR Workshop on Multi-Agent Learning and Its Opportunities in the Era of Generative AI (MALGAI)
Venue short: MALGAI
Year: 2026
Topic: Multi-Agent RL
Paper: https://arxiv.org/abs/2602.08847

Multi-agent LLM systems enable advanced reasoning and tool use via role specialization, yet reliable reinforcement learning (RL) post-training for such systems remains difficult. In this work, we theoretically pinpoint a key reason for training instability when extending group-based RL to multi-agent LLM systems. We show that under GRPO-style optimization, a global normalization baseline may deviate from diverse agents' reward distributions, which ultimately leads to gradient-norm instability. Based on this finding, we propose Dr. MAS, a simple and stable RL training recipe for multi-agent LLM systems. Dr. MAS uses an agent-wise remedy: normalizing advantages per agent using each agent's own reward statistics, which calibrates gradient scales and dramatically stabilizes training, both theoretically and empirically. Beyond the algorithm, Dr. MAS provides an end-to-end RL training framework for multi-agent LLM systems, supporting scalable orchestration, flexible per-agent LLM serving and optimization configs, and shared resource scheduling of LLM actor backends. We evaluate Dr. MAS on multi-agent math reasoning and multi-turn search benchmarks using Qwen2.5 and Qwen3 series models. Dr. MAS achieves clear gains over vanilla GRPO (e.g., +5.6\% avg@16 and +4.6\% pass@16 on math, and +15.2\% avg@16 and +13.1\% pass@16 on search) while largely eliminating gradient spikes. Moreover, it remains highly effective under heterogeneous agent-model assignments while improving efficiency.

### DeRL-SWE: Decoupled Reinforcement Learning with Nested Credit Assignment for Software Engineering
Id: derl-swe
Authors: Fuxiang Zhang, Xinyu Guan, Jujie He, Liang Zeng, Jiacheng Xu, Yang Liu, Bo An
Venue: ICML Workshop on Deep Learning for Code (DL4C)
Venue short: DL4C
Year: 2026
Topic: Large Language Models
Paper: https://openreview.net/forum?id=MisdGC6Jlh

Recent state-of-the-art systems for repository-level software engineering (SWE) rely heavily on SWE-specific Supervised Fine-Tuning (SFT) or mid-training, which improves benchmark performance at the cost of narrowing the base model's general ability. Reinforcement Learning (RL) avoids this imitation bias by directly optimizing task-level returns. However, applying RL to repository-level SWE is difficult, since agentic training over long-horizon tool-use trajectories suffers from massive action spaces and delayed binary rewards that destabilize credit assignment. We propose DeRL-SWE, a decoupled RL framework that exploits the localize-then-repair agentless pipeline.
Training proceeds in two stages: (i) repair-only RL under oracle localization to bootstrap edit
capability, and (ii) joint localization-repair RL with nested credit assignment, where each localization is rewarded by the subsequent success of repair operations sampled from it. We show that this nested estimator yields an unbiased Monte Carlo estimate of the joint policy gradient, turning credit assignment from a heuristic into a principled decomposition of the end-to-end objective. On SWE-bench Verified, DeRL-SWE-32B reaches 47.4% single-attempt and 61.8% with test-time patch selection under the agentless framework. Meanwhile, the model preserves the base model's reasoning capabilities on general benchmarks such as math and general knowledge.

### Skywork Open Reasoner 1 Technical Report
Id: skywork-or1
Authors: Jujie He, Jiacai Liu, Chris Yuhao Liu, Rui Yan, Chaojie Wang, Peng Cheng, Xiaoyu Zhang, Fuxiang Zhang, Jiacheng Xu, Wei Shen, Siyuan Li, Liang Zeng, Tianwen Wei, Cheng Cheng, Bo An, Yang Liu, Yahui Zhou
Venue: Technical Report
Venue short: Technical Report
Year: 2025
Topic: Large Language Models
Paper: https://arxiv.org/abs/2505.22312

The success of DeepSeek-R1 underscores the significant role of reinforcement learning (RL) in enhancing the reasoning capabilities of large language models (LLMs). In this work, we present Skywork-OR1, an effective and scalable RL implementation for long Chain-of-Thought (CoT) models. Building on the DeepSeek-R1-Distill model series, our RL approach achieves notable performance gains, increasing average accuracy across AIME24, AIME25, and LiveCodeBench from 57.8% to 72.8% (+15.0%) for the 32B model and from 43.6% to 57.5% (+13.9%) for the 7B model. Our Skywork-OR1-32B model surpasses both DeepSeek-R1 and Qwen3-32B on the AIME24 and AIME25 benchmarks, while achieving comparable results on LiveCodeBench. The Skywork-OR1-7B and Skywork-OR1-Math-7B models demonstrate competitive reasoning capabilities among models of similar size. We perform comprehensive ablation studies on the core components of our training pipeline to validate their effectiveness. Additionally, we thoroughly investigate the phenomenon of entropy collapse, identify key factors affecting entropy dynamics, and demonstrate that mitigating premature entropy collapse is critical for improved test performance. To support community research, we fully open-source our model weights, training code, and training datasets.

### Skywork-Reward-V2: Scaling Preference Data Curation via Human-AI Synergy
Id: skywork-reward-v2
Authors: Chris Yuhao Liu, Liang Zeng, Yuzhen Xiao, Jujie He, Jiacai Liu, Chaojie Wang, Rui Yan, Wei Shen, Fuxiang Zhang, Jiacheng Xu, Yang Liu, Yahui Zhou
Venue: Technical Report
Venue short: Technical Report
Year: 2025
Topic: Large Language Models
Paper: https://arxiv.org/abs/2507.01352
Code: https://github.com/SkyworkAI/Skywork-Reward-V2

Despite the critical role of reward models (RMs) in Reinforcement Learning from Human Feedback (RLHF), current state-of-the-art open RMs perform poorly on most existing evaluation benchmarks, failing to capture nuanced human preferences. We hypothesize that this brittleness stems primarily from limitations in preference datasets, which are often narrowly scoped, synthetically labeled, or lack rigorous quality control. To address these challenges, we present SynPref-40M, a large-scale preference dataset comprising 40 million preference pairs. To enable data curation at scale, we design a human-AI synergistic two-stage pipeline that leverages the complementary strengths of human annotation quality and AI scalability. In this pipeline, humans provide verified annotations, while LLMs perform automatic curation based on human guidance. Training on this preference mixture, we introduce Skywork-Reward-V2, a suite of eight reward models ranging from 0.6B to 8B parameters, trained on a carefully curated subset of 26 million preference pairs from SynPref-40M. We demonstrate that Skywork-Reward-V2 is versatile across a wide range of capabilities, including alignment with human preferences, objective correctness, safety, resistance to stylistic biases, and best-of-N scaling. These reward models achieve state-of-the-art performance across seven major reward model benchmarks, outperform generative reward models, and demonstrate strong downstream performance. Ablation studies confirm that effectiveness stems not only from data scale but also from high-quality curation. The Skywork-Reward-V2 series represents substantial progress in open reward models, demonstrating how human-AI curation synergy can unlock significantly higher data quality.

### REAR: Test-time Preference Realignment through Reward Decomposition
Id: rear
Authors: Fuxiang Zhang, Pengcheng Wang, Chenran Li, Yi-Chen Li, Yuxin Chen, Lang Feng, Chenfeng Xu, Masayoshi Tomizuka, Bo An
Venue: International Conference on Machine Learning (ICML)
Venue short: ICML
Year: 2026
Topic: Large Language Models
Paper: https://arxiv.org/abs/2606.30339
Code: https://github.com/mansicer/REAR

Aligning large language models (LLMs) with diverse user preferences is a critical yet challenging task. While post-training methods can adapt models to specific needs, they often require costly data curation and additional training. Test-time scaling (TTS) presents an efficient, training-free alternative, but its application has been largely limited to verifiable domains like mathematics and coding, where response correctness is easily judged. To extend TTS to preference alignment, we introduce a novel framework that models the task as a realignment problem, since the base model often fails to sufficiently align with the stated preference. Our key insight is to decompose the
underlying reward function into two components: one related to the question and the other to
preference information. This allows us to derive a REAlignment Reward (REAR) that selectively rescales the proportions of these two reward terms. We then show that REAR can be formulated as a linear combination of token-level policy log-probabilities, making it computationally efficient and easy to integrate with various TTS algorithms such as best-of-N sampling and tree search. Experiments show that compared to other test-time baselines, REAR not only enables scalable test-time realignment for preference alignment tasks under diverse user requirements, but also generalizes to mathematical and visual tasks under appropriate preference settings.

### Incentivizing LLMs to Self-Verify Their Answers
Id: self-verification
Authors: Fuxiang Zhang, Jiacheng Xu, Chaojie Wang, Ce Cui, Yang Liu, Bo An
Venue: Conference on Neural Information Processing Systems (NeurIPS)
Venue short: NeurIPS
Year: 2025
Topic: Large Language Models
Paper: https://arxiv.org/abs/2506.01369
Code: https://github.com/mansicer/self-verification

Large Language Models (LLMs) have demonstrated remarkable progress in complex reasoning tasks through both post-training and test-time scaling laws. While prevalent test-time scaling approaches are often realized by using external reward models to guide the model generation process, we find that only marginal gains can be acquired when scaling a model post-trained on specific reasoning tasks. We identify that the limited improvement stems from distribution discrepancies between the specific post-trained generator and the general reward model. To address this, we propose a framework that incentivizes LLMs to self-verify their own answers. By unifying answer generation and verification within a single reinforcement learning (RL) process, we train models that can effectively assess the correctness of their own solutions. The trained model can further scale its performance at inference time by verifying its generations, without the need for external verifiers. We train our self-verification models based on Qwen2.5-Math-7B and DeepSeek-R1-Distill-Qwen-1.5B, demonstrating their capabilities across varying reasoning context lengths. Experiments on multiple mathematical reasoning benchmarks show that our models can not only improve post-training performance but also enable effective test-time scaling.

### Multi-Agent Imitation by Learning and Sampling from Factorized Soft Q-Function
Id: multi-agent-imitation
Authors: Yi-Chen Li, Zhongxiang Ling, Tao Jiang, Fuxiang Zhang, Pengyuan Wang, Lei Yuan, Zongzhang Zhang, Yang Yu
Venue: Conference on Neural Information Processing Systems (NeurIPS)
Venue short: NeurIPS
Year: 2025
Topic: Multi-Agent RL
Paper: https://papers.neurips.cc/paper_files/paper/2025/hash/13a6f537e943a598b8719b03181a8e2a-Abstract-Conference.html
Code: https://github.com/LAMDA-RL/MAFIS

Learning from multi-agent expert demonstrations, known as Multi-Agent Imitation Learning (MAIL), provides a promising approach to sequential decision-making. However, existing MAIL methods including Behavior Cloning (BC) and Adversarial Imitation Learning (AIL) face significant
challenges: BC suffers from the compounding error issue, while the very nature of adversarial
optimization makes AIL prone to instability. In this work, we propose Multi-Agent imitation by learning and sampling from FactorIzed Soft Q-function (MAFIS), a novel method that addresses these limitations for both online and offline MAIL settings. Built upon the single-agent IQ-Learn framework, MAFIS introduces the value decomposition network to factorize the imitation objective at agent level, thus enabling scalable training for multi-agent systems. Moreover, we observe that the soft Q-function implicitly defines the optimal policy as an energy-based model, from which we can sample actions via stochastic gradient Langevin dynamics. This allows us to estimate the gradient of the factorized optimization objective for continuous control tasks, avoiding the adversarial optimization between the soft Q-function and the policy required by prior work. By doing so, we obtain a tractable and non-adversarial objective for both discrete and continuous multi-agent control. Experiments on common benchmarks including the discrete control tasks StarCraft Multi-Agent Challenge v2 (SMACv2), Gold Miner, and Multi Particle Environments (MPE), as well as the continuous control task Multi-Agent MuJoCo (MaMuJoCo), demonstrate that MAFIS achieves superior performance compared with baselines. Our code is available at [github.com/LAMDA-RL/MAFIS](https://github.com/LAMDA-RL/MAFIS).

### Q-Adapter: Customizing Pre-trained LLMs to New Preferences with Forgetting Mitigation
Id: q-adapter
Authors: Yi-Chen Li*, Fuxiang Zhang*, Wenjie Qiu, Lei Yuan, Chengxing Jia, Zongzhang Zhang, Yang Yu, Bo An
Venue: International Conference on Learning Representations (ICLR)
Venue short: ICLR
Year: 2025
Topic: Large Language Models
Paper: https://arxiv.org/abs/2407.03856
Code: https://github.com/mansicer/Q-Adapter

Large Language Models (LLMs), trained on a large amount of corpus, have demonstrated remarkable abilities. However, it may not be sufficient to directly apply open-source LLMs like Llama to certain real-world scenarios, since most of them are trained for general purposes. Thus, the demands for customizing publicly available LLMs emerge, but are currently under-studied. In this work, we consider customizing pre-trained LLMs with new human preferences. Specifically, the LLM should not only meet the new preference but also preserve its original capabilities after customization. Drawing inspiration from the observation that human preference can be expressed as a reward model, we propose to cast LLM customization as optimizing the sum of two reward functions, one of which (denoted as r1) was used to pre-train the LLM while the other (denoted as r2) characterizes the new human preference. The obstacle here is that both reward functions are unknown, making the application of modern reinforcement learning methods infeasible. Thanks to the residual Q-learning framework, we can restore the customized LLM with the pre-trained LLM and the residual Q-function without the reward function r1. Moreover, we find that for a fixed pre-trained LLM, the reward function r2 can be derived from the residual Q-function, enabling us to directly learn the residual Q-function from the new human preference data upon the Bradley-Terry model. We name our method Q-Adapter as it introduces an adapter module to approximate the residual Q-function for customizing the pre-trained LLM towards the new preference. Experiments based on the Llama-3.1 model on the DSP dataset and HH-RLHF dataset illustrate the superior effectiveness of Q-Adapter on both retaining existing knowledge and learning new preferences. Code is available at [github.com/mansicer/Q-Adapter](https://github.com/mansicer/Q-Adapter).

### Disentangling Policy from Offline Task Representation Learning via Adversarial Data Augmentation
Id: offline-task-representation
Authors: Chengxing Jia*, Fuxiang Zhang*, Yi-Chen Li, Chenxiao Gao, Xu-Hui Liu, Lei Yuan, Zongzhang Zhang, and Yang Yu
Venue: International Conference on Autonomous Agents and Multiagent Systems (AAMAS)
Venue short: AAMAS
Year: 2024
Topic: Reinforcement Learning
Paper: https://arxiv.org/abs/2403.07261
Code: https://github.com/LAMDA-RL/ReDA

Offline meta-reinforcement learning (OMRL) proficiently allows an agent to tackle novel tasks while solely relying on a static dataset. For precise and efficient task identification, existing OMRL research suggests learning separate task representations that be incorporated with policy input, thus forming a context-based meta-policy. A major approach to train task representations is to adopt contrastive learning using multi-task offline data. The dataset typically encompasses interactions from various policies (i.e., the behavior policies), thus providing a plethora of contextual information regarding different tasks. Nonetheless, amassing data from a substantial number of policies is not only impractical but also often unattainable in realistic settings. Instead, we resort to a more constrained yet practical scenario, where multi-task data collection occurs with a limited number of policies. We observed that learned task representations from previous OMRL methods tend to correlate spuriously with the behavior policy instead of reflecting the essential characteristics of the task, resulting in unfavorable out-of-distribution generalization. To alleviate this issue, we introduce a novel algorithm to disentangle the impact of behavior policy from task representation learning through a process called adversarial data augmentation. Specifically, the objective of adversarial data augmentation is not merely to generate data analogous to offline data distribution; instead, it aims to create adversarial examples designed to confound learned task representations and lead to incorrect task identification. Our experiments show that learning from such adversarial samples significantly enhances the robustness and effectiveness of the task identification process and realizes satisfactory out-of-distribution generalization.

### Policy Rehearsing: Training Generalizable Policies for Reinforcement Learning
Id: policy-rehearsing
Authors: Chengxing Jia, Chenxiao Gao, Hao Yin, Fuxiang Zhang, Xiyao Chen, Tian Xu, Lei Yuan, Zongzhang Zhang, Zhi-Hua Zhou
Venue: International Conference on Learning Representations (ICLR)
Venue short: ICLR
Year: 2024
Topic: Reinforcement Learning
Paper: https://openreview.net/forum?id=m3xVPaZp6Z

Human beings can make adaptive decisions in a preparatory manner, i.e., by making preparations in advance, which offers significant advantages in scenarios where both online and offline experiences are expensive and limited. Meanwhile, current reinforcement learning methods commonly rely on numerous environment interactions but hardly obtain generalizable policies. In this paper, we introduce the idea of rehearsal into policy optimization, where the agent plans for all possible outcomes in mind and acts adaptively according to actual responses from the environment. To effectively rehearse, we propose ReDM, an algorithm that generates a diverse and eligible set of dynamics models and then rehearse the policy via adaptive training on the generated model set. Rehearsal enables the policy to make decision plans for various hypothetical dynamics and to naturally generalize to previously unseen environments. Our experimental results demonstrate that ReDM is capable of learning a valid policy solely through rehearsal, even with zero interaction data. We further extend ReDM to scenarios where limited or mismatched interaction data is available, and our experimental results reveal that ReDM produces high-performing policies compared to other offline RL baselines.

### Internal Logical Induction for Pixel-Symbolic Reinforcement Learning
Id: logical-induction
Authors: Jiacheng Xu, Chao Chen, Fuxiang Zhang, Lei Yuan, Zongzhang Zhang, Yang Yu
Venue: ACM SIGKDD Conference on Knowledge Discovery and Data Mining (KDD)
Venue short: KDD
Year: 2023
Topic: Reinforcement Learning
Paper: https://dl.acm.org/doi/10.1145/3580305.3599393

Reinforcement Learning (RL) has experienced rapid advancements in recent years. The widely studied RL algorithms mainly focus on a single input form, such as pixel-based image input or symbolic vector input. These two forms have different characteristics and, in many scenarios, will appear together, while few RL algorithms have studied the problems with mixed input types. Specifically, in the scenario where both pixel and symbolic inputs are available, symbolic input usually offers abstract features with specific semantics, which is more conducive to the agent's focus. Conversely, pixel input provides more comprehensive information, enabling the agent to make well-informed decisions. Tailoring the processing approach based on the properties of these two input types can contribute to solving the problem more effectively. To tackle the above issue, we propose an Internal Logical Induction (ILI) framework that integrates deep RL and rule learning into one system. ILI utilizes the deep RL algorithm to process the pixel input and the rule learning algorithm to induce propositional logic knowledge from symbolic input. To efficiently combine these two mechanisms, we further adopt a reward shaping technique by treating valuable knowledge as intrinsic rewards for the RL procedure. Experimental results demonstrate that the ILI framework outperforms baseline approaches in RL problems with pixel-symbolic input, and its inductive knowledge exhibits transferability advantages when pixel input semantics change.

### Policy Regularization with Dataset Constraint for Offline Reinforcement Learning
Id: dataset-constraint
Authors: Yuhang Ran*, Yi-Chen Li*, Fuxiang Zhang, Zongzhang Zhang, and Yang Yu
Venue: International Conference on Machine Learning (ICML)
Venue short: ICML
Year: 2023
Topic: Reinforcement Learning
Paper: https://arxiv.org/abs/2306.06569
Code: https://github.com/LAMDA-RL/PRDC

We consider the problem of learning the best possible policy from a fixed dataset, known as offline Reinforcement Learning (RL). A common taxonomy of existing offline RL works is policy regularization, which typically constrains the learned policy by distribution or support of the behavior policy. However, distribution and support constraints are overly conservative since they both force the policy to choose similar actions as the behavior policy when considering particular states. It will limit the learned policy's performance, especially when the behavior policy is sub-optimal. In this paper, we find that regularizing the policy towards the nearest state-action pair can be more effective and thus propose Policy Regularization with Dataset Constraint (PRDC). When updating the policy in a given state, PRDC searches the entire dataset for the nearest state-action sample and then restricts the policy with the action of this sample. Unlike previous works, PRDC can guide the policy with proper behaviors from the dataset, allowing it to choose actions that do not appear in the dataset along with the given state. It is a softer constraint but still keeps enough conservatism from out-of-distribution actions. Empirical evidence and theoretical analysis show that PRDC can alleviate offline RL's fundamentally challenging value overestimation issue with a bounded performance gap. Moreover, on a set of locomotion and navigation tasks, PRDC achieves state-of-the-art performance compared with existing methods. Code is available at [github.com/LAMDA-RL/PRDC](https://github.com/LAMDA-RL/PRDC)

### Discovering Generalizable Multi-agent Coordination Skills from Multi-task Offline Data
Id: coordination-skills
Authors: Fuxiang Zhang*, Chengxing Jia*, Yi-Chen Li, Lei Yuan, Yang Yu, Zongzhang Zhang
Venue: International Conference on Learning Representations (ICLR)
Venue short: ICLR
Year: 2023
Topic: Multi-Agent RL
Paper: https://openreview.net/forum?id=53FyUAdP7d
Code: https://github.com/LAMDA-RL/ODIS

Cooperative multi-agent reinforcement learning (MARL) faces the challenge of adapting to multiple tasks with varying agents and targets. Previous multi-task MARL approaches require costly interactions to simultaneously learn or fine-tune policies in different tasks. However, the situation that an agent should generalize to multiple tasks with only offline data from limited tasks is more in line with the needs of real-world applications. Since offline multi-task data contains a variety of behaviors, an effective data-driven approach is to extract informative latent variables that can represent universal skills for realizing coordination across tasks. In this paper, we propose a novel Offline MARL algorithm to Discover coordInation Skills (ODIS) from multi-task data. ODIS first extracts task-invariant coordination skills from offline multi-task data and learns to delineate different agent behaviors with the discovered coordination skills. Then we train a coordination policy to choose optimal coordination skills with the centralized training and decentralized execution paradigm. We further demonstrate that the discovered coordination skills can assign effective coordinative behaviors, thus significantly enhancing generalization to unseen tasks. Empirical results in cooperative MARL benchmarks, including the StarCraft multi-agent challenge, show that ODIS obtains superior performance in a wide range of tasks only with offline data from limited sources.

### Multi-Agent Concentrative Coordination with Decentralized Task Representation
Id: concentrative-coordination
Authors: Lei Yuan, Chenghe Wang, Jianhao Wang, Fuxiang Zhang, Feng Chen, Cong Guan, Zongzhang Zhang, Chongjie Zhang, Yang Yu
Venue: International Joint Conference on Artificial Intelligence (IJCAI)
Venue short: IJCAI
Year: 2022
Topic: Multi-Agent RL
Paper: https://www.ijcai.org/proceedings/2022/0085.pdf
Code: https://github.com/DrZero0/MACC

Value-based multi-agent reinforcement learning (MARL) methods hold the promise of promoting coordination in cooperative settings. Popular MARL methods mainly focus on the scalability or the representational capacity of value functions. Such a learning paradigm can reduce agents’ uncertainties and promote coordination. However, they fail to leverage the task structure decomposability, which generally exists in real-world multi-agent systems (MASs), leading to a significant amount of time exploring the optimal policy in complex scenarios. To address this limitation, we propose a novel framework Multi-Agent Concentrative Coordination (MACC) based on task decomposition, with which an agent can implicitly form local groups to reduce the learning space to facilitate coordination. In MACC, agents first learn representations for subtasks from their local information and then implement an attention mechanism to concentrate on the most relevant ones. Thus, agents can pay targeted attention to specific subtasks and improve coordination. Extensive experiments on various complex multi-agent benchmarks demonstrate that MACC achieves remarkable performance compared to existing methods.

### Towards Deployment-Efficient and Collision-Free Multi-Agent Path Finding (Student Abstract)
Id: multi-agent-path-finding
Authors: Feng Chen, Chenghe Wang, Fuxiang Zhang, Haotian Ding, Qiyu Zhong, Shi Pu, Zongzhang Zhang
Venue: AAAI Conference on Artificial Intelligence (AAAI), Student Abstract
Venue short: AAAI
Year: 2023
Topic: Multi-Agent RL
Paper: https://ojs.aaai.org/index.php/AAAI/article/view/26951/26723

Multi-agent pathfinding (MAPF) is essential to large-scale robotic coordination tasks. Planning-based algorithms show their advantages in collision avoidance while avoiding exponential growth in the number of agents. Reinforcementlearning (RL)-based algorithms can be deployed efficiently but cannot prevent collisions entirely due to the lack of hard constraints. This paper combines the merits of planning-based and RL-based MAPF methods to propose a deployment-efficient and collision-free MAPF algorithm. The experiments show the effectiveness of our approach.

### Multi-Agent Incentive Communication via Decentralized Teammate Modeling
Id: incentive-communication
Authors: Lei Yuan*, Jianhao Wang*, Fuxiang Zhang*, Chenghe Wang, Zongzhang Zhang, Yang Yu, and Chongjie Zhang
Venue: AAAI Conference on Artificial Intelligence (AAAI)
Venue short: AAAI
Year: 2022
Topic: Multi-Agent RL
Paper: https://cdn.aaai.org/ojs/21179/21179-13-25192-1-2-20220628.pdf
Code: https://github.com/mansicer/MAIC

Effective communication can improve coordination in cooperative multi-agent reinforcement learning (MARL). One popular communication scheme is exchanging agents’ local observations or latent embeddings and using them to augment individual local policy input. Such a communication paradigm can reduce uncertainty for local decision-making and induce implicit coordination. However, it enlarges agents’ local policy spaces and increases learning complexity, leading to poor coordination in complex settings. To handle this limitation, this paper proposes a novel framework named Multi-Agent Incentive Communication (MAIC) that allows each agent to learn to generate incentive messages and bias other agents’ value functions directly, resulting in effective explicit coordination. Our method firstly learns targeted teammate models, with which each agent can anticipate the teammate’s action selection and generate tailored messages to specific agents. We further introduce a novel regularization to leverage interaction sparsity and improve communication efficiency. MAIC is agnostic to specific MARL algorithms and can be flexibly integrated with different value function factorization methods. Empirical results demonstrate that our method significantly outperforms baselines and achieves excellent performance on multiple cooperative MARL tasks.

### Improving Sample Efficiency of Reinforcement Learning with Background Knowledge from Large Language Models
Id: llm-background-knowledge
Authors: Fuxiang Zhang, Junyou Li, Yi-Chen Li, Zongzhang Zhang, Yang Yu, Deheng Ye
Venue: IEEE Transactions on Neural Networks and Learning Systems (TNNLS)
Venue short: TNNLS
Year: 2025
Topic: Reinforcement Learning
Paper: https://arxiv.org/abs/2407.03964
Code: https://github.com/mansicer/background-knowledge-rl

Low sample efficiency is an enduring challenge of reinforcement learning (RL). With the advent of versatile large language models (LLMs), recent works impart common-sense knowledge to accelerate policy learning for RL processes. However, we note that such guidance is often tailored for one specific task but loses generalizability. In this paper, we introduce a framework that harnesses LLMs to extract background knowledge of an environment, which contains general understandings of the entire environment, making various downstream RL tasks benefit from one-time knowledge representation. We ground LLMs by feeding a few pre-collected experiences and requesting them to delineate background knowledge of the environment. Afterward, we represent the output knowledge as potential functions for potential-based reward shaping, which has a good property for maintaining policy optimality from task rewards. We instantiate three variants to prompt LLMs for background knowledge, including writing code, annotating preferences, and assigning goals. Our experiments show that these methods achieve significant sample efficiency improvements in a spectrum of downstream tasks from Minigrid and Crafter domains.

### Generalizable Multi-Modal Adversarial Imitation Learning for Non-Stationary Dynamics
Id: multi-modal-imitation
Authors: Yi-Chen Li, Ningjing Chao, Zongzhang Zhang, Fuxiang Zhang, Lei Yuan, Yang Yu
Venue: IEEE Transactions on Pattern Analysis and Machine Intelligence (TPAMI)
Venue short: TPAMI
Year: 2025
Topic: Reinforcement Learning
Paper: https://ieeexplore.ieee.org/document/10930709
Code: https://github.com/LAMDA-RL/GMAIL

Imitation Learning (IL) learns from experts, on which most existing studies assume that the imitator will be deployed in stationary environments. However, real-world scenarios commonly involve perturbations, necessitating robust imitators for non-stationary scenarios. To fulfill this, we leverage a multi-modal expert dataset encompassing diverse dynamics, while still adhering to the shared goal between the experts and imitator. Different from conventional multi-modal IL work that considers reproducing the demonstrated different behaviors, we aim to imitate a policy that rapidly adapts to sudden dynamic changes, even when encountering dynamics unseen during training. We propose a method called Generalizable Multi-modal Adversarial Imitation Learning (GMAIL) for non-stationary dynamics, which adversarially trains a discriminator and a generator. Due to dynamic mismatch between the experts and the imitator, the optimal next state for the imitator may require several steps for the experts to reach, inspiring us to propose to take the state-next-state pairs within multiple steps in the demonstrated trajectories to facilitate imitation under dynamic mismatch. For quick identification of the changed dynamic, GMAIL learns a dynamics-sensitive generator by introducing a history-based context encoder. On a wide range of navigation, locomotion and autonomous driving tasks, empirical results illustrate the effectiveness of GMAIL.

### Multiagent Continual Coordination via Progressive Task Contextualization
Id: continual-coordination
Authors: Lei Yuan, Lihe Li, Ziqian Zhang, Fuxiang Zhang, Cong Guan, Yang Yu
Venue: IEEE Transactions on Neural Networks and Learning Systems (TNNLS)
Venue short: TNNLS
Year: 2025
Topic: Multi-Agent RL
Paper: https://arxiv.org/abs/2305.13937
Code: https://github.com/lilh76/MACPro

Cooperative Multi-agent Reinforcement Learning (MARL) has attracted significant attention and played the potential for many real-world applications. Previous arts mainly focus on facilitating the coordination ability from different aspects (e.g., non-stationarity, credit assignment) in single-task or multi-task scenarios, ignoring the stream of tasks that appear in a continual manner. This ignorance makes the continual coordination an unexplored territory, neither in problem formulation nor efficient algorithms designed. Towards tackling the mentioned issue, this paper proposes an approach Multi-Agent Continual Coordination via Progressive Task Contextualization, dubbed MACPro. The key point lies in obtaining a factorized policy, using shared feature extraction layers but separated independent task heads, each specializing in a specific class of tasks. The task heads can be progressively expanded based on the learned task contextualization. Moreover, to cater to the popular CTDE paradigm in MARL, each agent learns to predict and adopt the most relevant policy head based on local information in a decentralized manner. We show in multiple multi-agent benchmarks that existing continual learning methods fail, while MACPro is able to achieve close-to-optimal performance. More results also disclose the effectiveness of MACPro from multiple aspects like high generalization ability.

### Model Gradient: Unified Model and Policy Learning in Model-based Reinforcement Learning
Id: model-gradient
Authors: Chengxing Jia*, Fuxiang Zhang*, Tian Xu, Jing-Cheng Pang, Zongzhang Zhang, and Yang Yu
Venue: Frontiers of Computer Science
Venue short: FCS
Year: 2024
Topic: Reinforcement Learning
Paper: https://link.springer.com/article/10.1007/s11704-023-3150-5

Model-based reinforcement learning is a promising direction to improve the sample efficiency of reinforcement learning with learning a model of the environment. Previous model learning methods aim at fitting the transition data, and commonly employ a supervised learning approach to minimize the distance between the predicted state and the real state. The supervised model learning methods, however, diverge from the ultimate goal of model learning, i.e., optimizing the learned-in-the-model policy. In this work, we investigate how model learning and policy learning can share the same objective of maximizing the expected return in the real environment. We find model learning towards this objective can result in a target of enhancing the similarity between the gradient on generated data and the gradient on the real data. We thus derive the gradient of the model from this target and propose the Model Gradient algorithm (MG) to integrate this novel model learning approach with policy-gradient-based policy optimization. We conduct experiments on multiple locomotion control tasks and find that MG can not only achieve high sample efficiency but also lead to better convergence performance compared to traditional model-based reinforcement learning approaches.
