export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  FRONTEND_URL: string;
}

export interface SessionPayload {
  iid: number;       // installation_id
  owner: string;
  repo: string;
  exp: number;
}
