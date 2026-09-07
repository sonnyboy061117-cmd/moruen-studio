// 临时脚本：清空会员记录
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'moruen.db');

const db = new Database(DB_PATH);

console.log('=== 清空会员记录 ===');

// 删除所有会员记录
const deleteResult = db.prepare('DELETE FROM membership').run();
console.log(`✅ 已删除 ${deleteResult.changes} 条会员记录`);

// 查看当前会员状态
const membership = db.prepare('SELECT * FROM membership').all();
console.log('当前会员记录数量:', membership.length);

// 查看当前余额
const wallet = db.prepare('SELECT * FROM wallet WHERE id = 1').get();
console.log('当前余额:', wallet.balance, '元');

db.close();
console.log('✅ 完成');
