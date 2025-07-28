import mongoose, { Document, Schema } from "mongoose";

export interface IMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isUser: boolean;
  content: string;
  messageType: "text" | "file" | "voice";
  file?: {
    filename: string;
    originalName: string;
    path: string;
    content: string;
  };
  feedback?: "like" | "dislike"; 
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isUser: {
      type: Boolean,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "file", "voice"],
      default: "text",
    },
    file: {
      filename: String,
      originalName: String,
      path: String,
      content: String,
    },
    feedback: {
      type: String,
      enum: ["like", "dislike", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ feedback: 1 });


export const Message = mongoose.model<IMessage>("Message", messageSchema);
