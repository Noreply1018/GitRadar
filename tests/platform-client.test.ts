import { createServer } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitHubPlatformClient } from "../src/github/platform-client";

describe("GitHubPlatformClient", () => {
  let server: ReturnType<typeof createServer>;
  let lastUrl = "";
  let lastBody = "";

  beforeEach(async () => {
    lastUrl = "";
    lastBody = "";

    server = createServer(async (request, response) => {
      lastUrl = request.url ?? "";
      const chunks: Buffer[] = [];

      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      lastBody = Buffer.concat(chunks).toString("utf8");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify([{ html_url: "https://example.com/pr/1", number: 1 }]),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("queries open pull requests by owner-qualified head branch", async () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server.");
    }

    const client = new GitHubPlatformClient({
      token: "token",
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
    });

    const result = await client.findOpenPullRequest("Noreply1018", "GitRadar", {
      head: "console-writeback/test",
      base: "main",
    });

    expect(result).toEqual({
      html_url: "https://example.com/pr/1",
      number: 1,
    });
    expect(lastUrl).toContain(
      "/repos/Noreply1018/GitRadar/pulls?state=open&head=Noreply1018%3Aconsole-writeback%2Ftest&base=main",
    );
    expect(lastBody).toBe("");
  });
});
