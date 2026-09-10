// 墨韵工坊 · 前端主入口(v2: 纯前端 + 后端 API)
// 字段值/枚举/默认值从后端 /api/meta 加载,保证一致
import { api } from './api.js';
import { STATUS, statusBadge } from './state.js';
import { TaskPoller } from './poller.js';

let META = null;
let PROVIDER_DEFAULT = 'claude';
// 访问密码(从页面弹窗录入后存到这里,reveal 二次验证用)
let AUTH_USER = 'moruen';
let AUTH_PASS = '';
let COST_TABLE = {};

// 获取当前用户的 access_code
function getAccessCode() {
  return localStorage.getItem('moruen_access_code') || null;
}
window.getAccessCode = getAccessCode;

// ========== 导航 ==========
const crumbMap = {
  home: '首页概览', title: '一键标题', original: '批量原创',
  rewrite: '批量改写', universal: '万能改写',
  layout: '一键排版', keys: '模型秘钥', tutorial: '使用教程',
  membership: '会员中心', wallet: '我的钱包', 'model-account': '大模型账号',
  'admin-activate': '客服手动开通'
};

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');
  document.getElementById('crumbTitle').textContent = crumbMap[view] || '墨韵工坊';
  location.hash = '#/' + view;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 加载会员/钱包/模型账号数据
  if (view === 'membership' && window.loadMembershipStatus) {
    window.loadMembershipStatus();
  } else if (view === 'wallet' && window.loadWalletInfo) {
    window.loadWalletInfo();
  } else if (view === 'model-account' && window.loadModelAccountStatus) {
    window.loadModelAccountStatus();
  } else if (view === 'admin-activate' && window.loadAdminActivateHistory) {
    window.loadAdminActivateHistory();
  }
}
window.switchView = switchView;

// ========== Toast / Progress ==========
function showToast(msg, type = 'info', duration = 2800) {
  const t = document.createElement('div');
  t.textContent = msg;
  const colors = { info: '#222', error: '#dc2626', success: '#059669', warn: '#d97706' };

  // 计算当前已有的toast数量，调整位置
  const existingToasts = document.querySelectorAll('.toast-notification');
  let topOffset = 20;
  existingToasts.forEach(toast => {
    topOffset += toast.offsetHeight + 10; // 每个toast高度 + 10px间距
  });

  Object.assign(t.style, {
    position: 'fixed', top: topOffset + 'px', left: '50%', transform: 'translateX(-50%)',
    background: colors[type] || colors.info, color: '#fff',
    padding: '10px 18px', borderRadius: '8px', fontSize: '13px',
    zIndex: 9999, opacity: '0', transition: 'opacity .25s, transform .25s, top .25s',
    boxShadow: '0 6px 24px -6px rgba(0,0,0,.25)', maxWidth: '80vw',
    pointerEvents: 'auto'
  });
  t.className = 'toast-notification';
  document.body.appendChild(t);

  requestAnimationFrame(() => { t.style.opacity = '1'; });

  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => {
      t.remove();
      // 移除后，重新调整剩余toast的位置
      repositionToasts();
    }, 300);
  }, duration);
}

function repositionToasts() {
  const toasts = document.querySelectorAll('.toast-notification');
  let topOffset = 20;
  toasts.forEach(toast => {
    toast.style.top = topOffset + 'px';
    topOffset += toast.offsetHeight + 10;
  });
}
window.showToast = showToast;

function setProgress(id, pct) {
  const bar = document.getElementById(id);
  if (!bar) return;
  const fill = bar.querySelector('.progress-fill');
  if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
}
function showProgress(id) { document.getElementById(id)?.classList.add('show'); }
function hideProgress(id) { setTimeout(() => document.getElementById(id)?.classList.remove('show'), 600); }

async function copyText(text, btn) {
  // 1) 优先用 clipboard API (需 HTTPS / localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) { btn.textContent = '✓ 已复制'; setTimeout(() => { if (btn.isConnected) btn.textContent = '复制'; }, 1200); }
      showToast('已复制', 'success');
      return;
    } catch (e) {
      console.warn('[copy] clipboard API failed:', e.message);
    }
  }
  // 2) 兜底: execCommand('copy') + 隐藏 textarea
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '1px';
  ta.style.height = '1px';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  // 选中内容
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    console.warn('[copy] execCommand threw:', e.message);
  }
  document.body.removeChild(ta);
  if (ok) {
    if (btn) { btn.textContent = '✓ 已复制'; setTimeout(() => { if (btn.isConnected) btn.textContent = '复制'; }, 1200); }
    showToast('已复制', 'success');
  } else {
    // 3) 终极兜底: 弹模态让用户手动 Ctrl+C
    showManualCopyModal(text, btn);
  }
}

function showManualCopyModal(text, btn) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:20px 22px;max-width:90vw;width:560px;box-shadow:0 20px 60px rgba(0,0,0,.3);';
  box.innerHTML = `
    <div style="font-weight:600;font-size:15px;margin-bottom:10px;color:var(--primary)">浏览器拦截了自动复制</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:12px">请按 <kbd style="background:#f3f4f6;padding:1px 6px;border-radius:3px;border:1px solid #d1d5db">Ctrl+C</kbd> (Mac: <kbd style="background:#f3f4f6;padding:1px 6px;border-radius:3px;border:1px solid #d1d5db">⌘+C</kbd>) 复制下面文本</div>
    <textarea readonly style="width:100%;height:240px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;line-height:1.6;resize:vertical">${text.replace(/</g, '&lt;')}</textarea>
    <div style="text-align:right;margin-top:10px"><button id="mc-close" class="btn btn-primary btn-sm">关闭</button></div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const ta = box.querySelector('textarea');
  ta.focus();
  ta.select();
  box.querySelector('#mc-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  if (btn) { btn.textContent = '✓ 已复制'; setTimeout(() => { if (btn.isConnected) btn.textContent = '复制'; }, 1200); }
}
window.copyText = copyText;

function escape(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ========== 草稿自动保存(刷新不丢内容) ==========
// 每个工具页声明要保存的字段,debounce 600ms 存 localStorage,init 时自动恢复
// 4 个页面的字段配置:[{ id: 't-refs', kind: 'text' | 'select' | 'opt' | 'check', optGroup?: 't-style' }, ...]
const DRAFT_FIELDS = {
  title: [
    { id: 't-refs', kind: 'text' },
    { id: 't-count', kind: 'select' },
    { id: 't-domain', kind: 'select' },
    { kind: 'opt', group: 't-style' },
    { kind: 'opt', group: 't-format' }
  ],
  original: [
    { id: 'o-topics', kind: 'text' },
    { id: 'o-per', kind: 'text' },
    { id: 'o-length', kind: 'select' }
  ],
  rewrite: [
    { id: 'r-urls', kind: 'text' },
    { id: 'r-text', kind: 'text' },
    { id: 'r-count', kind: 'select' },
    { id: 'r-strength', kind: 'select' },
    { id: 'r-length', kind: 'select' },
    { kind: 'check', className: 'r-logic' }
  ],
  universal: [
    { id: 'u-text', kind: 'text' },
    { id: 'u-strength', kind: 'select' },
    { id: 'u-audience', kind: 'select' },
    { id: 'u-keywords', kind: 'check' },
    { id: 'u-tone', kind: 'check' },
    { id: 'u-length', kind: 'check' }
  ],
  layout: [
    { id: 'l-text', kind: 'text' },
    { id: 'l-style', kind: 'select' },
    { id: 'l-size', kind: 'select' },
    { id: 'l-line', kind: 'select' }
  ]
};

function draftKey(page) { return 'moruen.draft.' + page; }

function readFormState(page) {
  const fields = DRAFT_FIELDS[page] || [];
  const state = {};
  for (const f of fields) {
    if (f.kind === 'text' || f.kind === 'select') {
      const el = document.getElementById(f.id);
      if (el) state[f.id] = el.value;
    } else if (f.kind === 'opt' && f.group) {
      const active = document.querySelector(`[data-group="${f.group}"] .opt-btn.active`);
      if (active) state['__opt__' + f.group] = active.dataset.val;
    } else if (f.kind === 'check' && f.className) {
      const cbs = Array.from(document.querySelectorAll('.' + f.className + ':checked'));
      state['__check__' + f.className] = cbs.map(c => c.value);
    }
  }
  return state;
}

function writeFormState(page, state) {
  if (!state) return;
  const fields = DRAFT_FIELDS[page] || [];
  for (const f of fields) {
    if (f.kind === 'text' || f.kind === 'select') {
      if (state[f.id] != null) {
        const el = document.getElementById(f.id);
        if (el) el.value = state[f.id];
      }
    } else if (f.kind === 'opt' && f.group) {
      const v = state['__opt__' + f.group];
      if (v != null) {
        document.querySelectorAll(`[data-group="${f.group}"] .opt-btn`).forEach(b => {
          b.classList.toggle('active', b.dataset.val === v);
        });
      }
    } else if (f.kind === 'check' && f.className) {
      const arr = state['__check__' + f.className];
      if (Array.isArray(arr)) {
        document.querySelectorAll('.' + f.className).forEach(cb => {
          cb.checked = arr.includes(cb.value);
        });
      }
    }
  }
}

function saveDraft(page) {
  try {
    const state = readFormState(page);
    // 如果整页都是空,不存(避免噪声)
    const hasContent = Object.values(state).some(v => {
      if (Array.isArray(v)) return v.length > 0;
      return v != null && String(v).trim() !== '';
    });
    if (!hasContent) {
      localStorage.removeItem(draftKey(page));
      updateClearDraftButtonState(page, false);
      return;
    }
    localStorage.setItem(draftKey(page), JSON.stringify({ ts: Date.now(), state }));
    // 保存成功后，更新按钮状态为可用
    updateClearDraftButtonState(page, true);
  } catch (e) { /* localStorage 满 / 隐私模式 */ }
}

function loadDraft(page) {
  try {
    const raw = localStorage.getItem(draftKey(page));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // 超过 7 天的草稿视为过期
    if (Date.now() - (data.ts || 0) > 7 * 24 * 3600 * 1000) {
      localStorage.removeItem(draftKey(page));
      return null;
    }
    return data.state;
  } catch (e) { return null; }
}

function clearDraft(page) {
  try { localStorage.removeItem(draftKey(page)); } catch (e) {}
  updateClearDraftButtonState(page, false);
}

// 确保"清空草稿"按钮存在（始终可见，但根据内容状态启用/禁用）
function ensureClearDraftButton(page) {
  const view = document.getElementById('view-' + page);
  if (!view) return;
  const inputPanel = view.querySelector('.panel');
  if (!inputPanel) return;

  let btnContainer = inputPanel.querySelector('.clear-draft-btn-container');

  // 如果按钮容器不存在，创建它
  if (!btnContainer) {
    // 对于批量改写页面，需要找到可见的textarea（不在display:none的父元素中）
    let firstTextarea = null;
    const textareas = inputPanel.querySelectorAll('textarea');
    for (const ta of textareas) {
      // 检查textarea及其父元素是否可见
      let parent = ta.parentElement;
      let isVisible = true;
      while (parent && parent !== inputPanel) {
        if (parent.style.display === 'none') {
          isVisible = false;
          break;
        }
        parent = parent.parentElement;
      }
      if (isVisible) {
        firstTextarea = ta;
        break;
      }
    }

    if (!firstTextarea) return;

    btnContainer = document.createElement('div');
    btnContainer.className = 'clear-draft-btn-container';
    btnContainer.style.cssText = 'margin-top:8px;text-align:right;';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-ghost btn-sm clear-draft-btn';
    clearBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
      清空草稿
    `;
    clearBtn.style.cssText = 'font-size:12px;color:var(--muted);border-color:var(--border);padding:4px 10px;transition:all 0.2s;';

    clearBtn.addEventListener('click', async () => {
      // 检查是否有内容可清空
      const hasContent = loadDraft(page) !== null;
      if (!hasContent) {
        showToast('当前没有草稿内容', 'info', 2000);
        return;
      }

      // 二次确认弹窗
      const confirmed = await confirmModal({
        title: '清空草稿',
        message: '确定要清空当前草稿吗？此操作不可恢复。',
        okText: '确认清空',
        okType: 'danger'
      });

      if (!confirmed) return;

      clearDraft(page);
      // 清空当前表单
      const fields = DRAFT_FIELDS[page] || [];
      for (const f of fields) {
        if (f.kind === 'text' || f.kind === 'select') {
          const el = document.getElementById(f.id);
          if (el) el.value = '';
        } else if (f.kind === 'opt' && f.group) {
          // 不重置为第一个,避免破坏默认值
        } else if (f.kind === 'check' && f.className) {
          document.querySelectorAll('.' + f.className).forEach(cb => { cb.checked = false; });
        }
      }
      showToast('已清空草稿', 'info', 2000);
    });

    btnContainer.appendChild(clearBtn);
    firstTextarea.parentElement.appendChild(btnContainer);
  }

  // 按钮始终显示
  btnContainer.style.display = '';
}

