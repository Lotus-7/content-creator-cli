import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadContext } from "../lib/storage.js";
import { generateWithProvider } from "../lib/providers.js";
import { formatTopicCard, formatOutline, formatDraft, formatTitles, printError, startSpinner, stopSpinner, printProviderInfo } from "../lib/ui.js";
import { generateDraft, generateOutline, generateTitles, generateTopic } from "../lib/content-engine.js";

// 自由对话提示词
const CHAT_SYSTEM_PROMPT = `你是一位内容创作助手，擅长帮助创作者思考选题、优化表达、提供灵感。

对话风格：
- 简洁直接，避免空话套话
- 多用提问引导用户深入思考
- 可以给具体例子，但不啰嗦
- 保持友好、鼓励的语气

你的角色：
1. 帮助用户梳理创作想法
2. 针对内容提供建议
3. 回答关于创作的问题
4. 在对话成熟时主动建议生成内容

重要：当你觉得话题已经讨论得比较充分，可以主动询问：
"需要我帮你整理成完整稿子吗？"
"要生成大纲吗？"
"要生成一些标题选项吗？"

但不要每次都问，只在合适的时机提出。`;

// 检测用户意图的命令
function detectCommandIntent(text, lastTopic) {
  // 显式命令
  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(" ");
    const payload = rest.join(" ").trim();
    return { type: "explicit", command: cmd, idea: payload || lastTopic };
  }

  // 检测生成初稿意图
  const draftKeywords = ["写成", "变成", "生成初稿", "写稿", "写文章", "写完整", "整理成稿", "展开成", "扩写成"];
  for (const kw of draftKeywords) {
    if (text.includes(kw)) {
      return { type: "draft", idea: lastTopic };
    }
  }

  // 检测生成大纲意图
  const outlineKeywords = ["生成大纲", "列大纲", "写大纲", "大纲", "框架", "结构"];
  for (const kw of outlineKeywords) {
    if (text.includes(kw)) {
      return { type: "outline", idea: lastTopic };
    }
  }

  // 检测生成标题意图
  const titleKeywords = ["生成标题", "起标题", "标题", "拟标题"];
  for (const kw of titleKeywords) {
    if (text.includes(kw)) {
      return { type: "title", idea: lastTopic };
    }
  }

  // 检测生成选题意图
  const topicKeywords = ["生成选题", "选题卡", "分析选题"];
  for (const kw of topicKeywords) {
    if (text.includes(kw)) {
      return { type: "topic", idea: lastTopic };
    }
  }

  // 默认是自由对话
  return { type: "chat", idea: text };
}

// 检测用户确认
function isConfirmation(text) {
  const confirmWords = ["好的", "可以", "行", "嗯", "要", "需要", "是", "ok", "yes", "当然", "来吧", "开始"];
  return confirmWords.some(w => text.toLowerCase().includes(w)) && text.length < 10;
}

