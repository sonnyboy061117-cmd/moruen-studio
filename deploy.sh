#!/usr/bin/env bash
# 墨韵工坊 · 一键部署到远程服务器
# 用法: ./deploy.sh user@server-ip [ssh-port]
# 要求: 本地有项目代码 + sshpass(可选,用于非交互)
set -euo pipefail

TARGET="${1:-}"
PORT="${2:-22}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$TARGET" ]]; then
  echo "用法: $0 user@server-ip [ssh-port]"
  echo "例:   $0 root@1.2.3.4 22"
  exit 1
fi

REMOTE_DIR="/opt/moruen"

echo "==> 1. 远程目录: $TARGET:$REMOTE_DIR"
echo "==> 2. 创建远程目录"
ssh -p "$PORT" -o StrictHostKeyChecking=no "$TARGET" "mkdir -p $REMOTE_DIR"

echo "==> 3. 上传项目文件(排除 node_modules / .git 等)"
rsync -avz --progress \
  -e "ssh -p $PORT -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude 'screenshot*.png' \
  --exclude 'test_*.js' \
  --exclude 'package-lock.json' \
  "$LOCAL_DIR/" "$TARGET:$REMOTE_DIR/"

echo "==> 4. 远程启动 docker compose"
ssh -p "$PORT" -o StrictHostKeyChecking=no "$TARGET" << EOF
set -e
cd $REMOTE_DIR
# 检查 docker
if ! command -v docker &> /dev/null; then
  echo "未安装 docker,正在安装..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
if ! docker compose version &> /dev/null; then
  echo "未安装 docker compose plugin"
  apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin
fi
# 启动
docker compose build --no-cache
docker compose up -d
echo "==> 等待健康检查..."
for i in {1..30}; do
  STATUS=\$(docker inspect --format='{{.State.Health.Status}}' moruen-studio 2>/dev/null || echo "starting")
  if [[ "\$STATUS" == "healthy" ]]; then
    echo "✓ 容器健康"
    break
  fi
  sleep 2
done
docker compose ps
docker compose logs --tail=30
EOF

echo ""
echo "==> ✓ 部署完成"
echo "==> 访问: http://<server-ip>:8787/"
echo "==> 看日志: ssh -p $PORT $TARGET 'cd $REMOTE_DIR && docker compose logs -f'"