// 更新"清空草稿"按钮的启用/禁用状态
function updateClearDraftButtonState(page, hasContent) {
  const view = document.getElementById('view-' + page);
  if (!view) return;

  // 先确保按钮存在
  ensureClearDraftButton(page);

  const clearBtn = view.querySelector('.clear-draft-btn');
  if (!clearBtn) return;

  if (hasContent) {
    // 有内容：按钮可用，鼠标悬停时高亮
    clearBtn.disabled = false;
    clearBtn.style.opacity = '1';
    clearBtn.style.cursor = 'pointer';

    // 重新绑定悬停效果
    clearBtn.onmouseenter = () => {
      if (!clearBtn.disabled) {
        clearBtn.style.color = '#dc2626';
        clearBtn.style.borderColor = '#dc2626';
        clearBtn.style.background = 'rgba(220, 38, 38, 0.05)';
      }
    };
    clearBtn.onmouseleave = () => {
      if (!clearBtn.disabled) {
        clearBtn.style.color = 'var(--muted)';
        clearBtn.style.borderColor = 'var(--border)';
        clearBtn.style.background = '';
      }
    };
  } else {
    // 无内容：按钮禁用，灰色显示
    clearBtn.disabled = true;
    clearBtn.style.opacity = '0.4';
    clearBtn.style.cursor = 'not-allowed';
    clearBtn.style.color = 'var(--muted)';
    clearBtn.style.borderColor = 'var(--border)';
    clearBtn.style.background = '';

    // 移除悬停效果
    clearBtn.onmouseenter = null;
    clearBtn.onmouseleave = null;
  }
}

// 隐藏"清空草稿"按钮（已废弃，保留用于兼容）
function hideClearDraftButton(page) {
  // 不再隐藏按钮，只更新状态为禁用
  updateClearDraftButtonState(page, false);
}

// ========== 后台任务进度恢复(刷新不丢) ==========
function saveActiveTask(type, taskId) {
  try {
    const map = JSON.parse(localStorage.getItem('moruen.activeTasks') || '{}');
    map[type] = { taskId, ts: Date.now() };
    localStorage.setItem('moruen.activeTasks', JSON.stringify(map));
  } catch (e) {}
}
function clearActiveTask(type) {
  try {
    const map = JSON.parse(localStorage.getItem('moruen.activeTasks') || '{}');
    delete map[type];
    localStorage.setItem('moruen.activeTasks', JSON.stringify(map));
    // 同步隐藏顶部条
    const banner = document.getElementById('active-task-banner');
    if (banner && Object.keys(map).length === 0) banner.remove();
  } catch (e) {}
}
function getActiveTasks() {
  try {
    return JSON.parse(localStorage.getItem('moruen.activeTasks') || '{}');
  } catch (e) { return {}; }
}

// 顶部状态条: 显示当前后台任务 (已禁用)
function showActiveTaskBanner(type, total, onClick) {
  // 功能已禁用，不再显示橙色提示条
  return;
}

async function restoreActiveTasks() {
  const map = getActiveTasks();
  const types = Object.keys(map);
  for (const type of types) {
    const { taskId, ts } = map[type];
    if (!taskId) continue;
    // 7 天前的忽略
    if (Date.now() - (ts || 0) > 7 * 24 * 3600 * 1000) {
      clearActiveTask(type);
      continue;
    }
    try {
      const t = await api.task(taskId);
      if (!t) { clearActiveTask(type); continue; }
      const total = t.total || t.items.length;
      // 已完成或已取消的任务不再恢复
      if (t.status === 'done' || t.status === 'cancelled') {
        clearActiveTask(type);
        continue;
      }
      // 续上 poller
      if (type === 'original') {
        currentOriginalTask = t;
        // ★ 立即同步渲染一次(不依赖 poller 第一次 tick)
        renderTaskItems(t, 'o', total, { showSource: false });
        if (originalPoller) originalPoller.stop();
        originalPoller = new TaskPoller(taskId, tt => {
          renderTaskItems(tt, 'o', total, { showSource: false });
          if (tt.status === 'done' || tt.status === 'cancelled') clearActiveTask('original');
        });
        originalPoller.start(1500);
        showActiveTaskBanner('original', total, t => {
          if (originalPoller) originalPoller.stop();
          originalPoller = new TaskPoller(t.id, tt => {
            renderTaskItems(tt, 'o', total, { showSource: false });
            if (tt.status === 'done' || tt.status === 'cancelled') clearActiveTask('original');
          });
          originalPoller.start(1500);
          switchView('original');
        });
      } else if (type === 'rewrite') {
        currentRewriteTask = t;
        // ★ 立即同步渲染一次
        renderTaskItems(t, 'r', total, { showSource: false });
        if (rewritePoller) rewritePoller.stop();
        rewritePoller = new TaskPoller(taskId, tt => {
          renderTaskItems(tt, 'r', total, { showSource: false });
          if (tt.status === 'done' || tt.status === 'cancelled') clearActiveTask('rewrite');
        });
        rewritePoller.start(1500);
        showActiveTaskBanner('rewrite', total, t => {
          if (rewritePoller) rewritePoller.stop();
          rewritePoller = new TaskPoller(t.id, tt => {
            renderTaskItems(tt, 'r', total, { showSource: false });
            if (tt.status === 'done' || tt.status === 'cancelled') clearActiveTask('rewrite');
          });
          rewritePoller.start(1500);
          switchView('rewrite');
        });
      }
    } catch (e) {
      // 后端重启过,任务丢失
      clearActiveTask(type);
    }
  }
}

function initDrafts() {
  // 每个工具页: 启动时恢复 + 用户输入时保存(节流 600ms)
  Object.keys(DRAFT_FIELDS).forEach(page => {
    const view = document.getElementById('view-' + page);
    if (!view) return;

    // 0) 首先确保"清空草稿"按钮存在（所有页面都需要）
    setTimeout(() => {
      const state = loadDraft(page);
      const hasContent = state !== null;
      ensureClearDraftButton(page);
      updateClearDraftButtonState(page, hasContent);
    }, 0);

    // 1) 恢复草稿(在用户看到表单后)
    const state = loadDraft(page);
    if (state) {
      // 延迟 0 ms,等 DOMContentLoaded 完成,确保所有控件已渲染
      setTimeout(() => {
        writeFormState(page, state);
        // 顶部提示 + Toast
        showDraftHint(page);
        // 一键标题页: 还要触发 t-refs 计数刷新
        if (page === 'title') {
          const tRefs = document.getElementById('t-refs');
          if (tRefs) tRefs.dispatchEvent(new Event('input'));
        }
        // 批量改写页: 切回默认 text pane + 触发实时提示
        if (page === 'rewrite') {
          // 不强制切,让用户自己选;但刷新计数
          const tText = document.getElementById('r-text');
          if (tText) tText.dispatchEvent(new Event('input'));
          const tUrls = document.getElementById('r-urls');
          if (tUrls) tUrls.dispatchEvent(new Event('input'));
        }
        // 批量原创页: 草稿恢复后,重算 o-cost 和主题计数
        if (page === 'original') {
          const oTopics = document.getElementById('o-topics');
          if (oTopics) oTopics.dispatchEvent(new Event('input'));
          if (typeof updateOCost === 'function') updateOCost();
        }
      }, 0);
    }

    // 2) 监听输入变化,debounce 保存
    let timer = null;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => saveDraft(page), 600);
    };
    // 监听该 view 内所有 input/textarea/select 变化
    view.addEventListener('input', trigger, true);
    view.addEventListener('change', trigger, true);
    view.addEventListener('click', (e) => {
      // opt-btn 切换也触发
      if (e.target.classList && e.target.classList.contains('opt-btn')) trigger();
    }, true);
  });
}

// 在工具页顶部显示"已恢复草稿"提示 + 恢复/清空操作
function showDraftHint(page) {
  const view = document.getElementById('view-' + page);
  if (!view) return;
  const toolHead = view.querySelector('.tool-head');
  if (!toolHead) return;

  // 只对当前激活的页面显示Toast通知，避免多页面同时弹出多条
  if (view.classList.contains('active')) {
    showToast('📋 已自动恢复上次未提交的输入(草稿,7天内有效)', 'info', 2500);
  }

  // 确保"清空草稿"按钮显示
  ensureClearDraftButton(page);
}

