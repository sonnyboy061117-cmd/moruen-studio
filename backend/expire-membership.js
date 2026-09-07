import Database from 'better-sqlite3';

const db = new Database('./data/moruen.db');

// 将最新的会员记录设置为昨天过期
const result = db.prepare(`
  UPDATE membership
  SET expire_date = datetime('now', '-1 day')
  WHERE id = (SELECT MAX(id) FROM membership)
`).run();

console.log('✅ 会员记录已过期，影响行数:', result.changes);

// 查看当前会员状态
const current = db.prepare('SELECT * FROM membership ORDER BY id DESC LIMIT 1').get();
console.log('当前会员记录:', current);

db.close();
