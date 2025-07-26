import { OpenAI } from "openai";
import { callRagQueryTool } from "./mcpClient";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateRAGResponse({
  userQuestion,
  prompt,
}: {
  userQuestion: string;
  prompt: string;
}): Promise<string> {
  const fullPrompt = `${prompt}\n\n${userQuestion}`;

  // 1. Call OpenAI with tool definition
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: fullPrompt }],
    tools: [
      {
        type: "function",
        function: {
          name: "rag_query",
          description: "Answer user question with context from vector DB",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "User query to answer based on documents",
              },
            },
            required: ["query"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  const message = chatResponse.choices[0].message;

  // 2. If OpenAI wants to call the tool, handle it
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    if (toolCall.function.name === "rag_query") {
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await callRagQueryTool(toolArgs.query);

      // 3. Send tool result back to OpenAI to get the final answer
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: fullPrompt },
          {
            role: "assistant",
            tool_calls: [toolCall],
            content: null,
          },
          {
            role: "tool",
            tool_call_id: toolCall.id,
            //@ts-ignore
            name: "rag_query",
            content: toolResult,
          },
        ],
      });

      return finalResponse.choices[0].message.content ?? "";
    }
  }

  // If no tool call, just return the model's response
  return message.content ?? "";
}

export default generateRAGResponse;
