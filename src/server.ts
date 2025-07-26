import dotenv from "dotenv";
import app from "./app";
import connectDB from "./connectors/connectDB";
import { connectToRedis } from "./connectors/redis";
import { startRAGBuilderWorker } from "./workers/RAGBuilderWorker";

// Load environment variables from .env file
dotenv.config({ path: "./.env" });

// Get the port from environment variables or default to 8000
const PORT = process.env.PORT || 8000;

// Connect to DB first, then start the server and workers
connectDB()
  .then(async () => {
    // Connect to Redis
    await connectToRedis();

    // Start the RAG builder worker
    await startRAGBuilderWorker();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error starting server:", error);
  });

connectToRedis();
