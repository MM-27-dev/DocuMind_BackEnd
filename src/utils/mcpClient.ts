import axios from "axios";

export async function callRagQueryTool(query: string): Promise<string> {
  const response = await axios.post("http://localhost:4000/rag_query", {
    query,
  });
  return response.data.toolResult;
}
