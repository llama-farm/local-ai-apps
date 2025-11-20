import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  // Use CDN worker for reliability across all environments
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export async function parsePdfToText(
  file: File
): Promise<{ text: string; pages: number }> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const strings: string[] = textContent.items
      .map((item: any) => item.str)
      .filter(Boolean);

    const pageText = strings.join(" ").replace(/\s+/g, " ").trim();
    fullText += `\n\n[[Page ${pageNum}]]\n${pageText}`;
  }

  return {
    text: fullText.trim(),
    pages: pdf.numPages,
  };
}
