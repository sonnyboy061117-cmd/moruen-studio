// 墨韵工坊 · 并发池
// 后端批量任务用,限制 5-10 并发,超出排队
import pLimit from 'p-limit';

export class TaskPool {
  constructor(concurrency = 8) {
    this.limit = pLimit(concurrency);
    this.stats = { active: 0, queued: 0, done: 0 };
  }

  async run(fn) {
    return this.limit(async () => {
      this.stats.active++;
      try {
        const r = await fn();
        this.stats.done++;
        return r;
      } finally {
        this.stats.active--;
      }
    });
  }

  get pending() {
    return this.limit.activeCount + this.limit.pendingCount;
  }
}