// 把后端 / 上游 LLM 的英文错误码翻译成人话
function friendlyError(raw) {
  if (!raw) return '未知错误';
  const s = String(raw);
  // 1) HTTP 状态码(从后端的 "LLM 401: ..." / "Claude 401: ..." 提取)
  const httpMatch = s.match(/\b(4\d\d|5\d\d)\b/);
  const http = httpMatch ? parseInt(httpMatch[1]) : null;
  // 2) 关键词检测
  const lower = s.toLowerCase();
  if (lower.includes('invalid_api_key') || lower.includes('incorrect api key') || lower.includes('authentication') || http === 401) {
    return '密钥无效或已过期,请检查后重新输入';
  }
  if (lower.includes('insufficient_quota') || lower.includes('quota') || lower.includes('balance') || lower.includes('billing')) {
    return '账户余额不足,请充值后再试';
  }
  if (lower.includes('rate_limit') || lower.includes('too many requests') || http === 429) {
    return '请求过于频繁,稍后再试';
  }
  if (lower.includes('model_not_found') || lower.includes('invalid model')) {
    return '模型名不可用,请在「模型秘钥」页切到该供应商支持的模型';
  }
  if (lower.includes('permission') || lower.includes('forbidden') || http === 403) {
    return '无访问权限(可能 Key 没开对应模型权限,或账号未实名)';
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('etimedout')) {
    return '网络连接失败,检查服务器是否能访问供应商 API';
  }
  if (lower.includes('context_length_exceeded') || lower.includes('too long') || lower.includes('maximum context')) {
    return '输入文本太长,超过模型上下文长度限制';
  }
  if (lower.includes('invalid_request') || http === 400) {
    return '请求格式错误(可能是供应商接口变更或 Key 类型不匹配)';
  }
  if (http === 404) return '接口地址 404,供应商路径可能变了';
  if (http === 500 || http === 502 || http === 503) return '供应商服务器暂时不可用,稍后再试';
  // 兜底: 截短原错误,去掉 { } 和 key 残留
  const clean = s
    .replace(/sk-[A-Za-z0-9_\-]{2,}/g, 'sk-****')
    .replace(/\*\*{2,}/g, '****')
    .replace(/\{[^}]{0,200}\}/g, '{...}')
    .replace(/^\s*(LLM|Claude|OpenAI|DeepSeek|文心)[^:]*:\s*/i, '')
    .slice(0, 160);
  return `调用失败: ${clean}`;
}

// ========== 加载 meta + 秘钥状态 ==========
async function loadMeta() {
  META = await api.meta();
  PROVIDER_DEFAULT = META.providers.default;
  // 渲染秘钥卡片
  await renderKeys();
}

// Key格式验证
function validateKey(provider, key) {
  if (!key || !key.trim()) {
    return '请输入 API Key';
  }

  // 智谱GLM的Key格式: xxx.xxx (包含点分隔)
  if (provider === 'zhipu') {
    if (!/^[a-f0-9]+\.[a-zA-Z0-9]+$/.test(key)) {
      return '智谱GLM的 Key 格式应为: xxx.xxx（小写字母数字.字母数字）';
    }
  }

  // DeepSeek和通义千问通常以sk-开头
  if ((provider === 'deepseek' || provider === 'qwen') && !key.startsWith('sk-')) {
    return `${provider === 'deepseek' ? 'DeepSeek' : '通义千问'}的 Key 通常以 sk- 开头，请检查格式`;
  }

  // 基本长度检查
  if (key.length < 20) {
    return 'API Key 长度太短，请检查是否完整';
  }

  return null; // 验证通过
}

// 错误分类，提供更友好的提示
function classifyError(errorMsg) {
  if (!errorMsg) return 'unknown';
  const msg = errorMsg.toLowerCase();

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid') || msg.includes('authentication')) {
    return 'invalid_key';
  }
  if (msg.includes('402') || msg.includes('insufficient') || msg.includes('quota') || msg.includes('balance')) {
    return 'insufficient_balance';
  }
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('network')) {
    return 'network';
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 'rate_limit';
  }

  return 'unknown';
}

async function renderKeys() {
  const r = await api.keys();
  const root = document.querySelector('#view-keys .tool-head').parentElement;
  // 移除旧卡
  root.querySelectorAll('.api-card').forEach(c => c.remove());

  // 找到插入位置(底部说明之前)
  let insertBefore = root.querySelector('div[style*="emerald-soft"]');
  // 新供应商顺序: DeepSeek、字节豆包、通义千问、智谱GLM、通义万相
  const order = ['deepseek', 'doubao', 'qwen', 'zhipu', 'tongyi-wanxiang'];

  // 供应商名称映射，用于生成更友好的placeholder
  const providerNames = {
    deepseek: 'DeepSeek',
    doubao: '豆包',
    qwen: '通义千问',
    zhipu: '智谱GLM',
    'tongyi-wanxiang': '通义万相'
  };

  order.forEach(p => {
    const info = r.providers[p];
    if (!info) return;
    const isCurrent = PROVIDER_DEFAULT === p;
    const div = document.createElement('div');
    div.className = 'api-card';
    div.dataset.provider = p;

    // demo 状态:配置过但 key 是 null 的,显示"演示·已配置"灰标
    const isDemoState = !info.configured && META.providers[p].default_configured;
    // 4 个供应商统一逻辑: 真填了 key 才显示"已配置",没填一律"未配置"
    // demo 状态用小灰标 + 副标题提示,不再用"已配置(演示)"这种歧义文案
    const displayStatus = info.configured ? '已配置' : '未配置';
    const displayStatusClass = info.configured ? 'status-on' : 'status-off';

    // 生成更友好的placeholder
    const friendlyName = providerNames[p] || p;
    const placeholderText = info.configured
      ? '输入新 Key 覆盖旧的'
      : `填入${friendlyName}的 API Key`;

    // 通义万相是图片模型，不显示"当前使用"标签
    const isImageProvider = META.providers[p]?.type === 'image';

    div.innerHTML = `
      <div class="api-head">
        <div class="logo" style="background: linear-gradient(135deg, ${logoColor(p, 0)}, ${logoColor(p, 1)});">${info.short}</div>
        <div class="info">
          <div class="name">${info.name} ${isCurrent && !isImageProvider ? '<span style="color:var(--emerald);font-size:11px;background:var(--emerald-soft);padding:1px 6px;border-radius:4px;margin-left:6px;">当前使用</span>' : ''} ${isImageProvider ? '<span style="color:#8b5cf6;font-size:11px;background:#f3e8ff;padding:1px 6px;border-radius:4px;margin-left:6px;">图片生成</span>' : ''} ${isDemoState && !info.configured ? '<span style="color:var(--muted);font-size:11px;background:var(--bg-soft);padding:1px 6px;border-radius:4px;margin-left:6px;">推荐配置</span>' : ''}</div>
          <div class="sub">${info.configured ? '已配置 · ' + info.models.slice(0, 2).join(' / ') : '未配置'}</div>
        </div>
        <span class="api-status ${displayStatusClass}">${displayStatus}</span>
      </div>
      <div class="key-input-row">
        <input type="password" placeholder="${placeholderText}" value="">
        <button class="btn btn-primary btn-sm" data-act="save">${info.configured ? '更新' : '保存'}</button>
        <button class="btn btn-ghost btn-sm" data-act="test" title="测试 API Key 连通性">测试</button>
        ${info.configured ? `
          <button class="btn btn-ghost btn-sm" data-act="reveal" title="显示明文 Key(会做二次身份确认)">显示</button>
          <button class="btn btn-ghost btn-sm" data-act="del">删除</button>
        ` : ''}
        ${!isCurrent && info.configured && !isImageProvider ? '<button class="btn btn-emerald btn-sm" data-act="use">设为默认</button>' : ''}
      </div>
      <div class="api-msg" style="margin-top:8px;font-size:12.5px;color:var(--muted);min-height:18px;"></div>
    `;
    if (insertBefore) root.insertBefore(div, insertBefore);
    else root.appendChild(div);

    const input = div.querySelector('input');
    const msgEl = div.querySelector('.api-msg');
    div.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        if (act === 'save') {
          const v = input.value.trim();
          if (!v) { msgEl.innerHTML = '<span style="color:var(--primary);">⚠ 请输入 Key</span>'; return; }

          // Key格式验证
          const validationError = validateKey(p, v);
          if (validationError) {
            msgEl.innerHTML = `<span style="color:var(--primary);">⚠ ${escape(validationError)}</span>`;
            return;
          }

          msgEl.innerHTML = '<span style="color:var(--muted);">保存中…</span>';
          const oldBtnText = btn.textContent;
          btn.disabled = true; btn.textContent = '保存中…';
          try {
            // 1) 保存
            await api.saveKey(p, v);
            // 2) 自动测试连通
            msgEl.innerHTML = '<span style="color:var(--muted);">测试连通中…</span>';
            const tr = await api.testKey(p);
            if (!tr.ok) throw new Error(tr.msg);
            // 3) 自动设为默认(原默认不是这个的话)
            if (PROVIDER_DEFAULT !== p) {
              PROVIDER_DEFAULT = p;
              localStorage.setItem('moruen.defaultProvider', p);
            }
            // 反馈
            input.value = '';
            input.style.outline = '2px solid var(--emerald)';
            input.style.background = 'rgba(5, 150, 105, 0.06)';
            msgEl.innerHTML = '<span style="color:var(--emerald);font-weight:600;">✓ 已保存 · 连通正常 · 设为默认</span>';
            showToast(`✓ ${info.name} 已保存并设为默认`, 'success', 3500);
            setTimeout(() => {
              input.style.outline = '';
              input.style.background = '';
            }, 1500);
            await renderKeys();
          } catch (e) {
            msgEl.innerHTML = `<span style="color:var(--primary);">✗ ${escape(friendlyError(e.message))}</span>`;
            showToast(friendlyError(e.message), 'error', 5000);
          } finally {
            btn.disabled = false; btn.textContent = oldBtnText;
          }
        } else if (act === 'test') {
          // 如果输入框有值，使用输入框的临时Key测试；否则测试已保存的Key
          const tempKey = input.value.trim();

          if (!tempKey && !info.configured) {
            msgEl.innerHTML = '<span style="color:var(--primary);">⚠ 请先输入 API Key</span>';
            return;
          }

          msgEl.innerHTML = '<span style="color:var(--muted);">测试连通中…</span>';
          const oldBtnText = btn.textContent;
          btn.disabled = true; btn.textContent = '测试中…';
          try {
            let r;
            if (tempKey) {
              // 使用临时Key测试（不保存）
              r = await api.testKeyTemp(p, tempKey);
            } else {
              // 测试已保存的Key
              r = await api.testKey(p);
            }

            if (r.ok) {
              msgEl.innerHTML = `<span style="color:var(--emerald);font-weight:600;">✓ 连通正常</span> <span style="color:var(--muted);font-size:11.5px;">${escape(r.msg || '测试成功')}</span>`;
              showToast(`${info.name} 连通正常`, 'success', 2500);
            } else {
              // 根据错误信息提供更详细的反馈
              const errorType = classifyError(r.msg);
              msgEl.innerHTML = `<span style="color:var(--primary);font-weight:600;">✗ ${escape(friendlyError(r.msg))}</span>`;
              showToast(friendlyError(r.msg), 'error', 5000);
            }
          } catch (e) {
            const errorType = classifyError(e.message);
            msgEl.innerHTML = `<span style="color:var(--primary);">✗ ${escape(friendlyError(e.message))}</span>`;
            showToast(friendlyError(e.message), 'error', 5000);
          } finally {
            btn.disabled = false; btn.textContent = oldBtnText;
          }
        } else if (act === 'del') {
          // 二次确认: 显眼的模态框,避免手滑
          const ok = await confirmModal({
            title: `删除 ${info.name} 的 Key?`,
            message: '删除后该模型无法调用,需要重新填入。\n本操作不可撤销。',
            okText: '确认删除',
            okType: 'danger'
          });
          if (!ok) return;
          await api.deleteKey(p);
          await renderKeys();
          showToast(`${info.name} Key 已删除`, 'info');
        } else if (act === 'reveal') {
          // 三步二次确认: 警示 + 重新输密码 + 验证后才显示
          if (!confirm('⚠️ 显示明文 API Key\n\n请确认:\n1) 你清楚这会暴露真实付费 Key\n2) 旁边没有其他人\n3) 用完及时关闭\n\n继续吗?')) return;
          // 让用户重新输入 Basic Auth 密码(双重身份验证)
          const reUser = prompt('请输入访问用户名:', AUTH_USER);
          if (!reUser) { showToast('已取消', 'info'); return; }
          const rePassword = prompt(`请重新输入访问密码(用户: ${reUser}):`, '');
          if (!rePassword) { showToast('已取消', 'info'); return; }
          try {
            const data = await api.revealKey(p, { auth: { user: reUser, pass: rePassword } });
            if (!data || !data.key) {
              showToast('解密失败: 主密钥已变更,Key 数据需要重新保存', 'error');
              return;
            }
            prompt(`明文 Key(可复制,关闭后请清空剪贴板):`, data.key);
          } catch (e) {
            showToast('认证失败或请求错误: ' + e.message, 'error');
          }
        } else if (act === 'use') {
          PROVIDER_DEFAULT = p;
          // 持久化到 localStorage(只记偏好,不是 key)
          localStorage.setItem('moruen.defaultProvider', p);
          await renderKeys();
          showToast('已设为默认模型: ' + info.name, 'success');
        }
      });
    });
  });
}

