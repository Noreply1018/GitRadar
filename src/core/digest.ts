export interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
  whyItMatters: string;
  whyNow: string;
  evidence: string[];
  novelty: string;
  trend: string;
}

export interface DailyDigest {
  date: string;
  title: string;
  items: DigestItem[];
}
