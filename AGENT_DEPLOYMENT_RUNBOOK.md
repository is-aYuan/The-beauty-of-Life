# Agent Deployment Runbook

Purpose: this document is written for future Codex/agent sessions. When the user asks to deploy, update the cloud server, restart the online service, debug the deployed site, or continue the "Trace of Life / 故事坊" deployment work, read this file first and follow it step by step.

Current date when this runbook was created: 2026-05-20.

## Mandatory Agent Rules

1. Before answering the user, state which skill was used or that no skill was used.
2. For deployment/update/debugging, use `setup-deploy`; for unexpected errors use `systematic-debugging`; for destructive cleanup use `careful`; for documentation updates use `document-release`.
3. Do not ask the user to paste secrets into chat. `.env` contains real API keys.
4. Do not run destructive commands such as `rm -rf`, `git reset --hard`, `git restore .`, or deleting PM2 processes unless the user clearly confirms the scope or the command is narrowly described.
5. Do not commit `.env`, `lovable_ui/.env.production`, `node_modules`, `dist`, local audio/data records, or local editor/agent settings.
6. If server `git status` is dirty, do not blindly `git pull`; inspect and protect server-only config first.

## Current Online State

The project is currently deployed on a Volcengine ECS instance for public-IP testing.

```text
Public URL: http://124.174.21.48
Server IP: 124.174.21.48
SSH key on Mac: ~/Downloads/TraceOfLife.pem
SSH user: root
Server OS: Ubuntu 22.04 LTS
Server project path: /var/www/traceoflife
GitHub repo: https://github.com/is-aYuan/The-beauty-of-Life.git
Git branch: main
Backend PM2 process: traceoflife-api
Frontend PM2 process: traceoflife-web
Backend local port: 8000
Frontend SSR preview local port: 3000
Nginx public port: 80
```

Current runtime architecture:

```text
Browser
  -> http://124.174.21.48
  -> Nginx :80
      -> /api/*    -> http://127.0.0.1:8000
      -> /ws/chat  -> http://127.0.0.1:8000/ws/chat
      -> /         -> http://127.0.0.1:3000
```

The app currently uses public IP + HTTP. This is enough for login, admin, data writing, text chat, AI response, and basic TTS playback. Browser microphone recording may be restricted until the service moves to a domain + HTTPS.

## Existing Human-Facing Docs

These files exist in the repo and should be updated if the deployment process changes:

```text
公网IP部署操作手册.md
代码变更提交与云服务器启动服务说明.md
docs/provider-switching.md
```

This file, `AGENT_DEPLOYMENT_RUNBOOK.md`, is the agent-facing operational source of truth.

## What Has Already Been Completed

Provider-switching work:

```text
LLM provider can switch between Hunyuan and Doubao Ark.
Voice provider can switch between Tencent and Doubao.
DeepSeek remains unchanged.
Doubao Ark main chat endpoint uses ARK_CHAT_MODEL=ep-...
Doubao ASR uses DOUBAO_ASR_RESOURCE_ID=volc.bigasr.auc_turbo.
Doubao TTS uses DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0 and mp3 output.
Frontend runtime config now supports VITE_API_BASE and VITE_WS_URL.
```

Deployment work:

```text
Server receives project at /var/www/traceoflife.
Backend .env exists on server.
Backend health check passed at http://127.0.0.1:8000/health.
PM2 backend process traceoflife-api was created.
Frontend .env.production exists on server.
Frontend build succeeds after reinstalling lovable_ui/node_modules.
Frontend is TanStack Start SSR, not a pure static SPA.
Nginx must proxy / to frontend SSR service on 127.0.0.1:3000.
Nginx must proxy /api/ and /ws/chat to backend on 127.0.0.1:8000.
```

Important frontend deployment quirk:

```text
After npm run build, the build produces dist/server/index.js.
vite preview expects dist/server/server.js.
Therefore this symlink is required after each frontend build:

ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
```

## Normal User Intent Mapping

If the user says:

```text
"部署一下"
"更新线上"
"我改了代码，帮我发到服务器"
"执行部署任务"
"线上打不开"
"重启服务"
"停止项目"
```

Do this:

1. Read this runbook.
2. Ask the user whether the latest code has already been pushed to GitHub, unless they explicitly say it has.
3. If code needs committing, guide local Mac Git commit/push first.
4. SSH to server only if the task requires server operations and the user is doing commands manually or grants remote command execution.
5. Use the appropriate command sequence below.

