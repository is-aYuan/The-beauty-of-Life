# AI Provider Switching

本文档记录故事坊后端的 AI 和语音供应商切换方式。DeepSeek 摘要、主题分析和自传生成保持原有配置，不受这里的 provider 开关影响。

## 默认配置

默认保持原有能力：

```env
LLM_PROVIDER=hunyuan
VOICE_PROVIDER=tencent
```

对应链路：

```txt
前端 PCM 录音 -> 腾讯 ASR -> 腾讯混元主对话 -> 腾讯 TTS -> 前端播放
```

## 切到火山方舟主对话

```env
LLM_PROVIDER=doubao
ARK_API_KEY=你的火山方舟ARK_API_KEY
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_CHAT_MODEL=ep-xxxxxxxx
```

`ARK_CHAT_MODEL` 使用火山方舟在线推理接入点 ID。代码会把项目内的混元消息格式：

```js
{ Role: 'user', Content: '你好' }
```

转换为方舟 OpenAI 兼容格式：

```js
{ role: 'user', content: '你好' }
```

## 切到豆包语音

```env
VOICE_PROVIDER=doubao
DOUBAO_SPEECH_API_KEY=你的豆包语音API_Key
DOUBAO_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
DOUBAO_TTS_RESOURCE_ID=你的豆包语音合成资源ID
DOUBAO_TTS_VOICE=你的默认TTS音色ID
DOUBAO_TTS_FORMAT=mp3
DOUBAO_TTS_SAMPLE_RATE=16000
```

如控制台提供的是 App Key / Access Key，可以改用：

```env
DOUBAO_SPEECH_APP_KEY=你的豆包语音App_Key
DOUBAO_SPEECH_ACCESS_KEY=你的豆包语音Access_Key
```

前端协议不变，仍然上传裸 PCM。后端会把 PCM 16k/16-bit/mono 包装成 WAV 后发送给豆包录音文件识别 2.0。TTS 输出继续用 mp3，前端播放逻辑不变。

## 支持的组合

```env
LLM_PROVIDER=hunyuan
VOICE_PROVIDER=tencent
```

```env
LLM_PROVIDER=doubao
VOICE_PROVIDER=tencent
```

```env
LLM_PROVIDER=hunyuan
VOICE_PROVIDER=doubao
```

```env
LLM_PROVIDER=doubao
VOICE_PROVIDER=doubao
```

## 仍然保留的配置

腾讯 CloudBase、混元和腾讯语音相关配置继续保留，便于回滚：

```env
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_REGION=ap-guangzhou
HUNYUAN_MODEL=hunyuan-turbos-latest
```

DeepSeek 继续按原逻辑使用：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BIOGRAPHY_MODEL=deepseek-v4-pro
```

## 前端部署配置

线上构建 `lovable_ui` 前，需要让前端请求线上后端，而不是本地 `localhost`：

```env
VITE_API_BASE=https://你的正式域名
VITE_WS_URL=wss://你的正式域名/ws/chat
```

本地开发可以不设置这两个变量，默认仍然使用：

```txt
http://localhost:8000
ws://localhost:8000/ws/chat
```
