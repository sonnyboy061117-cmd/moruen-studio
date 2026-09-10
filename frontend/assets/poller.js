// 墨韵工坊 · 任务轮询
// 后端异步跑,前端定时拉状态
import { api } from './api.js';

export class TaskPoller {
  constructor(taskId, onUpdate) {
    this.taskId = taskId;
    this.onUpdate = onUpdate;
    this.timer = null;
    this.stopped = false;
    this.tickCount = 0;
  }
  start(interval = 1500) {
    const tick = async () => {
      if (this.stopped) return;
      this.tickCount++;
      try {
        const t = await api.task(this.taskId);
        const ok = (t.items || []).filter(i => i.status === '完成' || i.status === '降AI处理成功').length;
        const total = t.items?.length || 0;
        console.log(`[poller ${this.taskId.slice(0, 8)}] tick#${this.tickCount} status=${t.status} ${ok}/${total}`);
        this.onUpdate(t);
        if (t.status === 'done') { this.stop(); return; }
      } catch (e) {
        console.warn(`[poller ${this.taskId.slice(0, 8)}] tick#${this.tickCount} err:`, e.message);

        // 如果是404任务不存在，停止轮询并给出友好提示
        if (e.status === 404 || e.message.includes('任务不存在')) {
          this.stop();
          this.onUpdate({
            status: 'lost',
            error: '任务已丢失（可能因服务器重启），请重新提交任务',
            items: []  // 确保有 items 数组，避免前端报错
          });
          return;
        }

        // 其他错误继续轮询，但传递安全的数据结构
        this.onUpdate({ error: e.message, items: [], status: 'error' });
      }
      this.timer = setTimeout(tick, interval);
    };
    tick();
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