function logoColor(p, idx) {
  const colors = {
    claude: ['#f59e0b', '#ea580c'],
    openai: ['#6366f1', '#8b5cf6'],
    wenxin: ['#10b981', '#14b8a6'],
    deepseek: ['#ec4899', '#db2777'],
    doubao: ['#3b82f6', '#2563eb'],
    qwen: ['#f59e0b', '#ea580c'],
    zhipu: ['#8b5cf6', '#7c3aed'],
    'tongyi-wanxiang': ['#a855f7', '#9333ea']
  };
  return (colors[p] || ['#888', '#aaa'])[idx];
}

// 通用确认模态框(返回 Promise<boolean>)
function confirmModal({ title, message, okText = '确认', okType = 'primary', cancelText = '取消' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:22px 24px;max-width:90vw;width:440px;box-shadow:0 20px 60px rgba(0,0,0,.3);';
    const okColor = okType === 'danger' ? '#dc2626' : 'var(--primary)';
    box.innerHTML = `
      <div style="font-weight:600;font-size:16px;margin-bottom:8px;">${escape(title)}</div>
      <div style="font-size:13.5px;color:var(--muted);line-height:1.6;margin-bottom:18px;white-space:pre-line;">${escape(message)}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" id="cm-cancel">${escape(cancelText)}</button>
        <button class="btn btn-sm" id="cm-ok" style="background:${okColor};color:#fff;border:none;padding:6px 16px;border-radius:6px;font-weight:500;cursor:pointer;">${escape(okText)}</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const cleanup = (v) => { overlay.remove(); resolve(v); };
    box.querySelector('#cm-cancel').onclick = () => cleanup(false);
    box.querySelector('#cm-ok').onclick = () => cleanup(true);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    box.querySelector('#cm-cancel').focus();
  });
}
window.confirmModal = confirmModal;

// ========== 1. 一键标题 ==========
async function generateTitles() {
  const refs = document.getElementById('t-refs').value.trim();
  const refLines = refs.split('\n').filter(Boolean);
  if (refLines.length > 5) { showToast(`参考标题最多 5 条,当前 ${refLines.length} 条。请删除多余行后重试。`, 'error', 4500); return; }
  if (refLines.length === 0) { showToast('请至少输入 1 条参考标题', 'warn'); return; }
  const count = Math.min(20, Math.max(1, parseInt(document.getElementById('t-count').value) || 10));
  const domain = document.getElementById('t-domain').value;
  const style = document.querySelector('[data-group="t-style"] .opt-btn.active')?.dataset.val || '悬念';
  const format = document.querySelector('[data-group="t-format"] .opt-btn.active')?.dataset.val || '两段式';
  const resultEl = document.getElementById('t-results');
  const countEl = document.getElementById('t-result-count');
  resultEl.innerHTML = '';
  countEl.textContent = '生成中…';
  showProgress('t-progress');
  setProgress('t-progress', 15);
  try {
    const r = await api.title({ refs, count, domain, style, format, provider: PROVIDER_DEFAULT });
    setProgress('t-progress', 100);
    countEl.textContent = r.titles.length + ' 条';
    resultEl.innerHTML = r.titles.map((t, i) => renderTitleItem(i + 1, t, style, format, r.cost)).join('');
    bindTitleActions(r.titles);
    showToast('生成完成', 'success');
  } catch (e) {
    countEl.textContent = '失败';
    showToast(e.message, 'error');
  } finally { hideProgress('t-progress'); }
}
window.generateTitles = generateTitles;

function renderTitleItem(num, title, style, format, cost) {
  return `<div class="result-item" data-title="${encodeURIComponent(title)}">
    <div class="result-num" style="display:flex;align-items:center;gap:6px;">
      <input type="checkbox" class="t-pick" style="cursor:pointer;" title="勾选后可批量导入">
      <span>${num}</span>
    </div>
    <div class="result-content">
      <div class="result-title">${escape(title)}</div>
      <div class="result-meta"><span>📊 风格: ${style}</span><span>🎯 句式: ${format}</span><span>💰 消耗 ≈ ${cost} 元</span></div>
      <div class="result-actions">
        <button class="btn btn-ghost btn-sm" data-act="copy">复制</button>
        <button class="btn btn-ghost btn-sm" data-act="toOriginal">→ 导入原创</button>
      </div>
    </div>
  </div>`;
}

function bindTitleActions(titles) {
  const root = document.getElementById('t-results');
  // 显示批量操作工具栏
  const bulkBar = document.getElementById('t-bulk-bar');
  if (bulkBar) bulkBar.style.display = 'flex';
  // 全选
  const pickAll = document.getElementById('t-pick-all');
  if (pickAll) pickAll.checked = false;
  root.querySelectorAll('.result-item').forEach((el, i) => {
    const t = titles[i];
    el.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.act === 'copy') copyText(t, btn);
        if (btn.dataset.act === 'toOriginal') {
          importTitlesToOriginal([t]);
        }
      });
    });
    const cb = el.querySelector('.t-pick');
    if (cb) cb.addEventListener('change', updatePickedCount);
  });
  updatePickedCount();
}

function updatePickedCount() {
  const all = document.querySelectorAll('#t-results .t-pick');
  const picked = Array.from(all).filter(c => c.checked);
  const countEl = document.getElementById('t-picked-count');
  if (countEl) countEl.textContent = `已选 ${picked.length} / ${all.length} 条`;
  const pickAll = document.getElementById('t-pick-all');
  if (pickAll) pickAll.checked = (picked.length === all.length && all.length > 0);
}

// 批量导入标题到「批量原创」主题框(支持多选 / 全选)
function importTitlesToOriginal(titles) {
  if (!titles || !titles.length) {
    showToast('请先勾选要导入的标题', 'warn');
    return;
  }
  const cur = document.getElementById('o-topics').value.trim();
  const newTopics = titles.join('\n');
  document.getElementById('o-topics').value = cur ? cur + '\n' + newTopics : newTopics;
  showToast(`已导入 ${titles.length} 个标题到「批量原创」`, 'success', 2500);
  switchView('original');
}

window.importTitlesToOriginal = importTitlesToOriginal;

// ========== 2. 批量原创 ==========
let currentOriginalTask = null;
let originalPoller = null;

async function generateOriginals() {
  const topics = document.getElementById('o-topics').value.trim().split('\n').filter(Boolean);
  if (!topics.length) { showToast('请填写至少 1 个主题', 'warn'); return; }
  if (topics.length > 10) { showToast('主题最多 10 个', 'warn'); return; }
  const per = parseInt(document.getElementById('o-per').value) || 3;
  const length = parseInt(document.getElementById('o-length').value) || 800;
  const withImages = document.getElementById('o-images').checked;
  const withAIOff = document.getElementById('o-ai-off').checked;
  const withFormat = document.getElementById('o-format').checked;
  const domain = Array.from(document.querySelectorAll('.checkbox-grid input[type="checkbox"]:checked')).map(c => c.value);
  const style = document.querySelector('[data-group="o-style"] .opt-btn.active')?.dataset.val || '干货';
  const extraNote = document.getElementById('o-extra-note').value.trim().substring(0, 200);

  const total = topics.length * per;
  if (total > 120) { showToast('单次最多 120 篇', 'warn'); return; }

  // 成本预估
  try {
    const est = await api.estimate({ provider: PROVIDER_DEFAULT, totalCount: total, wordsPerItem: length, withAIOff });
    document.getElementById('o-cost').textContent = `预计消耗 ≈ ${est.cost} 元`;
  } catch {}

  const resultEl = document.getElementById('o-results');
  const countEl = document.getElementById('o-result-count');
  resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">任务已提交,后台异步执行,可切换页面查看进度…</div>';
  countEl.textContent = `0 / ${total}`;
  showProgress('o-progress');
  setProgress('o-progress', 0);

  try {
    const r = await api.batchOriginal({
      topics, perTopic: per, length, domain, style, withImages, withAIOff, withFormat,
      extraNote,
      provider: PROVIDER_DEFAULT, concurrency: 16
    });
    currentOriginalTask = r.task;
    // 持久化 taskId(刷新后能恢复进度)
    saveActiveTask('original', r.taskId);
    // 启动轮询
    if (originalPoller) originalPoller.stop();
    originalPoller = new TaskPoller(r.taskId, t => {
      renderTaskItems(t, 'o', total, { showSource: false });
      if (t.status === 'done') clearActiveTask('original');
    });
    originalPoller.start(1500);
    // 顶部状态条 + Toast
    showActiveTaskBanner('original', total, t => {
      if (originalPoller) originalPoller.stop();
      originalPoller = new TaskPoller(t.id, tt => {
        renderTaskItems(tt, 'o', total, { showSource: false });
        if (tt.status === 'done') clearActiveTask('original');
      });
      originalPoller.start(1500);
      switchView('original');
    });
    showToast(`任务已创建,共 ${total} 篇,可在顶部「查看进度」跳转`, 'success', 3500);
  } catch (e) {
    showToast(e.message, 'error');
    hideProgress('o-progress');
  }
}
window.generateOriginals = generateOriginals;

// ========== 3. 批量改写 ==========
let currentRewriteTask = null;
let rewritePoller = null;

async function rewriteBatch() {
  const mode = document.querySelector('[data-r-mode].active')?.dataset.rMode || 'text';
  let urls = [];
  let texts = [];
  if (mode === 'url') {
    urls = document.getElementById('r-urls').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
    if (!urls.length) { showToast('请粘贴至少 1 个链接', 'warn'); return; }
    // 严格校验: 每行必须是 http(s):// 开头的合法 URL
    const isUrl = (s) => /^https?:\/\/\S+/.test(s);
    const bad = urls.filter(u => !isUrl(u));
    if (bad.length) {
      showToast(`第 ${bad.length} 行不是有效链接,请输入 http(s):// 开头的真实链接。若要粘贴原文请切换到「直接粘贴原文」`, 'error', 5000);
      const ta = document.getElementById('r-urls');
      if (ta) { ta.focus(); ta.style.outline = '2px solid var(--primary)'; setTimeout(() => ta.style.outline = '', 2000); }
      return;
    }
  } else {
    const raw = document.getElementById('r-text').value.trim();
    if (!raw) { showToast('请粘贴原文', 'warn'); return; }
    // 用 --- (单独一行) 分隔多篇
    texts = raw.split(/^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
    if (!texts.length) { showToast('未识别到原文', 'warn'); return; }
  }
  const count = Math.min(10, Math.max(1, parseInt(document.getElementById('r-count').value) || 3));
  const strength = document.getElementById('r-strength').value;
  const logics = Array.from(document.querySelectorAll('.r-logic:checked')).map(c => c.value);
  const targetLength = document.getElementById('r-length').value;

  const sources = mode === 'url' ? urls : texts;
  const total = sources.length * count;
  const resultEl = document.getElementById('r-results');
  const countEl = document.getElementById('r-result-count');
  resultEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);">任务已提交,${mode === 'url' ? '先抓取原文再' : ''}并发改写…</div>`;
  countEl.textContent = `0 / ${total}`;
  showProgress('r-progress');
  setProgress('r-progress', 0);

  try {
    const body = {
      count, strength, logics, targetLength,
      provider: PROVIDER_DEFAULT, concurrency: 8, withAIOff: true
    };
    if (mode === 'url') body.urls = urls;
    else body.texts = texts;
    const r = await api.batchRewrite(body);
    currentRewriteTask = r.task;
    // 持久化 taskId
    saveActiveTask('rewrite', r.taskId);
    if (rewritePoller) rewritePoller.stop();
    rewritePoller = new TaskPoller(r.taskId, t => {
      renderTaskItems(t, 'r', total, { showSource: false });
      if (t.status === 'done') clearActiveTask('rewrite');
    });
    rewritePoller.start(1500);
    // 顶部状态条 + Toast
    showActiveTaskBanner('rewrite', total, t => {
      if (rewritePoller) rewritePoller.stop();
      rewritePoller = new TaskPoller(t.id, tt => {
        renderTaskItems(tt, 'r', total, { showSource: false });
        if (tt.status === 'done') clearActiveTask('rewrite');
      });
      rewritePoller.start(1500);
      switchView('rewrite');
    });
    showToast(`任务已创建,共 ${total} 篇,可在顶部「查看进度」跳转`, 'success', 3500);
  } catch (e) {
    showToast(e.message, 'error');
    hideProgress('r-progress');
  }
}
window.rewriteBatch = rewriteBatch;

