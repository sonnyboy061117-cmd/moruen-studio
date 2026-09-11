// 墨韵工坊 · 会员路由
import { Router } from 'express';
import { getMembership, activateMembership, getMembershipHistory } from '../lib/db.js';

const router = Router();

// 会员档位配置
const MEMBERSHIP_TIERS = {
  day: { label: '日会员', price: 14.9, days: 1 },
  month: { label: '月会员', price: 199, days: 30 },
  lifetime: { label: '永久买断', price: 599, days: null }
};

// 获取会员状态
router.get('/membership', (req, res) => {
  try {
    // 优先使用请求头，兼容 URL 参数
    const accessCode = req.accessCode || req.query.code;
    const status = getMembership(accessCode);
    res.json({ ...status, tiers: MEMBERSHIP_TIERS });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 开通会员
router.post('/membership/activate', (req, res) => {
  try {
    const { tier } = req.body;
    if (!MEMBERSHIP_TIERS[tier]) {
      return res.status(400).json({ error: '无效的会员档位' });
    }

    const config = MEMBERSHIP_TIERS[tier];
    const result = activateMembership({
      tier,
      price: config.price,
      activationType: 'normal'
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 手动开通（客服用）
router.post('/membership/manual-activate', (req, res) => {
  try {
    const { days = 1, contact } = req.body;

    // 验证 contact 必填
    if (!contact || contact.trim() === '') {
      return res.status(400).json({ error: '联系方式为必填项' });
    }

    const result = activateMembership({
      tier: 'day',
      price: 9.9,
      activationType: 'manual_service',
      days: parseInt(days),
      contact: contact.trim()
    });

    // 拼接专属链接
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host') || 'localhost:8787';
    const accessUrl = `${protocol}://${host}/#/home?code=${result.accessCode}`;

    res.json({
      success: true,
      id: result.id,
      startDate: result.startDate,
      expireDate: result.expireDate,
      accessCode: result.accessCode,
      accessUrl
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取开通记录
router.get('/membership/history', (req, res) => {
  try {
    const history = getMembershipHistory();
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
