import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFile extends Document {
  name: string;
  url: string;
  type: string;
  size?: number;
  userId: mongoose.Types.ObjectId;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  chunksCount?: number;
  vectorizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema: Schema<IFile> = new Schema<IFile>(
  {
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    chunksCount: {
      type: Number,
      default: 0,
    },
    vectorizedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

FileSchema.index({ userId: 1, processingStatus: 1 });
FileSchema.index({ vectorizedAt: 1 });

export const Files: Model<IFile> = mongoose.model<IFile>("Files", FileSchema);
