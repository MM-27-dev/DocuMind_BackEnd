import mongoose, { Document, Schema } from "mongoose";

export interface ISession extends Document {
  title: string;
  userId: mongoose.Types.ObjectId;
  messages: mongoose.Types.ObjectId[];
  latestFile?: {
    name: string;
    content: string;
  };
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    title: {
      type: String,
      required: true,
      default: "Untitled Session",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: [
      {
        type: Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    latestFile: {
      name: String,
      content: String,
    },
    feedback: String,
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, updatedAt: -1 });

export const Session = mongoose.model<ISession>("Session", sessionSchema);
