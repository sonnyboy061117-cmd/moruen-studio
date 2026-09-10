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
  access_code TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 钱包表
CREATE TABLE IF NOT EXISTS wallet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance REAL NOT NULL DEFAULT 0,
  access_code TEXT,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 钱包交易记录表
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('recharge', 'consume')),
  description TEXT NOT NULL,
  access_code TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`;

// 执行建表
db.exec(INIT_SQL);

console.log('[DB] SQLite 初始化完成:', DB_PATH);

// ==================== 会员相关 ====================

// 生成随机8位access_code（字母+数字）
function generateAccessCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 检查access_code是否已存在
function isAccessCodeExists(code) {
  const membershipExists = db.prepare('SELECT 1 FROM membership WHERE access_code = ? LIMIT 1').get(code);
  const walletExists = db.prepare('SELECT 1 FROM wallet WHERE access_code = ? LIMIT 1').get(code);
  return !!(membershipExists || walletExists);
}

// 生成唯一的access_code
function generateUniqueAccessCode() {
  let code;
  let attempts = 0;
  do {
    code = generateAccessCode();
    attempts++;
    if (attempts > 100) throw new Error('生成access_code失败，重试次数过多');
  } while (isAccessCodeExists(code));
  return code;
}

// 获取当前会员状态（按access_code查询）
export function getMembership(accessCode = null) {
  if (!accessCode) {
    return { active: false, tier: null, expireDate: null, activationType: null };
  }

  const row = db.prepare(`
    SELECT * FROM membership
    WHERE access_code = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(accessCode);

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

  // 生成唯一的access_code
  const accessCode = generateUniqueAccessCode();

  // 插入会员记录
  const stmt = db.prepare(`
    INSERT INTO membership (tier, price, activation_type, start_date, expire_date, contact, access_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(tier, price, activationType, startDate, expireDate, contact, accessCode);

  // 为该用户创建钱包记录（初始余额0）
  db.prepare(`
    INSERT INTO wallet (balance, access_code)
    VALUES (0, ?)
  `).run(accessCode);

  return { id: result.lastInsertRowid, startDate, expireDate, accessCode };
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

// 获取余额（按access_code查询）
export function getBalance(accessCode = null) {
  if (!accessCode) {
    return 0;
  }

  const row = db.prepare('SELECT balance FROM wallet WHERE access_code = ?').get(accessCode);
  return row ? row.balance : 0;
}

// 充值（按access_code）
export function recharge(accessCode, amount, description = '模拟充值') {
  if (!accessCode) {
    throw new Error('access_code不能为空');
  }

  const stmt = db.prepare(`
    UPDATE wallet SET balance = balance + ?, updated_at = datetime('now', 'localtime')
    WHERE access_code = ?
  `);
  stmt.run(amount, accessCode);

  // 记录交易
  db.prepare(`
    INSERT INTO wallet_transactions (amount, type, description, access_code)
    VALUES (?, 'recharge', ?, ?)
  `).run(amount, description, accessCode);

  return getBalance(accessCode);
}

// 消费（按access_code，返回是否成功）
export function consume(accessCode, amount, description) {
  if (!accessCode) {
    return { success: false, message: 'access_code不能为空', balance: 0 };
  }

  const balance = getBalance(accessCode);
  if (balance < amount) {
    return { success: false, message: '余额不足', balance };
  }

  const stmt = db.prepare(`
    UPDATE wallet SET balance = balance - ?, updated_at = datetime('now', 'localtime')
    WHERE access_code = ?
  `);
  stmt.run(amount, accessCode);

  // 记录交易
  db.prepare(`
    INSERT INTO wallet_transactions (amount, type, description, access_code)
    VALUES (?, 'consume', ?, ?)
  `).run(-amount, description, accessCode);

  return { success: true, balance: getBalance(accessCode) };
}

// 获取交易记录（按access_code查询）
export function getTransactions(accessCode = null, limit = 50) {
  if (!accessCode) {
    return [];
  }

  return db.prepare(`
    SELECT * FROM wallet_transactions
    WHERE access_code = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(accessCode, limit);
}

export default db;
