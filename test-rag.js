const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:8000/api/v1";
let authToken = "";

// Test data
const testFile = {
  name: "Sample Document",
  url: "https://docs.google.com/document/d/1rKQ-mpQczE6H1XiqBbGPQPtN766mrtFLW0-DHTQTpm0/edit?usp=sharing",
  type: "application/pdf",
  size: 1024,
};

// Helper function to make authenticated requests
const makeAuthRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    ...(data && { data }),
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(
      `Error in ${method} ${endpoint}:`,
      error.response?.data || error.message
    );
    throw error;
  }
};

// Test functions
const testAuth = async () => {
  console.log("🔐 Testing authentication...");

  // Register a test user
  try {
    await makeAuthRequest("POST", "/auth/register", {
      email: "test@example.com",
      password: "testpassword123",
    });
    console.log("✅ User registered successfully");
  } catch (error) {
    if (error.response?.status === 409) {
      console.log("ℹ️ User already exists, proceeding with login");
    } else {
      throw error;
    }
  }

  // Login
  const loginResponse = await makeAuthRequest("POST", "/auth/login", {
    email: "test@example.com",
    password: "testpassword123",
  });

  authToken = loginResponse.data.accessToken;
  console.log("✅ Login successful");
};

const testFileUpload = async () => {
  console.log("\n📄 Testing file upload...");

  const uploadResponse = await makeAuthRequest(
    "POST",
    "/documents/upload",
    testFile
  );
  console.log("✅ File uploaded successfully:", uploadResponse.data.name);

  return uploadResponse.data._id;
};

const testGetDocuments = async () => {
  console.log("\n📋 Testing get documents...");

  const documentsResponse = await makeAuthRequest("GET", "/documents");
  console.log(
    "✅ Documents retrieved:",
    documentsResponse.data.length,
    "files"
  );

  return documentsResponse.data;
};

const testProcessingStats = async () => {
  console.log("\n📊 Testing processing statistics...");

  const statsResponse = await makeAuthRequest(
    "GET",
    "/documents/stats/processing"
  );
  console.log("✅ Processing stats retrieved:", statsResponse.data);

  return statsResponse.data;
};

const waitForProcessing = async (fileId, maxWaitTime = 60000) => {
  console.log("\n⏳ Waiting for file processing...");

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const documents = await makeAuthRequest("GET", "/documents");
      const file = documents.data.find((doc) => doc._id === fileId);

      if (file) {
        console.log(`📊 File status: ${file.processingStatus}`);

        if (file.processingStatus === "completed") {
          console.log("✅ File processing completed!");
          console.log(`📄 Chunks created: ${file.chunksCount}`);
          return file;
        } else if (file.processingStatus === "failed") {
          console.log("❌ File processing failed");
          return file;
        }
      }

      // Wait 5 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Error checking file status:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log("⏰ Timeout waiting for processing");
  return null;
};

// Main test function
const runTests = async () => {
  try {
    console.log("🚀 Starting RAG system tests...\n");

    // Test authentication
    await testAuth();

    // Test file upload
    const fileId = await testFileUpload();

    // Test get documents
    await testGetDocuments();

    // Test processing stats
    await testProcessingStats();

    // Wait for processing to complete
    const processedFile = await waitForProcessing(fileId);

    if (processedFile && processedFile.processingStatus === "completed") {
      console.log("\n🎉 All tests passed! RAG system is working correctly.");
      console.log(
        `📊 Final stats: ${processedFile.chunksCount} chunks created and vectorized`
      );
    } else {
      console.log(
        "\n⚠️ Tests completed but file processing may have failed or timed out."
      );
    }
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testAuth,
  testFileUpload,
  testGetDocuments,
  testProcessingStats,
  waitForProcessing,
};
