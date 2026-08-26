# 墨韵工坊 · 新媒体一站式内容生成工具

> 内部工具,团队自用。Node.js 后端 + 浏览器前端,真实调用大模型 API。
> 配套需求文档: 详见 `doc.md` (或 README 末尾)

## 快速部署 (Docker 一键)

### 服务器要求

- Linux (Ubuntu 20.04+ / CentOS 7+ / Debian 11+ 均可)
- 2 核 2GB 内存起,推荐 2 核 4GB
- 已安装 Docker 20.10+ 和 Docker Compose v2
- 开放 8787 端口(或自定义)
- 公网 IP + 域名 (可选,直接用 IP 也行)

### 一条命令部署

把项目目录上传到服务器(任意路径,比如 `/opt/moruen`),然后:

```bash
cd /opt/moruen
docker compose up -d
```

等 30-60 秒,看到 `moruen-studio` 容器 `healthy`,访问:

```
http://<服务器IP>:8787/
```

看到墨韵工坊界面,搞定。

### 自定义端口

```bash
# 在 docker-compose.yml 同级建 .env 文件
echo "MORUEN_PORT=9080" > .env
docker compose up -d
```

### 配置 HTTPS / 域名(推荐 Nginx 反代)

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

用 certbot 一键加 HTTPS:

```bash
sudo certbot --nginx -d moruen.your-domain.com
```

## 日常运维

```bash
# 看日志
docker compose logs -f moruen

# 重启
docker compose restart moruen

# 停掉
docker compose down

# 更新(拉新代码后)
docker compose build --no-cache
docker compose up -d

# 备份秘钥数据
docker run --rm -v moruen-studio-v2_moruen_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/moruen-keys-$(date +%Y%m%d).tar.gz /data
```

## 本地开发(不部署,只跑)

```bash
# 后端
cd backend
npm install
npm start                    # 跑在 8787,后端同时托管前端

# 或者前后端分开
# 终端 1: cd backend && npm start
# 终端 2: cd frontend && python3 -m http.server 8765
# 浏览器: http://127.0.0.1:8765
```

## 项目结构

```
moruen-studio/
├── Dockerfile                  # Docker 镜像构建
├── docker-compose.yml          # 一键编排
├── .dockerignore
├── backend/                    # Node.js 后端
│   ├── server.js               # Express 入口(同时托管前端)
│   ├── package.json
│   ├── config/                 # ★ 配置(可热改)
│   │   ├── domains.json        # 13 个领域
│   │   ├── strengths.json      # 改写强度(批量 3 档 + 万能 4 档,独立不复用)
│   │   ├── styles.json         # 排版:5 风格 + 4 字号 + 3 行间距
│   │   ├── scoring.json        # ★ 打分权重/阈值,改完重启生效
│   │   ├── providers.json      # 4 家供应商配置
│   │   └── prompts.json        # 标题/原创/改写风格枚举
│   ├── lib/
│   │   ├── config.js           # 配置加载器
│   │   ├── keys.js             # AES-256-GCM 秘钥加密
│   │   ├── llm.js              # 4 家 LLM 统一调用
│   │   ├── scoring.js          # 启发式打分(读配置)
│   │   ├── deai.js             # 降 AI 味 4 阶段流水线
│   │   ├── prompts.js          # 全部 prompt 模板
│   │   ├── readability.js      # 后端链接抓取(cheerio,无 CORS)
│   │   ├── pool.js             # p-limit 并发池
│   │   ├── tasks.js            # 批量任务 + 状态机
│   │   └── cost.js             # 成本预估(读 providers.json 单价)
│   ├── routes/
│   │   ├── keys.js             # 秘钥 CRUD + 测试 + 二次确认 reveal
│   │   ├── generate.js         # 单点:标题/万能改写/排版/打分/成本
│   │   ├── tasks.js            # 批量原创/改写 + 任务轮询
│   │   ├── fetch.js            # 链接抓取 API
│   │   └── meta.js             # 元数据(给前端加载配置)
│   └── data/                   # 加密秘钥存储(运行时)
│       └── keys.enc.json
├── frontend/                   # 浏览器前端(纯静态,无构建)
│   ├── index.html              # 沿用 demo 视觉
│   └── assets/
│       ├── api.js              # 后端 API 客户端
│       ├── state.js            # 状态机 + 徽章
│       ├── poller.js           # 任务轮询
│       └── app.js              # 主入口(UI 绑定)
└── README.md
```

