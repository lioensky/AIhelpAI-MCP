# AI Helper MCP 服务器

这是一个基于 Model Context Protocol (MCP) 的服务器，允许 AI 代理通过 MCP 协议向其他配置好的大型语言模型（LLM）请求帮助或咨询。

## 功能特点

-   **多模型支持**: 内置配置了对多种流行 LLM 的访问（例如 Grok, Gemini, Claude, GPT-4o）。
-   **动态工具列表**: MCP 服务器会自动列出所有可用的 AI 助手作为独立的工具（例如 `ask_grok3`, `ask_gemini2_5pro`）。
-   **统一接口**: 通过标准的 OpenAI 兼容 API 格式与后端 AI 模型交互。
-   **对话历史**: 维护简单的内存对话历史（最近 5 轮），为每个模型提供上下文。
-   **环境配置**: 通过环境变量配置后端 API 代理的 URL 和 Key。

## 系统要求

-   Node.js v18.0.0 或更高版本

您可以通过以下命令验证 Node.js 安装：

```bash
node --version  # 应显示v18.0.0或更高版本
```

## 安装步骤

1.  克隆或下载本项目代码。
2.  进入项目根目录。
3.  安装依赖：

    ```bash
    npm install
    ```

4.  构建项目：

    ```bash
    npm run build
    ```

    (注意: `npm install` 通常会自动触发 `npm run build`)

## 配置说明 (客户端)

此 MCP 服务器本身**不**读取 `.env` 文件。您需要在**启动此 MCP 服务器的客户端应用程序**（例如您的 AI 聊天界面或 MCP 管理工具）中配置以下环境变量：

1.  **`API_URL`**: 指向您的 OpenAI 兼容 API 代理服务器的 **基础 URL** (例如: `http://localhost:3000`)。服务器代码会自动添加 `/v1/chat/completions` 路径。
2.  **`API_KEY`**: 用于访问您的 API 代理的密钥 (例如: `sk-xxxxxxxx`)。

### 客户端配置示例 (例如在 VS Code MCP 插件中)

在您的客户端 MCP 服务器配置界面（类似于您截图中的界面）：

-   **名称**: 给这个服务器起个名字，例如 `求助AI`。
-   **描述**: 简要描述，例如 `让 AI 去求助别的 AI`。
-   **类型**: 选择 `标准输入/输出 (stdio)`。
-   **命令**: 输入 `node`。
-   **参数**: 输入指向本项目 **编译后** 的 `index.js` 文件的 **绝对路径**。例如: `实际地址\AIHelpAI-MCP\build\index.js` (请根据您的实际路径修改)。
-   **环境变量**:
    -   添加 `API_URL`，值为您的 API 代理 URL (例如 `http://localhost:3000`)。
    -   添加 `API_KEY`，值为您的 API 密钥 (例如 `sk-xxxxxxxx`)。

保存配置后，客户端应该能够启动并连接到这个 MCP 服务器。

## 使用方法

配置并启动服务器后，连接到此 MCP 服务器的 AI 代理将看到一系列可用的工具，格式为 `ask_<model_key>`，例如：

-   `ask_grok3`
-   `ask_gemini2_5pro`
-   `ask_claude3_7sonnet`
-   `ask_gpt4o`

每个工具的描述会说明该 AI 助手的特点和擅长领域。

调用工具时，只需提供一个参数：

-   `prompt` (string, required): 您想向该 AI 助手提出的问题或指令。

服务器将使用配置的 API URL 和 Key，结合内置的模型参数和对话历史，向对应的模型发出请求，并将回复返回给调用方。

## 开发者工具

您可以使用 MCP Inspector 工具来测试服务器（如果已全局安装或使用 npx）：

```bash
# 确保设置了 API_URL 和 API_KEY 环境变量
npx @modelcontextprotocol/inspector build/index.js
# 或者，如果全局安装了
mcp-inspector build/index.js
```

## 许可证

请参阅项目仓库中的许可证文件。
