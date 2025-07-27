import { addRAGBuilderJob } from "../connectors/RAGBuilderQueue";

export interface IngestData {
  email: string;
  fileName: string;
  content: string;
  fileId?: string;
  mimeType?: string;
  source?: "google-drive" | "local";
}

export async function ingestToVectorDB({
  email,
  fileName,
  content,
  fileId,
  mimeType,
  source = "google-drive",
}: IngestData) {
  try {
    console.log(
      `Ingesting ${fileName} for ${email}, ${content.length} chars`
    );

    // Create a unique job ID for this ingestion
    const jobId = `${email}-${fileName}-${Date.now()}`;

    // Add job to RAG builder queue
    await addRAGBuilderJob({
      jobId,
      data: {
        email,
        fileName,
        content,
        fileId,
        mimeType,
        source,
      },
    });

    console.log(
      `Added ${fileName} to RAG builder queue with job ID: ${jobId}`
    );
    return jobId;
  } catch (error) {
    console.error("Error ingesting to vector DB:", error);
    throw error;
  }
}

// Function to ingest multiple documents
export async function ingestMultipleDocuments(documents: IngestData[]) {
  const results = [];

  for (const doc of documents) {
    try {
      const jobId = await ingestToVectorDB(doc);
      results.push({ success: true, fileName: doc.fileName, jobId });
    } catch (error) {
      console.error(`Failed to ingest ${doc.fileName}:`, error);
      results.push({
        success: false,
        fileName: doc.fileName,
        error: (error as Error).message,
      });
    }
  }

  return results;
}
