# 墨韵工坊 · Docker 镜像
# 多阶段构建: 前端静态 + 后端 Node,一个进程搞定一切
FROM node:20-alpine AS backend

# 时区(在此阶段装一次,后续 stage 都继承缓存)
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com

COPY backend/ ./
# 保留 config 和 data 目录(运行时读写)
# 排除 node_modules,会在容器内重新装

# 前端无需构建,直接 COPY 静态文件
FROM node:20-alpine
WORKDIR /app

# 后端文件
COPY --from=backend /app/backend ./backend

# 前端文件
COPY frontend/ ./frontend/

# 端口
ENV PORT=8787 \
    NODE_ENV=production \
    MORUEN_API_BASE= \
    ALLOW_ORIGIN=*

# 数据持久化目录(仅密钥存储需要持久化,config 随镜像发布,不应做成卷)
RUN mkdir -p /app/backend/data
VOLUME ["/app/backend/data"]

EXPOSE 8787

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1

WORKDIR /app/backend
CMD ["node", "server.js"]
