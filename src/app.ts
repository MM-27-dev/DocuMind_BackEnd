import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import documentsRoutes from "./routes/documents.routes";
import { healthcheckRouter } from "./routes/healthcheck.routes";
import chatRoutes from "./routes/chat.routes";
import cookieParser from "cookie-parser";
import { mcptestRouter } from "./routes/mcptestroutes";
import googleDriveApis from "./routes/googleDrive";

dotenv.config();

const app: Application = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
};
app.use(cookieParser());

app.use(cors(corsOptions));
app.use(express.json());

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Server is running!");
});

// MCP routes
app.use("/api/v1/mcp", mcptestRouter);

// Health check
app.use("/api/v1/healthcheck", healthcheckRouter);

// Auth routes
app.use("/api/v1/auth", authRoutes);

// Google Drive routes
app.use("/api/v1/google-drive", googleDriveApis);

// Documents routes
app.use("/api/v1/documents", documentsRoutes);

// Chat routes
app.use("/api/v1/chat", chatRoutes);

export default app;
