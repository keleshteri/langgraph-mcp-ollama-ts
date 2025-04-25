// src/agent/simple-agent.ts

import { getModelResponse, callTool } from './nodes';
import { StateType } from './types';

/**
 * A simplified agent implementation that doesn't use LangGraph
 * but provides the same functionality.
 */
export class SimpleAgent {
  /**
   * Process a conversation by executing the agent's logic.
   * @param initialState The initial state with messages, etc.
   * @returns The final state after processing
   */
  async execute(initialState: StateType): Promise<StateType> {
    let currentState = { ...initialState };
    let isDone = false;
    
    // Main agent loop
    while (!isDone) {
      // Step 1: Get model response
      currentState = await getModelResponse(currentState);
      
      // Step 2: Check if we need to call a tool
      if (currentState.tools_to_call && currentState.tools_to_call.length > 0) {
        // Step 3: Call the tool
        currentState = await callTool(currentState);
        
        // Continue the loop to get another model response
        continue;
      }
      
      // If no tools to call, we're done
      isDone = true;
    }
    
    return currentState;
  }
}

/**
 * Factory function to create a new SimpleAgent instance.
 * This mimics the LangGraph's createAgentGraph function.
 */
export function createSimpleAgent(): SimpleAgent {
  return new SimpleAgent();
}