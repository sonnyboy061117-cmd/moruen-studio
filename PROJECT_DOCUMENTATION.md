# 墨韵工坊 v2 - 完整项目文档

> **最后更新**: 2026-09-02
> **项目状态**: 生产环境运行中
> **部署地址**: http://39.102.209.193:8787/#/original

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心功能模块](#核心功能模块)
4. [数据流与状态机](#数据流与状态机)
5. [后端API详解](#后端api详解)
6. [前端架构](#前端架构)
7. [配置系统](#配置系统)
8. [LLM集成层](#llm集成层)
9. [降AI味算法](#降ai味算法)
10. [部署与运维](#部署与运维)
11. [开发规范](#开发规范)
12. [已知问题与限制](#已知问题与限制)

---

## 项目概述

### 项目定位
墨韵工坊是一个**内部自用**的新媒体内容生成工具，专为公众号、自媒体平台提供从创意到成稿的全流程AI辅助。

### 核心价值
- **批量生产**: 单次可生成最多120篇原创文章或改写内容
- **降AI味**: 独创的4阶段降AI味流水线 + 启发式打分系统
- **多模型支持**: Claude / GPT-4 / 文心 / DeepSeek 四家大模型统一调用
- **一站式排版**: 5种风格 + 公众号HTML直接复制

### 技术栈总览
```
前端: 纯静态HTML + Vanilla JS (无构建工具)
后端: Node.js 18+ + Express
数据库: 无 (秘钥AES-256-GCM加密存储在本地文件)
部署: Docker + Docker Compose
大模型: Anthropic Claude / OpenAI GPT / 百度文心 / DeepSeek
```

---

## 技术架构

### 目录结构
```
D:\moruen-studio-v2\
├── backend/                    # Node.js 后端
│   ├── server.js              # Express 入口 + Basic Auth + 限流
│   ├── package.json           # 依赖: express, cors, cheerio, p-limit, dotenv
│   ├── config/                # JSON配置文件 (热加载)
│   │   ├── domains.json       # 13个领域 (理财/职场/情感...)
│   │   ├── strengths.json     # 改写强度 (批量3档/万能4档)
│   │   ├── styles.json        # 排版风格
│   │   ├── scoring.json       # 打分权重/阈值 ★核心配置
│   │   ├── providers.json     # 4家LLM供应商配置
│   │   └── prompts.json       # Prompt枚举
│   ├── lib/                   # 核心业务逻辑
│   │   ├── config.js          # 配置加载器 (支持热重载)
│   │   ├── keys.js            # AES-256-GCM 秘钥加密
│   │   ├── llm.js             # 4家LLM统一调用层 + Demo模式
│   │   ├── scoring.js         # 启发式打分算法
│   │   ├── deai.js            # 降AI味 4阶段流水线
│   │   ├── prompts.js         # Prompt模板构建器
│   │   ├── readability.js     # 链接抓取 (cheerio)
│   │   ├── pool.js            # p-limit 并发池
│   │   ├── tasks.js           # 批量任务状态机
│   │   └── cost.js            # 成本预估
│   ├── routes/                # API路由
│   │   ├── keys.js            # 秘钥 CRUD + 测试 + reveal二次确认
│   │   ├── generate.js        # 单点: 标题/万能改写/排版/打分
│   │   ├── tasks.js           # 批量原创/改写 + 轮询
│   │   ├── fetch.js           # 链接抓取API
│   │   └── meta.js            # 元数据 (前端加载配置)
│   ├── data/                  # 运行时数据
│   │   └── keys.enc.json      # AES加密后的秘钥存储
│   └── public/                # 静态资源 (AI生成的图片等)
├── frontend/                  # 纯静态前端
│   ├── index.html             # 单页应用入口
│   └── assets/
│       ├── api.js             # 后端API客户端
│       ├── state.js           # 状态机 + 徽章渲染
│       ├── poller.js          # 任务轮询器
│       └── app.js             # 主入口 (UI绑定)
├── Dockerfile                 # Docker镜像构建
├── docker-compose.yml         # 一键部署编排
├── .dockerignore
└── README.md                  # 用户手册
```

### 运行时端口
- **生产**: `8787` (docker-compose.yml 配置)
- **本地开发**: `8787` (server.js 默认)
- **CORS**: 默认允许所有来源 (`ALLOW_ORIGIN=*`)

### 身份认证
- **Basic Auth**: 可选,通过环境变量 `AUTH_USER` / `AUTH_PASS` 开启
- **限流**: 内存限流,每IP 60秒120次请求
- **健康检查**: `/health` 接口免认证

---

## 核心功能模块

### 1. 一键标题
**路径**: `/api/title`  
**用途**: 根据1-5条参考标题生成1-20条候选标题

**输入参数**:
```json
{
  "refs": ["参考标题1", "参考标题2"],
  "count": 10,
  "domain": "理财",
  "style": "悬念",  // 悬念/反问/数字/情感
  "format": "短句", // 短句/长句/疑问句
  "provider": "claude",
  "demo": false
}
```

**输出**:
```json
{
  "titles": ["1. 30岁才明白的三个理财真相...", "2. ..."],
  "cost": { "estimated": "¥0.02", "provider": "claude" }
}
```

**实现细节**:
- Prompt: `buildTitlePrompt()` in `lib/prompts.js:11-34`
- 温度: `0.95` (最高创意性)
- 去重: 前端自动过滤重复标题
- Demo模式: 返回预设MOCK数据 (见 `llm.js:35-48`)

---

### 2. 批量原创
**路径**: `POST /api/original` → 返回 `taskId` → 轮询 `GET /api/tasks/:id`

**场景**: 最多10个主题 × 12篇/主题 = 120篇上限

**输入参数**:
```json
{
  "topics": ["主题1", "主题2"],
  "perTopic": 3,
  "length": 800,
  "domain": "职场",
  "style": "干货",
  "withImages": false,
  "withAIOff": true,     // 是否降AI味
  "withFormat": false,
  "provider": "claude",
  "concurrency": 8,
  "demo": false
}
```

**状态机流转** (见下文"数据流与状态机"章节)

**并发控制**:
- 默认并发: `8`
- 实现: `p-limit` (lib/pool.js)
- 重试: 每篇最多3次重试,指数退避

**字数控制**:
- 硬截断: 超过 `length * 1.3` 自动截断
- 截断策略: 优先在最后一个句号/换行符处截断
- Prompt约束: `getLengthRange()` 计算严格区间 (±15%, 最多±200字)

**实现位置**: `lib/tasks.js:153-260`

---

### 3. 批量改写
**路径**: `POST /api/rewrite` → 返回 `taskId` → 轮询 `GET /api/tasks/:id`

**场景**: 支持URL抓取 + 纯文本输入,每个源可生成N篇不同角度改写

**输入参数**:
```json
{
  "sources": ["https://mp.weixin.qq.com/...", "纯文本"],
  "count": 3,              // 每个源生成3篇
  "strength": "中度",
  "logics": ["同角度换词", "不同角度重写"],
  "targetLength": "保持原长度",
  "provider": "claude",
  "concurrency": 8,
  "withAIOff": true,
  "demo": false
}
```

**链接抓取**:
- 实现: `lib/readability.js` (基于 cheerio)
- 超时: 10秒
- 失败处理: 单个URL失败不影响其他任务,状态标记为"抓取失败"
- **公众号限制**: 需要登录态cookie,公开抓取几乎都失败 → 建议用"万能改写"直接粘贴

**角度分配**:
- `logics` 长度为N,第i篇改写用 `logics[i % N]`
- 默认逻辑: `["同角度换词", "不同角度重写"]`

**实现位置**: `lib/tasks.js:264-398`

---

### 4. 万能改写
**路径**: `/api/universal`

**用途**: 单篇文章的万能改写 + "仅降AI味"模式

**输入参数**:
```json
{
  "text": "原文内容",
  "strength": "中度",      // 轻度/中度/深度/彻底重写 (4档独立)
  "audience": "年轻人",    // 通用/年轻人/职场人/宝妈/中老年
  "aiOff": true,           // 改写后是否降AI味
  "onlyDeAI": false,       // ★ true=仅降AI味,跳过改写
  "keywords": "核心词",
  "tone": "轻松",
  "length": "800-1200",
  "provider": "claude",
  "demo": false
}
```

**"仅降AI味"模式**:
- `onlyDeAI: true` → 跳过改写,直接进入4阶段降AI流水线
- 输出包含打分: `{ text, score, level, passed }`

**实现位置**: `routes/generate.js:45-73`

---

### 5. 一键排版
**路径**: `/api/layout`

**用途**: 生成公众号可直接复制的HTML富文本

**输入参数**:
```json
{
  "text": "原文",
  "style": "简约",         // 简约/文艺/商务/清新/经典
  "size": "15px",          // 14/15/16/17
  "line": "1.75",          // 1.5/1.75/2.0
  "withImages": false,     // 配图占位符
  "withEmoji": true,       // 表情装饰
  "withQuote": true,       // 引用块
  "withAI": false,         // 排版前先降AI味
  "withAutoImages": true,  // ★ 自动AI配图 (通义万相)
  "provider": "claude"
}
```

**AI自动配图流程** (新增功能):
1. 用LLM分析文章,生成2-3个配图场景描述
2. 调用通义万相API生成图片
3. 图片保存到 `backend/public/images/`
4. HTML中插入 `<img>` 标签,路径为相对路径
5. 失败处理: 配图失败不影响排版,静默回退

**排版风格对比**:
| 风格 | 字体 | 主色 | 背景 | 特点 |
|-----|------|------|------|------|
| 简约 | -apple-system | #2c3e50 | #ffffff | 底部细线标题,灰色左线引用块 |
| 文艺 | 'Noto Serif SC' | #5a4a42 | #faf8f5 | 居中标题+上下细线,金棕色引用块 |
| 商务 | -apple-system | #1e3a5f | #ffffff | 左侧色条标题,蓝色边框引用块 |
| 清新 | 'Noto Sans SC' | #2d5016 | #f9fdf7 | 浅绿背景标题,绿色引用块+大圆角 |
| 经典 | 'Noto Serif SC' | #3d3d3d | #fffef9 | 居中+红色底线标题,红色引用块 |

**公众号兼容性保证**:
- 全部使用 `<section>` + 内联样式
- 避免使用 `<div>` (部分版本不支持)
- 所有样式带 `box-sizing:border-box`
- 图片使用 `max-width:100%; height:auto`

**实现位置**: `routes/generate.js:76-140` + `layoutText()` 函数

---

### 6. 模型秘钥管理
**路由**: `/api/keys/*`

**支持的供应商**:
```javascript
{
  "claude": { type: "anthropic", name: "Claude", demo: true },
  "gpt4": { type: "openai", name: "GPT-4", demo: false },
  "wenxin": { type: "openai", name: "文心", demo: true },
  "deepseek": { type: "openai", name: "DeepSeek", demo: false },
  "tongyi-wanxiang": { type: "image", name: "通义万相" }
}
```

**Demo状态逻辑**:
- `demo: true` 的供应商,前端默认显示"已配置(演示)"灰标
- 实际未存key,点"保存"才真存
- 用户可在任何API调用时传 `demo: true` 强制Demo模式

**秘钥加密**:
- 算法: AES-256-GCM
- 主密钥: 服务器启动时生成,存在内存 (不持久化)
- 存储: `backend/data/keys.enc.json`
- 格式: `{ iv: "...", authTag: "...", encrypted: "..." }`

**API列表**:
```
GET    /api/keys                  # 列表 (掩码显示)
POST   /api/keys/:provider        # 保存
DELETE /api/keys/:provider        # 删除
POST   /api/keys/:provider/test   # 测试连接
POST   /api/keys/:provider/reveal # 明文查看 (需二次确认)
```

**实现位置**: `lib/keys.js` + `routes/keys.js`

---

### 7. 降AI味 4阶段流水线

**核心算法**: 串行4阶段处理,每阶段打分 + 自动重做

**阶段定义**:
1. **去模板**: 删除"首先/其次/综上所述"等AI套话
2. **增口语**: 加入"其实/说白了/坦白讲"等口语连接词
3. **调句式**: 长短句交替,打破工整节奏
4. **加温度**: 加入具体数字/场景/第一人称

**执行逻辑**:
```javascript
for (const stage of ['去模板', '增口语', '调句式', '加温度']) {
  let bestResult = current;
  let bestScore = scoreAI(current).score;
  
  for (let loop = 0; loop <= maxLoops; loop++) {
    const out = await chat({ prompt: DEAI_STAGES[stage] });
    const sc = scoreAI(out);
    
    if (sc.score < bestScore) {
      bestResult = out;
      bestScore = sc.score;
    }
    
    if (sc.score < pass_threshold || loop === maxLoops) {
      current = bestResult;
      break;
    }
  }
}
```

**配置参数** (config/scoring.json):
- `pass_threshold`: 50 (低于此分数视为通过)
- `loop_max`: 2 (每阶段最多重做2次)

**实现位置**: `lib/deai.js`

---

## 数据流与状态机

### 批量任务状态机

```
待生成 (PENDING)
    ↓
生成中 (GENERATING)  ← 重试最多3次
    ↓
生成成功 (GENERATED)
    ↓
[if withAIOff=true]
    ↓
降AI处理中 (DEAI_RUNNING)
    ↓
降AI处理成功 (DEAI_OK) / 降AI处理失败(未达标) (DEAI_FAIL)
    ↓
完成 (DONE)

异常分支:
- 抓取失败 (FETCH_FAIL) ← 仅批量改写
- 生成失败 (GEN_FAIL) ← LLM调用失败
- 已取消 (CANCELLED) ← 用户主动取消
```

### 任务数据结构
```javascript
{
  id: "t_abc123",
  type: "original" | "rewrite",
  total: 10,
  items: [
    {
      id: "主题A#1",
      title: "主题A",
      body: "生成的文章内容",
      score: 42,
      status: "降AI处理成功",
      error: null
    }
  ],
  status: "running" | "done" | "cancelled",
  success: 8,
  fail: 2,
  createdAt: "2026-09-02T10:00:00.000Z",
  updatedAt: "2026-09-02T10:05:00.000Z",
  cancelToken: { cancelled: false, reason: null }
}
```

### 任务生命周期管理
- **TTL**: 7天自动清理
- **上限**: 最多保留1000个任务
- **清理策略**: 每30分钟检查,优先删除已完成的旧任务
- **取消机制**: `CancelToken` 支持运行中取消,未完成的项标记为"已取消"

**实现位置**: `lib/tasks.js:27-79`

---

## 后端API详解

### API速查表
```
GET    /health                    # 健康检查 (免认证)
GET    /api/meta                  # 元数据 (前端加载配置)
GET    /api/keys                  # 秘钥列表
POST   /api/keys/:provider        # 保存秘钥
DELETE /api/keys/:provider        # 删除秘钥
POST   /api/keys/:provider/test   # 测试连接
POST   /api/keys/:provider/reveal # 明文查看
POST   /api/title                 # 一键标题
POST   /api/universal             # 万能改写
POST   /api/layout                # 一键排版
POST   /api/score                 # 单独打分
POST   /api/estimate              # 成本预估
POST   /api/original              # 批量原创 (异步)
POST   /api/rewrite               # 批量改写 (异步)
GET    /api/tasks/:id             # 轮询任务
POST   /api/tasks/:id/cancel      # 取消任务
POST   /api/fetch                 # 单链接抓取
```

### 通用响应格式
**成功**:
```json
{
  "data": { ... },
  "cost": { "estimated": "¥0.05" }  // 可选
}
```

**失败**:
```json
{
  "error": "错误信息"
}
```

### 重点API详解

#### `/api/meta` - 元数据
**用途**: 前端启动时加载所有配置
```json
{
  "domains": [{ "key": "理财", "label": "理财", "emoji": "💰" }, ...],
  "batch_rewrite_strengths": [...],
  "universal_rewrite_strengths": [...],
  "target_audiences": [...],
  "layout_styles": [...],
  "providers": {
    "claude": { "name": "Claude", "configured": true, "demo": true },
    ...
  }
}
```

#### `/api/tasks/:id` - 任务轮询
**响应**:
```json
{
  "id": "t_abc123",
  "type": "original",
  "status": "running",
  "progress": {
    "total": 10,
    "done": 7,
    "running": 2,
    "failed": 1
  },
  "items": [...]
}
```

**轮询策略**:
- 前端: 每1秒轮询
- 状态为 `done` / `cancelled` 时停止轮询

#### `/api/estimate` - 成本预估
**输入**:
```json
{
  "provider": "claude",
  "totalCount": 10,
  "wordsPerItem": 800,
  "withAIOff": true
}
```

**输出**:
```json
{
  "cost": {
    "estimated": "¥1.20",
    "breakdown": {
      "generation": "¥0.60",
      "deai": "¥0.60"
    },
    "provider": "claude"
  }
}
```

**单价配置** (config/providers.json):
```json
{
  "claude": { "price_per_1k_tokens": 0.015 },
  "gpt4": { "price_per_1k_tokens": 0.03 },
  "wenxin": { "price_per_1k_tokens": 0.008 },
  "deepseek": { "price_per_1k_tokens": 0.001 }
}
```

---

## 前端架构

### 技术选型
- **无构建工具**: 纯HTML + Vanilla JS
- **无框架**: 不依赖 React / Vue
- **状态管理**: 手写状态机 (assets/state.js)
- **样式**: 内联CSS + 少量全局样式

### 文件职责

#### `index.html`
- 单页应用入口
- 7个主功能Tab: 一键标题 / 批量原创 / 批量改写 / 万能改写 / 一键排版 / 降AI味 / 模型秘钥
- 动态加载后端 `/api/meta` 填充选项

#### `assets/api.js`
- 后端API客户端封装
- 自动处理 Basic Auth
- 统一错误处理

#### `assets/state.js`
- 状态徽章渲染: `待生成` → 灰色, `生成中` → 蓝色, `完成` → 绿色, `失败` → 红色
- 状态机映射

#### `assets/poller.js`
- 任务轮询器
- 自动管理轮询生命周期
- 支持多任务并行轮询

#### `assets/app.js`
- 主入口,绑定所有UI事件
- 表单提交 → API调用 → 结果渲染

### 前端状态管理
```javascript
// 全局状态
window.APP_STATE = {
  currentTask: null,
  pollers: new Map(),  // taskId -> Poller实例
  meta: {}             // 从 /api/meta 加载的配置
};
```

---

## 配置系统

### 配置文件清单

#### `config/domains.json`
13个领域: 理财 / 职场 / 情感 / 育儿 / 健康 / 科技 / 美食 / 旅行 / 历史 / 体育 / 娱乐 / 汽车 / 军事

#### `config/strengths.json`
- `batch_rewrite_strengths`: 批量改写3档 (轻度/中度/深度)
- `universal_rewrite_strengths`: 万能改写4档 (轻度/中度/深度/彻底重写)
- **注意**: 两套参数独立,代码不复用

#### `config/scoring.json` ★核心配置
```json
{
  "pass_threshold": 50,
  "loop_max": 2,
  "weights": {
    "template_penalty_each": 4,    // 每个AI套话扣4分
    "template_penalty_cap": 30,    // 套话扣分上限30
    "uniformity_weight": 18,       // 句长方差权重
    "persona_bonus_each": 1.2,     // 第一人称加分
    "long_sentence_threshold": 60  // 长句阈值
  },
  "template_phrases": [
    "首先", "其次", "综上所述", "赋能", "数字化转型", ...
  ]
}
```

**热重载**: 修改后重启服务生效

#### `config/providers.json`
```json
{
  "default_provider": "claude",
  "providers": {
    "claude": {
      "type": "anthropic",
      "name": "Claude",
      "base_url": "https://api.anthropic.com/v1/messages",
      "default_model": "claude-3-5-sonnet-20241022",
      "price_per_1k_tokens": 0.015,
      "demo": true
    },
    "tongyi-wanxiang": {
      "type": "image",
      "name": "通义万相",
      "base_url": "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
    }
  }
}
```

### 配置加载器
**位置**: `lib/config.js`
**特性**:
- 启动时加载所有JSON
- 导出为 `config.domains` / `config.scoring` 等
- 支持热重载 (需重启服务)

---

## LLM集成层

### 统一调用接口
**位置**: `lib/llm.js`

**函数签名**:
```javascript
async function chat({
  provider,      // "claude" | "gpt4" | "wenxin" | "deepseek"
  messages,      // [{ role: "user", content: "..." }]
  temperature,   // 0.0-1.0
  maxTokens,
  system,        // 系统提示词 (可选)
  model,         // 模型名 (可选,默认用provider配置)
  demo,          // true=Demo模式
  tempKey        // 临时Key (测试连接用)
})
```

### Demo模式
**触发条件**:
- `demo: true` 参数
- 或未配置API Key

**行为**:
- 根据任务类型返回预设MOCK数据
- 任务检测: 标题 / 原创 / 改写 / 降AI味 / 排版
- 延迟: 600-1400ms 模拟网络延迟

**MOCK数据库**:
```javascript
const MOCK_TITLES = {
  理财: ['30岁才明白的三个理财真相', ...],
  职场: ['35岁被裁后我才明白', ...],
  ...
};
```

### 错误处理
- **超时**: 60秒
- **限流**: 捕获429错误,返回友好提示
- **秘钥脱敏**: 自动删除错误信息中的key尾号

### 供应商适配层

#### Anthropic Claude
```javascript
POST https://api.anthropic.com/v1/messages
Headers: 
  x-api-key: sk-ant-...
  anthropic-version: 2023-06-01
Body:
  { model, max_tokens, temperature, messages, system }
```

#### OpenAI / 文心 / DeepSeek
```javascript
POST {base_url}
Headers:
  Authorization: Bearer sk-...
Body:
  { model, messages, temperature, max_tokens }
```

**注意**: 文心/DeepSeek使用OpenAI兼容接口

---

## 降AI味算法

### 启发式打分算法
**位置**: `lib/scoring.js`

**评分维度**:
| 维度 | 权重 | 说明 |
|-----|------|------|
| AI套话词频 | 4分/次, 封顶30 | 检测"首先/其次/综上所述"等47个模板短语 |
| 句长方差 | 18分 | 方差越小(句式越工整)扣分越多 |
| 段落重复开头 | 3分/次, 封顶15 | 检测"首先...其次...最后..."模式 |
| 过渡词密度 | 1.5分/次, 封顶10 | 检测"然而/因此/所以"等10个过渡词 |
| 第一人称(加分) | -1.2分/次, 封顶15 | "我/我们/咱"等18个人称词 |
| 口语词(加分) | -0.6分/次, 封顶8 | "吧/嘛/其实"等20个口语词 |
| 长句惩罚 | 0.3分/字 | 超过60字的句子 |
| 短句惩罚 | 4分/次 | 少于8字的句子 |
| 怪异标点 | 2分/次 | `...` / `——` / 全角空格 |

**基准分**: 35分

**计算公式**:
```javascript
score = base_score
      + template_penalty
      + uniformity_penalty
      + repeat_penalty
      + transition_penalty
      - persona_bonus
      - colloquial_bonus
      + long_sentence_penalty
      + short_sentence_penalty
      + weird_punct_penalty
```

**等级划分**:
- **S级** (0-30): 完全像人写的
- **A级** (31-45): 轻微AI痕迹
- **B级** (46-60): 明显AI感
- **C级** (61-80): 严重AI味
- **D级** (81+): 典型AI文

**通过阈值**: `pass_threshold: 50` (可在 scoring.json 修改)

### Prompt设计原则

#### 系统提示词 (BASE_SYSTEM)
```
你是一位中文新媒体写作老手,擅长把"AI体"文章改写得像真人写的。
铁律:
1. 绝不出现"首先/其次/综上所述"等套话
2. 多用"我/你/咱们",加入具体场景和个人感受
3. 句式有长有短,不工整,偶尔用"其实/说白了"
4. 给数字、给例子、给时间地点
5. 标题党但不低俗
6. 输出纯文本,不要Markdown
```

#### 4阶段Prompt特点
1. **去模板**: 罗列47个AI套话,要求删除或替换
2. **增口语**: 指定20个口语词,要求自然插入
3. **调句式**: 要求长短句交替,句尾标点多样化
4. **加温度**: 要求加入2处数字 + 1处场景 + 1处第一人称

**字数约束**:
- 去模板: 不能增加字数
- 增口语: 最多增加5%
- 调句式: 持平 (±3%)
- 加温度: 最多增加10%

**实现位置**: `lib/prompts.js:115-193`

---

## 部署与运维

### Docker部署 (生产环境)

#### 1. 一键部署
```bash
cd /opt/moruen-studio-v2
docker compose up -d
```

#### 2. 查看日志
```bash
docker compose logs -f moruen
```

#### 3. 重启服务
```bash
docker compose restart moruen
```

#### 4. 停止服务
```bash
docker compose down
```

#### 5. 更新代码后重新构建
```bash
git pull
docker compose build --no-cache
docker compose up -d
```

### 环境变量
**`.env` 文件** (可选):
```bash
# 端口
MORUEN_PORT=8787

# Basic Auth (可选)
AUTH_USER=admin
AUTH_PASS=your_secure_password

# CORS
ALLOW_ORIGIN=*

# Node环境
NODE_ENV=production
```

### Nginx反向代理 (推荐)
```nginx
server {
    listen 80;
    server_name moruen.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE/长轮询需要
        proxy_buffering off;
    }
}
```

**HTTPS配置**:
```bash
sudo certbot --nginx -d moruen.your-domain.com
```

### 数据备份

#### 备份秘钥
```bash
docker run --rm \
  -v moruen-studio-v2_moruen_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/moruen-keys-$(date +%Y%m%d).tar.gz /data
```

#### 恢复秘钥
```bash
docker run --rm \
  -v moruen-studio-v2_moruen_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/moruen-keys-20260902.tar.gz -C /
```

### 监控指标
- **健康检查**: `GET /health` (返回 `{ ok: true, ts: 1234567890 }`)
- **任务统计**: 查看 `GET /api/tasks` 返回的任务列表
- **内存占用**: Docker stats查看 `moruen` 容器

### 性能调优

#### 并发数调整
**批量任务默认并发**: 8
**建议值**:
- 2核2GB: 并发5-8
- 2核4GB: 并发8-12
- 4核8GB: 并发12-20

#### 限流配置
**当前**: 每IP 60秒120次
**调整**: 修改 `server.js:30-31`:
```javascript
const win = 60_000;  // 窗口时间 (毫秒)
const max = 120;     // 最大请求数
```

---

## 开发规范

### 本地开发
```bash
# 后端
cd backend
npm install
npm start    # 监听 8787,同时托管前端

# 或前后端分离
# 终端1: cd backend && npm start
# 终端2: cd frontend && python3 -m http.server 8765
```

### 代码风格
- **ES Module**: 所有文件使用 `import/export`
- **异步**: 统一使用 `async/await`
- **错误处理**: try-catch + 友好错误信息
- **注释**: 文件头注释 + 关键逻辑注释

### 添加新功能检查清单
1. ✅ 后端API路由添加
2. ✅ 前端UI组件添加
3. ✅ API文档更新 (本文档)
4. ✅ 配置文件更新 (如需)
5. ✅ Demo模式支持 (如涉及LLM调用)
6. ✅ 错误处理完善
7. ✅ 测试连通性

### Git提交规范
```
feat: 新功能
fix: 修复bug
refactor: 重构
docs: 文档更新
style: 代码格式
perf: 性能优化
```

---

## 已知问题与限制

### 功能限制
1. **公众号链接抓取**: 需要登录态cookie,公开抓取成功率<10%
   - **解决方案**: 用"万能改写"手动粘贴原文

2. **批量任务上限**: 单次最多120篇 (10主题×12篇)
   - **原因**: 防止LLM并发过高触发限流

3. **图片生成**: 目前仅支持通义万相,其他平台需单独适配

4. **无数据库**: 任务数据存内存,服务重启后丢失
   - **影响**: 重启时正在运行的任务会丢失进度

### 性能瓶颈
1. **LLM响应速度**: 单篇文章生成需5-15秒
   - **优化**: 已使用并发池,可调整并发数

2. **降AI味时长**: 4阶段×2轮=最多8次LLM调用,耗时30-60秒
   - **优化**: 可关闭降AI味或降低 `loop_max`

3. **内存占用**: 批量任务数据全部存内存
   - **建议**: 2GB内存起步,4GB推荐

### 安全注意事项
1. **生产环境务必开启Basic Auth**:
   ```bash
   AUTH_USER=your_user AUTH_PASS=your_pass docker compose up -d
   ```

2. **秘钥加密**: 主密钥存内存,容器重启后需重新输入API Key
   - **备份方案**: 定期备份 `data/keys.enc.json`

3. **CORS配置**: 生产环境建议限制来源:
   ```bash
   ALLOW_ORIGIN=https://your-domain.com docker compose up -d
   ```

### 兼容性
- **浏览器**: Chrome 90+ / Edge 90+ / Safari 14+ (需支持ES6)
- **Node.js**: 18+ (使用ES Module + fetch API)
- **Docker**: 20.10+
- **公众号编辑器**: 已测试微信公众号后台 (2024版)

---

## 附录

### 快速问题排查

#### 问题: 任务一直"生成中"不动
**排查**:
1. 查看后端日志: `docker compose logs -f moruen`
2. 检查API Key是否有效: 访问 `/api/keys/:provider/test`
3. 检查LLM供应商是否限流

#### 问题: 降AI味后分数反而更高
**原因**: 某些阶段可能引入新的AI特征词
**解决**:
1. 调整 `scoring.json` 的权重
2. 降低 `loop_max` 减少过度处理
3. 检查Prompt是否需要优化

#### 问题: 排版后公众号粘贴乱码
**原因**: 公众号编辑器版本差异
**解决**:
1. 使用"简约"风格 (兼容性最好)
2. 检查是否有不支持的CSS属性
3. 使用"源代码模式"粘贴

### 成本参考 (2026年价格)
| 供应商 | 单价 (¥/1k tokens) | 800字文章成本 | 降AI味成本 |
|--------|-------------------|--------------|-----------|
| Claude | 0.015 | ¥0.03 | ¥0.12 (4阶段) |
| GPT-4 | 0.03 | ¥0.06 | ¥0.24 |
| 文心 | 0.008 | ¥0.016 | ¥0.064 |
| DeepSeek | 0.001 | ¥0.002 | ¥0.008 |

**实际成本**: 受温度参数、重试次数、降AI味轮数影响,可能上浮20-50%

### 联系与反馈
- **项目地址**: 内部仓库 (非开源)
- **技术栈**: Node.js + Express + Vanilla JS
- **维护者**: 墨韵工坊团队

---

**文档版本**: v2.0  
**最后更新**: 2026-09-02  
**下次更新**: 功能迭代后同步更新
