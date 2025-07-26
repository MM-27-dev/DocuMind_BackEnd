import { Worker, Job } from "bullmq";
import { getRedisClient } from "../connectors/redis";
import { createPineconeIndex, upsertVectors } from "../connectors/pinecone";
import { extractRemoteFileContent } from "../utils/extractRemoteFileContent";
import { chunkText } from "../utils/textChunker";
import { chunksToPineconeRecords } from "../utils/embeddingGenerator";
import { Files } from "../model/files.model";
import dotenv from "dotenv";

dotenv.config();

export const ragBuilderQueueName = process.env.RAG_BUILDER_QUEUE_NAME as string;

let ragBuildWorker: Worker | null = null;

export const startRAGBuilderWorker = async (): Promise<void> => {
  const redisClient = await getRedisClient();
  console.info("[RAGWorker] Redis client obtained");

  ragBuildWorker = new Worker(
    ragBuilderQueueName,
    async (job: Job) => {
      const jobId = job.id;
      console.info(`[RAGWorker] 🚀 Starting RAG build job: ${jobId}`);

      try {
        // Get files that need processing
        const files = await Files.find({
          processingStatus: { $in: ["pending", "failed"] },
        });

        if (!files || files.length === 0) {
          console.warn("[RAGWorker] ⚠️ No files found to process");
          return;
        }

        console.info(`[RAGWorker] 📁 Found ${files.length} files to process`);

        // Create or ensure Pinecone index exists
        const indexName = "documind";
        await createPineconeIndex(indexName);

        let totalFilesProcessed = 0;
        let totalChunksCreated = 0;
        let totalVectorsUpserted = 0;

        for (const file of files) {
          if (!file.url || !file.type) {
            console.warn(
              `[RAGWorker] ⚠️ Skipping file ${file.name} - missing URL or type`
            );
            continue;
          }

          try {
            // Update file status to processing
            await Files.findByIdAndUpdate(file._id, {
              processingStatus: "processing",
            });

            console.info(`[RAGWorker] 🔄 Processing file: ${file.name}`);

            // Extract content from file
            const fileText = await extractRemoteFileContent(
              file.url,
              file.type
            );

            if (
              !fileText ||
              typeof fileText !== "string" ||
              fileText.trim().length === 0
            ) {
              console.warn(
                `[RAGWorker] ⚠️ No content extracted from file: ${file.name}`
              );
              await Files.findByIdAndUpdate(file._id, {
                processingStatus: "failed",
              });
              continue;
            }

            console.info(
              `[RAGWorker] 📄 Extracted ${fileText.length} characters from ${file.name}`
            );

            // Chunk the text
            const chunks = chunkText(
              fileText,
              (file._id as string).toString(),
              file.name,
              {
                maxChunkSize: 1000,
                overlapSize: 200,
                separator: "\n\n",
              }
            );

            console.info(
              `[RAGWorker] ✂️ Created ${chunks.length} chunks from ${file.name}`
            );

            if (chunks.length === 0) {
              console.warn(
                `[RAGWorker] ⚠️ No chunks created for file: ${file.name}`
              );
              await Files.findByIdAndUpdate(file._id, {
                processingStatus: "failed",
              });
              continue;
            }

            // Convert chunks to Pinecone records with embeddings
            const records = await chunksToPineconeRecords(chunks);

            if (records.length === 0) {
              console.warn(
                `[RAGWorker] ⚠️ No records created for file: ${file.name}`
              );
              await Files.findByIdAndUpdate(file._id, {
                processingStatus: "failed",
              });
              continue;
            }

            // Upsert vectors to Pinecone
            await upsertVectors(indexName, records);

            // Update file status to completed
            await Files.findByIdAndUpdate(file._id, {
              processingStatus: "completed",
              chunksCount: chunks.length,
              vectorizedAt: new Date(),
            });

            totalFilesProcessed++;
            totalChunksCreated += chunks.length;
            totalVectorsUpserted += records.length;

            console.info(
              `[RAGWorker] ✅ Successfully processed file: ${file.name} (${chunks.length} chunks)`
            );
          } catch (err: any) {
            console.error(
              `[RAGWorker] ❌ Failed to process file: ${file.name} (${file.url})`,
              err.message
            );

            // Update file status to failed
            await Files.findByIdAndUpdate(file._id, {
              processingStatus: "failed",
            });
          }
        }

        console.info(
          `[RAGWorker] 🎉 Job ${jobId} completed: ${totalFilesProcessed} files processed, ${totalChunksCreated} chunks created, ${totalVectorsUpserted} vectors upserted`
        );
      } catch (error: any) {
        console.error(
          `[RAGWorker] ❌ RAG Build worker failed job ${jobId}: ${error.message}`
        );
        throw error;
      }
    },
    {
      connection: redisClient,
      concurrency: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  ragBuildWorker.on("completed", (job) => {
    console.info(`[RAGWorker] ✅ RAG Job ${job.id} completed successfully`);
  });

  ragBuildWorker.on("failed", (job, err) => {
    console.error(`[RAGWorker] ❌ RAG Job ${job?.id} failed: ${err.message}`);
  });

  ragBuildWorker.on("error", (err) => {
    console.error(`[RAGWorker] ❌ RAG Worker error: ${err.message}`);
  });

  console.info("🚀 RAG Builder worker started successfully");
};
