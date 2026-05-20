# 故事坊公网 IP 部署操作手册

本文档记录当前项目在火山引擎云服务器上通过公网 IP 临时内测的完整操作流程。当前测试访问地址示例：

```text
http://124.174.21.48
```

当前部署结构：

```text
用户浏览器
  -> Nginx 80 端口
    -> 前端 SSR 服务: 127.0.0.1:3000
    -> 后端 API 服务: 127.0.0.1:8000
    -> 后端 WebSocket: 127.0.0.1:8000/ws/chat
```

服务器上的项目目录：

```text
/var/www/traceoflife
```

PM2 进程名称：

```text
traceoflife-api
traceoflife-web
```

## 1. Mac 连接服务器

在 Mac 终端执行：

```bash
ssh -i ~/Downloads/TraceOfLife.pem root@124.174.21.48
```

如果提示密钥权限不安全，先执行：

```bash
chmod 400 ~/Downloads/TraceOfLife.pem
```

再重新 SSH。

退出服务器：

```bash
exit
```

## 2. 上传项目到服务器

如果本地已经打好压缩包：

```bash
scp -i ~/Downloads/TraceOfLife.pem ~/Documents/project.zip root@124.174.21.48:/root/
```

服务器上解压：

```bash
mkdir -p /var/www
apt update
apt install -y unzip
unzip /root/project.zip -d /var/www
```

如果解压后有带空格的目录，例如：

```text
/var/www/storybook/cc- The beauty of Life
```

移动成固定部署目录：

```bash
mv "/var/www/storybook/cc- The beauty of Life" /var/www/traceoflife
```

确认项目目录正确：

```bash
cd /var/www/traceoflife
ls
```

应该能看到：

```text
server.js
package.json
lovable_ui
```

确认无误后，旧空壳目录可以删除：

```bash
rm -rf /var/www/storybook
```

## 3. 安装服务器基础环境

首次部署时执行：

```bash
apt update
apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

检查版本：

```bash
node -v
npm -v
nginx -v
```

## 4. 配置后端 .env

推荐从 Mac 直接上传本地 `.env`，避免手动粘贴出错。

Mac 终端执行：

```bash
scp -i ~/Downloads/TraceOfLife.pem "/Users/ayuan/Documents/cc- The beauty of Life/.env" root@124.174.21.48:/var/www/traceoflife/.env
```

服务器上检查文件是否存在：

```bash
cd /var/www/traceoflife
ls -la .env
```

不要把 `.env` 截图发给别人，里面有真实 API Key。

关键环境变量包括：

```env
LLM_PROVIDER=doubao
VOICE_PROVIDER=doubao
ARK_API_KEY=你的火山方舟APIKey
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_CHAT_MODEL=ep-...
DOUBAO_SPEECH_API_KEY=你的豆包语音APIKey
DOUBAO_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0
DOUBAO_TTS_VOICE=zh_female_vv_uranus_bigtts
DOUBAO_TTS_FORMAT=mp3
DOUBAO_TTS_SAMPLE_RATE=16000
```

原来的 CloudBase、DeepSeek、混元相关变量也要保留。

## 5. 安装后端依赖并启动 API

服务器执行：

```bash
cd /var/www/traceoflife
npm install
```

先前台测试：

```bash
node server.js
```

看到类似输出表示后端正常：

```text
故事坊后端服务已启动
WebSocket: ws://localhost:8000/ws/chat
健康检查: http://localhost:8000/health
AI Provider: doubao
语音 Provider: doubao
```

按 `control + C` 停掉前台服务，然后交给 PM2 后台运行：

```bash
pm2 start server.js --name traceoflife-api
pm2 save
```

检查后端健康：

```bash
curl http://127.0.0.1:8000/health
```

正常返回：

```json
{"status":"ok","service":"故事坊后端"}
```

## 6. 配置前端环境变量

服务器执行：

```bash
cd /var/www/traceoflife/lovable_ui
nano .env.production
```

公网 IP 测试时写入：

```env
VITE_API_BASE=http://124.174.21.48
VITE_WS_URL=ws://124.174.21.48/ws/chat
```

保存 nano：

```text
control + O
回车
control + X
```

## 7. 构建前端

如果前端构建报错，优先清理服务器上的前端依赖后重装：

```bash
cd /var/www/traceoflife/lovable_ui
rm -rf node_modules
npm install
npm run build
```

当前项目是 TanStack Start SSR 应用，`dist/client` 没有 `index.html` 是正常的。构建后需要补一个服务入口软链接：

```bash
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
```

## 8. 启动前端 SSR 服务

服务器执行：

```bash
cd /var/www/traceoflife/lovable_ui
pm2 start node_modules/vite/bin/vite.js --name traceoflife-web -- preview --host 127.0.0.1 --port 3000
pm2 save
```

检查前端服务：

```bash
curl -I http://127.0.0.1:3000
```

只要不是 `500 Internal Server Error`，就可以继续。若出现找不到 `dist/server/server.js`，重新执行：

```bash
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
pm2 restart traceoflife-web
```

## 9. 配置 Nginx

创建或编辑配置：

```bash
nano /etc/nginx/sites-available/traceoflife
```

写入：

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

启用配置：

```bash
ln -s /etc/nginx/sites-available/traceoflife /etc/nginx/sites-enabled/traceoflife
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

如果提示软链接已存在，可以忽略，继续 `nginx -t`。

## 10. 访问测试

浏览器打开：

```text
http://124.174.21.48
```

建议测试顺序：

