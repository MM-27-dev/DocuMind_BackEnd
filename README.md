📘 DocuMind Backend
This is the backend service for the DocuMind project — an AI-powered document assistant that allows users to connect their Google Drive, ingest documents, and chat with an AI that understands their files using RAG (Retrieval-Augmented Generation).

🌐 Live Deployments
Frontend: https://docu-mind-front-end.vercel.app
Backend API: https://documind-backend-ijex.onrender.com
MCP Server (RAG Core): https://mcp-server-thci.onrender.com

🧠 Features
✅ Google Drive Integration
OAuth2.0 Google Login
Secure token storage
List & fetch documents
Ingest documents (PDF, DOCX, TXT)
Auto webhook setup for file changes

🧠 AI Chat Assistant (RAG)
Embeds document content using OpenAI
Stores vector data in Pinecone
Retrieves context using semantic similarity
Streams intelligent answers based on file content

🧵 Session & Message Management
Persistent user sessions
Tracks message history
Sends and stores AI responses

⚙️ Queue-based Processing
Uses BullMQ + Redis for file ingestion
Workers process ingestion jobs asynchronously

🚀 How to Run Locally
1. Clone the Repos
git clone https://github.com/MM-27-dev/DocuMind_BackEnd.git
cd DocuMind_BackEnd

2. Install Dependencies
npm install

3. Set Up .env
Create a .env file in the root with the following values:
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/auth/google/callback

# Base URLs
BASE_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017
DB_NAME=documind

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI + Pinecone
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key

# RAG Queue
RAG_BUILDER_QUEUE_NAME=rag-builder-queue

# Auth
ACCESS_TOKEN_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

4. Start Backend Server
npm run dev

🧩 API Overview
🔐 Google Drive Auth
| Method | Endpoint                                 | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/api/google-drive/auth/google`          | Redirects to Google OAuth screen |
| GET    | `/api/google-drive/auth/google/callback` | Callback after Google consent    |
| GET    | `/api/google-drive/list-files`           | Lists Google Drive files         |
| GET    | `/api/google-drive/get-file/:fileId`     | Downloads and parses file        |
| POST   | `/api/google-drive/ingest-documents`     | Triggers ingestion of all files  |

💬 AI Chat System
| Method | Endpoint                            | Description                             |
| ------ | ----------------------------------- | --------------------------------------- |
| POST   | `/api/chat/send-message/:sessionId` | Sends user message and gets AI response |
| GET    | `/api/chat/sessions`                | Lists user sessions                     |
| POST   | `/api/chat/sessions/create`         | Creates a new chat session              |

🔁 Backend RAG Flow
User logs in via Google OAuth
Google tokens are saved to the DB
User chooses to ingest Google Drive files
Files are downloaded and parsed
Text is chunked and embedded using OpenAI
Embeddings are stored in Pinecone with metadata
User chats — messages & history are sent to OpenAI
RAG tool is auto-invoked to retrieve document-based responses
AI response is streamed back and saved

🧰 Technologies Used
Backend: Node.js, Express.js, TypeScript
Auth: Google OAuth2
Queue: BullMQ, Redis
Vector DB: Pinecone
Embedding: OpenAI API
Database: MongoDB + Mongoose
Cloud: Vercel, Render

📋 Notes
Webhooks for file update monitoring are simulated, not native Google push notifications
RAG pipeline can be extended to support other file types

✅ Future Enhancements
Add native Google webhook support for file change detection
Add support for image and audio transcription
Enhance chunking with semantic parsing
Add search endpoint using Pinecone


## Thank YOU

🙌 Author
Monika Muniraju
📧 monikamuniraju27@gmail.com
📱 +91 93535 13002
🔗 LinkedIn