## Local Mac Code Commit Flow

Local repo:

```bash
cd "/Users/ayuan/Documents/cc- The beauty of Life"
```

Inspect:

```bash
git status
git diff
```

Add specific files only. Avoid `git add .`.

Example:

```bash
git add .env_example \
  docs/provider-switching.md \
  lovable_ui/src/hooks/useStoryEngine.ts \
  lovable_ui/src/routes/admin.tsx \
  lovable_ui/src/lib/runtimeConfig.js \
  lovable_ui/src/lib/runtimeConfig.d.ts \
  tests/frontendRuntimeConfig.test.js \
  公网IP部署操作手册.md \
  代码变更提交与云服务器启动服务说明.md \
  AGENT_DEPLOYMENT_RUNBOOK.md
```

Commit and push:

```bash
git commit -m "Describe the deployment or feature update"
git push origin main
```

Never add these:

```text
.env
lovable_ui/.env.production
node_modules/
lovable_ui/node_modules/
dist/
lovable_ui/dist/
.DS_Store
.claude/settings.local.json
data/records/
```

## SSH Into Server

From Mac:

```bash
ssh -i ~/Downloads/TraceOfLife.pem root@124.174.21.48
```

Server project:

```bash
cd /var/www/traceoflife
```

## Server Pre-Deploy Check

Always run before pulling:

```bash
cd /var/www/traceoflife
git remote -v
git branch --show-current
git status
```

Expected:

```text
origin https://github.com/is-aYuan/The-beauty-of-Life.git
branch main
working tree clean
```

If clean:

```bash
git pull --ff-only origin main
```

If dirty, pause and inspect. Server may contain expected server-only files:

```text
.env
lovable_ui/.env.production
node_modules type changes
.claude/settings.local.json
```

For dirty server state, prefer:

```bash
git stash push -m "server local changes before deploy"
mkdir -p /root/traceoflife-backup
mv lovable_ui/.env.production /root/traceoflife-backup/.env.production 2>/dev/null || true
mv .claude/settings.local.json /root/traceoflife-backup/settings.local.json 2>/dev/null || true
git pull --ff-only origin main
cp /root/traceoflife-backup/.env.production /var/www/traceoflife/lovable_ui/.env.production 2>/dev/null || true
```

Do not use `git reset --hard` unless the user explicitly approves and understands server-local changes will be discarded.

## Backend Deploy

Use when backend files changed:

```text
server.js
lib/
tests/
package.json
package-lock.json
```

Commands:

```bash
cd /var/www/traceoflife
npm install
pm2 restart traceoflife-api
curl http://127.0.0.1:8000/health
```

Expected health:

```json
{"status":"ok","service":"故事坊后端"}
```

Backend logs:

```bash
pm2 logs traceoflife-api --lines 80
```

## Frontend Deploy

Use when frontend files changed:

```text
lovable_ui/src/
lovable_ui/package.json
lovable_ui/package-lock.json
lovable_ui/.env.production
```

Commands:

```bash
cd /var/www/traceoflife/lovable_ui
npm install
npm run build
ln -sf index.js dist/server/server.js
pm2 restart traceoflife-web
curl -I http://127.0.0.1:3000
```

If `curl -I` returns `500 Internal Server Error`, immediately check:

```bash
pm2 logs traceoflife-web --lines 80
```

If logs show:

```text
Cannot find module .../dist/server/server.js
```

Run:

```bash
cd /var/www/traceoflife/lovable_ui
ln -sf index.js dist/server/server.js
pm2 restart traceoflife-web
```

## Full Deploy From GitHub

Use after local code has been pushed to GitHub and server state is clean:

