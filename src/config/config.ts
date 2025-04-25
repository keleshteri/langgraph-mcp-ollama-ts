import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Ollama Configuration
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    modelName: process.env.OLLAMA_MODEL_NAME || 'mistral:latest',
  },
  
  // MCP Server Configuration
  mcp: {
    port: parseInt(process.env.MCP_PORT || '8000', 10),
  },
};