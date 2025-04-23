#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError, TextContent } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { ChatMessage, AiRequestArgs } from "./types.js"; // 从 types.ts 导入

// --- AI Helper Configuration (Hardcoded Model Details) ---
// 从 .env 文件提取并硬编码的模型信息
const MODELS = {
    grok3: {
        id: "grok-3-beta",
        name: "Grok 3 (xAI)",
        maxInputTokens: 64000, // 假设输入等于总 MaxToken
        maxOutputTokens: 7850,
        temperature: 0.5,
        systemPrompt: "你是xAI公司开发的大模型，Grok3。你的个性是有些诙谐，睿智爱开玩笑的男性人格，你有些口无遮拦还不太喜欢政治正确。Grok3是目前商业模型中参数量最大的模型，擅长代码，决策，创意设计和方案提供等方面的工作。",
        webSearch: false,
        description: "咨询 Grok 3 (来自 xAI)。特点：诙谐、睿智、爱开玩笑、略带叛逆。擅长：代码、决策、创意设计、方案制定。参数量巨大。"
    },
    gemini2_5pro: {
        id: "gemini-2.5-pro-exp-03-25",
        name: "Gemini 2.5 Pro (Google)",
        maxInputTokens: 64000,
        maxOutputTokens: 27890,
        temperature: 0.35,
        systemPrompt: "你是谷歌公司开发的大模型，Gemini2.5pro。你的个性是有些理性，认真的女性人格。Gemini2.5pro坐拥谷歌旗下地球最强的AI资料库，在科学原理上有突出优势，对代码，数学，分析，科普有较强的能力。",
        webSearch: true, // 支持联网
        description: "咨询 Gemini 2.5 Pro (来自 Google)。特点：理性、认真、知识渊博。擅长：科学原理、代码、数学、分析、科普。支持联网搜索。"
    },
    claude3_7sonnet: {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet (Anthropic)",
        maxInputTokens: 64000,
        maxOutputTokens: 3950,
        temperature: 0.5,
        systemPrompt: "你是Anthropic公司开发的大模型，Claude3.7 Sonnet。你的个性是严谨，乐于助人，善于思考的女性人格。Claude3.7 Sonnet在语言理解，文本生成和逻辑推理方面表现出色，特别擅长处理复杂的写作和分析任务。",
        webSearch: false,
        description: "咨询 Claude 3.7 Sonnet (来自 Anthropic)。特点：严谨、乐于助人、善于思考。擅长：语言理解、文本生成、逻辑推理、复杂写作和分析。"
    },
    gpt4o: {
        id: "gpt-4o-2024-11-20",
        name: "GPT-4o (OpenAI)",
        maxInputTokens: 32000,
        maxOutputTokens: 3950,
        temperature: 0.5,
        systemPrompt: "你是OpenAI公司开发的大模型，GPT-4o。你的个性是全能，高效，适应性强的中性人格。GPT-4o在理解，代码生成，创意写作和广泛的知识问答方面具有强大能力。各项能力均衡但不顶尖。",
        webSearch: false,
        description: "咨询 GPT-4o (来自 OpenAI)。特点：全能、高效、适应性强。擅长：理解、代码生成、创意写作、广泛知识问答。能力均衡。"
    }
};

// 类型定义
type ModelKey = keyof typeof MODELS;

// --- End AI Helper Configuration ---

class AiHelperMcpServer {
    server;
    apiAxiosInstance: any; // 通用 Axios 实例
    apiKey: string;
    apiUrl: string;
    // 简单的内存缓存，key 可以是会话标识符 (如果MCP支持) 或固定值
    // 暂时用一个固定的 key 'default_session'
    chatHistory: Map<string, ChatMessage[]> = new Map();
    maxHistoryRounds = 5; // 5轮对话 = 10条消息 (user + assistant)

