export function chunkTextSmart(
  text: string,
  targetSize = 1200,
  overlap = 150
): string[] {
  const lines = text.split(/\n+/).map((l) => l.trim());
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const combined = buffer.join(" ").trim();
    if (combined) paragraphs.push(combined);
    buffer = [];
  };

  const headingPatterns = [
    /^(abstract|impression|assessment|plan|lab results|cbc|cmp|history|findings|conclusion)[:\-\s]?/i,
    /^.{1,70}:$/,
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isHeading = headingPatterns.some((pattern) => pattern.test(line));

    if (isHeading && buffer.length > 0) {
      flushBuffer();
    }

    buffer.push(line);
    const joined = buffer.join(" ");

    if (joined.length >= targetSize) {
      flushBuffer();
    }
  }

  flushBuffer();

  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= targetSize * 1.2) {
      chunks.push(para);
    } else {
      for (let i = 0; i < para.length; i += targetSize - overlap) {
        chunks.push(para.slice(i, i + targetSize));
      }
    }
  }

  return chunks;
}
