// 墨韵工坊 · 钱包路由
import { Router } from 'express';
import { getBalance, recharge, consume, getTransactions } from '../lib/db.js';

const router = Router();

// 获取钱包信息
router.get('/wallet', (req, res) => {
  try {
    const balance = getBalance();
    const transactions = getTransactions();
    res.json({ balance, transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 模拟充值
router.post('/wallet/recharge', (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '充值金额必须大于0' });
    }

    const newBalance = recharge(parseFloat(amount), '模拟充值（内部测试）');
    res.json({ success: true, balance: newBalance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 消费（内部调用）
router.post('/wallet/consume', (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '消费金额必须大于0' });
    }

    const result = consume(parseFloat(amount), description || '大模型调用');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
