import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
};

export interface StateType {
  messages: Message[];
  tools_to_call?: ToolToCall[];
  tool_call_id?: string;
  tool_outputs?: Record<string, any>;
  current_tool_call?: ToolToCall;
}

export interface ToolToCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
}

// Mapping between our message format and LangChain's message format
export function toLangChainMessage(message: Message): BaseMessage {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else if (message.role === 'system') {
    return new SystemMessage(message.content);
  } else if (message.role === 'tool') {
    return new ToolMessage({
      content: message.content,
      name: message.name || '',
      tool_call_id: '',
    });
  }
  
  // Default to human message if role is unknown
  return new HumanMessage(message.content);
}