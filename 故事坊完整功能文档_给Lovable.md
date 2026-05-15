# 故事坊 - 完整功能文档

## 项目概述

**故事坊**是一款面向老年人的 AI 语音故事记录应用，帮助老年人通过语音对话记录人生故事，最终生成个人自传。

**技术栈**：
- 前端：原生 HTML + CSS + JavaScript（无框架）
- 后端：Node.js + WebSocket
- 数据库：腾讯云 CloudBase（云数据库）
- AI 服务：
  - 语音识别（ASR）：腾讯云 ASR
  - AI 对话：腾讯云混元大模型
  - 语音合成（TTS）：腾讯云 TTS
  - 叙事摘要 + 自传撰写：DeepSeek API

---

## 一、用户端功能

### 1.1 登录/注册页面

**页面元素**：
- 应用标题：故事坊
- 副标题：AI家庭记忆传承
- 登录表单：
  - 手机号输入框（11位数字）
  - 登录按钮
  - "还没有账号？点击注册"链接
- 注册表单：
  - 手机号输入框
  - 姓名输入框
  - 年龄输入框（选填）
  - 注册按钮
  - "已有账号？返回登录"链接
- 错误提示区域

**功能逻辑**：
- 手机号作为唯一标识
- 注册时自动创建用户资料
- 登录成功后保存用户信息到 localStorage
- 下次打开自动登录

**API 接口**：
```
POST /api/register
请求：{ phone: string, name: string, age?: number }
响应：{ success: boolean, userId: string, phone: string, name: string }

POST /api/login
请求：{ phone: string }
响应：{ success: boolean, userId: string, phone: string, name: string, age: number }
```

---

### 1.2 主聊天页面

#### 1.2.1 顶部状态栏

**元素**：
- 用户姓名
- 用户统计（已记录 X 条对话，约 X 分钟）
- 退出按钮

**功能**：
- 显示当前登录用户信息
- 实时更新对话统计
- 退出登录，清除本地存储

#### 1.2.2 状态提示区

**状态文案**：
| 状态 | 显示文案 | 颜色 |
|------|---------|------|
| 初始 | 请点击开始 | 默认 |
| 录音中 | 正在听您说… | 绿色 |
| AI思考中 | AI正在思考... | 橙色 |
| 播放中 | 正在播放... | 蓝色 |
| 完成 | 请点击开始 | 默认 |

#### 1.2.3 音波可视化区

**功能**：
- 录音时显示实时音波
- 48个频率条动画
- 颜色随音量变化（蓝色系）

#### 1.2.4 核心交互区 - 麦克风按钮

**两种录音模式**：

**模式一：按住说话（默认）**
- 按住麦克风按钮开始录音
- 松开停止录音
- 适合主动讲述

**模式二：放桌上畅聊（VAD模式）**
- 点击后持续录音
- 自动检测说话结束（静音3.5秒）
- 最长录音180秒
- 适合放在桌上聊天

**按钮状态**：
- 默认：蓝色圆形按钮
- 录音中：红色 + 脉冲动画
- 禁用：灰色半透明

#### 1.2.5 模式切换

**元素**：
- "按住说话"按钮
- "放桌上畅聊"按钮
- 当前模式高亮显示

#### 1.2.6 生成自传按钮

**功能**：
- 点击后弹出确认框
- 调用后端生成自传
- 显示生成状态（加载中/成功/失败）
- 生成成功后隐藏按钮
- 显示结果：书名、章节数、字数

**API 接口**：
```
POST /api/biographies/{userId}/generate
响应：{
  success: boolean,
  biographyId: string,
  title: string,
  tier: string,
  chapterCount: number,
  wordCount: number
}
```

#### 1.2.7 字幕提示区

**功能**：
- 显示用户语音识别结果
- 显示 AI 回复文字
- 固定高度（3行），超出滚动

#### 1.2.8 网络断开遮罩层

**功能**：
- WebSocket 断开时显示
- 显示重连动画
- 自动重连（指数退避：1s, 2s, 4s... 最大30s）

---

### 1.3 WebSocket 通信协议

**连接地址**：`ws://localhost:8000/ws/chat`

**客户端 → 服务器**：

