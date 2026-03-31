import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "playwright";

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_URL = process.env.GITRADAR_SCREENSHOT_BASE_URL?.trim()
  ? process.env.GITRADAR_SCREENSHOT_BASE_URL.trim()
  : "http://127.0.0.1:3210";
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "assets", "console");

async function main(): Promise<void> {
  await waitForHealth();
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  await capture(page, "console-home.png");

  await page.getByRole("button", { name: "环境配置" }).click();
  await page.waitForTimeout(800);
  await capture(page, "console-environment.png");

  await page.getByRole("button", { name: "收藏与待看" }).click();
  await page.waitForTimeout(800);
  await capture(page, "console-saved.png");

  await page.getByRole("button", { name: "归档日报" }).click();
  await page.waitForTimeout(1000);
  await capture(page, "console-archive-reader.png");

  await browser.close();

  console.log(`Saved GitRadar console screenshots to ${OUTPUT_DIR}`);
}

async function waitForHealth(): Promise<void> {
  let lastError = "unknown";

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `GitRadar console is not reachable at ${BASE_URL}/api/health: ${lastError}`,
  );
}

async function capture(page: Page, fileName: string): Promise<void> {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    fullPage: true,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to capture GitRadar screenshots: ${message}`);
  process.exitCode = 1;
});
