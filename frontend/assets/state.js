// 墨韵工坊 · 状态机 + 任务轮询
// 后端任务状态枚举,与文档第 8.2 节一致
export const STATUS = {
  PENDING: '待生成',
  GENERATING: '生成中',
  GENERATED: '生成成功',
  DEAI_RUNNING: '降AI处理中',
  DEAI_OK: '降AI处理成功',
  DEAI_FAIL: '降AI处理失败(未达标)',
  FETCH_FAIL: '抓取失败',
  GEN_FAIL: '生成失败',
  DONE: '完成',
  CANCELLED: '已取消'
};

export const STATUS_CLASS = {
  '待生成': 'status-pending',
  '生成中': 'status-running',
  '生成成功': 'status-ok',
  '降AI处理中': 'status-running',
  '降AI处理成功': 'status-ok',
  '降AI处理失败(未达标)': 'status-warn',
  '完成': 'status-ok',
  '抓取失败': 'status-error',
  '生成失败': 'status-error',
  '已取消': 'status-error'
};

export function statusBadge(s) {
  return `<span class="status-badge ${STATUS_CLASS[s] || ''}">${s}</span>`;
}