// 只更新单个卡片的内容，不触发整个列表重渲染
function updateSingleCardContent(itemEl, updatedItem, idx, prefix, showSource) {
  const contentDiv = itemEl.querySelector('.result-content');
  if (!contentDiv) return;

  // 移除加载遮罩
  const loadingOverlay = contentDiv.querySelector('.regenerate-loading');
  if (loadingOverlay) loadingOverlay.remove();

  // 准备新内容
  const title = updatedItem.title || (updatedItem.source ? updatedItem.source.slice(0, 30) + '…' : `篇 ${idx + 1}`);
  const body = updatedItem.body || updatedItem.error || '';
  const source = showSource && updatedItem.source ? `<span>🔗 ${updatedItem.source.slice(0, 36)}…</span>` : '';
  const scoreBadge = updatedItem.score != null ? `<span>🎯 AI 味 ${updatedItem.score}%</span>` : '';

  // 相似度徽章
  let similarityBadge = '';
  if (updatedItem.similarity) {
    const sim = updatedItem.similarity;
    const color = sim.passed ? '#10b981' : '#f59e0b';
    const icon = sim.passed ? '✓' : '⚠️';
    similarityBadge = `<span style="color:${color};">${icon} 相似度 ${sim.score}%</span>`;
    if (updatedItem.similarityWarning) {
      similarityBadge += `<span style="color:#f59e0b;font-size:11px;margin-left:6px;" title="${escape(updatedItem.similarityWarning)}">⚠ 建议重新生成</span>`;
    }
  }

  // 重新生成按钮
  const retryCount = updatedItem.retryCount || 0;
  const maxRetries = 3;
  let regenerateBtn = '';
  if (prefix === 'r' && updatedItem.body) {
    if (retryCount >= maxRetries) {
      regenerateBtn = `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">已达重试上限</button>`;
    } else {
      const btnStyle = updatedItem.similarityWarning ? 'color:#f59e0b;border-color:#f59e0b;' : 'opacity:0.7;';
      regenerateBtn = `<button class="btn btn-ghost btn-sm" data-act="regenerate" style="${btnStyle}">🔄 重新生成 (${retryCount}/${maxRetries})</button>`;
    }
  }

  const isLong = body && body.length > 300;
  const formattedBody = body ? body.split('\n').filter(p => p.trim()).map(p => `<p style="margin-bottom:12px;line-height:1.8;">${escape(p.trim())}</p>`).join('') : '';

  // 更新卡片内容（保持卡片本身和序号不变）
  contentDiv.innerHTML = `
    <div class="result-title">${escape(title)} ${statusBadge(updatedItem.status)}</div>
    ${body ? `<div class="result-body" data-collapsed="${isLong ? '1' : '0'}" style="${isLong ? 'max-height:140px;overflow:hidden;mask-image:linear-gradient(to bottom,#000 60%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 60%,transparent 100%);' : ''}">${formattedBody}</div>
                ${isLong ? `<button class="btn btn-ghost btn-sm" data-act="expand" style="margin-top:8px;padding:2px 10px;font-size:12px;">展开全文 (${body.length} 字) ↓</button>` : ''}` : ''}
    <div class="result-meta">${source} ${scoreBadge} ${similarityBadge} ${updatedItem.error ? `<span style="color:var(--primary);">✗ ${escape(updatedItem.error)}</span>` : ''}</div>
    ${updatedItem.body ? `<div class="result-actions">
      <button class="btn btn-ghost btn-sm" data-act="copy">复制</button>
      ${showSource ? '<button class="btn btn-ghost btn-sm" data-act="toOriginal">→ 加入原创</button>' : '<button class="btn btn-ghost btn-sm" data-act="toLayout">→ 去排版</button>'}
      ${regenerateBtn}
    </div>` : ''}
  `;
}

