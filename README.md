# content-creator-cli

一个面向内容创作者的命令行工具，围绕实际工作流程设计，帮助你用 AI 保持个人风格、提高内容生产效率。

## 核心特点

**工作流驱动**：命令按照创作者的实际工作流程设计，从选题、大纲、初稿到标题形成完整的内容生产管线。

**声音风格系统**：可以从你的历史文本样本中学习写作风格，生成新内容时自动应用这种风格，确保输出「像你写的」。

**多模型支持**：支持 OpenAI、Kimi、Anthropic、GLM、Gemini、OpenRouter、Qwen、DeepSeek 等多个 AI 提供商。

**本地优先**：所有生成内容存储在本地 `.creator/` 目录，你的配置、风格档案、内容资产完全可控。

## 安装

```bash
# 确保 Node.js 20+
node --version

# 全局安装
npm install -g content-creator-cli

# 或使用 npx (无需安装)
npx content-creator-cli init
```

安装完成后，直接使用 `creator` 命令：

```bash
creator init
creator topic "为什么普通人做自媒体总是断更" --platform xiaohongshu
```

## 快速开始

```bash
# 初始化配置
creator init

# 设置 AI 提供商（以 OpenRouter 为例）
creator profile provider openrouter --enable --model openai/gpt-4.1-mini
export OPENROUTER_API_KEY=你的密钥

# 测试连接
creator providers test

# 开始创作
creator topic "为什么普通人做自媒体总是断更" --platform xiaohongshu
```

## 内容生产流程

### 1. 选题 - topic

从模糊想法生成结构化选题卡片，包含受众分析、切入角度、开头钩子、系列延伸等。

```bash
creator topic "为什么普通人做自媒体总是断更" --platform xiaohongshu --tone direct
```

选项：
- `--platform` 目标平台（小红书、抖音、公众号等）
- `--niche` 内容领域
- `--tone` 语气风格
- `--audience` 目标受众

### 2. 大纲 - outline

基于选题生成内容大纲。

```bash
creator outline "为什么普通人做自媒体总是断更"
```

### 3. 初稿 - draft

生成 markdown 格式的完整初稿。

```bash
creator draft "为什么普通人做自媒体总是断更" --voice xiaoqi
```

选项：
- `--voice` 应用声音风格

### 4. 标题 - title

生成多个标题选项供选择。

```bash
creator title "为什么普通人做自媒体总是断更"
```

## 声音风格系统

这是本工具的核心功能。声音风格是从你的历史文本中学习到的写作特征，生成新内容时会自动应用。

### 创建和训练风格

```bash
# 初始化一个声音风格
creator voice init xiaoqi

# 从样本文本中学习风格
creator voice train xiaoqi ./samples

# 查看风格档案
creator voice show xiaoqi

# 设为默认风格
creator voice use xiaoqi
```

### 编辑风格字段

```bash
# 编辑身份定位
creator voice edit xiaoqi identity 内容创业者

# 编辑核心理念
creator voice edit xiaoqi coreBeliefs 少空话,先行动,先验证

# 编辑禁用表达
creator voice edit xiaoqi bannedPhrases "总的来说,基本上,实际上"
```

可编辑的字段：
- `description` 描述
- `identity` 身份定位
- `audience` 目标受众
- `coreBeliefs` 核心理念
- `bannedPhrases` 禁用表达
- `signaturePhrases` 标志性表达
- `structurePatterns` 结构习惯
- `styleFingerprint.tone` 语气
- `styleFingerprint.sentenceStyle` 句式风格
- `styleFingerprint.openingStyle` 开头风格
- `styleFingerprint.closingStyle` 结尾风格
- `styleFingerprint.rhythm` 节奏
- `styleFingerprint.emotionalTemperature` 情绪温度

### 风格审核和改进

```bash
# 审核文稿与风格的匹配度
creator voice audit xiaoqi ./draft.md

# 自动改进文稿以更贴近风格
creator voice improve xiaoqi ./draft.md
```

## 配置管理

### 查看和修改配置

```bash
# 查看当前配置
creator profile show

# 设置默认平台
creator profile set defaultPlatform 抖音

# 设置默认风格
creator profile set defaultVoice xiaoqi
```

### AI 提供商管理

```bash
# 列出所有提供商
creator providers list

# 切换默认提供商
creator providers use qwen

# 测试提供商连接
creator providers test
creator providers test openrouter
```

支持的提供商：
- OpenAI
- Kimi（月之暗面）
- Anthropic
- GLM（智谱）
- Google Gemini
- OpenRouter
- Qwen（通义千问）
- DeepSeek

对应的环境变量：
- `OPENAI_API_KEY`
- `MOONSHOT_API_KEY`
- `ANTHROPIC_API_KEY`
- `ZHIPUAI_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `DASHSCOPE_API_KEY`
- `DEEPSEEK_API_KEY`

## 其他功能

### 内容资产库 - library

管理你的内容资产，如核心选题、系列内容等。

```bash
# 列出所有资产
creator library list

# 添加核心选题
creator library add pillar 选题拆解

# 添加系列
creator library add series 7天内容挑战

# 移除资产
creator library remove banned 自媒体秘籍
```

### 内容改写 - repurpose

将现有内容改写为适合其他平台的版本。

```bash
creator repurpose ./.creator/outputs/example.md --to douyin --voice xiaoqi
```

### 发布日历 - calendar

基于主题生成未来几天的发布计划。

```bash
creator calendar "个人成长内容矩阵" --days 7 --platform xiaohongshu
```

### 交互模式 - chat

进入简单的交互式对话环境。

```bash
creator chat
```

## 文件存储结构

所有生成的文件存储在 `.creator/` 目录：

```
.creator/
├── profile.json          # 配置文件
├── library.json          # 内容资产
├── providers.json        # AI 提供商配置
├── voices/               # 声音风格档案
│   └── xiaoqi.json
└── outputs/              # 生成的内容
    ├── topic-xxx.json
    ├── draft-xxx.md
    └── ...
```

## 设计理念

- **工作流优先**：命令对应创作者的实际产出目标，而非模型的 API 原语
- **本地优先**：所有输出写入本地文件，你拥有完整的数据控制权
- **上下文感知**：配置和默认值存储在 profile 中，减少重复输入
- **风格感知**：创作者的声音风格可以训练、审核和复用

## License

MIT

## 链接

- npm: https://www.npmjs.com/package/content-creator-cli
- GitHub: https://github.com/Lotus-7/creator-cli
