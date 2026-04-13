# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 用户约束

- 使用中文回复用户
- 大量改动代码后记得git commit


## What is GitRadar

Single-user GitHub-native daily digest tool. Discovers trending open-source projects, generates Chinese summaries via LLM, pushes to WeChat Work (企业微信). Runs entirely on GitHub Actions — no local runtime required in production.

Current status: rebuilding as v1. See `SPEC/v1/` for the full spec, `SPEC/v1/audit.md` for scope boundaries.

## Commands

```bash
# Quality gates (run all before committing)
npm run format:check    # Prettier
npm run lint:md         # markdownlint
npm run lint:yaml       # YAML lint via Prettier
npm run typecheck       # TypeScript (both src/ and web/)
npm run test            # Vitest

# Run a single test file
npx vitest run tests/digest-model.test.ts

# Core pipeline (local dev/debug only — production runs on GitHub Actions)
npm run generate:digest              # Generate digest locally
npm run generate:digest -- --send    # Generate and send to WeChat

# Validation
npm run validate:digest-rules -- --format json

# Web console (not v1 core — Phase B / v2)
npm run dev:web         # Dev server on port 4173
npm run build:web       # Production build
```

## Architecture

Six-layer pipeline with strict boundaries between layers:

1. **Source** (`src/github/candidates.ts`, `src/github/trending.ts`) — Fetches candidates from GitHub Trending + Search API
2. **Scoring** (`src/digest/rules.ts`) — Theme inference (9 themes), multi-factor scoring, diversity control, blacklist filtering
3. **Editorial** (`src/digest/model.ts`) — LLM call via OpenAI-compatible API, JSON response parsing, quality validation
4. **Archive** (`src/core/archive.ts`) — JSON archive to `data/history/YYYY-MM-DD.json`
5. **Delivery** (`src/notifiers/wecom-robot.ts`) — WeChat Work markdown with 4096-byte pagination
6. **Feedback** (`src/feedback/`) — Not v1 core, frozen until v2

Orchestration: `src/digest/generate.ts` → called by `src/commands/generate-daily-digest.ts`

GitHub API abstraction: `src/github/platform-client.ts` (all repo read/write via GitHub REST API, no git CLI)

## Key Design Decisions

- **LLM must succeed** — no template fallback. 3 retries, then throw. Template code in model.ts is being deleted per `SPEC/v1/deletion-plan.md`
- **Non-matching time slots exit 0** — cron runs every 5 min, only the matching slot executes the pipeline, all others must exit 0 silently
- **LLM failure = exit 1** — no archive generated, runtime failure written, WeChat failure notification sent
- **Node 20** — all workflows must use Node 20 LTS (being unified from mixed 20/24)

## Project Layout

```
src/commands/     CLI entry points (tsx)
src/core/         Domain models, date utils, logging, archive schema
src/digest/       Pipeline: generate.ts (orchestrator), model.ts (LLM), rules.ts (scoring)
src/github/       GitHub API: platform-client.ts, candidates.ts, trending.ts
src/config/       Config loading: env.ts, digest-rules.ts, schedule.ts, user-preferences.ts
src/notifiers/    WeChat Work robot
src/feedback/     Feedback system (v2, frozen)
web/src/          React SPA on GitHub Pages (v1 Phase B: read-only, v2: full)
config/           Repository config JSON files (schedule, rules, preferences)
data/history/     Daily digest archives (gitignored, written by workflow)
data/runtime/     Execution state (gitignored, written by workflow)
tests/            Vitest tests — mocks use node:http createServer, not mocking libraries
SPEC/v1/          v1 spec, audit, deletion plan, rebuild plan
SPEC/v2/          v2 scope (Web config, feedback, writeback)
```

## Testing Patterns

- Framework: Vitest with globals enabled
- HTTP mocking: real `node:http` servers, not mock libraries
- Tests validate business rules (evidence authenticity, summary quality detection via regex, WeChat byte limits)
- Error paths get equal coverage to happy paths

## Config Files

- `config/schedule.json` — send time + timezone (Asia/Shanghai, 08:17 default)
- `config/digest-rules.json` — themes, scoring weights, blacklists, thresholds (schema versioned)
- `config/user-preferences.json` — preferred themes, custom topics

## v1 Scope

v1 does exactly 7 things: GitHub Actions scheduled run → candidate discovery → scoring → LLM generation → WeChat push → archive → runtime state writeback. Everything else (Web config editing, feedback, writeback workflow, environment diagnostics) is v2.
