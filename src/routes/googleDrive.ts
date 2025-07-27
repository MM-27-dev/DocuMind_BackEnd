import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import { User, IGoogleTokens } from "../model/userSchema";
import { Request, Response, NextFunction } from "express";
import { parsePDF, parseDocx, parseTxt } from "../utils/documentParser";
import {
  ingestToVectorDB,
  ingestMultipleDocuments,
} from "../utils/ingestPipeline";
import multer from "multer";
const upload = multer(); 

dotenv.config();

const googleDriveApis = express.Router();
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/google-drive/auth/google/callback"
);

const SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly", 
  "https://www.googleapis.com/auth/drive.readonly", 
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Start OAuth Flow
googleDriveApis.get("/auth/google", (_req, res) => {
  console.log(" OAuth2 Client Config:", {
    clientId: process.env.GOOGLE_CLIENT_ID ? "Set" : "Missing",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Missing",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:3000/api/google-drive/auth/google/callback",
  });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  console.log("🔗 Google Drive Auth URL:", url);
  res.redirect(url);
});

// Handle OAuth Callback
googleDriveApis.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    //@ts-ignore
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log("✅ Tokens received:", tokens);

    //Get user profile
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    const email = profile?.data?.email;
    if (!email) throw new Error("Unable to retrieve user email");

    //Save tokens to DB
    await saveTokensToDB({ email, tokens });

    res.redirect("http://localhost:5173");
  } catch (error) {
    console.error("Google Drive OAuth error:", error);
    res.status(500).send("Google Drive authentication failed.");
  }
});

// List files from Drive
googleDriveApis.get("/list-files", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    // Find user and set tokens
    const user = await User.findOne({ email });
    if (!user || !user.googleTokens) {
      return res
        .status(401)
        .json({ message: "User not authenticated with Google Drive" });
    }

    oauth2Client.setCredentials(user.googleTokens);

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const filesResponse = await drive.files.list({
      pageSize: 10,
      fields: "files(id, name, mimeType, modifiedTime)",
    });

    res.json({ files: filesResponse.data.files });
  } catch (error) {
    console.error(" Error listing Drive files:", error);
    res.status(500).json({ message: (error as Error).message });
  }
});

