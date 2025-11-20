export function extractTopExcerpts(
  query: string,
  chunks: string[],
  k = 6
): string[] {
  const queryTerms = query
    .toLowerCase()
    .split(/[^a-z0-9.%]+/)
    .filter(Boolean);

  const scored = chunks.map((chunk, idx) => {
    const lowerChunk = chunk.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedTerm}\\b`, "g");
      const matches = lowerChunk.match(regex);
      score += matches?.length || 0;
    }

    const headingBoosts = [
      /^impression/i,
      /^assessment/i,
      /^summary/i,
      /^diagnos/i,
    ];

    if (headingBoosts.some((pattern) => pattern.test(chunk))) {
      score += 2.5;
    }

    return { idx, score, chunk };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => item.chunk);
}
