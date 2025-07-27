import dotenv from "dotenv";
import app from "./app";
import connectDB from "./connectors/connectDB";
import { connectToRedis } from "./connectors/redis";
import { startRAGBuilderWorker } from "./workers/RAGBuilderWorker";

dotenv.config({ path: "./.env" });
const PORT = process.env.PORT || 8000;

connectDB()
  .then(async () => {
    await connectToRedis();
    await startRAGBuilderWorker();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error starting server:", error);
  });

connectToRedis();
