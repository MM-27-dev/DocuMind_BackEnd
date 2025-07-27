import axios from "axios";

export async function callRagQueryTool(query: string): Promise<string> {
  const response = await axios.post("https://mcp-server-thci.onrender.com/rag_query", {
    query,
  });

  console.log("response.data.toolResult", response.data.toolResult);
  return response.data.toolResult;
}
