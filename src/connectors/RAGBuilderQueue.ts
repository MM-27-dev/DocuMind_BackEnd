import { Queue } from "bullmq";
import { getRedisClient } from "./redis";
import dotenv from "dotenv";

dotenv.config();

const RAGBuilderQueueName = process.env.RAG_BUILDER_QUEUE_NAME;

let ragBuilderQueue: Queue | null = null;

export interface RAGBuilderJobData {
  jobId: string;
  retryCount?: number;
}

export const initializeRAGBuilderQueue = async (): Promise<Queue> => {
  if (!RAGBuilderQueueName) {
    console.error(
      "RAG_BUILDER_QUEUE_NAME is not set in the environment variables"
    );
    process.exit(1);
  }

  const redisClient = await getRedisClient();

  ragBuilderQueue = new Queue(RAGBuilderQueueName as string, {
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
  console.info("RAG builder queue initialized successfully");
  return ragBuilderQueue;
};
// Add a job to the RAG builder queue
export const addRAGBuilderJob = async (
  jobData: RAGBuilderJobData
): Promise<void> => {
  try {
    console.debug("🔍 [RAGQueue] Adding job:", jobData);
    const queue = await initializeRAGBuilderQueue();
    console.debug("🔍 [RAGQueue] Queue initialized successfully");
    await queue.add("process-rag-assistant", jobData, {
      priority: 1,
      jobId: `rag-assistant-${jobData.jobId}-${Date.now()}`,
    });
    console.info(`Added RAG builder job for assistant ${jobData.jobId}`);
  } catch (error: any) {
    console.error(`Failed to add RAG builder job: ${error.message}`);
    throw error;
  }
};

// Get the status of the RAG builder queue
export const getRAGBuilderQueueStatus = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> => {
  try {
    console.debug("🔍 [RAGQueue] Getting queue status...");
    const queue = await initializeRAGBuilderQueue();
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);
    console.debug("🔍 [RAGQueue] Status:", {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    });
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  } catch (error: any) {
    console.error(`Failed to get RAG builder queue status: ${error.message}`);
    throw error;
  }
};

// Clean up the RAG builder queue
export const cleanupRAGBuilderQueue = async (): Promise<void> => {
  if (ragBuilderQueue) {
    console.debug("🔍 [RAGQueue] Cleaning up queue...");
    await ragBuilderQueue.close();
    ragBuilderQueue = null;
    console.info("RAG builder queue cleaned up successfully");
  }
};

// Get a specific RAG builder job
export const getRAGBuilderJob = async (jobId: string): Promise<any> => {
  try {
    console.debug(`🔍 [RAGQueue] Getting job: ${jobId}`);
    const queue = await initializeRAGBuilderQueue();
    const job = await queue.getJob(jobId);
    console.debug("🔍 [RAGQueue] Job result:", job);
    return job;
  } catch (error: any) {
    console.error(`Failed to get RAG builder job ${jobId}: ${error.message}`);
    throw error;
  }
};

// Remove a specific RAG builder job
export const removeRAGBuilderJob = async (jobId: string): Promise<void> => {
  try {
    console.debug(`🔍 [RAGQueue] Removing job: ${jobId}`);
    const queue = await initializeRAGBuilderQueue();
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.info(`Removed RAG builder job ${jobId}`);
    } else {
      console.warn(`RAG builder job ${jobId} not found`);
    }
  } catch (error: any) {
    console.error(
      `Failed to remove RAG builder job ${jobId}: ${error.message}`
    );
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
