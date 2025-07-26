export interface TextChunk {
  id: string;
  content: string;
  metadata: {
    fileId: string;
    fileName: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    tokens?: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  separator?: string;
}

const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000, // characters
  overlapSize: 200, // characters
  separator: "\n\n", // paragraph separator
};

export const chunkText = (
  text: string,
  fileId: string,
  fileName: string,
  options: ChunkingOptions = {}
): TextChunk[] => {
  const config = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  // Clean and normalize text
  const cleanText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If text is smaller than max chunk size, return as single chunk
  if (cleanText.length <= config.maxChunkSize) {
    chunks.push({
      id: `${fileId}-chunk-0`,
      content: cleanText,
      metadata: {
        fileId,
        fileName,
        chunkIndex: 0,
        startChar: 0,
        endChar: cleanText.length,
        tokens: estimateTokens(cleanText),
      },
    });
    return chunks;
  }

  // Split text by separator first
  const segments = cleanText.split(config.separator);
  let currentChunk = "";
  let chunkIndex = 0;
  let startChar = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) continue;

    // If adding this segment would exceed max chunk size
    if (
      currentChunk.length + segment.length + config.separator.length >
      config.maxChunkSize
    ) {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push({
          id: `${fileId}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            fileId,
            fileName,
            chunkIndex,
            startChar,
            endChar: startChar + currentChunk.length,
            tokens: estimateTokens(currentChunk),
          },
        });
        chunkIndex++;
      }

      // Start new chunk with overlap
      const overlap = getOverlap(currentChunk, config.overlapSize);
      currentChunk = overlap + config.separator + segment;
      startChar = Math.max(
        0,
        startChar +
          currentChunk.length -
          overlap.length -
          config.separator.length -
          segment.length
      );
    } else {
      // Add segment to current chunk
      if (currentChunk) {
        currentChunk += config.separator + segment;
      } else {
        currentChunk = segment;
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      id: `${fileId}-chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        fileId,
        fileName,
        chunkIndex,
        startChar,
        endChar: startChar + currentChunk.length,
        tokens: estimateTokens(currentChunk),
      },
    });
  }

  return chunks;
};

const getOverlap = (text: string, overlapSize: number): string => {
  if (text.length <= overlapSize) {
    return text;
  }

  // Try to break at word boundaries
  const lastSpaceIndex = text.lastIndexOf(" ", text.length - overlapSize);
  if (lastSpaceIndex > text.length - overlapSize - 50) {
    return text.substring(lastSpaceIndex + 1);
  }

  return text.substring(text.length - overlapSize);
};

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

export const mergeOverlappingChunks = (chunks: TextChunk[]): TextChunk[] => {
  if (chunks.length <= 1) return chunks;

  const merged: TextChunk[] = [];
  let currentChunk = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const nextChunk = chunks[i];

    // Check if chunks overlap significantly
    const overlap = findOverlap(currentChunk.content, nextChunk.content);

    if (
      overlap.length >
      Math.min(currentChunk.content.length, nextChunk.content.length) * 0.3
    ) {
      // Merge chunks
      const mergedContent =
        currentChunk.content +
        "\n\n" +
        nextChunk.content.substring(overlap.length);
      currentChunk = {
        ...currentChunk,
        content: mergedContent,
        metadata: {
          ...currentChunk.metadata,
          endChar: nextChunk.metadata.endChar,
          tokens: estimateTokens(mergedContent),
        },
      };
    } else {
      // No significant overlap, save current chunk and start new one
      merged.push(currentChunk);
      currentChunk = nextChunk;
    }
  }

  // Add the last chunk
  merged.push(currentChunk);
  return merged;
};

const findOverlap = (str1: string, str2: string): string => {
  const minLength = Math.min(str1.length, str2.length);

  for (let i = minLength; i > 0; i--) {
    const suffix = str1.substring(str1.length - i);
    const prefix = str2.substring(0, i);

    if (suffix === prefix) {
      return suffix;
    }
  }

  return "";
};
