import pdf from "pdf-parse";
import axios from "axios";

export const extractRemoteFileContent = async (
  url: string,
  mimetype: string
): Promise<string | false> => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    if (mimetype === "application/pdf") {
      const data = await pdf(buffer);
      return data.text;
    } else if (mimetype.startsWith("text/")) {
      return buffer.toString("utf8");
    } else {
      // Optionally add more types (images, audio, etc.)
      console.error("Unsupported remote file type:", mimetype);
      return false;
    }
  } catch (error) {
    console.error("Error fetching or extracting remote file:", error);
    return false;
  }
};
