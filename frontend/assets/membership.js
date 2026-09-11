// 墨韵工坊 · 会员与钱包前端逻辑

// ==================== 会员功能 ====================

// 加载会员状态
async function loadMembershipStatus() {
  try {
    const accessCode = localStorage.getItem('moruen_access_code');
    const url = accessCode ? `/api/membership?code=${accessCode}` : '/api/membership';
    const res = await fetch(url);
    const data = await res.json();

    // 渲染会员状态
    const statusEl = document.getElementById('membership-status');
    if (!statusEl) return;

    if (!data.active) {
      statusEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">🎫</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">暂未开通会员</div>
          <div style="color:var(--muted);font-size:13px;">请先购买会员，畅享全部功能</div>
        </div>
      `;
    } else {
      const tierLabels = {
        day: '日会员',
        month: '月会员',
        bimonth: '双月会员（已下架）',
        lifetime: '永久买断'
      };
      const tierLabel = tierLabels[data.tier] || data.tier;
      const expireText = data.isLifetime
        ? '永久有效'
        : `到期时间：${new Date(data.expireDate).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      const typeTag = data.activationType === 'manual_service' ? '<span style="background:var(--amber-soft);color:var(--amber);padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">体验价开通</span>' : '';

      statusEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:48px;margin-bottom:12px;">👑</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">
            当前是 ${tierLabel} ${typeTag}
          </div>
          <div style="color:var(--muted);font-size:13px;">${expireText}</div>
        </div>
      `;
    }

    // 渲染会员档位
    const tiersEl = document.getElementById('membership-tiers');
    const tiers = [
      { key: 'day', label: '日会员', price: 14.9, desc: '有效期 1 天', highlight: false, newUserTip: true },
      { key: 'month', label: '月会员', price: 199, desc: '有效期 30 天', highlight: true },
      { key: 'lifetime', label: '永久买断', price: 599, desc: '永久有效', highlight: false }
    ];

    tiersEl.innerHTML = tiers.map(tier => `
      <div class="card" style="position:relative;${tier.highlight ? 'border: 2px solid var(--primary);' : ''}">
        ${tier.highlight ? '<div style="position:absolute;top:-10px;right:16px;background:var(--primary);color:white;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;">推荐</div>' : ''}
        <div class="card-body" style="padding:24px;display:flex;flex-direction:column;height:100%;">
          <div style="flex:1;display:flex;flex-direction:column;">
            <div style="font-size:18px;font-weight:600;margin-bottom:8px;">${tier.label}</div>
            <div style="font-size:32px;font-weight:700;color:var(--primary);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
              ¥${tier.price}
            </div>
            <div style="color:var(--muted);font-size:13px;margin-bottom:16px;">${tier.desc}</div>
            <div style="min-height:52px;">
              ${tier.newUserTip ? '<div style="font-size:12px;color:var(--amber);border-top:1px solid var(--border);padding-top:12px;">新用户体验价 9.9元，<button class="btn-link" onclick="showCustomerService()" style="color:var(--amber);text-decoration:underline;background:none;border:none;padding:0;cursor:pointer;font-size:12px;">联系客服获取</button></div>' : ''}
            </div>
          </div>
          <button class="btn ${tier.highlight ? 'btn-primary' : ''}" onclick="activateMembership('${tier.key}')" style="width:100%;margin-top:16px;">
            立即开通
          </button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('加载会员状态失败:', e);
    showToast('加载失败: ' + e.message, 'error');
  }
}

// 开通会员
async function activateMembership(tier) {
  try {
    const res = await fetch('/api/membership/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier })
    });

    const data = await res.json();
    if (data.success) {
      showToast('会员开通成功！', 'success');
      loadMembershipStatus();
    } else {
      showToast(data.error || '开通失败', 'error');
    }
  } catch (e) {
    showToast('开通失败: ' + e.message, 'error');
  }
}

// ==================== 钱包功能 ====================

// 加载钱包信息
async function loadWalletInfo() {
  try {
    const accessCode = localStorage.getItem('moruen_access_code');
    const url = accessCode ? `/api/wallet?code=${accessCode}` : '/api/wallet';
    const res = await fetch(url);
    const data = await res.json();

    // 显示余额（始终保留两位小数）
    document.getElementById('wallet-balance').textContent = `¥${data.balance.toFixed(2)}`;

    // 显示交易记录
    const txEl = document.getElementById('wallet-transactions');
    if (data.transactions.length === 0) {
      txEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);">暂无记录</div>';
    } else {
      txEl.innerHTML = `
        <div style="max-height:400px;overflow-y:auto;">
          ${data.transactions.map(tx => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-soft);">
              <div>
                <div style="font-size:13px;font-weight:500;margin-bottom:4px;">${tx.description}</div>
                <div style="font-size:12px;color:var(--muted);">${new Date(tx.created_at).toLocaleString('zh-CN')}</div>
              </div>
              <div style="font-size:16px;font-weight:600;font-family:'JetBrains Mono',monospace;color:${tx.amount > 0 ? 'var(--emerald)' : 'var(--text)'};">
                ${tx.amount > 0 ? '+' : ''}¥${Math.abs(tx.amount).toFixed(2)}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (e) {
    console.error('加载钱包信息失败:', e);
    showToast('加载失败: ' + e.message, 'error');
  }
}

// 显示充值对话框
function showRechargeDialog() {
  const amount = prompt('请输入充值金额（元）：', '100');
  if (!amount) return;

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    showToast('请输入有效的金额', 'error');
    return;
  }

  rechargeWallet(num);
}

// 充值
async function rechargeWallet(amount) {
  try {
    const accessCode = localStorage.getItem('moruen_access_code');
    if (!accessCode) {
      showToast('未找到访问凭证', 'error');
      return;
    }

    const res = await fetch('/api/wallet/recharge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, code: accessCode })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`充值成功！当前余额：¥${data.balance.toFixed(2)}`, 'success');
      loadWalletInfo();
    } else {
      showToast(data.error || '充值失败', 'error');
    }
  } catch (e) {
    showToast('充值失败: ' + e.message, 'error');
  }
}

// 消费（内部调用）
async function consumeBalance(amount, description) {
  try {
    const accessCode = localStorage.getItem('moruen_access_code');
    if (!accessCode) {
      return { success: false, message: '未找到访问凭证' };
    }

    const res = await fetch('/api/wallet/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description, code: accessCode })
    });

    const data = await res.json();
    return data;
  } catch (e) {
    console.error('消费失败:', e);
    return { success: false, message: e.message };
  }
}

// ==================== 大模型账号 ====================

// 保存模型账号
async function saveModelAccount() {
  const input = document.getElementById('model-account-input');
  const key = input.value.trim();

  if (!key) {
    showToast('请输入账号', 'error');
    return;
  }

  try {
    // 底层对应到 DeepSeek
    const res = await fetch('/api/keys/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const data = await res.json();
    if (data.success) {
      showToast('账号保存成功', 'success');
    } else {
      showToast(data.error || '保存失败', 'error');
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

// 测试模型账号
async function testModelAccount() {
  try {
    const res = await fetch('/api/keys/deepseek/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (data.ok) {
      showToast('连接测试成功！' + data.msg, 'success');
    } else {
      showToast('连接测试失败：' + data.msg, 'error');
    }
  } catch (e) {
    showToast('测试失败: ' + e.message, 'error');
  }
}

// 加载模型账号状态
async function loadModelAccountStatus() {
  try {
    const res = await fetch('/api/keys');
    const data = await res.json();

    // 检查 DeepSeek 是否已配置
    const deepseekKey = data.keys.find(k => k.provider === 'deepseek');
    if (deepseekKey && deepseekKey.configured) {
      document.getElementById('model-account-input').placeholder = '已配置账号（' + deepseekKey.masked + '）';
    }
  } catch (e) {
    console.error('加载模型账号状态失败:', e);
  }
}

// ==================== 客服开通功能 ====================

// 手动开通会员
async function adminActivateMembership() {
  const contact = document.getElementById('admin-activate-contact').value.trim();
  if (!contact) {
    showToast('请填写联系方式', 'warn');
    return;
  }

  const type = document.querySelector('input[name="admin-activate-type"]:checked').value;
  let days = 1;

  if (type === 'custom') {
    days = parseInt(document.getElementById('admin-activate-days').value);
    if (!days || days < 1) {
      showToast('请输入有效的天数', 'error');
      return;
    }
  }

  try {
    const res = await fetch('/api/membership/manual-activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, contact })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`开通成功！有效期 ${days} 天`, 'success');

      // 显示专属链接
      const resultEl = document.getElementById('admin-activate-result');
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="margin-top:16px;padding:16px;background:var(--emerald-soft);border:1px solid var(--emerald);border-radius:8px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--emerald);">✓ 开通成功</div>
            <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;">专属访问链接（有效期 ${days} 天）：</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" readonly value="${data.accessUrl}" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:12px;background:white;">
              <button class="btn btn-primary" onclick="copyAccessUrl('${data.accessUrl}')" style="white-space:nowrap;">复制链接</button>
            </div>
          </div>
        `;
      }

      // 清空输入框
      document.getElementById('admin-activate-contact').value = '';
      document.querySelector('input[name="admin-activate-type"][value="experience"]').checked = true;
      toggleAdminActivateDays();
      loadAdminActivateHistory();
    } else {
      showToast(data.error || '开通失败', 'error');
    }
  } catch (e) {
    showToast('开通失败: ' + e.message, 'error');
  }
}

