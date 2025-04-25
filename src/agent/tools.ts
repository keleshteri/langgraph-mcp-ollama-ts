import { ToolDefinition, ToolToCall } from './types';

// Define a simple calculator tool
export const calculator: ToolDefinition = {
  name: 'calculator',
  description: 'A calculator tool that can perform basic arithmetic operations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The arithmetic operation to perform',
      },
      a: {
        type: 'number',
        description: 'The first operand',
      },
      b: {
        type: 'number',
        description: 'The second operand',
      },
    },
    required: ['operation', 'a', 'b'],
  },
};

// Define a simple weather tool
export const weather: ToolDefinition = {
  name: 'weather',
  description: 'Get current weather information for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state/country, e.g., "San Francisco, CA" or "Paris, France"',
      },
    },
    required: ['location'],
  },
};

// Define all available tools
export const TOOLS: ToolDefinition[] = [calculator, weather];

// Tool implementation functions
export async function executeCalculator(args: Record<string, any>): Promise<string> {
  const { operation, a, b } = args;
  
  let result: number;
  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        return 'Error: Division by zero is not allowed';
      }
      result = a / b;
      break;
    default:
      return `Error: Unknown operation: ${operation}`;
  }
  
  return `The result of ${a} ${operation} ${b} is ${result}`;
}

export async function executeWeather(args: Record<string, any>): Promise<string> {
  const { location } = args;
  // In a real application, you would call a weather API here
  // For this example, we'll return mock data
  return `The weather in ${location} is currently 22°C and partly cloudy.`;
}

// Function to execute a tool based on its name
export async function executeTool(toolCall: ToolToCall): Promise<string> {
  const { name, args } = toolCall;
  
  switch (name) {
    case 'calculator':
      return executeCalculator(args);
    case 'weather':
      return executeWeather(args);
    default:
      return `Error: Unknown tool: ${name}`;
  }
}