```text
1. 用户端登录
2. 文字聊天
3. AI 回复
4. TTS 播放
5. 管理端刷新数据
6. 查看用户对话记录是否写入
```

注意：公网 IP + HTTP 不是安全上下文，浏览器麦克风录音可能受限制。后续正式内测语音录制，建议换成域名 + HTTPS。

## 11. 日常查看运行状态

查看 PM2 服务：

```bash
pm2 status
```

应该看到：

```text
traceoflife-api
traceoflife-web
```

查看后端日志：

```bash
pm2 logs traceoflife-api
```

查看前端日志：

```bash
pm2 logs traceoflife-web
```

查看最近 50 行：

```bash
pm2 logs traceoflife-api --lines 50
pm2 logs traceoflife-web --lines 50
```

退出日志跟随：

```text
control + C
```

查看 Nginx 状态：

```bash
systemctl status nginx
```

查看 Nginx 错误日志：

```bash
tail -n 50 /var/log/nginx/error.log
```

## 12. 重启服务

重启后端：

```bash
pm2 restart traceoflife-api
```

重启前端：

```bash
pm2 restart traceoflife-web
```

重启全部 PM2 服务：

```bash
pm2 restart all
```

重载 Nginx：

```bash
nginx -t
systemctl reload nginx
```

## 13. 临时停止项目

停止后端和前端：

```bash
pm2 stop traceoflife-api
pm2 stop traceoflife-web
```

或者停止所有 PM2 服务：

```bash
pm2 stop all
```

这时服务器还在，Nginx 也可能还在，但项目服务不可用。

恢复运行：

```bash
pm2 start traceoflife-api
pm2 start traceoflife-web
```

或：

```bash
pm2 restart all
```

## 14. 让公网 IP 直接打不开

停止 Nginx：

```bash
systemctl stop nginx
```

恢复 Nginx：

```bash
systemctl start nginx
```

## 15. 从 PM2 移除项目

如果不想让服务被 PM2 继续托管：

```bash
pm2 delete traceoflife-api
pm2 delete traceoflife-web
pm2 save
```

之后要重新启动，需要重新执行 `pm2 start ...`。

## 16. 停止整台云服务器

最彻底的方式是在火山引擎控制台停止 ECS 实例。

效果：

```text
1. 网站完全无法访问
2. SSH 无法连接
3. PM2 / Nginx / Node 全部停止
```

注意：停止服务器后，系统盘、公网 IP、快照等资源可能仍然产生费用，具体以火山引擎计费规则为准。

## 17. 更新项目代码

如果你本地改了代码，要重新部署：

Mac 本地重新压缩或上传新项目包，然后服务器替换项目文件。更简单的临时方式是重新上传 zip：

```bash
scp -i ~/Downloads/TraceOfLife.pem ~/Documents/project.zip root@124.174.21.48:/root/
```

服务器上建议先备份旧项目：

```bash
mv /var/www/traceoflife /var/www/traceoflife.bak
unzip /root/project.zip -d /var/www
mv "/var/www/storybook/cc- The beauty of Life" /var/www/traceoflife
```

然后重新同步 `.env`，安装依赖，构建前端：

```bash
cd /var/www/traceoflife
npm install

cd /var/www/traceoflife/lovable_ui
npm install
npm run build
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
```

重启服务：

```bash
pm2 restart traceoflife-api
pm2 restart traceoflife-web
```

如果只是改了后端 `.env`：

```bash
pm2 restart traceoflife-api
```

如果只是改了前端 `.env.production`：

```bash
cd /var/www/traceoflife/lovable_ui
npm run build
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
pm2 restart traceoflife-web
```

## 18. 常见问题

### 18.1 浏览器显示 500 Internal Server Error

先看前端：

```bash
pm2 logs traceoflife-web --lines 50
```

如果出现：

```text
Cannot find module .../dist/server/server.js
```

执行：

```bash
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
pm2 restart traceoflife-web
```

再看 Nginx：

```bash
tail -n 50 /var/log/nginx/error.log
```

### 18.2 后端健康检查失败

检查 PM2：

```bash
pm2 status
pm2 logs traceoflife-api --lines 80
```

检查健康接口：

```bash
curl http://127.0.0.1:8000/health
```

### 18.3 页面能打开，但登录或聊天失败

检查前端生产变量：

```bash
cd /var/www/traceoflife/lovable_ui
cat .env.production
```

应为：

```env
VITE_API_BASE=http://124.174.21.48
VITE_WS_URL=ws://124.174.21.48/ws/chat
```

改完后必须重新构建：

```bash
npm run build
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
pm2 restart traceoflife-web
```

### 18.4 Nginx 配置改完没生效

执行：

```bash
nginx -t
systemctl reload nginx
```

如果 `nginx -t` 报错，先不要 reload，按报错行数修配置。

### 18.5 关闭 Mac 后网站还会不会运行

会。项目运行在云服务器上，由 PM2 和 Nginx 托管。Mac 只是用来 SSH 管理服务器，关机不影响服务器上的服务。

## 19. 后续换域名和 HTTPS

买域名后，前端 `.env.production` 改成：

```env
VITE_API_BASE=https://你的域名
VITE_WS_URL=wss://你的域名/ws/chat
```

Nginx 改：

```nginx
server_name 你的域名;
```

然后申请 HTTPS：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

重新构建前端：

```bash
cd /var/www/traceoflife/lovable_ui
npm run build
ln -sf index.js /var/www/traceoflife/lovable_ui/dist/server/server.js
pm2 restart traceoflife-web
```

换成 HTTPS 后，浏览器麦克风权限更稳定，适合正式语音内测。
