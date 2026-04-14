import { describe, expect, it } from "vitest";
import { parseTrendingRepositoryNames } from "../../src/github/trending";

describe("parseTrendingRepositoryNames", () => {
  it("extracts repo names from trending HTML", () => {
    const html = `
      <article>
        <h2><a href="/facebook/react">facebook / react</a></h2>
      </article>
      <article>
        <h2><a href="/vercel/next.js">vercel / next.js</a></h2>
      </article>
    `;
    const result = parseTrendingRepositoryNames(html);
    expect(result).toContain("facebook/react");
    expect(result).toContain("vercel/next.js");
  });

  it("returns empty array for non-matching HTML", () => {
    const result = parseTrendingRepositoryNames("<html><body>nothing</body></html>");
    expect(result).toEqual([]);
  });

  it("deduplicates repo names", () => {
    const html = `
      <h2><a href="/owner/repo">1</a></h2>
      <h2><a href="/owner/repo">2</a></h2>
    `;
    const result = parseTrendingRepositoryNames(html);
    expect(result).toEqual(["owner/repo"]);
  });
});
