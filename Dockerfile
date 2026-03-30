FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    cron \
    curl \
    tzdata \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build:web \
  && chmod +x /app/scripts/docker/entrypoint.sh /app/scripts/docker/run-scheduled-digest.sh

EXPOSE 3210

ENTRYPOINT ["/app/scripts/docker/entrypoint.sh"]