// 任务状态渲染(原创 + 改写共用)
function renderTaskItems(task, prefix, total, { showSource }) {
  // 处理任务丢失情况
  if (task.status === 'lost' || (task.error && task.error.includes('任务已丢失'))) {
    const resultEl = document.getElementById(prefix + '-results');
    const countEl = document.getElementById(prefix + '-result-count');
    const cancelBtn = document.getElementById(prefix + '-cancel-btn');

    if (resultEl) {
      resultEl.innerHTML = `
        <div style="padding:40px 20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
          <h3 style="color:var(--text);margin-bottom:8px;">任务已丢失</h3>
          <p style="color:var(--muted);font-size:14px;margin-bottom:20px;">
            ${task.error || '任务可能因服务器重启而丢失，请重新提交任务'}
          </p>
          <button class="btn btn-primary" onclick="location.reload()">刷新页面</button>
        </div>
      `;
    }
    if (countEl) countEl.textContent = '任务丢失';
    if (cancelBtn) cancelBtn.style.display = 'none';
    hideProgress(prefix + '-progress');
    clearActiveTask(prefix === 'o' ? 'original' : 'rewrite');
    return;
  }

  const resultEl = document.getElementById(prefix + '-results');
  const countEl = document.getElementById(prefix + '-result-count');
  const cancelBtn = document.getElementById(prefix + '-cancel-btn');

  // 控制取消按钮显示/隐藏
  if (cancelBtn) {
    if (task.status === 'running') {
      cancelBtn.style.display = 'inline-block';
      cancelBtn.onclick = () => cancelTaskById(task.id, prefix);
    } else {
      cancelBtn.style.display = 'none';
    }
  }

  // 进度条(在 resultEl 外面,先单独处理,这样即使 resultEl 不存在也能 show)
  const bar = document.getElementById(prefix + '-progress');
  if (bar) {
    if (task.status === 'done' || task.status === 'cancelled') bar.classList.remove('show');
    else bar.classList.add('show');
  }
  // 如果 resultEl 存在,确保它有"正在处理"占位(避免显示陈旧的"任务已提交")
  if (resultEl) {
    const empty = resultEl.querySelector('.empty');
    if (empty) empty.remove();
  }
  if (!resultEl || !countEl) return;
  const items = task.items || [];
  // 状态分组
  const s = STATUS;
  const cnt = {
    pending: items.filter(i => i.status === s.PENDING).length,
    running: items.filter(i => [s.GENERATING, s.DEAI_RUNNING].includes(i.status)).length,
    ok: items.filter(i => i.status === s.DONE || i.status === s.DEAI_OK).length,
    fail: items.filter(i => i.status === s.GEN_FAIL || i.status === s.DEAI_FAIL || i.status === s.FETCH_FAIL).length,
    total: items.length
  };
  const done = cnt.ok + cnt.fail;
  setProgress(prefix + '-progress', (done / Math.max(1, items.length)) * 100);
  // 顶部状态摘要(显示整体进度 + 状态分布)
  if (cnt.total > 0) {
    const pct = Math.round((done / cnt.total) * 100);
    countEl.innerHTML = `<span style="font-weight:600;color:var(--emerald);">${done} / ${cnt.total}</span> 完成 · 进度 <strong>${pct}%</strong>` +
      (cnt.running > 0 ? ` · <span style="color:#d97706;">⏳ ${cnt.running} 处理中</span>` : '') +
      (cnt.ok > 0 ? ` · <span style="color:var(--emerald);">✓ ${cnt.ok} 成功</span>` : '') +
      (cnt.fail > 0 ? ` · <span style="color:#dc2626;">✗ ${cnt.fail} 失败</span>` : '') +
      (cnt.pending > 0 ? ` · <span style="color:var(--muted);">○ ${cnt.pending} 等待</span>` : '');
  } else {
    countEl.textContent = '0 条';
  }

  // 事件委托: resultEl 上只绑一次,后续重渲染不影响
  if (!resultEl.dataset.bound) {
    resultEl.dataset.bound = '1';
    resultEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const itemEl = btn.closest('.result-item');
      if (!itemEl) return;
      const idx = Array.from(resultEl.querySelectorAll('.result-item')).indexOf(itemEl);
      const it = (currentRewriteTask?.items || currentOriginalTask?.items || [])[idx]
                || (resultEl._lastItems || [])[idx];
      if (!it) return;

      // 处理重新生成
      if (btn.dataset.act === 'regenerate') {
        if (btn.disabled) return;

        const taskId = currentRewriteTask?.id || currentOriginalTask?.id;
        if (!taskId) {
          showToast('任务ID丢失，请刷新页面', 'error');
          return;
        }

        // 显示加载状态：给卡片添加遮罩层
        const contentDiv = itemEl.querySelector('.result-content');
        if (!contentDiv) return;

        // 创建加载遮罩
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'regenerate-loading';
        loadingOverlay.innerHTML = `
          <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;z-index:10;border-radius:8px;">
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid var(--primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px;"></div>
              <div style="color:var(--primary);font-weight:500;">重新生成中...</div>
            </div>
          </div>
        `;
        contentDiv.style.position = 'relative';
        contentDiv.appendChild(loadingOverlay);

        // 禁用按钮
        btn.disabled = true;
        const originalBtnText = btn.textContent;

        try {
          await api.regenerateItem(taskId, idx, {
            provider: PROVIDER_DEFAULT,
            provider: PROVIDER_DEFAULT
          });

          // 只更新任务数据，不触发完整重渲染
          const task = await api.task(taskId);
          if (prefix === 'r') {
            currentRewriteTask = task;
          } else if (prefix === 'o') {
            currentOriginalTask = task;
          }

          // 更新缓存的 items
          resultEl._lastItems = task.items;

          // 只更新这一个卡片的内容
          const updatedItem = task.items[idx];
          if (updatedItem) {
            updateSingleCardContent(itemEl, updatedItem, idx, prefix, showSource);
          }

          showToast('重新生成成功', 'success');

        } catch (error) {
          showToast(error.message, 'error');
          // 移除遮罩
          if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.remove();
          }
          btn.disabled = false;
          btn.textContent = originalBtnText;
        }
        return;
      }

      if (!it.body) return;
      if (btn.dataset.act === 'copy') {
        copyText(`${it.title || ''}\n\n${it.body}`, btn);
      } else if (btn.dataset.act === 'expand') {
        const bodyEl = itemEl.querySelector('.result-body');
        if (!bodyEl) return;
        const collapsed = bodyEl.dataset.collapsed === '1';
        if (collapsed) {
          bodyEl.dataset.collapsed = '0';
          bodyEl.style.maxHeight = 'none';
          bodyEl.style.overflow = 'visible';
          bodyEl.style.maskImage = 'none';
          bodyEl.style.webkitMaskImage = 'none';
          btn.textContent = '收起 ↑';
        } else {
          bodyEl.dataset.collapsed = '1';
          bodyEl.style.maxHeight = '140px';
          bodyEl.style.overflow = 'hidden';
          bodyEl.style.maskImage = 'linear-gradient(to bottom,#000 60%,transparent 100%)';
          bodyEl.style.webkitMaskImage = 'linear-gradient(to bottom,#000 60%,transparent 100%)';
          btn.textContent = `展开全文 (${(it.body||'').length} 字) ↓`;
        }
      } else if (btn.dataset.act === 'toOriginal') {
        const cur = document.getElementById('o-topics').value.trim();
        document.getElementById('o-topics').value = (cur ? cur + '\n' : '') + (it.title || it.source);
        showToast('已加入「批量原创」主题', 'success');
      } else if (btn.dataset.act === 'toLayout') {
        document.getElementById('l-text').value = `${it.title || ''}\n\n${it.body}`;
        showToast('已导入到「一键排版」', 'success');
        switchView('layout');
      }
    });
  }
  // 缓存当前 items,供事件委托查
  resultEl._lastItems = items;

  // 只在需要时才重新渲染（避免频繁跳动）
  const currentHTML = resultEl.innerHTML;
  const newHTML = items.map((it, idx) => {
    const title = it.title || (it.source ? it.source.slice(0, 30) + '…' : `篇 ${idx + 1}`);
    const body = it.body || it.error || '';
    const source = showSource && it.source ? `<span>🔗 ${it.source.slice(0, 36)}…</span>` : '';
    const scoreBadge = it.score != null ? `<span>🎯 AI 味 ${it.score}%</span>` : '';

    // 相似度徽章
    let similarityBadge = '';
    if (it.similarity) {
      const sim = it.similarity;
      const color = sim.passed ? '#10b981' : '#f59e0b';
      const icon = sim.passed ? '✓' : '⚠️';
      similarityBadge = `<span style="color:${color};">${icon} 相似度 ${sim.score}%</span>`;

      // 如果有警告，添加详细信息提示
      if (it.similarityWarning) {
        similarityBadge += `<span style="color:#f59e0b;font-size:11px;margin-left:6px;" title="${escape(it.similarityWarning)}">⚠ 建议重新生成</span>`;
      }
    }

    // 重新生成按钮（仅批量改写任务显示）
    const retryCount = it.retryCount || 0;
    const maxRetries = 3;
    let regenerateBtn = '';
    if (prefix === 'r' && it.body) {  // 只在批量改写且已生成内容时显示
      if (retryCount >= maxRetries) {
        regenerateBtn = `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">已达重试上限</button>`;
      } else {
        const btnStyle = it.similarityWarning ? 'color:#f59e0b;border-color:#f59e0b;' : 'opacity:0.7;';
        regenerateBtn = `<button class="btn btn-ghost btn-sm" data-act="regenerate" style="${btnStyle}">🔄 重新生成 (${retryCount}/${maxRetries})</button>`;
      }
    }

    const isLong = body && body.length > 300;

    // 美化文章内容：段落分隔
    const formattedBody = body ? body.split('\n').filter(p => p.trim()).map(p => `<p style="margin-bottom:12px;line-height:1.8;">${escape(p.trim())}</p>`).join('') : '';

    return `<div class="result-item">
      <div class="result-num">${idx + 1}</div>
      <div class="result-content">
        <div class="result-title">${escape(title)} ${statusBadge(it.status)}</div>
        ${body ? `<div class="result-body" data-collapsed="${isLong ? '1' : '0'}" style="${isLong ? 'max-height:140px;overflow:hidden;mask-image:linear-gradient(to bottom,#000 60%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 60%,transparent 100%);' : ''}">${formattedBody}</div>
                    ${isLong ? `<button class="btn btn-ghost btn-sm" data-act="expand" style="margin-top:8px;padding:2px 10px;font-size:12px;">展开全文 (${body.length} 字) ↓</button>` : ''}` : ''}
        <div class="result-meta">${source} ${scoreBadge} ${similarityBadge} ${it.error ? `<span style="color:var(--primary);">✗ ${escape(it.error)}</span>` : ''}</div>
        ${it.body ? `<div class="result-actions">
          <button class="btn btn-ghost btn-sm" data-act="copy">复制</button>
          ${showSource ? '<button class="btn btn-ghost btn-sm" data-act="toOriginal">→ 加入原创</button>' : '<button class="btn btn-ghost btn-sm" data-act="toLayout">→ 去排版</button>'}
          ${regenerateBtn}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  // 只有内容真正改变时才更新DOM，减少跳动
  if (currentHTML !== newHTML) {
    resultEl.innerHTML = newHTML;
  }

  if (task.status === 'done') hideProgress(prefix + '-progress');
}

// ========== 4. 万能改写 ==========
async function universalRewrite() {
  const text = document.getElementById('u-text').value.trim();
  if (!text || text.length < 20) { showToast('请粘贴至少 20 字原文', 'warn'); return; }
  const strength = document.getElementById('u-strength').value;
  const audience = document.getElementById('u-audience').value;
  const aiOff = document.getElementById('u-ai-off').checked;
  const keywords = document.getElementById('u-keywords').checked;
  const tone = document.getElementById('u-tone').checked;
  const length = document.getElementById('u-length').checked ? '精简20%' : '保持原长度';
  const style = document.getElementById('u-style').value || undefined;
  const structure = document.getElementById('u-structure').value || undefined;

  // 根据选择的强度显示不同的加载提示
  const loadingMessages = {
    '轻度': '正在润色改写（预计5-10秒）...',
    '中度': '正在重组改写（预计8-15秒）...',
    '深度': '正在深度重组改写（预计10-20秒）...',
    '完全重写': '正在完全重写（预计15-30秒）...',
    '彻底重写': '正在完全重写（预计15-30秒）...'
  };
  const loadingMsg = loadingMessages[strength] || '正在改写中（预计30-60秒）...';

  const resultEl = document.getElementById('u-results');
  const countEl = document.getElementById('u-result-count');
  resultEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);">${loadingMsg}</div>`;
  countEl.textContent = '改写中…';
  showProgress('u-progress');
  setProgress('u-progress', 20);
  try {
    const r = await api.universal({
      text,
      strength,
      audience,
      aiOff,
      keywords,
      tone,
      length,
      style,
      structure,
      onlyDeAI: false,
      provider: PROVIDER_DEFAULT
    });
    setProgress('u-progress', 100);
    const meta = `<span>📊 原创度 ${100 - r.score}%</span><span>🎯 AI 味 ${r.score}% ${r.passed ? '✓' : '⚠️'}</span><span>📏 ${r.text.length} 字</span>`;
    resultEl.innerHTML = `<div class="result-item">
      <div class="result-num">1</div>
      <div class="result-content">
        <div class="result-title">${aiOff ? '改写 + 降 AI 味(4 阶段)' : '深度重组改写'}</div>
        <div class="result-body">${r.text.split(/\n+/).map(p => `<p>${escape(p)}</p>`).join('')}</div>
        <div class="result-meta">${meta}</div>
        <div class="result-actions">
          <button class="btn btn-ghost btn-sm" data-act="copy">复制</button>
          <button class="btn btn-ghost btn-sm" data-act="toLayout">→ 去排版</button>
        </div>
      </div>
    </div>`;
    countEl.textContent = '1 篇';
    bindUniversalActions({ title: aiOff ? '改写 + 降 AI 味' : '深度重组改写', body: r.text });
    showToast('改写完成', 'success');
  } catch (e) {
    showToast(e.message, 'error');
    countEl.textContent = '失败';
  } finally { hideProgress('u-progress'); }
}
window.universalRewrite = universalRewrite;

