// 墨韵工坊 · 权限检查中间件
import { getMembership, getBalance, consume } from './db.js';

// 提取 accessCode 中间件（从请求头 X-Access-Code 读取并注入到 req.accessCode）
export function extractAccessCode(req, res, next) {
  req.accessCode = req.headers['x-access-code'] || null;
  next();
}

// 检查会员状态
export function checkMembership(req, res, next) {
  const membership = getMembership(req.accessCode);

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
export async function checkAndConsumeBalance(amount, description, accessCode) {
  const balance = getBalance(accessCode);

  if (balance < amount) {
    return {
      allowed: false,
      error: '余额不足，请先充值',
      balance
    };
  }

  const result = consume(amount, description, accessCode);
  return {
    allowed: result.success,
    balance: result.balance,
    error: result.success ? null : result.message
  };
}

// 统一权限检查：会员 或 余额（删除演示模式逻辑）
export function checkAccess(req, res, next) {
  const membership = getMembership(req.accessCode);
  const balance = getBalance(req.accessCode);

  // 会员有效 或 余额充足 → 正常使用
  if (membership.active || balance > 0) {
    req.hasAccess = true;
    req.membership = membership;
    req.balance = balance;
    next();
  }
  // 无会员且无余额 → 拒绝访问
  else {
    res.status(403).json({
      error: '请开通会员或充值余额后使用',
      code: 'ACCESS_DENIED',
      message: '日会员仅需14.9元即可体验全部功能，或充值余额按次使用'
    });
  }
}

