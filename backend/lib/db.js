// 墨韵工坊 · 数据库层 (SQLite)
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'moruen.db');

// 确保data目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据库连接
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // 性能优化

// 建表SQL
const INIT_SQL = `
-- 会员表
CREATE TABLE IF NOT EXISTS membership (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL CHECK(tier IN ('day', 'month', 'lifetime')),
  price REAL NOT NULL,
  activation_type TEXT NOT NULL CHECK(activation_type IN ('normal', 'manual_service')),
  start_date TEXT NOT NULL,
  expire_date TEXT,
  contact TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 钱包表
CREATE TABLE IF NOT EXISTS wallet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 钱包交易记录表
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('recharge', 'consume')),
  description TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 初始化钱包记录（如果不存在）
INSERT OR IGNORE INTO wallet (id, balance) VALUES (1, 0);
`;

// 执行建表
db.exec(INIT_SQL);

console.log('[DB] SQLite 初始化完成:', DB_PATH);

// ==================== 会员相关 ====================

// 获取当前会员状态
export function getMembership() {
  const row = db.prepare(`
    SELECT * FROM membership
    ORDER BY created_at DESC
    LIMIT 1
  `).get();

  if (!row) {
    return { active: false, tier: null, expireDate: null, activationType: null };
  }

  const now = new Date();
  const expireDate = row.expire_date ? new Date(row.expire_date) : null;
  const active = !expireDate || expireDate > now; // 永久或未过期

  return {
    active,
    tier: row.tier,
    price: row.price,
    activationType: row.activation_type,
    startDate: row.start_date,
    expireDate: row.expire_date,
    isLifetime: row.expire_date === null
  };
}

// 开通会员
export function activateMembership({ tier, price, activationType = 'normal', days = null, contact = null }) {
  const startDate = new Date().toISOString();
  let expireDate = null;

  // 根据tier计算到期时间
  if (tier === 'day') {
    const expire = new Date();
    expire.setDate(expire.getDate() + (days || 1));
    expireDate = expire.toISOString();
  } else if (tier === 'month') {
    const expire = new Date();
    expire.setDate(expire.getDate() + 30);
    expireDate = expire.toISOString();
  } else if (tier === 'lifetime') {
    expireDate = null; // 永久
  }

  const stmt = db.prepare(`
    INSERT INTO membership (tier, price, activation_type, start_date, expire_date, contact)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(tier, price, activationType, startDate, expireDate, contact);
  return { id: result.lastInsertRowid, startDate, expireDate };
}

// 获取最近开通记录
export function getMembershipHistory(limit = 20) {
  return db.prepare(`
    SELECT * FROM membership
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

// ==================== 钱包相关 ====================

// 获取余额
export function getBalance() {
  const row = db.prepare('SELECT balance FROM wallet WHERE id = 1').get();
  return row ? row.balance : 0;
}

// 充值
export function recharge(amount, description = '模拟充值') {
  const stmt = db.prepare(`
    UPDATE wallet SET balance = balance + ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `);
  stmt.run(amount);

  // 记录交易
  db.prepare(`
    INSERT INTO wallet_transactions (amount, type, description)
    VALUES (?, 'recharge', ?)
  `).run(amount, description);

  return getBalance();
}

// 消费（返回是否成功）
export function consume(amount, description) {
  const balance = getBalance();
  if (balance < amount) {
    return { success: false, message: '余额不足', balance };
  }

  const stmt = db.prepare(`
    UPDATE wallet SET balance = balance - ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `);
  stmt.run(amount);

  // 记录交易
  db.prepare(`
    INSERT INTO wallet_transactions (amount, type, description)
    VALUES (?, 'consume', ?)
  `).run(-amount, description);

  return { success: true, balance: getBalance() };
}

// 获取交易记录
export function getTransactions(limit = 50) {
  return db.prepare(`
    SELECT * FROM wallet_transactions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

export default db;
