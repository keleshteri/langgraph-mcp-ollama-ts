import express, { Request, Response } from 'express';
import { config } from './config/config';
import { createAgentGraph } from './agent/graph';
import { StateType, Message } from './agent/types';
import { Command } from '@langchain/langgraph';
import { 
  BaseMessage, 
  HumanMessage, 
  AIMessage, 
  SystemMessage,
  ToolMessage,
  MessageContent,
  MessageFieldWithRole 
} from '@langchain/core/messages';
import { StateAnnotation } from './agent/graph';
import * as readline from 'readline';

// Create Express app
const app = express();
app.use(express.json());

// Create the agent graph
const agentExecutor = createAgentGraph();

/**
 * Convert a simple message object to a LangChain BaseMessage
 */
function convertToBaseMessage(message: { role: string; content: string; name?: string }): BaseMessage {
  switch (message.role) {
    case 'user':
      return new HumanMessage(message.content);
    case 'assistant':
      return new AIMessage(message.content);
    case 'system':
      return new SystemMessage(message.content);
    case 'tool':
    case 'function':
      return new ToolMessage({
        content: message.content,
        name: message.name || '',
        tool_call_id: '',
      });
    default:
      // Default to HumanMessage if unknown role
      return new HumanMessage(message.content);
  }
}

/**
 * Convert MessageContent to string
 */
function messageContentToString(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  } else if (Array.isArray(content)) {
    // Handle complex message content by converting to a readable string
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        } else if (item.type === 'text') {
          return item.text;
        } else if (item.type === 'image_url') {
          return '[Image]';
        } else {
          return JSON.stringify(item);
        }
      })
      .join(' ');
  }
  return JSON.stringify(content);
}

/**
 * Convert MessageFieldWithRole to a simple message format
 */
function simplifyMessage(message: MessageFieldWithRole): { role: string; content: string; name?: string } {
  return {
    role: message.role,
    content: messageContentToString(message.content),
    name: message.name
  };
}

// Define the MCP endpoint
app.post('/mcp', function(req: Request, res: Response) {
  const handleRequest = async () => {
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request: messages array is required' });
      }
      
      // Convert messages to LangChain BaseMessage objects
      const baseMessages = messages.map(convertToBaseMessage);
      
      // Execute the graph with properly typed messages
      const result = await agentExecutor.invoke({
        messages_with_role: messages,
        messages: baseMessages
      });
      
      // Extract assistant messages from the result
      const resultMessages = result?.messages_with_role || [];
      const assistantMessages = resultMessages.filter((msg: any) => msg.role === 'assistant');
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      
      // Return the response
      return res.json({
        message: lastMessage,
        all_messages: resultMessages,
      });
    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  handleRequest();
});

// Start the server
app.listen(config.mcp.port, () => {
  console.log(`MCP Server is running on port ${config.mcp.port}`);
});

// For command-line testing
if (require.main === module) {
  // Check if running in single-question mode
  const singleQuestionMode = process.argv.length > 2;
  
  if (singleQuestionMode) {
    // Run in single-question mode (legacy behavior)
    const testAgentDirectly = async () => {
      const userMessage = process.argv[2] || 'What is 2 + 2?';
      
      // Initialize message as a proper LangChain message
      const initialMessage = new HumanMessage(userMessage);
      
      // Also create the message with role format for compatibility
      const initialMessageWithRole = {
        role: 'user',
        content: userMessage,
      };
      
      try {
        // Execute the graph with properly typed input
        const result = await agentExecutor.invoke({
          messages: [initialMessage],
          messages_with_role: [initialMessageWithRole]
        });
        
        // Print the conversation
        console.log('\n=== Conversation ===');
        const messages = result?.messages_with_role || [];
        for (const message of messages) {
          console.log(`\n${message.role.toUpperCase()}${message.name ? ` (${message.name})` : ''}: ${messageContentToString(message.content)}`);
        }
        console.log('\n===================');
      } catch (error) {
        console.error('Error executing agent:', error);
      }
    };
    
    testAgentDirectly().catch(console.error);
  } else {
    // Run in interactive chat mode
    console.log("\n===== LangGraph Ollama Agent Terminal =====");
    console.log("Type your message and press Enter. Type 'exit' to quit.");
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'You: '
    });
    
    // Store conversation history - simple message format
    const conversationHistory: Array<{role: string; content: string; name?: string}> = [];
    
    // Start the prompt
    rl.prompt();
    
    // Handle user input
    rl.on('line', async (input) => {
      // Check for exit command
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
        return;
      }
      
      try {
        // Add user message to history
        const userMessage = {
          role: 'user',
          content: input.trim()
        };
        conversationHistory.push(userMessage);
        
        // Convert history to LangChain messages
        const baseMessages = conversationHistory.map(convertToBaseMessage);
        
        // Show "thinking" indicator
        process.stdout.write('Assistant is thinking...');
        
        // Call the agent
        const result = await agentExecutor.invoke({
          messages: baseMessages,
          messages_with_role: conversationHistory
        });
        
        // Clear the "thinking" indicator
        process.stdout.write('\r\x1b[K');
        
        // Get the latest response
        const resultMessages = result?.messages_with_role || [];
        const assistantMessages = resultMessages.filter((msg: any) => msg.role === 'assistant');
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
        
        if (lastAssistantMessage) {
          // Convert to simple format and add to conversation history
          const simplifiedMessage = simplifyMessage(lastAssistantMessage);
          conversationHistory.push(simplifiedMessage);
          
          // Display assistant's response
          console.log(`\nAssistant: ${simplifiedMessage.content}\n`);
        }
        
        // Display tool messages if any
        const toolMessages = resultMessages
          .filter((msg: any) => msg.role === 'tool');
          
        for (const toolMsg of toolMessages) {
          // Check if this tool message is already in history
          const alreadyInHistory = conversationHistory.some(
            m => m.role === 'tool' && 
                m.name === toolMsg.name && 
                m.content === messageContentToString(toolMsg.content)
          );
          
          if (!alreadyInHistory) {
            // Convert to simple format
            const simplifiedToolMsg = simplifyMessage(toolMsg);
            conversationHistory.push(simplifiedToolMsg);
            console.log(`\nTool (${simplifiedToolMsg.name}): ${simplifiedToolMsg.content}\n`);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
      
      // Show prompt for next input
      rl.prompt();
    });
    
    // Handle Ctrl+C gracefully
    rl.on('SIGINT', () => {
      console.log('\nGoodbye!');
      rl.close();
      process.exit(0);
    });
  }
}