```json
// 登录
{ "type": "login", "phone": "13800138000" }

// 注册
{ "type": "register", "phone": "13800138000", "name": "张三", "age": 70 }

// 语音结束事件
{ "event": "user_speech_ended" }

// 二进制数据：PCM音频流（16kHz, 16bit, 单声道）
```

**服务器 → 客户端**：

```json
// 需要登录
{ "status": "need_login", "text": "请先登录或注册" }

// 登录成功/就绪
{
  "status": "ready",
  "text": "欢迎语内容",
  "user": { "userId": "...", "phone": "...", "name": "..." },
  "hasBiography": false
}

// AI思考中
{ "status": "ai_thinking" }

// AI回复文字
{ "status": "ai_speaking", "text": "AI的回复内容" }

// AI回复结束
{ "event": "ai_response_end", "status": "ready" }

// 二进制数据：MP3音频流（AI语音回复）
```

---

## 二、后端功能

### 2.1 用户管理

**功能**：
- 用户注册（手机号+姓名+年龄）
- 用户登录（手机号）
- 获取用户资料
- 更新用户资料
- 删除用户（级联删除所有关联数据）

**数据库集合：users**
```javascript
{
  _id: string,           // 用户ID（CloudBase自动生成）
  phone: string,         // 手机号（唯一标识）
  name: string,          // 姓名
  age: number | null,    // 年龄
  status: string,        // 'active' | 'deleted'
  createdAt: Date,
  updatedAt: Date
}
```

---

### 2.2 会话管理

**功能**：
- 创建会话（WebSocket连接时）
- 结束会话（WebSocket断开时）
- 获取用户会话列表

**数据库集合：sessions**
```javascript
{
  _id: string,
  sessionId: string,     // 会话ID
  userId: string,        // 关联用户
  startTime: Date,
  endTime: Date | null,
  messageCount: number,
  status: string         // 'active' | 'ended'
}
```

---

### 2.3 对话记录

**功能**：
- 保存每轮对话（用户语音文字 + AI回复 + 音频文件）
- 获取用户所有对话记录
- 获取某会话的对话记录

**数据库集合：conversations**
```javascript
{
  _id: string,
  sessionId: string,     // 关联会话
  userId: string,        // 关联用户
  userText: string,      // 用户语音识别文字
  aiReply: string,       // AI回复文字
  audioFile: string,     // 音频文件名
  audioSizeKB: number,   // 音频大小
  timestamp: Date
}
```

---

### 2.4 叙事摘要提取

**触发时机**：会话结束时自动异步提取

**功能**：
- 使用 DeepSeek API 分析对话记录
- 提取叙事摘要（保留原话、情感、细节）
- 构建记忆档案（人物、地点、事件、情感）
- 判断自传就绪度

**数据库集合：summaries**
```javascript
{
  _id: string,
  sessionId: string,
  userId: string,
  profile: {
    name: string,           // 用户姓名
    approxAge: string,      // 大致年龄
    location: string        // 居住地
  },
  narratives: [             // 叙事段落数组
    {
      theme: string,        // 主题分类
      title: string,        // 标题（6字以内）
      content: string,      // 完整叙事段落
      keyFacts: string[]    // 关键事实
    }
  ],
  coverage: {
    discussed: string[],    // 已讨论话题
    unexplored: string[]    // 未深入话题
  },
  emotionalNote: string,    // 情感状态描述
  memoryArchive: {
    people: [{ name, relation, mentionedIn, details }],
    places: [{ name, context, significance }],
    events: [{ time, description, people, emotionalWeight }],
    emotions: [{ feeling, trigger, intensity }]
  },
  readiness: {
    timeline: { status: boolean, reason: string },
    keyPeople: { status: boolean, reason: string },
    depth: { status: boolean, reason: string },
    stories: { status: boolean, reason: string },
    emotions: { status: boolean, reason: string }
  },
  conversationCount: number,
  sessionWordCount: number,
  createdAt: Date
}
```

---

### 2.5 记忆档案（累积）

**功能**：
- 每次会话结束后累积更新
- 人物按姓名去重合并
- 地点按名称去重合并
- 事件按描述去重合并
- 情感按感受去重合并