export async function runChat() {
  const context = await loadContext();
  const rl = readline.createInterface({ input, output });

  console.log("\n  Creator Chat\n");
  console.log("  直接输入内容开始对话");
  console.log("  可用命令:");
  console.log("    /draft   - 生成初稿");
  console.log("    /outline - 生成大纲");
  console.log("    /title   - 生成标题");
  console.log("    /topic   - 生成选题卡片");
  console.log("    /exit    - 退出\n");

  let chatHistory = [];
  let lastTopic = "";
  let pendingAction = null; // 等待用户确认的操作

  while (true) {
    const line = (await rl.question("\n> ")).trim();

    if (!line) continue;
    if (line === "/exit" || line === "quit" || line === "exit") {
      rl.close();
      console.log(" 再见！");
      return;
    }

    try {
      const provider = context.profile.aiProvider;
      const model = context.profile.aiModel;

      // 处理待确认的操作
      if (pendingAction && isConfirmation(line)) {
        printProviderInfo(provider, model);

        const { type, idea } = pendingAction;
        pendingAction = null;

        switch (type) {
          case "draft": {
            startSpinner("正在生成初稿...");
            const result = await generateDraft(context, { idea, voiceName: context.profile.defaultVoice });
            stopSpinner("初稿生成完成！", true);
            formatDraft(result.data);
            break;
          }
          case "outline": {
            startSpinner("正在生成大纲...");
            const result = await generateOutline(context, { idea, voiceName: context.profile.defaultVoice });
            stopSpinner("大纲生成完成！", true);
            formatOutline(result.data);
            break;
          }
          case "title": {
            startSpinner("正在生成标题...");
            const result = await generateTitles(context, { idea, voiceName: context.profile.defaultVoice });
            stopSpinner("标题生成完成！", true);
            formatTitles(result.data);
            break;
          }
          case "topic": {
            startSpinner("正在生成选题卡片...");
            const result = await generateTopic(context, { idea, voiceName: context.profile.defaultVoice });
            stopSpinner("选题卡片生成完成！", true);
            formatTopicCard(result.data);
            break;
          }
        }
        continue;
      }

      // 取消待确认的操作
      if (pendingAction && !isConfirmation(line)) {
        pendingAction = null;
      }

      // 检测用户意图
      const intent = detectCommandIntent(line, lastTopic);
      printProviderInfo(provider, model);

      // 更新话题
      if (intent.idea && intent.type === "chat") {
        lastTopic = intent.idea;
      } else if (intent.idea && intent.type !== "chat") {
        lastTopic = intent.idea;
      }

      switch (intent.type) {
        case "explicit": {
          const cmd = intent.command;
          if (cmd === "/exit") {
            rl.close();
            console.log(" 再见！");
            return;
          }
          if (cmd === "/draft" && intent.idea) {
            startSpinner("正在生成初稿...");
            const result = await generateDraft(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
            stopSpinner("初稿生成完成！", true);
            formatDraft(result.data);
            break;
          }
          if (cmd === "/outline" && intent.idea) {
            startSpinner("正在生成大纲...");
            const result = await generateOutline(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
            stopSpinner("大纲生成完成！", true);
            formatOutline(result.data);
            break;
          }
          if (cmd === "/title" && intent.idea) {
            startSpinner("正在生成标题...");
            const result = await generateTitles(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
            stopSpinner("标题生成完成！", true);
            formatTitles(result.data);
            break;
          }
          if (cmd === "/topic" && intent.idea) {
            startSpinner("正在生成选题卡片...");
            const result = await generateTopic(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
            stopSpinner("选题卡片生成完成！", true);
            formatTopicCard(result.data);
            break;
          }
          // 未知命令，当作聊天
          startSpinner("思考中...");
        }
        // fallthrough to chat
        case "chat": {
          if (!intent.idea) {
            printError("请输入内容");
            break;
          }
          startSpinner("思考中...");

          // 构建对话历史
          let conversationHistory = "";
          if (chatHistory.length > 0) {
            conversationHistory = "\n\n对话历史:\n" + chatHistory.map(m => {
              const role = m.role === "user" ? "用户" : "助手";
              return `${role}: ${m.content}`;
            }).join("\n");
          }

          const userPrompt = intent.idea + conversationHistory;
          const result = await generateWithProvider({
            providers: context.providers,
            profile: context.profile,
            task: {
              system: CHAT_SYSTEM_PROMPT,
              user: userPrompt
            }
          });
          stopSpinner("", true);
          const response = result.text;
          console.log(`\n${response}`);
          chatHistory.push(
            { role: "user", content: intent.idea },
            { role: "assistant", content: response }
          );
          break;
        }
        case "draft": {
          if (!intent.idea) {
            printError("没有可以继续的话题，请先输入一个想法");
            break;
          }
          startSpinner("正在生成初稿...");
          const result = await generateDraft(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
          stopSpinner("初稿生成完成！", true);
          formatDraft(result.data);
          break;
        }
        case "outline": {
          if (!intent.idea) {
            printError("没有可以继续的话题，请先输入一个想法");
            break;
          }
          startSpinner("正在生成大纲...");
          const result = await generateOutline(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
          stopSpinner("大纲生成完成！", true);
          formatOutline(result.data);
          break;
        }
        case "title": {
          if (!intent.idea) {
            printError("没有可以继续的话题，请先输入一个想法");
            break;
          }
          startSpinner("正在生成标题...");
          const result = await generateTitles(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
          stopSpinner("标题生成完成！", true);
          formatTitles(result.data);
          break;
        }
        case "topic": {
          if (!intent.idea) {
            printError("没有可以继续的话题，请先输入一个想法");
            break;
          }
          startSpinner("正在生成选题卡片...");
          const result = await generateTopic(context, { idea: intent.idea, voiceName: context.profile.defaultVoice });
          stopSpinner("选题卡片生成完成！", true);
          formatTopicCard(result.data);
          break;
        }
      }
    } catch (error) {
      stopSpinner("生成失败", false);
      printError(error.message);
    }
  }
}
