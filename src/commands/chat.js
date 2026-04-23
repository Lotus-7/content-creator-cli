import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadContext } from "../lib/storage.js";
import { generateWithProvider } from "../lib/providers.js";
import { formatTopicCard, formatOutline, formatDraft, formatTitles, printError, printHeader, startSpinner, stopSpinner, printProviderInfo } from "../lib/ui.js";
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
4. 在用户需要时引导使用完整工作流

用户可能会问你关于选题、大纲、表达方式等问题，请以对话方式自然回答。`;

export async function runChat() {
  const context = await loadContext();
  const rl = readline.createInterface({ input, output });

  console.log("\n  Creator Chat\n");
  console.log("  可用命令:");
  console.log("    /topic <想法>   - 生成选题卡片");
  console.log("    /outline <想法> - 生成大纲");
  console.log("    /draft <想法>   - 生成初稿");
  console.log("    /title <想法>   - 生成标题");
  console.log("    /ask <问题>     - 自由对话");
  console.log("    /exit           - 退出");
  console.log("\n  直接输入内容默认执行 /topic + /title\n");

  let chatHistory = [];

  while (true) {
    const line = (await rl.question("\n> ")).trim();

    if (!line) continue;
    if (line === "/exit" || line === "quit" || line === "exit") {
      rl.close();
      console.log(" 再见！");
      return;
    }

    const [command, ...rest] = line.split(" ");
    const payload = rest.join(" ").trim();
    const idea = command.startsWith("/") ? payload : line;

    if (!idea && command !== "/chat") {
      printError("请输入内容");
      continue;
    }

    try {
      const provider = context.profile.aiProvider;
      const model = context.profile.aiModel;
      printProviderInfo(provider, model);

      switch (command) {
        case "/topic": {
          startSpinner("正在生成选题卡片...");
          const result = await generateTopic(context, { idea, voiceName: context.profile.defaultVoice });
          stopSpinner("选题卡片生成完成！", true);
          formatTopicCard(result.data);
          break;
        }
        case "/outline": {
          startSpinner("正在生成大纲...");
          const result = await generateOutline(context, { idea, voiceName: context.profile.defaultVoice });
          stopSpinner("大纲生成完成！", true);
          formatOutline(result.data);
          break;
        }
        case "/draft": {
          startSpinner("正在生成初稿...");
          const result = await generateDraft(context, { idea, voiceName: context.profile.defaultVoice });
          stopSpinner("初稿生成完成！", true);
          formatDraft(result.data);
          break;
        }
        case "/title": {
          startSpinner("正在生成标题...");
          const result = await generateTitles(context, { idea, voiceName: context.profile.defaultVoice });
          stopSpinner("标题生成完成！", true);
          formatTitles(result.data);
          break;
        }
        case "/ask":
        case "/chat": {
          if (!idea) {
            printError("请输入问题");
            break;
          }
          startSpinner("思考中...");

          // 构建对话历史字符串
          let conversationHistory = "";
          if (chatHistory.length > 0) {
            conversationHistory = "\n\n对话历史:\n" + chatHistory.map(m => {
              const role = m.role === "user" ? "用户" : "助手";
              return `${role}: ${m.content}`;
            }).join("\n");
          }

          const userPrompt = idea + conversationHistory;
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
            { role: "user", content: idea },
            { role: "assistant", content: response }
          );
          break;
        }
        default: {
          // 默认执行 topic + title
          startSpinner("正在生成...");
          const topicResult = await generateTopic(context, { idea, voiceName: context.profile.defaultVoice });
          const titleResult = await generateTitles(context, { idea, voiceName: context.profile.defaultVoice });
          stopSpinner("生成完成！", true);

          formatTopicCard(topicResult.data);
          formatTitles(titleResult.data);
          break;
        }
      }
    } catch (error) {
      stopSpinner("生成失败", false);
      printError(error.message);
    }
  }
}
