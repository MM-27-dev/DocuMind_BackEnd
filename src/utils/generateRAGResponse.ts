import { OpenAI } from "openai";
import { callRagQueryTool } from "./mcpClient";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateRAGResponse({
  userQuestion,
  prompt,
  messageHistory = [],
}: {
  userQuestion: string;
  prompt: string;
  messageHistory?: ChatMessage[];
}): Promise<string> {
  // Build conversation context
  const conversationMessages = [
    { role: "system" as const, content: prompt },
    ...messageHistory,
    { role: "user" as const, content: userQuestion },
  ];

  // 1. Call OpenAI with tool definition
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: conversationMessages,
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
      console.log("toolCall", toolCall.function.name);
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await callRagQueryTool(toolArgs.query);

      // 3. Send tool result back to OpenAI to get the final answer
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...conversationMessages,
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


// Helper function to generate session title
export async function generateSessionTitle(
  messages: ChatMessage[]
): Promise<string> {
  if (messages.length === 0) {
    return "Untitled Session";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Generate a concise, descriptive title (max 50 characters) for this chat session based on the conversation. Focus on the main topic or theme discussed. Return only the title, nothing else.",
        },
        {
          role: "user",
          content: `Generate a title for this conversation:\n\n${messages
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n")}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const title =
      response.choices[0].message.content?.trim() || "Untitled Session";
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  } catch (error) {
    console.error("Error generating session title:", error);
    return "Untitled Session";
  }
}

export default generateRAGResponse;
