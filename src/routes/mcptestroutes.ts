import { Router } from "express";

import generateRAGResponse from "../utils/generateRAGResponse";

const router = Router();

// Test MCP route
router.get("/", (req, res) => {
  res.json({ message: "MCP test route is working!" });
});

// RAG route
router.post("/rag", async (req, res) => {
  const { userQuestion, prompt } = req.body;
  if (!userQuestion || !prompt) {
    return res
      .status(400)
      .json({ error: "userQuestion and prompt are required" });
  }
  try {
    const answer = await generateRAGResponse({ userQuestion, prompt });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || "RAG error" });
  }
});

export { router as mcptestRouter };
