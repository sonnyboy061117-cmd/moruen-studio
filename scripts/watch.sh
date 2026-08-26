#!/usr/bin/env bash
# 墨韵工坊 · 文件改动自动重建
# 用法: ./scripts/watch.sh  (放后台跑)
# 触发: backend/* frontend/* Dockerfile docker-compose.yml 改动
# 排除: node_modules data/ .env *.log package-lock.json

set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/var/log/moruen-watch.log"
LOCK="/tmp/moruen-rebuild.lock"

if ! command -v inotifywait >/dev/null 2>&1; then
  echo "需要 inotify-tools: apt-get install -y inotify-tools"
  exit 1
fi

{
  echo "[$(date '+%H:%M:%S')] 启动文件监控,改动 backend/ frontend/ 或配置会自动 rebuild"
  echo "停止: pkill -f 'inotifywait.*moruen'"
} | tee -a "$LOG"

# 不用 pipe + 函数(子 shell 看不到),用 process substitution
while read -r path; do
  if [ -f "$LOCK" ]; then
    echo "[$(date '+%H:%M:%S')] 另一个 rebuild 正在进行,跳过" >> "$LOG"
    continue
  fi
  touch "$LOCK"
  echo "[$(date '+%H:%M:%S')] >>> 检测到变化: $path,开始 rebuild..." >> "$LOG"
  cd "$APP_DIR"
  if docker compose build >> "$LOG" 2>&1 && docker compose up -d >> "$LOG" 2>&1; then
    echo "[$(date '+%H:%M:%S')] ✓ rebuild + 重启成功" >> "$LOG"
  else
    echo "[$(date '+%H:%M:%S')] ✗ rebuild 失败,查看 $LOG" >> "$LOG"
  fi
  rm -f "$LOCK"
done < <(inotifywait -m -r \
  --event modify,create,delete,move \
  --format '%w%f' \
  --exclude '(node_modules|\.git|/data/|\.env$|\.log$|package-lock\.json)' \
  "$APP_DIR/backend" \
  "$APP_DIR/frontend" \
  "$APP_DIR/Dockerfile" \
  "$APP_DIR/docker-compose.yml" 2>/dev/null)