## 7 大模块

1. **一键标题** - 1-5 条参考 → 1-20 条候选
2. **批量原创** - 最多 10 主题 × 12 篇 = 120 篇上限,5-10 并发
3. **批量改写** - 链接抓取 + 3 档强度 + 6 项改写逻辑复选
4. **万能改写** - 4 档强度(独立不复用批量改写 3 档) + 5 档读者
5. **一键排版** - 5 风格 + 4 字号(14/15/16/17px) + 3 行间距(1.5/1.75/2.0)
6. **降 AI 味 4 阶段** - 去模板→增口语→调句式→加温度,内置启发式打分闭环
7. **模型秘钥** - Claude / GPT-4 / 文心 / DeepSeek,AES-256 后端加密

## 状态机(批量原创/改写共用)

```
待生成 → 生成中 → 生成成功 → 降AI处理中 → 降AI处理成功 / 降AI处理失败(未达标) → 完成
异常: 抓取失败(批量改写) / 生成失败
```

用户可在生成中切换页面,后端任务继续跑,前端轮询显示进度。

## 降 AI 味内部打分(不依赖任何外部检测)

| 维度 | 权重 | 阈值 |
|---|---|---|
| AI 套话词频(首先/其次/最后) | 4/次,封顶 30 | 阈值 50 |
| 句长方差(过工整=AI) | 18 | (改 scoring.json) |
| 段落重复开头 | 3/次,封顶 15 | |
| 过渡词密度 | 1.5/次,封顶 10 | |
| 第一人称/口语(加分) | -1.2/次,封顶 15 | |
| 长句惩罚(>60 字) | 0.3/字 | |

改 `backend/config/scoring.json` 的 `weights` 块,重启容器生效。**不达标自动重做该阶段,最多 2-3 轮**(改 `loop_max`)。

## 秘钥 demo 状态

按需求文档 1.1 节,Claude + 文心**默认 UI 显示"已配置(演示)"**(灰标),但实际未存 key,点"保存"才真存。GPT/DeepSeek 永远未配置。

## API 速查

```
GET    /health                    健康检查
GET    /api/meta                  元数据(13 领域/3 档/4 档/5 风格/...)
GET    /api/keys                  秘钥列表(掩码)
POST   /api/keys/:provider        保存 key
DELETE /api/keys/:provider        删除
POST   /api/keys/:provider/test   测试连接
POST   /api/keys/:provider/reveal 明文(需 confirm)
POST   /api/title                 一键标题
POST   /api/universal             万能改写(onlyDeAI=true 即"仅降 AI 味")
POST   /api/layout                一键排版
POST   /api/score                 单独打分
POST   /api/estimate              成本预估
POST   /api/original              批量原创(后台异步)
POST   /api/rewrite               批量改写(后台异步,自动抓链接)
GET    /api/tasks/:id             轮询任务状态
POST   /api/fetch                 单链接抓取
```

## FAQ

**Q: 公众号文章抓不到?**
A: 公众号需要登录态 cookie,公开抓取几乎都失败。建议用「万能改写」直接粘贴原文。

**Q: 降 AI 味 4 阶段要多久?**
A: 一篇 1500 字文章约 30-60 秒,4 阶段每阶段 1 次 LLM 调用,共 4-12 次。降 AI 味默认开。

**Q: 怎么备份秘钥?**
A: 秘钥加密存在 `data/keys.enc.json`,备份整个 `data/` 目录即可。

**Q: 怎么换默认模型供应商?**
A: 秘钥管理页 → 点对应 key 卡片的"设为默认"按钮。或改 `config/providers.json` 的 `default_provider`。

**Q: 打分阈值能改吗?**
A: 改 `backend/config/scoring.json` 的 `pass_threshold` 和 `weights`,重启容器。

## 后续可做(范围外)

- 批量下载(打包 zip 或逐个下载)
- 公众号链接真实抓取(需要 cookie 注入)
- AI 配图(豆包/通义万相/合规图库)
- 自定义规则编辑器(可视化调权重)
