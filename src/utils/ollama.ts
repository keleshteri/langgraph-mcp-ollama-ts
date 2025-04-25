import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { ToolDefinition } from '../agent/types';

export function createOllamaClient(tools: ToolDefinition[] = []) {
  // Get configuration from environment variables
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const modelName = process.env.OLLAMA_MODEL_NAME || 'mistral:latest';

  // Create and configure the Ollama client
  const ollama = new ChatOllama({
    baseUrl,
    model: modelName,
    temperature: 0.1,
    format: 'json',
  });

  // If there are tools, add them as a property
  if (tools.length > 0) {
    (ollama as any).tools = tools;
  }

  return ollama;
}