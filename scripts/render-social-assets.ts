import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const ROOT_DIR = path.resolve(__dirname, "..");

const ASSETS = [
  {
    input: path.join(ROOT_DIR, "docs", "assets", "release-cover-v2.0.0.svg"),
    output: path.join(ROOT_DIR, "docs", "assets", "release-cover-v2.0.0.png"),
    width: 1600,
    height: 900,
  },
  {
    input: path.join(ROOT_DIR, "docs", "assets", "showcase-hero.svg"),
    output: path.join(ROOT_DIR, "docs", "assets", "showcase-hero.png"),
    width: 1280,
    height: 640,
  },
  {
    input: path.join(ROOT_DIR, "docs", "assets", "github-pinned-preview.svg"),
    output: path.join(ROOT_DIR, "docs", "assets", "github-pinned-preview.png"),
    width: 800,
    height: 420,
  },
  {
    input: path.join(ROOT_DIR, "docs", "assets", "wecom-sample-digest.svg"),
    output: path.join(ROOT_DIR, "docs", "assets", "wecom-sample-digest.png"),
    width: 1600,
    height: 1200,
  },
];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const asset of ASSETS) {
      await mkdir(path.dirname(asset.output), { recursive: true });

      const page = await browser.newPage({
        viewport: {
          width: asset.width,
          height: asset.height,
        },
        deviceScaleFactor: 1,
      });

      const sourceUrl = `file://${asset.input}`;
      await page.setContent(
        `
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <style>
                html, body {
                  margin: 0;
                  width: ${asset.width}px;
                  height: ${asset.height}px;
                  overflow: hidden;
                  background: transparent;
                }

                img {
                  display: block;
                  width: ${asset.width}px;
                  height: ${asset.height}px;
                }
              </style>
            </head>
            <body>
              <img src="${sourceUrl}" alt="" />
            </body>
          </html>
        `,
        { waitUntil: "load" },
      );

      await page.screenshot({
        path: asset.output,
        omitBackground: false,
      });
      await page.close();

      console.log(`Rendered ${path.relative(ROOT_DIR, asset.output)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to render social assets: ${message}`);
  process.exitCode = 1;
});
