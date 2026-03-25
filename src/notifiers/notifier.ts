import type { DailyDigest } from "../core/digest";

export interface Notifier {
  sendDailyDigest(digest: DailyDigest): Promise<void>;
}
