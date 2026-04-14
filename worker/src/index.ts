import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import auth from "./auth";
import proxy from "./proxy";

const app = new Hono<{ Bindings: Env }>();

// CORS: allow frontend origin for API proxy routes
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.FRONTEND_URL;
      return origin === allowed ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
    maxAge: 86400,
  }),
);

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Auth routes (no CORS needed — browser navigates directly)
app.route("/auth", auth);

// API proxy routes
app.route("/api/github", proxy);

export default app;