**数据库集合：memory_profiles**
```javascript
{
  _id: string,
  userId: string,
  people: [{ name, relation, mentionedIn, details }],
  places: [{ name, context, significance }],
  events: [{ time, description, people, emotionalWeight }],
  emotions: [{ feeling, trigger, intensity }],
  readiness: { ... },
  readyCount: number,      // 就绪维度数（0-5）
  totalWordCount: number,  // 累计素材字数
  createdAt: Date,
  updatedAt: Date
}
```

---

### 2.6 自传生成

**触发条件**：
- 用户手动点击"生成我的故事书"按钮
- 或管理员在后台触发

**就绪判断**：
- 5个维度中至少4个为 true
- 累计素材 ≥ 10000 字

**自传档次**：
| 素材字数 | 档次名称 | 章节数 | 每章字数 |
|----------|----------|--------|----------|
| < 10000 | 人生故事集 | 5-8章 | 800-1500字 |
| 10000-30000 | 个人传记 | 8-12章 | 1500-2500字 |
| > 30000 | 完整回忆录 | 12-20章 | 2000-3000字 |

**数据库集合：biographies**
```javascript
{
  _id: string,
  userId: string,
  title: string,           // 自传标题
  tier: string,            // 档次名称
  chapters: [              // 章节数组
    {
      number: number,
      title: string,
      content: string
    }
  ],
  fullText: string,        // 完整文本
  wordCount: number,       // 总字数
  chapterCount: number,    // 章节数
  status: string,          // 'draft'
  sourceSummaryCount: number,
  sourceWordCount: number,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 2.7 语音处理流程

```
用户说话 → 前端录音（PCM） → WebSocket发送
    ↓
后端接收音频
    ↓
Step 1: 语音识别（腾讯云ASR）
    → 返回文字
    ↓
Step 2: AI对话（腾讯云混元）
    → 返回回复文字
    ↓
Step 3: 语音合成（腾讯云TTS）
    → 返回MP3音频
    ↓