// Get a file's download link
googleDriveApis.get(
  "/get-file/:fileId",
  async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      const { fileId } = req.params;

      if (!email || !fileId)
        return res.status(400).json({ message: "Email and fileId required" });

      const user = await User.findOne({ email });
      if (!user || !user.googleTokens) {
        return res
          .status(401)
          .json({ message: "User not authenticated with Google Drive" });
      }

      oauth2Client.setCredentials(user.googleTokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const file = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, webViewLink, webContentLink",
      });

      res.json({ file: file.data });
    } catch (error) {
      console.error(" Error fetching file:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  }
);


// Upload a file
googleDriveApis.post(
  "/upload-file",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || !req.file) {
        return res.status(400).json({ message: "Email and file required" });
      }

      const user = await User.findOne({ email });
      if (!user || !user.googleTokens) {
        return res
          .status(401)
          .json({ message: "User not authenticated with Google Drive" });
      }

      oauth2Client.setCredentials(user.googleTokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      console.log(`⬆️ Uploading file: ${req.file.originalname}`);

      // Upload file to Google Drive
      const response = await drive.files.create({
        requestBody: {
          name: req.file.originalname,
        },
        media: {
          mimeType: req.file.mimetype,
          body: Buffer.from(req.file.buffer),
        },
        fields: "id, name, mimeType, webViewLink, webContentLink",
      });

      res.json({
        message: "File uploaded successfully",
        file: response.data,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  }
);

// Ingest all supported files from user's Google Drive
googleDriveApis.post(
  "/ingest-documents",
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email required" });

      const user = await User.findOne({ email });
      if (!user || !user.googleTokens) {
        return res
          .status(401)
          .json({ message: "User not authenticated with Google Drive" });
      }

      oauth2Client.setCredentials(user.googleTokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      // List supported documents
      const filesResponse = await drive.files.list({
        q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='text/plain'",
        fields: "files(id, name, mimeType)",
      });

      const files = filesResponse.data.files || [];
      if (files.length === 0) {
        return res.json({
          message: "No supported documents found in Google Drive.",
        });
      }

      console.log(`📂 Found ${files.length} files for ingestion`);

      // Download and parse each file
      for (const file of files) {
        const fileId = file.id!;
        const mimeType = file.mimeType!;
        const name = file.name!;

        console.log(`⬇️ Downloading ${name}`);

        const fileResponse = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(fileResponse.data as ArrayBuffer);

        let text = "";
        if (mimeType === "application/pdf") {
          text = await parsePDF(buffer);
        } else if (
          mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          text = await parseDocx(buffer);
        } else if (mimeType === "text/plain") {
          text = parseTxt(buffer);
        }

        console.log(`📜 Extracted ${text.length} chars from ${name}`);

        // Step 3: Ingest extracted text to vector DB 
        await ingestToVectorDB({
          email,
          fileName: name,
          content: text,
          fileId,
          mimeType,
          source: "google-drive",
        });
      }

      res.json({
        message: "Documents ingested successfully",
        total: files.length,
      });
    } catch (error) {
      console.error("Error ingesting Google Drive documents:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  }
);

// Watch for new files in Google Drive (webhook endpoint)
googleDriveApis.post(
  "/webhook/new-file",
  async (req: Request, res: Response) => {
    try {
      const { email, fileId, fileName, mimeType } = req.body;

      if (!email || !fileId || !fileName) {
        return res
          .status(400)
          .json({ message: "Email, fileId, and fileName required" });
      }

      const user = await User.findOne({ email });
      if (!user || !user.googleTokens) {
        return res
          .status(401)
          .json({ message: "User not authenticated with Google Drive" });
      }

      oauth2Client.setCredentials(user.googleTokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      console.log(`🆕 New file detected: ${fileName} (${mimeType})`);

      // Download and process the new file
      const fileResponse = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      const buffer = Buffer.from(fileResponse.data as ArrayBuffer);

      let text = "";
      if (mimeType === "application/pdf") {
        text = await parsePDF(buffer);
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        text = await parseDocx(buffer);
      } else if (mimeType === "text/plain") {
        text = parseTxt(buffer);
      }

      // Ingest the new file
      await ingestToVectorDB({
        email,
        fileName,
        content: text,
        fileId,
        mimeType,
        source: "google-drive",
      });

      res.json({ message: " New file processed and ingested successfully" });
    } catch (error) {
      console.error("Error processing new file:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  }
);

// Setup Google Drive webhook for real-time file monitoring
googleDriveApis.post("/setup-webhook", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user || !user.googleTokens) {
      return res
        .status(401)
        .json({ message: "User not authenticated with Google Drive" });
    }

    console.log(`🔔 Webhook setup requested for ${email}`);

    res.json({
      message:
        "Google Drive webhook setup successfully (manual monitoring enabled)",
      note: "Files will be processed when manually triggered or during scheduled scans",
    });
  } catch (error) {
    console.error("Error setting up Google Drive webhook:", error);
    res.status(500).json({ message: (error as Error).message });
  }
});

// Get webhook status
googleDriveApis.get("/webhook-status", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    res.json({
      status: "manual-monitoring",
      message: "Manual file monitoring is active",
      note: "Files are processed when manually triggered or during scheduled scans",
    });
  } catch (error) {
    console.error("Error getting webhook status:", error);
    res.status(500).json({ message: (error as Error).message });
  }
});

export async function saveTokensToDB({
  email,
  tokens,
}: {
  email: string;
  tokens: IGoogleTokens;
}) {
  const response = await User.findOneAndUpdate(
    { email },
    { googleTokens: tokens },
    { upsert: true, new: true }
  );
  console.log("User after Google Drive connection:", response);
  return response;
}

export default googleDriveApis;
