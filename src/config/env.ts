import dotenv from "dotenv";

dotenv.config({ quiet: true });

export interface WecomRobotConfig {
  webhookUrl: string;
}

export function getWecomRobotConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WecomRobotConfig {
  const webhookUrl = env.GITRADAR_WECOM_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    throw new Error(
      "Missing GITRADAR_WECOM_WEBHOOK_URL. Set it in your environment or .env file.",
    );
  }

  try {
    // Validate format without hard-coding a single hostname, so tests can use mock URLs.
    new URL(webhookUrl);
  } catch {
    throw new Error("GITRADAR_WECOM_WEBHOOK_URL is not a valid URL.");
  }

  return { webhookUrl };
}
