import { describe, it, expect } from "vitest";
import { chunkTextSmart } from "../chunk";

describe("chunkTextSmart", () => {
  it("should split text into chunks of approximately target size", () => {
    const text = "Lorem ipsum dolor sit amet. ".repeat(100);
    const chunks = chunkTextSmart(text, 500, 50);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(550);
    });
  });

  it("should respect heading boundaries", () => {
    const text = `
Impression: Patient shows signs of improvement.
This is additional detail about the impression section with many words to fill space.

Assessment: The condition is stable and improving over time.
More details here about the assessment that takes up space in this paragraph.

Lab Results: CBC within normal limits.
Additional lab information provided here with some extra content.
    `;

    const chunks = chunkTextSmart(text, 150, 30);

    expect(chunks.length).toBeGreaterThan(0);
    const hasImpression = chunks.some((c) => c.includes("Impression"));
    const hasAssessment = chunks.some((c) => c.includes("Assessment"));
    expect(hasImpression).toBe(true);
    expect(hasAssessment).toBe(true);
  });

  it("should handle empty text", () => {
    const chunks = chunkTextSmart("", 1200, 150);
    expect(chunks).toEqual([]);
  });

  it("should handle very short text", () => {
    const text = "Short text.";
    const chunks = chunkTextSmart(text, 1200, 150);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  it("should create overlapping chunks for long paragraphs", () => {
    const longParagraph = "A ".repeat(2000);
    const chunks = chunkTextSmart(longParagraph, 1000, 100);

    expect(chunks.length).toBeGreaterThan(1);

    if (chunks.length > 1) {
      const overlap = chunks[0].slice(-100);
      expect(chunks[1].startsWith(overlap.slice(0, 50))).toBe(true);
    }
  });
});
