import { describe, expect, it } from "vitest";

import { parseTrendingRepositoryNames } from "../src/github/trending";

describe("parseTrendingRepositoryNames", () => {
  it("extracts repository names from GitHub trending HTML", () => {
    const html = `
      <article>
        <h2 class="h3 lh-condensed">
          <a href="/foo/bar"> foo / bar </a>
        </h2>
      </article>
      <article>
        <h2 class="h3 lh-condensed">
          <a href="/baz/qux"> baz / qux </a>
        </h2>
      </article>
    `;

    expect(parseTrendingRepositoryNames(html)).toEqual(["foo/bar", "baz/qux"]);
  });
});
