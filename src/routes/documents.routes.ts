import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { Files } from "../model/files.model";
import { addRAGBuilderJob } from "../connectors/RAGBuilderQueue";

const router = Router();

router.use(verifyJWT);

// Upload a new document
router.post(
  "/upload",
  asyncHandler(async (req, res) => {
    const { name, url, type, size } = req.body;
    const userId = req.user!._id;

    if (!name || !url || !type) {
      throw new ApiError(400, "Name, URL, and type are required");
    }

    // Create new file record
    const file = await Files.create({
      name,
      url,
      type,
      size,
      userId,
      processingStatus: "pending",
    });

    // Add RAG builder job to queue
    await addRAGBuilderJob({
      jobId: (file._id as string).toString(),
    });

    res
      .status(201)
      .json(
        new ApiResponse(201, file, "File uploaded and queued for processing")
      );
  })
);

// Get all documents for a user
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!._id;
    const files = await Files.find({ userId }).sort({ createdAt: -1 });

    res
      .status(200)
      .json(new ApiResponse(200, files, "Files retrieved successfully"));
  })
);

// Get a specific document
router.get(
  "/:fileId",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const userId = req.user!._id;

    const file = await Files.findOne({ _id: fileId, userId });

    if (!file) {
      throw new ApiError(404, "File not found");
    }
    res
      .status(200)
      .json(new ApiResponse(200, file, "File retrieved successfully"));
  })
);

// Delete a document
router.delete(
  "/:fileId",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const userId = req.user!._id;

    const file = await Files.findOneAndDelete({ _id: fileId, userId });

    if (!file) {
      throw new ApiError(404, "File not found");
    }
    res.status(200).json(new ApiResponse(200, {}, "File deleted successfully"));
  })
);

// Retry processing for a failed document
router.post(
  "/:fileId/retry",
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const userId = req.user!._id;

    const file = await Files.findOne({ _id: fileId, userId });

    if (!file) {
      throw new ApiError(404, "File not found");
    }

    if (file.processingStatus !== "failed") {
      throw new ApiError(400, "Only failed files can be retried");
    }

    await Files.findByIdAndUpdate(fileId, { processingStatus: "pending" });
    await addRAGBuilderJob({ jobId: fileId });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "File queued for reprocessing"));
  })
);

// Get processing statistics
router.get(
  "/stats/processing",
  asyncHandler(async (req, res) => {
    const userId = req.user!._id;

    const stats = await Files.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$processingStatus",
          count: { $sum: 1 },
          totalChunks: { $sum: "$chunksCount" },
        },
      },
    ]);

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalChunks: stat.totalChunks || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; totalChunks: number }>);

    res
      .status(200)
      .json(new ApiResponse(200, statsMap, "Processing statistics retrieved"));
  })
);

export default router;
