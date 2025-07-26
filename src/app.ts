import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import { healthcheckRouter } from "./routes/healthcheck.routes";
import cookieParser from "cookie-parser";

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

// Health check
app.use("/api/v1/healthcheck", healthcheckRouter);

// Auth routes
app.use("/api/v1/auth", authRoutes);

export default app;
