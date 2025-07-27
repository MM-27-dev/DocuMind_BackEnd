import { OpenAI } from "openai";
import { TextChunk } from "./textChunker";
import { PineconeRecord } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingOptions {
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

const DEFAULT_EMBEDDING_OPTIONS: Required<EmbeddingOptions> = {
  model: "text-embedding-3-small",
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
};

// Generate embeddings for a single text
export const generateEmbedding = async (
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> => {
  const config = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };

  try {
    const response = await openai.embeddings.create({
      model: config.model,
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error("Error generating embedding:", error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

export const generateEmbeddingsBatch = async (
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> => {
  const config = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += config.batchSize) {
    const batch = texts.slice(i, i + config.batchSize);

    try {
      const response = await openai.embeddings.create({
        model: config.model,
        input: batch,
        encoding_format: "float",
      });

      const batchEmbeddings = response.data.map((item) => item.embedding);
      embeddings.push(...batchEmbeddings);

      console.log(
        `Generated embeddings for batch ${
          Math.floor(i / config.batchSize) + 1
        }/${Math.ceil(texts.length / config.batchSize)}`
      );

      // Add delay between batches to respect rate limits
      if (i + config.batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(
        `Error generating embeddings for batch ${
          Math.floor(i / config.batchSize) + 1
        }:`,
        error.message
      );
      throw new Error(
        `Failed to generate embeddings for batch: ${error.message}`
      );
    }
  }

  return embeddings;
};

export const chunksToPineconeRecords = async (
  chunks: TextChunk[],
  options: EmbeddingOptions = {}
): Promise<PineconeRecord[]> => {
  const config = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };
  const records: PineconeRecord[] = [];

  if (chunks.length === 0) {
    return records;
  }

  try {
    // Extract text content from chunks
    const texts = chunks.map((chunk) => chunk.content);

    // Generate embeddings for all texts
    const embeddings = await generateEmbeddingsBatch(texts, config);

    // Create Pinecone records
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      if (embedding) {
        records.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            content: chunk.content,
            fileId: chunk.metadata.fileId,
            fileName: chunk.metadata.fileName,
            chunkIndex: chunk.metadata.chunkIndex,
            startChar: chunk.metadata.startChar,
            endChar: chunk.metadata.endChar,
            tokens: chunk.metadata.tokens || 0,
            createdAt: new Date().toISOString(),
          },
        });
      }
    }

    console.log(
      `Successfully created ${records.length} Pinecone records from ${chunks.length} chunks`
    );
    return records;
  } catch (error: any) {
    console.error(
      "Error converting chunks to Pinecone records:",
      error.message
    );
    throw error;
  }
};

export const generateEmbeddingWithRetry = async (
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> => {
  const config = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await generateEmbedding(text, options);
    } catch (error: any) {
      lastError = error;
      console.warn(
        `Embedding generation attempt ${attempt} failed: ${error.message}`
      );

      if (attempt < config.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.retryDelay * attempt)
        );
      }
    }
  }

  throw lastError!;
};

export const validateEmbedding = (embedding: number[]): boolean => {
  if (!Array.isArray(embedding)) {
    return false;
  }

  // Check if all values are numbers
  if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
    return false;
  }

  // Check dimension (text-embedding-3-small has 1536 dimensions)
  if (embedding.length !== 1536) {
    console.warn(
      `Unexpected embedding dimension: ${embedding.length}, expected 1536`
    );
  }

  return true;
};
