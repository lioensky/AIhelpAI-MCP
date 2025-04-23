// types.ts
// 后续可以根据需要添加新的类型定义，例如 ChatMessage, AiRequestArgs 等

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AiRequestArgs {
    prompt: string;
    // 可以添加 session_id 等可选参数
    // sessionId?: string;
}
