import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import documentsRoutes from "./routes/documents.routes";
import { healthcheckRouter } from "./routes/healthcheck.routes";
import cookieParser from "cookie-parser";
import { mcptestRouter } from "./routes/mcptestroutes";

dotenv.config();

const app: Application = express();

// Middlewares
const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
};
app.use(cookieParser()); // required to read cookies

app.use(cors(corsOptions));
app.use(express.json());

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Server is running!");
});

app.use("/api/v1/mcp", mcptestRouter);

// Health check
app.use("/api/v1/healthcheck", healthcheckRouter);

// Auth routes
app.use("/api/v1/auth", authRoutes);

// Documents routes
app.use("/api/v1/documents", documentsRoutes);

export default app;
