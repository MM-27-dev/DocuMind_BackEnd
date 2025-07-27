import { Queue } from "bullmq";
import { getRedisClient } from "./redis";
import dotenv from "dotenv";

dotenv.config();

const RAGBuilderQueueName = process.env.RAG_BUILDER_QUEUE_NAME;

let ragBuilderQueue: Queue | null = null;

export interface RAGBuilderJobData {
  jobId: string;
  retryCount?: number;
  data?: {
    email: string;
    fileName: string;
    content: string;
    fileId?: string;
    mimeType?: string;
    source?: "google-drive" | "local";
  };
}

// Initialize the RAG Builder queue
export const initializeRAGBuilderQueue = async (): Promise<Queue> => {
  if (!RAGBuilderQueueName) {
    console.error("Missing RAG_BUILDER_QUEUE_NAME in environment variables.");
    process.exit(1);
  }

  const redisClient = await getRedisClient();

  ragBuilderQueue = new Queue(RAGBuilderQueueName, {
    connection: redisClient,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  console.info("RAG builder queue initialized.");
  return ragBuilderQueue;
};

// Add a job to the RAG builder queue
export const addRAGBuilderJob = async (
  jobData: RAGBuilderJobData
): Promise<void> => {
  try {
    console.debug("[RAGQueue] Adding job:", jobData);

    const queue = await initializeRAGBuilderQueue();

    await queue.add("process-rag-assistant", jobData, {
      priority: 1,
      jobId: `rag-assistant-${jobData.jobId}-${Date.now()}`,
    });

    console.info(`Job added to RAG builder queue: ${jobData.jobId}`);
  } catch (error: any) {
    console.error(`Failed to add job to RAG builder queue: ${error.message}`);
    throw error;
  }
};

// Retrieve the current status of the queue
export const getRAGBuilderQueueStatus = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> => {
  try {
    const queue = await initializeRAGBuilderQueue();

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  } catch (error: any) {
    console.error(`Failed to get queue status: ${error.message}`);
    throw error;
  }
};

// Clean up and close the queue connection
export const cleanupRAGBuilderQueue = async (): Promise<void> => {
  if (ragBuilderQueue) {
    await ragBuilderQueue.close();
    ragBuilderQueue = null;
    console.info("RAG builder queue connection closed.");
  }
};

// Fetch a specific job by its ID
export const getRAGBuilderJob = async (jobId: string): Promise<any> => {
  try {
    const queue = await initializeRAGBuilderQueue();
    const job = await queue.getJob(jobId);

    return job;
  } catch (error: any) {
    console.error(`Failed to fetch job ${jobId}: ${error.message}`);
    throw error;
  }
};

// Remove a job from the queue using its ID
export const removeRAGBuilderJob = async (jobId: string): Promise<void> => {
  try {
    const queue = await initializeRAGBuilderQueue();
    const job = await queue.getJob(jobId);

    if (job) {
      await job.remove();
      console.info(`Job removed from RAG builder queue: ${jobId}`);
    } else {
      console.warn(`No job found with ID: ${jobId}`);
    }
  } catch (error: any) {
    console.error(`Failed to remove job ${jobId}: ${error.message}`);
    throw error;
  }
};

export default {
  initializeRAGBuilderQueue,
  addRAGBuilderJob,
  getRAGBuilderQueueStatus,
  cleanupRAGBuilderQueue,
  getRAGBuilderJob,
  removeRAGBuilderJob,
};
