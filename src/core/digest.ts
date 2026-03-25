export interface DigestItem {
  repo: string;
  url: string;
  summary: string;
  whyItMatters: string;
  novelty: string;
  trend: string;
}

export interface DailyDigest {
  date: string;
  title: string;
  items: DigestItem[];
}
