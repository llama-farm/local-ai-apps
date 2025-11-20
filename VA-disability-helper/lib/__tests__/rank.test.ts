import { describe, it, expect } from "vitest";
import { extractTopExcerpts } from "../rank";

describe("extractTopExcerpts", () => {
  const sampleChunks = [
    "Patient presented with fever and cough. Temperature was 101.2F.",
    "Impression: Likely viral upper respiratory infection. Recommend rest and fluids.",
    "Lab Results: CBC shows elevated WBC count at 12.5k. All other values normal.",
    "The patient has a history of hypertension managed with lisinopril 10mg daily.",
    "Assessment: Continue current medications. Follow up in 2 weeks.",
    "Patient denies chest pain, shortness of breath, or other concerning symptoms.",
  ];

  it("should return top k excerpts based on query relevance", () => {
    const query = "fever cough";
    const excerpts = extractTopExcerpts(query, sampleChunks, 3);

    expect(excerpts.length).toBe(3);
    expect(excerpts[0]).toContain("fever");
  });

  it("should boost excerpts with headings", () => {
    const query = "infection";
    const excerpts = extractTopExcerpts(query, sampleChunks, 2);

    const hasImpression = excerpts.some((e) => e.includes("Impression"));
    expect(hasImpression).toBe(true);
  });

  it("should handle queries with no matches", () => {
    const query = "xylophone zebra quantum";
    const excerpts = extractTopExcerpts(query, sampleChunks, 3);

    expect(excerpts.length).toBe(3);
  });

  it("should respect k parameter", () => {
    const query = "patient";
    const excerpts = extractTopExcerpts(query, sampleChunks, 2);

    expect(excerpts.length).toBe(2);
  });

  it("should handle empty chunks", () => {
    const query = "test";
    const excerpts = extractTopExcerpts(query, [], 3);

    expect(excerpts).toEqual([]);
  });

  it("should be case insensitive", () => {
    const query = "FEVER COUGH";
    const excerpts = extractTopExcerpts(query, sampleChunks, 2);

    expect(excerpts.length).toBe(2);
    expect(excerpts[0].toLowerCase()).toContain("fever");
  });

  it("should handle special characters in query", () => {
    const query = "101.2F";
    const excerpts = extractTopExcerpts(query, sampleChunks, 2);

    expect(excerpts.length).toBe(2);
  });
});
