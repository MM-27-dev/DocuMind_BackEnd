import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

import { generateEmbedding } from "./utils/embeddingGenerator";
import { queryVectors } from "./connectors/pinecone";
import express from "express";
import bodyParser from "body-parser";

const DEFAULT_INDEX = "documind"; 

const server = new Server(
  { name: "rag-mcp-server", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definition
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "rag_query",
        description: "Answer user question with context from vector DB",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  if (request.params.name === "rag_query") {
    const { query } = request.params.arguments;

    try {
      const embedding = await generateEmbedding(query);
      const matches = await queryVectors(DEFAULT_INDEX, embedding, 5);
      const contexts = matches
        .map((m: any) =>
          m && m.metadata && typeof m.metadata.content === "string"
            ? m.metadata.content
            : undefined
        )
        .filter((c: any): c is string => typeof c === "string");

      return {
        toolResult: contexts.join("\n---\n"),
      };
    } catch (err) {
      console.error("RAG tool error:", err);
      throw new McpError(ErrorCode.InternalError, "Failed to run RAG query");
    }
  }
  throw new McpError(ErrorCode.InternalError, "Tool not found");
});

// Start server
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();

const app = express();
app.use(bodyParser.json());

app.post("/rag_query", async (req, res) => {
  const { query } = req.body;
  try {
    const embedding = await generateEmbedding(query);
    const matches = await queryVectors(DEFAULT_INDEX, embedding, 5);
    const contexts = matches
      .map((m: any) =>
        m && m.metadata && typeof m.metadata.content === "string"
          ? m.metadata.content
          : undefined
      )
      .filter((c: any): c is string => typeof c === "string");
    res.json({ toolResult: contexts.join("\n---\n") });
  } catch (err) {
    console.error("RAG HTTP error:", err);
    res.status(500).json({ error: (err as Error).message || "RAG error" });
  }
});

app.listen(4000, () => {
  console.log("MCP HTTP server listening on port 4000");
});
