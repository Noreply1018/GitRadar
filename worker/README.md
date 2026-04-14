# GitRadar Worker

Cloudflare Worker，处理 GitHub App OAuth 登录和 API 代理。

## 前置条件

1. 创建 GitHub App：
   - Homepage URL: `https://noreply1018.github.io/GitRadar`
   - Callback URL: `https://gitradar-worker.<account>.workers.dev/auth/callback`
   - Permissions: `contents: read & write`, `actions: read & write`, `metadata: read`
   - 生成私钥（PEM 格式）

2. 安装 GitHub App 到 GitRadar 仓库

## 部署

```bash
cd worker
npm install

# 设置 secrets
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET

# 部署
npm run deploy
```

## 本地开发

```bash
# 创建 .dev.vars 文件（不入库）
cat > .dev.vars << 'EOF'
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
SESSION_SECRET=any_random_string_for_dev
EOF

npm run dev
```
