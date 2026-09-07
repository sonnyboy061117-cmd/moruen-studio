// 墨韵工坊 · 权限检查中间件
import { getMembership, getBalance, consume } from './db.js';

// 演示模式每日使用次数记录（内存存储，重启清空）
const demoUsage = new Map(); // key: date(YYYY-MM-DD), value: count

// 获取今日演示模式使用次数
function getTodayDemoCount() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return demoUsage.get(today) || 0;
}

// 增加演示模式使用次数
function incrementDemoCount() {
  const today = new Date().toISOString().split('T')[0];
  const current = demoUsage.get(today) || 0;
  demoUsage.set(today, current + 1);

  // 清理3天前的旧记录
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  for (const [date] of demoUsage) {
    if (date < threeDaysAgo) {
      demoUsage.delete(date);
    }
  }
}

// 检查是否可以使用演示模式
export function canUseDemoMode() {
  const DAILY_DEMO_LIMIT = 3;
  return getTodayDemoCount() < DAILY_DEMO_LIMIT;
}

// 检查会员状态
export function checkMembership(req, res, next) {
  const membership = getMembership();

  if (!membership.active) {
    return res.status(403).json({
      error: '该功能需要开通会员或有余额',
      code: 'MEMBERSHIP_REQUIRED',
      message: '日会员仅需14.9元即可体验全部功能'
    });
  }

  next();
}

// 检查余额并扣费
export async function checkAndConsumeBalance(amount, description) {
  const balance = getBalance();

  if (balance < amount) {
    return {
      allowed: false,
      error: '余额不足，请先充值',
      balance
    };
  }

  const result = consume(amount, description);
  return {
    allowed: result.success,
    balance: result.balance,
    error: result.success ? null : result.message
  };
}

// 统一权限检查：会员 或 余额 或 演示模式（每日3次）
export function checkAccess(req, res, next) {
  const membership = getMembership();
  const balance = getBalance();

  // 情况1: 会员有效 或 余额充足 → 正常使用
  if (membership.active || balance > 0) {
    req.hasAccess = true;
    req.membership = membership;
    req.balance = balance;
    req.autoDemo = false;
    next();
  }
  // 情况2: 无会员且无余额 → 尝试演示模式
  else if (canUseDemoMode()) {
    req.hasAccess = true;
    req.membership = membership;
    req.balance = balance;
    req.autoDemo = true; // 标记为自动演示模式
    req.demoCount = getTodayDemoCount() + 1;

    // 增加演示模式计数
    incrementDemoCount();

    next();
  }
  // 情况3: 演示次数用完 → 拒绝访问
  else {
    res.status(403).json({
      error: '今日演示次数已用完（3次/天），请开通会员或充值余额',
      code: 'DEMO_LIMIT_EXCEEDED',
      message: '日会员仅需14.9元即可体验全部功能，或充值余额按次使用',
      demoUsed: getTodayDemoCount(),
      demoLimit: 3
    });
  }
}

