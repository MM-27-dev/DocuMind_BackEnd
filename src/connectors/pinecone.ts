// src/lib/pinecone.ts
import {
  Pinecone,
  PineconeRecord,
  ScoredPineconeRecord,
  QueryResponse,
} from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Pinecone API key is missing in config");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Create a Pinecone index
export async function createPineconeIndex(
  indexName: string,
  dimension = 1536
): Promise<string> {
  const safeName = indexName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const { indexes } = await pinecone.listIndexes(); // returns string[] :contentReference[oaicite:0]{index=0}
  const existingNames = (indexes ?? []).map((ix) => ix.name);
  if (!existingNames?.includes(safeName)) {
    await pinecone.createIndex({
      name: safeName,
      dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
  }
  return safeName;
}

// Upsert vectors into a Pinecone index
export async function upsertVectors(
  indexName: string,
  vectors: PineconeRecord[]
): Promise<void> {
  if (!vectors || vectors.length === 0) {
    console.warn("No vectors provided for upserting");
    return;
  }

  try {
    const index = pinecone.index(indexName);

    // Upsert vectors in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
      console.log(
        `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          vectors.length / batchSize
        )}`
      );

      // Add delay between batches to respect rate limits
      if (i + batchSize < vectors.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `Successfully upserted ${vectors.length} vectors to index: ${indexName}`
    );
  } catch (error: any) {
    console.error(
      `Failed to upsert vectors to index ${indexName}:`,
      error.message
    );
    throw error;
  }
}

// Query vectors from a Pinecone index
export async function queryVectors(
  indexName: string,
  vector: number[],
  topK = 5
): Promise<ScoredPineconeRecord[]> {
  const index = pinecone.index(indexName);
  const response: QueryResponse = await index.query({
    // query with vector and topK :contentReference[oaicite:4]{index=4}
    vector,
    topK,
    includeMetadata: true,
  });
  return response.matches;
}

export default pinecone;
