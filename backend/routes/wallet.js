// 墨韵工坊 · 钱包路由
import { Router } from 'express';
import { getBalance, recharge, consume, getTransactions } from '../lib/db.js';

const router = Router();

// 获取钱包信息
router.get('/wallet', (req, res) => {
  try {
    const accessCode = req.query.code;
    const balance = getBalance(accessCode);
    const transactions = getTransactions(accessCode);
    res.json({ balance, transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 模拟充值
router.post('/wallet/recharge', (req, res) => {
  try {
    const { amount, code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'access_code不能为空' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '充值金额必须大于0' });
    }

    const newBalance = recharge(code, parseFloat(amount), '模拟充值（内部测试）');
    res.json({ success: true, balance: newBalance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 消费（内部调用）
router.post('/wallet/consume', (req, res) => {
  try {
    const { amount, description, code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'access_code不能为空' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '消费金额必须大于0' });
    }

    const result = consume(code, parseFloat(amount), description || '大模型调用');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