async function onlyDeAI() {
  const text = document.getElementById('u-text').value.trim();
  if (!text || text.length < 20) { showToast('请粘贴至少 20 字原文', 'warn'); return; }
  document.getElementById('u-ai-off').checked = true;
  const resultEl = document.getElementById('u-results');
  const countEl = document.getElementById('u-result-count');
  resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">降 AI 味 4 阶段处理中…</div>';
  countEl.textContent = '处理中…';
  showProgress('u-progress');
  setProgress('u-progress', 20);
  try {
    const r = await api.universal({ text, onlyDeAI: true, provider: PROVIDER_DEFAULT });
    setProgress('u-progress', 100);
    const meta = `<span>🎯 AI 味 ${r.score}% ${r.passed ? '✓' : '⚠️'}</span><span>📏 ${r.text.length} 字</span>`;
    resultEl.innerHTML = `<div class="result-item">
      <div class="result-num">1</div>
      <div class="result-content">
        <div class="result-title">降 AI 味(仅 4 阶段)</div>
        <div class="result-body">${r.text.split(/\n+/).map(p => `<p>${escape(p)}</p>`).join('')}</div>
        <div class="result-meta">${meta}</div>
        <div class="result-actions">
          <button class="btn btn-ghost btn-sm" data-act="copy">复制</button>
          <button class="btn btn-ghost btn-sm" data-act="toLayout">→ 去排版</button>
        </div>
      </div>
    </div>`;
    countEl.textContent = '1 篇';
    bindUniversalActions({ title: '降 AI 味', body: r.text });
    showToast('降 AI 味完成', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally { hideProgress('u-progress'); }
}
window.onlyDeAI = onlyDeAI;

function bindUniversalActions(item) {
  const root = document.getElementById('u-results');
  root.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.act === 'copy') copyText(item.body, btn);  // 只复制正文，不包含标题
      if (btn.dataset.act === 'toLayout') {
        document.getElementById('l-text').value = item.body;  // 也只导入正文
        showToast('已导入到「一键排版」', 'success');
        switchView('layout');
      }
    });
  });
}

// ========== 5. 一键排版 ==========
async function layoutArticle(copyToClipboard = true) {
  const text = document.getElementById('l-text').value.trim();
  if (!text) { showToast('请输入原文', 'warn'); return; }
  const style = document.querySelector('[data-group="l-style"] .opt-btn.active')?.dataset.val || '简约';
  const size = document.getElementById('l-size').value;
  const line = document.getElementById('l-line').value;
  const withImages = document.getElementById('l-images').checked;
  const withAutoImages = document.getElementById('l-auto-images').checked;
  const withEmoji = document.getElementById('l-emoji').checked;
  const withQuote = document.getElementById('l-quote').checked;
  const withAI = document.getElementById('l-ai-off').checked;
  const withImageSuggest = document.getElementById('l-image-suggest').checked;

  const resultEl = document.getElementById('l-results');

  // 如果勾选了AI配图建议，先生成关键词
  if (withImageSuggest) {
    await generateImageSuggestions(text);
    return; // 只生成建议，不继续排版
  }

  // 检查是否需要自动配图
  if (withAutoImages) {
    // 调用后端API检查通义万相是否已配置
    try {
      const keysData = await api.keys();
      const tongyiConfig = keysData.providers['tongyi-wanxiang'];
      if (!tongyiConfig || !tongyiConfig.configured) {
        showToast('请先在「模型秘钥」页面配置通义万相API密钥', 'warn');
        return;
      }
    } catch (e) {
      showToast('检查API密钥配置失败', 'error');
      return;
    }
  }

  // 显示加载状态
  if (withAutoImages) {
    resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);"><div style="margin-bottom:10px;">🎨 AI正在生成配图...</div><div style="font-size:12px;opacity:0.7;">这可能需要10-30秒，请耐心等待</div></div>';
  } else {
    resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">排版生成中…</div>';
  }

  try {
    const r = await api.layout({
      text, style, size, line, withImages, withEmoji, withQuote, withAI,
      withAutoImages,
      provider: PROVIDER_DEFAULT
    });

    // 如果配图失败但排版成功，显示提示
    if (withAutoImages && !r.imageGenerated) {
      showToast('配图生成失败，已跳过，排版继续', 'info', 3000);
    }

    resultEl.innerHTML = r.html + `<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;">
      <button class="btn btn-primary btn-sm" id="l-copy-btn">📋 复制到公众号</button>
      <button class="btn btn-ghost btn-sm" id="l-html-btn">查看 HTML</button>
    </div>`;

    document.getElementById('l-copy-btn').onclick = async () => {
      try {
        const blob = new Blob([r.html], { type: 'text/html' });
        const textBlob = new Blob([r.html.replace(/<[^>]+>/g, '')], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]);
        showToast('已复制，粘贴到公众号即可', 'success');
      } catch { showToast('复制失败', 'error'); }
    };

    document.getElementById('l-html-btn').onclick = () => {
      const w = window.open('', '_blank');
      if (w) { w.document.write(r.html); w.document.title = r.title; }
    };

    // 如果是"排版并复制"按钮调用，自动复制到剪贴板
    if (copyToClipboard) {
      try {
        const blob = new Blob([r.html], { type: 'text/html' });
        const textBlob = new Blob([r.html.replace(/<[^>]+>/g, '')], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]);
        const successMsg = withAutoImages && r.imageGenerated ? '排版完成（含AI配图）已复制' : '排版完成，已复制到剪贴板';
        showToast(successMsg, 'success');
      } catch {
        const successMsg = withAutoImages && r.imageGenerated ? '排版完成（含AI配图）' : '排版完成';
        showToast(successMsg, 'success');
      }
    } else {
      const successMsg = withAutoImages && r.imageGenerated ? '预览已生成（含AI配图）' : '预览已生成';
      showToast(successMsg, 'success');
    }
  } catch (e) {
    showToast(e.message, 'error');
    resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--error);">排版失败，请重试</div>';
  }
}
window.layoutArticle = layoutArticle;

// 生成AI配图建议
async function generateImageSuggestions(text) {
  const resultEl = document.getElementById('l-results');
  resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">正在分析文章生成配图建议...</div>';

  try {
    // 调用LLM分析文章，生成配图建议
    const prompt = `请分析下面这篇文章，为其生成3-5个配图建议。对于每个配图位置，生成：
1. 配图场景描述（一句话）
2. 中文搜索关键词（3-5个词）
3. 英文搜索关键词（适合Unsplash/Pexels）

请以JSON格式返回，格式如下：
[
  {
    "scene": "场景描述",
    "keywords_cn": "关键词1 关键词2 关键词3",
    "keywords_en": "keyword1 keyword2 keyword3"
  }
]

文章内容：
${text}`;

    const response = await api.universal({
      text: prompt,
      strength: 'medium',
      audience: 'general',
      provider: PROVIDER_DEFAULT
    });

    // 尝试解析JSON
    let suggestions = [];
    try {
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // 解析失败，使用默认建议
      suggestions = [
        { scene: "文章主题相关图片", keywords_cn: "主题 概念 插图", keywords_en: "concept illustration design" }
      ];
    }

    // 渲染配图建议
    let html = '<div style="padding:20px;">';
    html += '<h3 style="margin:0 0 16px 0;font-size:16px;color:var(--text);">📸 AI配图建议</h3>';
    html += '<div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5;">根据文章内容分析，建议在以下位置添加配图。点击按钮跳转到对应图库搜索：</div>';

    suggestions.forEach((sug, idx) => {
      const cnQuery = encodeURIComponent(sug.keywords_cn);
      const enQuery = encodeURIComponent(sug.keywords_en);

      html += `
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">
          <div style="font-weight:600;margin-bottom:8px;color:var(--text);">${idx + 1}. ${sug.scene}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
            <div><strong>中文关键词：</strong>${sug.keywords_cn}</div>
            <div><strong>英文关键词：</strong>${sug.keywords_en}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="https://cn.bing.com/images/search?q=${cnQuery}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;">
              Bing 图片
            </a>
            <a href="https://unsplash.com/s/photos/${enQuery}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;">
              Unsplash
            </a>
            <a href="https://www.pexels.com/search/${enQuery}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;">
              Pexels
            </a>
            <a href="https://pixabay.com/images/search/${enQuery}" target="_blank" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;">
              Pixabay
            </a>
          </div>
        </div>
      `;
    });

    html += '<div style="margin-top:16px;padding:12px;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:6px;font-size:12px;color:#0c4a6e;line-height:1.5;">';
    html += '💡 <strong>使用提示：</strong>点击按钮跳转到图库网站，使用关键词搜索合适的图片，下载后插入到文章中。建议选择无版权限制的免费图片。';
    html += '</div>';
    html += '</div>';

    resultEl.innerHTML = html;
    showToast('配图建议已生成，点击按钮跳转图库搜索', 'success');
  } catch (e) {
    resultEl.innerHTML = '<div class="empty"><h4>生成失败</h4><p>' + e.message + '</p></div>';
    showToast('生成配图建议失败: ' + e.message, 'error');
  }
}

// 预览按钮：不复制到剪贴板
function previewLayout() {
  layoutArticle(false);
}
window.previewLayout = previewLayout;

