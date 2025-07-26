# RAG (Retrieval-Augmented Generation) System Implementation

This document describes the implementation of a RAG system that extracts content from files, chunks them into smaller pieces, converts them to vector embeddings, and stores them in a vector database for efficient retrieval.

## Overview

The RAG system consists of several key components:

1. **File Processing**: Extract text content from various file types (PDF, text files)
2. **Text Chunking**: Divide large documents into smaller, manageable chunks
3. **Vector Embeddings**: Convert text chunks to vector representations using OpenAI embeddings
4. **Vector Database**: Store and index vectors in Pinecone for fast similarity search
5. **Queue System**: Process files asynchronously using BullMQ and Redis

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   File      │    │   Text      │    │   Vector    │    │   Pinecone  │
│  Upload     │───▶│  Chunking   │───▶│ Embeddings  │───▶│   Vector    │
│             │    │             │    │             │    │  Database   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   MongoDB   │    │   Chunk     │    │   OpenAI    │    │   Index     │
│  File Store │    │  Metadata   │    │   API       │    │  Management │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Components

### 1. File Model (`src/model/files.model.ts`)

Stores file metadata and processing status:

```typescript
interface IFile {
  name: string;
  url: string;
  type: string;
  size?: number;
  userId: mongoose.Types.ObjectId;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  chunksCount?: number;
  vectorizedAt?: Date;
}
```

### 2. Text Chunking (`src/utils/textChunker.ts`)

Divides text into smaller chunks with configurable parameters:

- **Max Chunk Size**: Default 1000 characters
- **Overlap Size**: Default 200 characters for context continuity
- **Separator**: Default paragraph breaks (`\n\n`)

Features:

- Intelligent word boundary splitting
- Overlap management to maintain context
- Token estimation
- Metadata tracking for each chunk

### 3. Embedding Generator (`src/utils/embeddingGenerator.ts`)

Converts text chunks to vector embeddings:

- Uses OpenAI's `text-embedding-3-small` model (1536 dimensions)
- Batch processing for efficiency
- Retry logic for API failures
- Rate limiting protection

### 4. Vector Database (`src/connectors/pinecone.ts`)

Manages Pinecone vector database operations:

- Index creation and management
- Batch vector upserting
- Rate limiting and error handling
- Query functionality for similarity search

### 5. RAG Builder Worker (`src/workers/RAGBuilderWorker.ts`)

Background worker that processes files:

- Extracts content from files
- Chunks text into manageable pieces
- Generates vector embeddings
- Upserts vectors to Pinecone
- Updates file processing status

### 6. Queue System (`src/connectors/RAGBuilderQueue.ts`)

Manages job queuing with BullMQ:

- Job scheduling and prioritization
- Retry logic with exponential backoff
- Job status tracking
- Queue monitoring

## API Endpoints

### Documents API (`/api/v1/documents`)

- `POST /upload` - Upload a new document
- `GET /` - Get all documents for user
- `GET /:fileId` - Get specific document
- `DELETE /:fileId` - Delete document
- `POST /:fileId/retry` - Retry failed processing
- `GET /stats/processing` - Get processing statistics

## Configuration

### Environment Variables

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USE_TLS=false

# MongoDB
MONGODB_URI=mongodb://localhost:27017
DB_NAME=documind

# Queue
RAG_BUILDER_QUEUE_NAME=rag-builder-queue

# JWT
ACCESS_TOKEN_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
```

## Usage

### 1. Start the Server

```bash
npm run dev
```

The server will:

- Connect to MongoDB
- Connect to Redis
- Start the RAG builder worker
- Start the Express server

### 2. Upload a Document

```bash
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Sample Document",
    "url": "https://example.com/document.pdf",
    "type": "application/pdf",
    "size": 1024
  }'
```

### 3. Monitor Processing

```bash
curl -X GET http://localhost:8000/api/v1/documents/stats/processing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test the System

```bash
node test-rag.js
```

## Processing Flow

1. **File Upload**: User uploads file metadata via API
2. **Job Queuing**: File is added to RAG builder queue
3. **Content Extraction**: Worker extracts text content from file
4. **Text Chunking**: Content is divided into smaller chunks
5. **Embedding Generation**: Chunks are converted to vector embeddings
6. **Vector Storage**: Embeddings are stored in Pinecone
7. **Status Update**: File processing status is updated in MongoDB

## Performance Considerations

- **Batch Processing**: Embeddings are generated in batches of 100
- **Rate Limiting**: Delays between API calls to respect limits
- **Error Handling**: Comprehensive retry logic and error recovery
- **Memory Management**: Processing files individually to avoid memory issues
- **Queue Management**: Job prioritization and cleanup

## Monitoring

The system provides comprehensive logging:

- File processing status updates
- Chunk creation statistics
- Embedding generation progress
- Vector database operations
- Error tracking and recovery

## Future Enhancements

1. **Additional File Types**: Support for images, audio, and other formats
2. **Advanced Chunking**: Semantic chunking based on content structure
3. **Caching**: Redis caching for frequently accessed embeddings
4. **Scaling**: Horizontal scaling with multiple workers
5. **Analytics**: Processing metrics and performance monitoring
6. **Search API**: Endpoint for similarity search and retrieval

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**: Check API key and rate limits
2. **Pinecone Connection**: Verify API key and index configuration
3. **Redis Connection**: Ensure Redis server is running
4. **MongoDB Connection**: Check connection string and database access
5. **File Processing Failures**: Verify file URLs and supported formats

### Debug Mode

Enable debug logging by setting environment variables:

```env
DEBUG=true
LOG_LEVEL=debug
```

## Security Considerations

- JWT authentication for all API endpoints
- User isolation (files are scoped to user)
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure file URL validation