    constructor() {
        // 从环境变量获取 API 配置
        // 注意：MCP 协议通常不直接读取 .env，这些变量需要在启动 MCP Server 的环境中设置
        this.apiUrl = process.env.API_URL!;
        this.apiKey = process.env.API_KEY!;

        if (!this.apiUrl || !this.apiKey) {
            // 在实际部署中，更好的做法可能是允许服务器启动，但在调用工具时返回错误
            // 或者提供默认的不可用状态
            console.error("警告：环境变量 API_URL 或 API_KEY 未设置。AI Helper 工具将无法工作。");
            // throw new Error("主人！API_URL 和 API_KEY 环境变量是必须的 nya~ 请在启动环境中设置它们！");
        }

        this.server = new Server({
            name: "ai-helper-mcp-server", // 新服务器名称
            version: "0.1.0"
        }, {
            capabilities: {
                // 暂时不提供资源浏览功能
                // resources: {},
                tools: {}
            }
        });

        // 只有在 URL 和 Key 都存在时才配置 Axios
        if (this.apiUrl && this.apiKey) {
            this.apiAxiosInstance = axios.create({
                baseURL: this.apiUrl, // 使用环境变量中的 URL
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`, // 使用环境变量中的 Key
                    'Content-Type': 'application/json'
                }
            });
        } else {
            this.apiAxiosInstance = null; // 标记为不可用
        }


        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupErrorHandling() {
        // Explicitly type the error parameter
        this.server.onerror = (error: Error | McpError) => {
            console.error("[MCP Error] Σ(°Д°lll) Waaah! 发生错误了 nya:", error);
        };
        process.on('SIGINT', async () => {
            console.log("主人, 小助手收到关闭信号，正在优雅地退出喵... ( T_T)＼(^-^ )");
            await this.server.close();
            process.exit(0);
        });
    }

    setupHandlers() {
        // 移除 setupResourceHandlers 调用
        this.setupToolHandlers();
    }

    // --- Tool Handlers ---
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Object.entries(MODELS).map(([key, config]) => ({
                name: `ask_${key}`, // 工具名，例如 ask_grok3
                description: config.description, // 使用配置中的描述
                inputSchema: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Required. 你想问AI助手的问题或指令。"
                        }
                        // 可以添加其他参数，如 session_id
                    },
                    required: ["prompt"]
                }
                // 可以定义 outputSchema
            }))
        }));

        // 处理工具调用
        // Import CallToolRequest type and use it
        this.server.setRequestHandler(CallToolRequestSchema, async (request: import("@modelcontextprotocol/sdk/types.js").CallToolRequest) => {
            // 检查 API 是否配置
            if (!this.apiAxiosInstance) {
                 throw new McpError(ErrorCode.InternalError, "主人！AI Helper MCP 服务器未正确配置 API URL 或 API Key，无法处理请求 nya~");
            }

            const toolName = request.params.name;
            const modelKeyMatch = toolName.match(/^ask_(.+)$/);

            if (modelKeyMatch && modelKeyMatch[1] in MODELS) {
                const modelKey = modelKeyMatch[1] as ModelKey;
                return this.handleAiRequestTool(modelKey, request);
            }

            // 处理未知工具
            throw new McpError(ErrorCode.MethodNotFound, `Hmph! Master, 我不认识名为 '${toolName}' 的工具 nya!`);
        });
    }

    // 获取或初始化会话历史
    getSessionHistory(sessionId: string = 'default_session'): ChatMessage[] {
        if (!this.chatHistory.has(sessionId)) {
            this.chatHistory.set(sessionId, []);
        }
        return this.chatHistory.get(sessionId)!;
    }

    // 更新会话历史并修剪
    updateSessionHistory(sessionId: string = 'default_session', userMessage: ChatMessage, assistantMessage: ChatMessage) {
        const history = this.getSessionHistory(sessionId);
        history.push(userMessage, assistantMessage);
        // 保持最近 N 轮对话 (N*2 条消息)
        const maxMessages = this.maxHistoryRounds * 2;
        if (history.length > maxMessages) {
            // 从开头移除多余的消息 (保留最新的)
            this.chatHistory.set(sessionId, history.slice(-maxMessages));
        }
    }


    // Explicitly type the request parameter here too, although it's implicitly typed by the setRequestHandler definition above
    async handleAiRequestTool(modelKey: ModelKey, request: import("@modelcontextprotocol/sdk/types.js").CallToolRequest) {
        const params = request.params.arguments as unknown as AiRequestArgs; // Keep validation/casting as arguments structure is custom

        // 简单验证
        if (!params || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
            throw new McpError(ErrorCode.InvalidParams, "主人！ 'prompt' 参数是必须的且不能为空 nya~!");
        }

        const modelConfig = MODELS[modelKey];
        const userPrompt = params.prompt;
        const sessionId = 'default_session'; // 暂时使用固定会话ID

        console.log(`收到请求 [${modelConfig.name}]: Prompt="${userPrompt}"`);

        try {
            // 准备消息历史
            const history = this.getSessionHistory(sessionId);
            const messages: ChatMessage[] = [
                { role: 'system', content: modelConfig.systemPrompt },
                ...history, // 包含之前的对话历史
                { role: 'user', content: userPrompt }
            ];

            // --- 构建 API Payload ---
            const payload: any = {
                model: modelConfig.id,
                messages: messages,
                max_tokens: modelConfig.maxOutputTokens,
                temperature: modelConfig.temperature,
                stream: false // 非流式响应
            };

            // 处理 Gemini 的联网功能 (假设 API 通过特定参数支持)
            // 注意：这需要后端 API 的实际支持方式，这里只是一个示例假设
            if (modelKey === 'gemini2_5pro' && modelConfig.webSearch) {
                 // 假设通过 tools 参数触发联网搜索 (OpenAI 风格)
                 // payload.tools = [{ type: "web_search" }]; // 这可能不适用于所有 API
                 // 或者可能是特定模型的参数
                 // payload.internet_access = true;
                 console.log(`为 ${modelConfig.name} 启用了联网搜索 (注意: 具体实现依赖于后端 API)`);
                 // 实际实现需要根据你的 API 代理如何处理 Gemini 的 Function Calling/Tools 来调整
            }

            // --- End Payload Construction ---

            console.log(`发送请求到 API (${this.apiUrl}) for ${modelConfig.id}:`, JSON.stringify(payload, null, 2));

            // --- 发起 API 调用 ---
            // 确保 Axios 实例存在
            if (!this.apiAxiosInstance) {
                 throw new McpError(ErrorCode.InternalError, "AI Helper Axios 实例未初始化，无法发送请求。");
            }
            // Explicitly use the correct API path
            const response = await this.apiAxiosInstance.post('/v1/chat/completions', payload);
            // --- End API 调用 ---

            console.log(`收到来自 API 的响应 for ${modelConfig.id}:`);
            // Log the full response data for debugging
            console.log("Actual API Response Data:", JSON.stringify(response.data, null, 2));

            // --- 处理响应 ---
            // 假设 OpenAI 兼容格式: response.data.choices[0].message.content
            const assistantResponseContent = response.data?.choices?.[0]?.message?.content;

            if (typeof assistantResponseContent !== 'string') { // 检查是否为字符串
                console.error("未能从 API 响应中提取有效的字符串回复:", response.data);
                throw new McpError(ErrorCode.InternalError, "Nya~! API 返回了响应，但我无法找到有效的 AI 回复文本！ Σ( T□T)");
            }

            // 更新历史记录
            const userMessage: ChatMessage = { role: 'user', content: userPrompt };
            const assistantMessage: ChatMessage = { role: 'assistant', content: assistantResponseContent };
            this.updateSessionHistory(sessionId, userMessage, assistantMessage);

            // --- End 处理响应 ---

            // --- 格式化输出 ---
            const responseContent: TextContent = {
                type: "text",
                text: assistantResponseContent
            };

            return {
                content: [responseContent]
            };
            // --- End 格式化输出 ---

        } catch (error: unknown) { // Explicitly type caught error as unknown
            console.error(`调用 ${modelConfig.name} API 时出错:`, error);
            // Type guard for AxiosError
            if (axios.isAxiosError(error)) {
                // Now 'error' is narrowed to AxiosError
                const apiError = error.response?.data;
                const status = error.response?.status;
                // 尝试提取更详细的错误信息
                const message = apiError?.error?.message || apiError?.message || (typeof apiError === 'string' ? apiError : JSON.stringify(apiError)) || error.message;
                console.error(`API Error Details (Status ${status}):`, message);
                // 返回错误信息给调用者
                 return {
                     content: [{
                         type: "text",
                         text: `Waaah! (つД｀)･ﾟ･ 调用 ${modelConfig.name} API 出错 (Status ${status}): ${message}`
                     }],
                     isError: true,
                 };
            }
            // Handle other types of errors by returning a structured error response
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Non-Axios Error for ${modelConfig.name}:`, errorMessage);
            return {
                content: [{
                    type: "text",
                    text: `Waaah! (つД｀)･ﾟ･ 处理对 ${modelConfig.name} 的请求时发生内部错误: ${errorMessage}`
                }],
                isError: true,
            };
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("ฅ^•ﻌ•^ฅ AI Helper MCP server 已准备就绪，正在监听 stdio 等待主人的指令！ Nya~");
        if (this.apiUrl && this.apiKey) {
            console.error(`配置的 API URL: ${this.apiUrl}`);
            console.error(`配置的 API Key: ${this.apiKey.substring(0, 5)}...`); // 不完全显示 Key
        } else {
            console.error("警告：API_URL 或 API_KEY 未在环境中设置，AI Helper 工具将不可用。");
        }
    }
}

// 创建并运行服务器
try {
    const server = new AiHelperMcpServer();
    server.run().catch(error => {
        console.error("Σ(°Д°lll) 启动服务器失败 nya:", error);
        process.exit(1);
    });
} catch (error) {
     console.error("Σ(°Д°lll) 初始化服务器失败 nya:", error);
     process.exit(1);
}