前端播放AI语音 + 显示文字
```

---

## 三、管理员后台

### 3.1 管理员登录

**元素**：
- 手机号输入框
- 密码输入框
- 登录按钮

**API 接口**：
```
POST /api/admin/login
请求：{ phone: string, password: string }
响应：{ success: boolean, token: string }
```

---

### 3.2 统计面板

**显示数据**：
- 注册用户数
- 总会话数
- 对话轮数
- 叙事摘要数

**API 接口**：
```
GET /api/admin/stats
Header: Authorization: Bearer {token}
响应：{ totalUsers, totalSessions, totalConversations, totalSummaries }
```

---

### 3.3 用户列表

**显示列**：
- 姓名
- 手机号
- 年龄
- 会话数
- 对话数
- 摘要数
- 操作（查看详情/删除）

**API 接口**：
```
GET /api/admin/users
响应：[{ _id, phone, name, age, sessionCount, conversationCount, summaryCount }]
```

---

### 3.4 用户详情弹窗

**标签页**：

**1. 对话记录**
- 显示所有对话轮次
- 格式：用户说 → AI回复

**2. 叙事摘要**
- 按时间排序的摘要列表
- 每个摘要包含：主题、标题、内容、关键事实

**3. 记忆档案**
- 人物列表
- 地点列表
- 事件列表
- 情感列表
- 就绪度状态

**4. 成品自传**
- 自传标题
- 章节列表
- 每章内容

**API 接口**：
```
GET /api/admin/user/{userId}/conversations
GET /api/admin/user/{userId}/summaries
GET /api/admin/user/{userId}/memory-profile
GET /api/admin/user/{userId}/biographies
POST /api/admin/user/{userId}/biographies/generate
DELETE /api/admin/user/{userId}
```

---

## 四、页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | index.html | 用户端主页 |
| `/index.html` | index.html | 用户端主页 |
| `/style.css` | style.css | 用户端样式 |
| `/app.js` | app.js | 用户端逻辑 |
| `/admin.html` | admin.html | 管理员后台 |
| `/admin.css` | admin.css | 管理员样式 |
| `/admin.js` | admin.js | 管理员逻辑 |

---

## 五、API 接口汇总

### 用户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/register | 用户注册 |
| POST | /api/login | 用户登录 |
| GET | /api/user/{userId} | 获取用户资料 |
| DELETE | /api/user/{userId} | 删除用户 |
| GET | /api/sessions/{userId} | 获取会话列表 |
| GET | /api/conversations/{userId} | 获取对话记录 |
| GET | /api/stats/{userId} | 获取用户统计 |
| GET | /api/summaries/{userId} | 获取叙事摘要 |
| GET | /api/biography-material/{userId} | 获取自传素材 |
| GET | /api/memory-profile/{userId} | 获取记忆档案 |
| GET | /api/biographies/{userId} | 获取自传列表 |
| POST | /api/biographies/{userId}/generate | 生成自传 |

### 管理员 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/login | 管理员登录 |
| GET | /api/admin/stats | 系统统计 |
| GET | /api/admin/users | 用户列表 |
| GET | /api/admin/user/{id}/conversations | 用户对话记录 |
| GET | /api/admin/user/{id}/summaries | 用户叙事摘要 |
| GET | /api/admin/user/{id}/memory-profile | 用户记忆档案 |
| GET | /api/admin/user/{id}/biographies | 用户自传列表 |
| POST | /api/admin/user/{id}/biographies/generate | 触发生成自传 |
| DELETE | /api/admin/user/{id} | 删除用户 |
| DELETE | /api/admin/biography/{id} | 删除自传 |

---

## 六、设计要点（供 Lovable 参考）

### 6.1 目标用户
- 60岁以上老年人
- 可能不熟悉智能手机
- 需要大字体、大按钮、简洁界面

### 6.2 核心体验
- **温暖**：像和老朋友聊天
- **简单**：一步操作，不需要学习
- **安全**：随时可以撤销，不会弄坏

### 6.3 交互原则
- 按钮最小 48×48px
- 字体最小 18px
- 颜色对比度 ≥ 4.5:1
- 暖色调为主（橙色、米色）
- 每次操作都有即时反馈
- 错误时先安慰，再给方案

### 6.4 需要设计的页面
1. 登录/注册页
2. 主聊天页（语音交互）
3. 管理员登录页
4. 管理员后台主页
5. 用户详情弹窗

### 6.5 未实现的功能（可设计UI占位）
- 用户中心（个人资料编辑）
- 故事库（历史故事浏览）
- 家庭成员（邀请家人查看）
- 故事书阅读器（在线阅读自传）
- 分享功能（分享给家人）

---

## 七、数据流程图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户端                                │
├─────────────────────────────────────────────────────────────┤
│  登录/注册 ──→ 建立WebSocket连接                            │
│      ↓                                                      │
│  选择录音模式 ──→ 按住说话 / 放桌上畅聊                      │
│      ↓                                                      │
│  录音（PCM） ──→ 发送到服务器                                │
│      ↓                                                      │
│  接收AI回复 ──→ 播放语音 + 显示字幕                          │
│      ↓                                                      │
│  重复对话 ──→ 素材积累                                       │
│      ↓                                                      │
│  点击生成自传 ──→ 等待生成 ──→ 查看结果                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        服务器端                              │
├─────────────────────────────────────────────────────────────┤
│  接收音频 ──→ ASR语音识别 ──→ 混元AI对话 ──→ TTS语音合成     │
│      ↓                                                      │
│  保存对话记录（CloudBase）                                   │
│      ↓                                                      │
│  会话结束 ──→ DeepSeek提取叙事摘要                           │
│      ↓                                                      │
│  更新记忆档案（累积合并）                                    │
│      ↓                                                      │
│  用户触发 ──→ DeepSeek撰写自传 ──→ 保存自传                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      管理员后台                              │
├─────────────────────────────────────────────────────────────┤
│  查看统计 ──→ 用户列表 ──→ 用户详情                          │
│      ↓                                                      │
│  查看对话记录 / 叙事摘要 / 记忆档案 / 成品自传               │
│      ↓                                                      │
│  触发生成自传 / 删除用户                                     │
└─────────────────────────────────────────────────────────────┘
```

---

**文档版本**：v1.0
**最后更新**：2026年5月14日
**用途**：提供给 Lovable 设计 UI 时参考
