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
        this.onUpdate({ error: e.message });
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
