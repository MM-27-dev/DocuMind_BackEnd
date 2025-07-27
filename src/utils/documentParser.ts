import pdfParse from "pdf-parse";

// Parse PDF
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF file");
  }
}

// Parse DOCX
export async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    console.warn("DOCX parsing is limited without mammoth library");
    return "DOCX content extraction requires mammoth library to be installed";
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Failed to parse DOCX file");
  }
}

// Parse TXT
export function parseTxt(buffer: Buffer): string {
  try {
    return buffer.toString("utf-8");
  } catch (error) {
    console.error("Error parsing TXT:", error);
    throw new Error("Failed to parse TXT file");
  }
}