// 切换天数输入框显示/隐藏
function toggleAdminActivateDays() {
  const type = document.querySelector('input[name="admin-activate-type"]:checked').value;
  const wrapper = document.getElementById('admin-activate-days-wrapper');
  if (type === 'custom') {
    wrapper.style.display = 'block';
  } else {
    wrapper.style.display = 'none';
  }
}
window.toggleAdminActivateDays = toggleAdminActivateDays;

// 复制专属链接
function copyAccessUrl(url) {
  // 优先使用传统方法（兼容性更好）
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);

  // 选中文本
  textarea.select();
  textarea.setSelectionRange(0, url.length);

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (e) {
    console.error('复制失败:', e);
  }

  document.body.removeChild(textarea);

  if (success) {
    showToast('链接已复制到剪贴板', 'success');
  } else {
    // 尝试现代API作为备选
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('链接已复制到剪贴板', 'success');
      }).catch(err => {
        console.error('Clipboard API失败:', err);
        showToast('复制失败，请手动复制: ' + url, 'error', 5000);
      });
    } else {
      showToast('复制失败，请手动复制: ' + url, 'error', 5000);
    }
  }
}
window.copyAccessUrl = copyAccessUrl;

// 加载开通记录
async function loadAdminActivateHistory() {
  try {
    const res = await fetch('/api/membership/history');
    const data = await res.json();

    const historyEl = document.getElementById('admin-activate-history');
    if (data.history.length === 0) {
      historyEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);">暂无记录</div>';
    } else {
      const tierLabels = {
        day: '日会员',
        month: '月会员',
        bimonth: '双月会员（已下架）',
        lifetime: '永久买断'
      };

      historyEl.innerHTML = `
        <div style="max-height:400px;overflow-y:auto;">
          ${data.history.map(item => {
            const host = window.location.host;
            const protocol = window.location.protocol;
            const accessUrl = item.access_code ? `${protocol}//${host}/#/home?code=${item.access_code}` : null;

            return `
            <div style="padding:12px 0;border-bottom:1px solid var(--border-soft);">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px;">
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:500;">
                    ${tierLabels[item.tier] || item.tier}
                    ${item.activation_type === 'manual_service' ? '<span style="background:var(--amber-soft);color:var(--amber);padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">体验价</span>' : ''}
                  </div>
                  ${item.contact ? `<div style="font-size:12px;color:var(--text-2);margin-top:4px;">联系方式：${item.contact}</div>` : ''}
                  ${item.access_code ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;font-family:'JetBrains Mono',monospace;">访问码：${item.access_code}</div>` : ''}
                  <div style="font-size:12px;color:var(--muted);margin-top:4px;">${new Date(item.created_at).toLocaleString('zh-CN')}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                  <div style="font-size:14px;font-weight:600;color:var(--primary);">
                    ¥${item.price.toFixed(2)}
                  </div>
                  ${accessUrl ? `<button class="btn" onclick="copyAccessUrl('${accessUrl}')" style="font-size:11px;padding:4px 8px;white-space:nowrap;">复制链接</button>` : ''}
                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      `;
    }
  } catch (e) {
    console.error('加载开通记录失败:', e);
  }
}

// ==================== 通用弹窗 ====================

function showCustomerService() {
  alert('请添加客服微信：XXX（占位符）');
}

function showPurchaseDialog() {
  alert('购买入口开发中，请稍后...');
}

// ==================== 页面初始化 ====================

// 将所有函数暴露到全局作用域
window.loadMembershipStatus = loadMembershipStatus;
window.activateMembership = activateMembership;
window.loadWalletInfo = loadWalletInfo;
window.showRechargeDialog = showRechargeDialog;
window.saveModelAccount = saveModelAccount;
window.testModelAccount = testModelAccount;
window.loadModelAccountStatus = loadModelAccountStatus;
window.adminActivateMembership = adminActivateMembership;
window.loadAdminActivateHistory = loadAdminActivateHistory;
window.showCustomerService = showCustomerService;
window.showPurchaseDialog = showPurchaseDialog;

// Toast提示（复用现有的或创建简单版本）
function showToast(message, type = 'info') {
  const colors = {
    success: 'var(--emerald)',
    error: 'var(--pink)',
    info: 'var(--indigo)'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-left: 4px solid ${colors[type]};
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 添加动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
