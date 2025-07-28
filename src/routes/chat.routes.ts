import express from "express";
import { verifyJWT } from "../middleware/auth.middleware";
import {
  createSession,
  getUserSessions,
  getSessionMessages,
  sendMessage,
  generateSessiontitle,
  deleteSession,
  giveFeedback,
} from "../controllers/chat.controllers";

const router = express.Router();

router.use(verifyJWT);

// Session management routes
router.post("/sessions/create", createSession);
router.get("/sessions/all", getUserSessions);
router.delete("/sessions/:sessionId/delete", deleteSession);

// Message routes
router.get("/sessions/:sessionId/messages", getSessionMessages);
router.post("/sessions/:sessionId/messages/send", sendMessage);

// Session management
router.post("/sessions/:sessionId/generate-title", generateSessiontitle);

router.patch("/messages/:messageId/feedback", giveFeedback);


export default router;
