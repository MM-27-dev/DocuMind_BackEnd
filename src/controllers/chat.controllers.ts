import { Request, Response } from "express";
import { Session } from "../model/session.model";
import { Message } from "../model/message.model";
import generateRAGResponse, {
  generateSessionTitle,
} from "../utils/generateRAGResponse";

//create session
export const createSession = async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const session = await Session.create({
      title: title || "Untitled Session",
      userId: (req as any).user._id,
    });
    return res.status(201).json(session);
  } catch (err: any) {
    console.error("Error in createSession:", err);
    return res.status(500).json({ error: err.message });
  }
};

//get user sessions
export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await Session.find({ userId: (req as any).user._id }).sort(
      {
        updatedAt: -1,
      }
    );
    return res.status(200).json(sessions);
  } catch (err: any) {
    console.error("Error in getUserSessions:", err);
    return res.status(500).json({ error: err.message });
  }
};

// get session messages
export const getSessionMessages = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userId: (req as any).user._id,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Fetch messages for the given sessionId
    const messages = await Message.find({ sessionId }).sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (err: any) {
    console.error("Error in getSessionMessages:", err);
    return res.status(500).json({ error: err.message });
  }
};

// send message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { content, isUser = true, messageType = "text" } = req.body;

    const userId = (req as any).user._id;

    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: (req as any).user._id,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const newMessage = await Message.create({
      sessionId,
      userId,
      isUser,
      content,
      messageType: messageType || "text",
    });

    await Session.findByIdAndUpdate(sessionId, {
      $push: { messages: newMessage._id },
      $set: { updatedAt: new Date() },
    });

    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    // Convert messages to chat format for context
    const messageHistory = messages.map((msg) => ({
      role: msg.isUser ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    const aiResponseContent = await generateRAGResponse({
      userQuestion: content,
      prompt:
        "You are a helpful assistant. Use the conversation history as context to provide relevant and coherent responses.",
      messageHistory: messageHistory,
    });

    console.log("AI Response:", aiResponseContent);
    

    const aiMessage = await Message.create({
      sessionId,
      userId,
      isUser: false,
      content: aiResponseContent,
      messageType: "text",
    });

    await Session.findByIdAndUpdate(sessionId, {
      $push: { messages: aiMessage._id },
      $set: { updatedAt: new Date() },
    });

    return res.status(201).json({ userMessage: newMessage, aiMessage });
  } catch (err: any) {
    console.error("Error in sendMessage:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// Generate a title for the session using the conversation history
export const generateSessiontitle = async (
  req: Request,
  res: Response
) => {
  try {
    const { sessionId } = req.params;

    // Check if the session exists and belongs to the current user
    const session = await Session.findOne({
      _id: sessionId,
      userId: (req as any).user._id,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get all messages from this session, ordered by creation time
    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    // If there are no messages, return a default response
    if (messages.length === 0) {
      return res.status(200).json({
        message: "No messages found in this session to generate a title.",
        title: "Untitled Session",
        session,
      });
    }

    const messageHistory = messages.map((msg) => ({
      role: msg.isUser ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    const generatedTitle = await generateSessionTitle(messageHistory);

    // Update the session with the generated title
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      { title: generatedTitle },
      { new: true }
    );

    return res.status(200).json({
      message: "Title generated and session updated successfully.",
      title: generatedTitle,
      session: updatedSession,
    });
  } catch (err: any) {
    console.error("Error while generating session title:", err);
    return res.status(500).json({ error: err.message });
  }
};


// delete session
export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userId: (req as any).user._id,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Delete all messages in the session
    await Message.deleteMany({ sessionId });

    // Delete the session
    await Session.findByIdAndDelete(sessionId);

    return res.status(200).json({
      message: "Session and all messages deleted successfully",
    });
  } catch (err: any) {
    console.error("Error in deleteSession:", err);
    return res.status(500).json({ error: err.message });
  }
};

//give fedback of the response
export const giveFeedback = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { feedback } = req.body;

    if (!["like", "dislike"].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Ensure user owns the message session
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId.toString() !== (req as any).user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    message.feedback = feedback;
    await message.save();

    return res.status(200).json({ message: "Feedback saved", feedback });
  } catch (err: any) {
    console.error("Error in giveFeedback:", err);
    return res.status(500).json({ error: err.message });
  }
};


