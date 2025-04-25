import { AIMessage, HumanMessage, SystemMessage, ToolMessage, MessageFieldWithRole } from '@langchain/core/messages';
import { Message, StateType, ToolToCall, toLangChainMessage } from './types';
import { createOllamaClient } from '../utils/ollama';
import { TOOLS, executeTool } from './tools';
import { MessageContent } from '@langchain/core/messages';
import { StateAnnotation } from './graph';
import { END } from '@langchain/langgraph';

// System prompt
const SYSTEM_PROMPT = `You are a helpful AI assistant that can use tools to answer user queries.
You have access to the following tools:
{tools_description}

Respond directly to the user when you know the answer or when no tool is needed.
When you need to use a tool to answer the user's query, request to use the tool.
Don't make up information or pretend to use tools when you don't need to.`;

// Function to generate the system message with tools description
function generateSystemMessage(): SystemMessage {
  const toolsDescription = TOOLS.map(tool => {
    return `${tool.name}: ${tool.description}`;
  }).join('\n');
  
  return new SystemMessage({
    content: SYSTEM_PROMPT.replace('{tools_description}', toolsDescription)
  });
}

/**
 * Helper function to convert MessageFieldWithRole to compatible Message type
 * This resolves the type mismatch with toLangChainMessage
 */
function convertToMessage(message: MessageFieldWithRole): Message {
  // Convert the role to a compatible type
  const role = message.role === 'function' ? 'tool' : 
               (message.role as 'user' | 'assistant' | 'system' | 'tool');
  
  return {
    role,
    content: typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content),
    name: message.name,
  };
}

/**
 * Node to get the response from the model
 * @param state Current state of the agent
 * @returns Updated state with model response
 */
export async function getModelResponse(
  state: typeof StateAnnotation.State
): Promise<Partial<typeof StateAnnotation.State>> {
  const ollama = createOllamaClient(TOOLS);
  
  // Extract messages from state
  let messagesArray = [...state.messages_with_role];
  
  // If this is the first message, add the system message
  if (messagesArray.length === 1 && messagesArray[0].role === 'user') {
    const systemMsg = generateSystemMessage();
    messagesArray = [
      { role: 'system', content: systemMsg.content as string },
      ...messagesArray
    ];
  }

  // Convert MessageFieldWithRole to Message, then to LangChain message format
  const langchainMessages = messagesArray.map(msg => {
    const compatibleMsg = convertToMessage(msg);
    return toLangChainMessage(compatibleMsg);
  });

  // Get response from model
  const response = await ollama.invoke(langchainMessages);
  
  // Parse tool calls if present
  const toolCalls: ToolToCall[] = [];
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      toolCalls.push({
        id: toolCall.id || `tool-${Date.now()}`,
        name: toolCall.name,
        args: toolCall.args,
      });
    }
  }

  // Convert response content to string if needed
  const contentAsString = typeof response.content === 'string' 
    ? response.content 
    : JSON.stringify(response.content);

  // Update state
  return {
    messages_with_role: [
      ...messagesArray,
      {
        role: 'assistant',
        content: contentAsString,
      }
    ],
    tools_to_call: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

/**
 * Function to decide whether to call a tool or end
 * @param state Current state of the agent
 * @returns "call_tool" or END constant
 */
export function routeToTool(
  state: typeof StateAnnotation.State
): "call_tool" | typeof END {
  if (state.tools_to_call && state.tools_to_call.length > 0) {
    return "call_tool";
  }
  return END;
}

/**
 * Node to execute a tool call
 * @param state Current state of the agent
 * @returns Updated state with tool execution result
 */
export async function callTool(
  state: typeof StateAnnotation.State
): Promise<Partial<typeof StateAnnotation.State>> {
  if (!state.tools_to_call || state.tools_to_call.length === 0) {
    return state;
  }

  // Get the next tool to call
  const toolToCall = state.tools_to_call[0];
  const remainingTools = state.tools_to_call.slice(1);
  
  // Execute the tool
  const toolResult = await executeTool(toolToCall);
  
  // Update state with tool result
  return {
    messages_with_role: [
      ...state.messages_with_role,
      {
        role: 'tool',
        content: toolResult,
        name: toolToCall.name,
      }
    ],
    tools_to_call: remainingTools.length > 0 ? remainingTools : undefined,
    tool_call_id: toolToCall.id,
    current_tool_call: toolToCall,
  };
}