```bash
cd /var/www/traceoflife
git pull --ff-only origin main
npm install
pm2 restart traceoflife-api

cd /var/www/traceoflife/lovable_ui
npm install
npm run build
ln -sf index.js dist/server/server.js
pm2 restart traceoflife-web

pm2 status
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

Then ask the user to test:

```text
http://124.174.21.48
```

## Nginx Configuration

Config path:

```text
/etc/nginx/sites-available/traceoflife
```

Expected config:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws/chat {
        proxy_pass http://127.0.0.1:8000/ws/chat;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

After editing:

```bash
nginx -t
systemctl reload nginx
```

If `nginx -t` fails, do not reload. Fix the reported line first.

## PM2 Service Commands

Check:

```bash
pm2 status
```

Start existing stopped services:

```bash
pm2 start traceoflife-api
pm2 start traceoflife-web
```

Restart:

```bash
pm2 restart traceoflife-api
pm2 restart traceoflife-web
```

Stop:

```bash
pm2 stop traceoflife-api
pm2 stop traceoflife-web
```

Delete from PM2:

```bash
pm2 delete traceoflife-api
pm2 delete traceoflife-web
pm2 save
```

Create if missing:

```bash
cd /var/www/traceoflife
pm2 start server.js --name traceoflife-api

cd /var/www/traceoflife/lovable_ui
pm2 start node_modules/vite/bin/vite.js --name traceoflife-web -- preview --host 127.0.0.1 --port 3000

pm2 save
```

## Stop Public Access

Temporary service stop:

```bash
pm2 stop traceoflife-api
pm2 stop traceoflife-web
```

Make public IP not serve the site:

```bash
systemctl stop nginx
```

Restore:

```bash
systemctl start nginx
pm2 start traceoflife-api
pm2 start traceoflife-web
```

Most complete stop: stop the ECS instance in Volcengine console. Note that disks/public IP may still incur cost.

## Verification Checklist

After every deploy, verify:

```bash
pm2 status
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
tail -n 50 /var/log/nginx/error.log
```

Browser checks:

```text
1. Open http://124.174.21.48
2. Login user side.
3. Send a text chat.
4. Confirm AI reply.
5. Confirm TTS playback if available.
6. Open admin side.
7. Refresh data.
8. Confirm latest conversation is visible.
```

## Common Failure Modes

### Browser shows 500

Check:

```bash
pm2 logs traceoflife-web --lines 80
tail -n 50 /var/log/nginx/error.log
```

Likely root causes:

```text
frontend SSR service down
missing dist/server/server.js symlink
Nginx still configured as static root instead of proxying to 127.0.0.1:3000
```

### Login or chat fails but page opens

Check backend:

```bash
pm2 status
curl http://127.0.0.1:8000/health
pm2 logs traceoflife-api --lines 80
```

Check frontend env:

```bash
cat /var/www/traceoflife/lovable_ui/.env.production
```

Expected public-IP test config:

```env
VITE_API_BASE=http://124.174.21.48
VITE_WS_URL=ws://124.174.21.48/ws/chat
```

If changed, rebuild frontend.

### Microphone fails on public IP

This is expected on plain HTTP public IP in many browsers. The durable fix is domain + HTTPS.

## Domain + HTTPS Future Migration

When the user buys a domain:

1. Point DNS A record to `124.174.21.48`.
2. Change Nginx `server_name` from `_` to the domain.
3. Install Certbot:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

4. Change frontend config:

```env
VITE_API_BASE=https://your-domain.com
VITE_WS_URL=wss://your-domain.com/ws/chat
```

5. Rebuild and restart frontend:

```bash
cd /var/www/traceoflife/lovable_ui
npm run build
ln -sf index.js dist/server/server.js
pm2 restart traceoflife-web
```

## Rollback

View recent commits:

```bash
cd /var/www/traceoflife
git log --oneline -5
```

Temporary checkout:

```bash
git checkout <old-commit-id>
npm install
pm2 restart traceoflife-api

cd /var/www/traceoflife/lovable_ui
npm install
npm run build
ln -sf index.js dist/server/server.js
pm2 restart traceoflife-web
```

Restore main:

```bash
cd /var/www/traceoflife
git checkout main
git pull --ff-only origin main
```

## Agent Response Pattern For Future Deployment Tasks

When the user asks to deploy/update:

1. Say: "我会读取 `AGENT_DEPLOYMENT_RUNBOOK.md`，然后按里面的部署流程执行/指导。"
2. Confirm whether latest local code has been pushed to GitHub.
3. If not pushed, guide local `git status`, selective `git add`, `git commit`, `git push`.
4. On server, check `git status` before pull.
5. Run backend deploy only if backend changed.
6. Run frontend deploy only if frontend changed.
7. Always run verification checklist before saying complete.
8. If any error appears, switch to systematic debugging and gather logs before proposing a fix.