// ========== 6. opt-btn 切换 ==========
function bindOptBtns() {
  document.querySelectorAll('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // 批量改写页: 切"链接/原文"时切面板
      if (btn.dataset.rMode) {
        document.querySelectorAll('[data-r-pane]').forEach(p => {
          p.style.display = (p.dataset.rPane === btn.dataset.rMode) ? '' : 'none';
        });
      }
    });
  });

  // 批量改写页: "直接粘贴原文" textarea 实时显示识别到的篇数
  const rText = document.getElementById('r-text');
  const rHint = document.getElementById('r-text-hint');
  const rCount = document.getElementById('r-count');
  const updateRHint = () => {
    if (!rText || !rHint) return;
    const raw = rText.value.trim();
    if (!raw) { rHint.textContent = ''; return; }
    const texts = raw.split(/^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
    const count = parseInt(rCount?.value) || 3;
    const lens = texts.map(t => t.length);
    rHint.innerHTML = `已识别 <strong>${texts.length}</strong> 篇来源(按 <code>---</code> 切分)${' · ' + texts.length} × ${count} 改写 = <strong>${texts.length * count}</strong> 篇结果` +
      (texts.length > 1 ? ` · 各篇长度: ${lens.join(' / ')}` : ` · 当前文本长度: ${lens[0] || 0}`);
  };
  if (rText) rText.addEventListener('input', updateRHint);
  if (rCount) rCount.addEventListener('input', updateRHint);
  // 切 tab 时也刷一次
  document.querySelectorAll('[data-r-mode]').forEach(b => b.addEventListener('click', () => setTimeout(() => { updateRHint(); updateRUrlHint(); }, 0)));
  // 初始化时跑一次(如果切到了 text 模式)
  setTimeout(() => { updateRHint(); updateRUrlHint(); }, 0);

  // 批量改写页: "粘贴链接" textarea 实时校验每行是否为 http(s):// 链接
  const rUrls = document.getElementById('r-urls');
  const rUrlHint = document.getElementById('r-urls-hint');
  function updateRUrlHint() {
    if (!rUrls || !rUrlHint) return;
    const lines = rUrls.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { rUrlHint.textContent = ''; rUrls.style.borderColor = ''; return; }
    const bad = lines.filter(u => !/^https?:\/\/\S+/.test(u));
    if (bad.length) {
      rUrlHint.innerHTML = `<span style="color:var(--primary)">⚠ 有 ${bad.length} 行不是 http(s):// 链接,提交将被拦截。若要粘贴原文请切换到「直接粘贴原文」。</span>`;
      rUrls.style.borderColor = 'var(--primary)';
    } else {
      rUrlHint.innerHTML = `<span style="color:var(--emerald)">✓ ${lines.length} 个链接,每行一个</span>`;
      rUrls.style.borderColor = '';
    }
  }
  if (rUrls) rUrls.addEventListener('input', updateRUrlHint);
}

// ========== 初始化 ==========
async function init() {
  // 处理 access_code：检查 URL 中的 code 参数
  // 支持两种格式: ?code=xxx#/home 或 #/home?code=xxx
  let codeFromUrl = null;

  // 优先检查 hash 后面的参数 (#/home?code=xxx)
  if (location.hash.includes('?code=')) {
    const hashParts = location.hash.split('?');
    const params = new URLSearchParams(hashParts[1]);
    codeFromUrl = params.get('code');
    if (codeFromUrl) {
      // 移除 hash 中的 code 参数
      params.delete('code');
      const newHash = hashParts[0] + (params.toString() ? '?' + params.toString() : '');
      history.replaceState(null, '', location.pathname + location.search + newHash);
    }
  } else {
    // 检查常规 query string (?code=xxx#/home)
    const urlParams = new URLSearchParams(location.search);
    codeFromUrl = urlParams.get('code');
    if (codeFromUrl) {
      // 移除 URL 中的 code 参数
      urlParams.delete('code');
      const newUrl = location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + location.hash;
      history.replaceState(null, '', newUrl);
    }
  }

  // 存入 localStorage
  if (codeFromUrl) {
    localStorage.setItem('moruen_access_code', codeFromUrl);
    showToast('已识别您的专属访问码', 'success');
  }

  bindOptBtns();
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });

  // 先不切换页面，等 restoreActiveTasks 执行完
  const m = location.hash.match(/#\/([\w-]+)/);
  const initialView = (m && document.getElementById('view-' + m[1])) ? m[1] : 'home';


  try {
    await loadMeta();
  } catch (e) {
    showToast('后端连接失败,请确认后端服务已启动', 'error');
  }

  // 草稿自动保存/恢复(刷新不丢内容)
  initDrafts();

  // 批量原创: 成本实时预估(字数/篇数/主题数变化时)
  setupOCostEstimator();

  // 批量原创: 主题行数实时计数
  const oTopics = document.getElementById('o-topics');
  const oTopicsCount = document.getElementById('o-topics-count');
  function updateOTopics() {
    if (!oTopics || !oTopicsCount) return;
    const lines = oTopics.value.split('\n').filter(Boolean);
    const n = lines.length;
    if (n === 0) oTopicsCount.textContent = '';
    else if (n > 10) oTopicsCount.innerHTML = ` <span style="color:var(--primary)">${n}/10 · 已超出,请删除</span>`;
    else oTopicsCount.textContent = ` ${n}/10`;
    oTopics.style.borderColor = n > 10 ? 'var(--primary)' : '';
  }
  if (oTopics) {
    oTopics.addEventListener('input', updateOTopics);
    oTopics.addEventListener('paste', (e) => {
      setTimeout(() => {
        const lines = oTopics.value.split('\n').filter(Boolean);
        if (lines.length > 10) {
          oTopics.value = lines.slice(0, 10).join('\n');
          showToast('主题最多 10 个,已自动截断', 'warn', 3000);
        }
        updateOTopics();
      }, 0);
    });
    setTimeout(updateOTopics, 0);
  }

  // 一键标题页: t-refs 实时限制 5 条 + 计数
  const tRefs = document.getElementById('t-refs');
  const tRefsCount = document.getElementById('t-refs-count');
  const tResults = document.getElementById('t-results');
  const tResultCount = document.getElementById('t-result-count');
  const tEmptyHTML = `<div class="empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <h4>等待开始</h4>
              <p>填写左侧表单后点击"立即生成"</p>
            </div>`;
  function resetTResults() {
    if (!tResults) return;
    tResults.innerHTML = tEmptyHTML;
    if (tResultCount) tResultCount.textContent = '0 条';
  }
  function updateTRefs() {
    if (!tRefs || !tRefsCount) return;
    const lines = tRefs.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { tRefsCount.textContent = ''; return; }
    if (lines.length > 5) {
      tRefsCount.innerHTML = ` <span style="color:var(--primary)">${lines.length}/5 · 超出,粘贴时自动截断</span>`;
    } else {
      tRefsCount.textContent = ` ${lines.length}/5`;
    }
  }
  if (tRefs) {
    tRefs.addEventListener('input', () => { updateTRefs(); resetTResults(); });
    tRefs.addEventListener('paste', () => {
      setTimeout(() => {
        const lines = tRefs.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length > 5) {
          tRefs.value = lines.slice(0, 5).join('\n');
          showToast('参考标题最多 5 条,已自动截断', 'warn', 3000);
        }
        updateTRefs();
        resetTResults();
      }, 0);
    });
  }
  if (tRefsCount) updateTRefs();
  // 注释掉：修改表单参数时不再清空已生成的结果
  // const tCountInput = document.getElementById('t-count');
  // if (tCountInput) tCountInput.addEventListener('input', resetTResults);
  // const tDomainInput = document.getElementById('t-domain');
  // if (tDomainInput) tDomainInput.addEventListener('change', resetTResults);
  // document.querySelectorAll('[data-group="t-style"] .opt-btn, [data-group="t-format"] .opt-btn').forEach(b => {
  //   b.addEventListener('click', resetTResults);
  // });

  // 一键标题: 全选 + 批量导入
  const tPickAll = document.getElementById('t-pick-all');
  if (tPickAll) tPickAll.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('#t-results .t-pick').forEach(cb => cb.checked = checked);
    updatePickedCount();
  });
  const tBulkImport = document.getElementById('t-bulk-import');
  if (tBulkImport) tBulkImport.addEventListener('click', () => {
    const picked = Array.from(document.querySelectorAll('#t-results .t-pick'))
      .filter(c => c.checked)
      .map(c => decodeURIComponent(c.closest('.result-item').dataset.title || ''))
      .filter(Boolean);
    importTitlesToOriginal(picked);
  });

  // 恢复活动任务(刷新后自动恢复进度)
  await restoreActiveTasks();

  // 最后切换到初始页面
  switchView(initialView);
}

// ========== 批量原创: 成本实时预估(顶层,供 initDrafts 调) ==========
let oCostTimer = null;
async function updateOCost() {
  const oCostEl = document.getElementById('o-cost');
  if (!oCostEl) return;
  const topics = document.getElementById('o-topics')?.value.split('\n').filter(Boolean) || [];
  const per = parseInt(document.getElementById('o-per')?.value) || 3;
  const length = parseInt(document.getElementById('o-length')?.value) || 800;
  const withAIOff = !!document.getElementById('o-aioff')?.checked;
  const total = topics.length * per;
  if (total === 0) { oCostEl.textContent = '预计消耗 0 元'; return; }
  try {
    const est = await api.estimate({ provider: PROVIDER_DEFAULT, totalCount: total, wordsPerItem: length, withAIOff });
    oCostEl.textContent = `预计消耗 ≈ ${est.cost} 元 · 共 ${total} 篇`;
  } catch (e) {
    oCostEl.textContent = '预计消耗 - 元';
  }
}
function setupOCostEstimator() {
  ['o-topics', 'o-per', 'o-length', 'o-aioff'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const trigger = () => {
      clearTimeout(oCostTimer);
      oCostTimer = setTimeout(updateOCost, 300);
    };
    el.addEventListener('input', trigger);
    el.addEventListener('change', trigger);
  });
  setTimeout(updateOCost, 100);
}
window.updateOCost = updateOCost;

// ========== 取消任务 ==========
async function cancelTaskById(taskId, prefix) {
  if (!confirm('确定要取消当前任务吗？已生成的结果将保留。')) return;

  try {
    const result = await api.cancelTask(taskId, '用户手动取消');
    if (result.success) {
      showToast('任务已取消', 'success');
      // 隐藏取消按钮
      const cancelBtn = document.getElementById(prefix + '-cancel-btn');
      if (cancelBtn) cancelBtn.style.display = 'none';
      // 停止轮询
      if (prefix === 'o' && originalPoller) {
        originalPoller.stop();
      } else if (prefix === 'r' && rewritePoller) {
        rewritePoller.stop();
      }
      // 清理活动任务
      clearActiveTask(prefix === 'o' ? 'original' : 'rewrite');

      // 清空结果区域，显示空状态
      const resultEl = document.getElementById(prefix + '-results');
      const countEl = document.getElementById(prefix + '-result-count');
      if (resultEl) {
        resultEl.innerHTML = `<div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h4>任务已取消</h4>
          <p>可重新填写表单开始新的生成任务</p>
        </div>`;
      }
      if (countEl) {
        countEl.textContent = '0 篇';
      }
      // 隐藏进度条
      const bar = document.getElementById(prefix + '-progress');
      if (bar) bar.classList.remove('show');
    } else {
      showToast(result.message || '取消失败', 'error');
    }
  } catch (e) {
    showToast('取消任务失败: ' + e.message, 'error');
  }
}
window.cancelTaskById = cancelTaskById;
document.addEventListener('DOMContentLoaded', init);
