import { StateGraph, END, START } from '@langchain/langgraph';
import { getModelResponse, callTool } from './nodes';
import { Annotation } from "@langchain/langgraph";
import { AIMessage, BaseMessage, MessageFieldWithRole } from '@langchain/core/messages';

// Define state annotation for the graph
export const StateAnnotation = Annotation.Root({
  sentiment: Annotation<string>({
    default: () => "",
    reducer: (x, y) => y ?? x ?? "",
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[])  => {
      if (Array.isArray(right)) {
        return left.concat(right);
      }
      return left.concat([right]);
    },
    default: () => [],
  }),
  messages_with_role: Annotation<MessageFieldWithRole[]>({
    default: () => [],
    reducer: (x, y) => y ?? x ?? [],
  }),
  tools_to_call: Annotation<any[] | undefined>({
    default: () => [],
    reducer: (x, y) => y ?? x ?? [],
  }),
  tool_call_id: Annotation<string>({
    default: () => "",
    reducer: (x, y) => y ?? x ?? "",
  }),
  tool_outputs: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (x, y) => y ?? x ?? {},
  }),
  current_tool_call: Annotation<any>({
    default: () => ({}),
    reducer: (x, y) => y ?? x ?? {},
  }),
});

/**
 * Creates a graph for the agent
 * @returns The compiled graph
 */
export function createAgentGraph() {
  // Create the graph with the state annotation directly
  // This matches the pattern in the documentation
  const builder = new StateGraph(StateAnnotation);

  // Define routing logic with proper type
  const shouldCallTool = (state: typeof StateAnnotation.State) => {
    if (state.tools_to_call && state.tools_to_call.length > 0) {
      return "call_tool";
    }
    return END;
  };

  /**
   * The correct way to build the graph is to chain methods in a fluent API style
   * This matches the pattern shown in the documentation and ensures
   * the typings work correctly
   */
  return builder
    // Add nodes first
    .addNode("model", getModelResponse)
    .addNode("call_tool", callTool)
    // Set up the flow
    .addEdge(START, "model")
    .addConditionalEdges("model", shouldCallTool, {
      "call_tool": "call_tool",
      [END]: END,
    })
    .addEdge("call_tool", "model")
    // Finally compile the graph
    .compile();
}