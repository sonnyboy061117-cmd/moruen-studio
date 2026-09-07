# 墨韵工坊 v2 - 会员、钱包、大模型账号功能实现总结

> **实现时间**: 2026-09-02
> **功能状态**: 已完成，待测试

---

## 📋 一、改动文件清单

### 新增文件（7个）

#### 后端文件（5个）
1. **`backend/lib/db.js`** - SQLite数据库层
   - 初始化数据库和建表
   - 会员相关函数：getMembership, activateMembership, getMembershipHistory
   - 钱包相关函数：getBalance, recharge, consume, getTransactions

2. **`backend/lib/access.js`** - 权限检查中间件
   - checkAccess: 统一权限检查（会员或余额二选一）
   - checkAndConsumeBalance: 余额扣费

3. **`backend/routes/membership.js`** - 会员路由
   - GET /api/membership - 获取会员状态
   - POST /api/membership/activate - 开通会员
   - POST /api/membership/manual-activate - 客服手动开通
   - GET /api/membership/history - 开通记录

4. **`backend/routes/wallet.js`** - 钱包路由
   - GET /api/wallet - 获取钱包信息
   - POST /api/wallet/recharge - 模拟充值
   - POST /api/wallet/consume - 消费（内部调用）

5. **`backend/data/moruen.db`** - SQLite数据库文件（运行时自动创建）

#### 前端文件（2个）
6. **`frontend/assets/membership.js`** - 会员与钱包前端逻辑
   - 会员状态加载和渲染
   - 会员开通
   - 钱包充值和消费记录
   - 大模型账号管理
   - 客服手动开通

7. **`frontend/index.html`** - 新增4个视图页面
   - view-membership: 会员中心
   - view-wallet: 我的钱包
   - view-model-account: 大模型账号
   - view-admin-activate: 客服手动开通（隐藏）

### 修改文件（5个）

1. **`backend/server.js`**
   - 导入新路由模块
   - 注册会员和钱包路由
   - 初始化数据库

2. **`backend/routes/generate.js`**
   - 添加权限检查中间件
   - 一键标题、万能改写、一键排版添加扣费逻辑

3. **`backend/routes/tasks.js`**
   - 批量原创、批量改写添加权限检查
   - 添加扣费逻辑

4. **`frontend/index.html`**
   - 修改导航栏，隐藏"模型秘钥"
   - 新增"会员中心"、"我的钱包"、"大模型账号"入口
   - 新增4个视图页面HTML

5. **`backend/package.json`**
   - 新增依赖：better-sqlite3

---

## 📊 二、数据库表结构

### 1. membership 表（会员表）
```sql
CREATE TABLE membership (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL CHECK(tier IN ('day', 'month', 'bimonth', 'lifetime')),
  price REAL NOT NULL,
  activation_type TEXT NOT NULL CHECK(activation_type IN ('normal', 'manual_service')),
  start_date TEXT NOT NULL,
  expire_date TEXT,  -- NULL表示永久
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

### 2. wallet 表（钱包表）
```sql
CREATE TABLE wallet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 初始化记录
INSERT INTO wallet (id, balance) VALUES (1, 0);
```

### 3. wallet_transactions 表（交易记录表）
```sql
CREATE TABLE wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,  -- 正数=充值，负数=消费
  type TEXT NOT NULL CHECK(type IN ('recharge', 'consume')),
  description TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

**特别说明**：
- 当前为单用户系统，三张表各只有1条全局记录
- 后续多用户系统上线后，可添加 `user_id` 字段关联用户

---

## 🎯 三、功能测试指南

### 测试环境启动

```bash
# 1. 确保在项目目录
cd D:\moruen-studio-v2

# 2. 安装新依赖（如果还没安装）
cd backend
npm install better-sqlite3

# 3. 启动服务器
npm start

# 4. 访问前端
# 浏览器打开: http://localhost:8787
```

---

### 测试1: 会员购买流程 ✅

**步骤**：
1. 导航栏点击 **"会员中心"**
2. 观察当前会员状态：应显示 **"暂未开通会员"**
3. 查看4个会员档位卡片：
   - 日会员：14.9元
   - 月会员：199元（推荐标签）
   - 双月会员：299元
   - 永久买断：599元
4. 点击"日会员"下方的 **"立即开通"** 按钮
5. 应弹出成功提示："会员开通成功！"
6. 页面自动刷新，会员状态变为：**"当前是 日会员"**，显示到期时间

**预期结果**：
- ✅ 会员状态正确显示
- ✅ 开通后到期时间为明天同一时间
- ✅ 数据库 membership 表新增1条记录

**验证数据库**：
```bash
# 进入项目目录
cd D:\moruen-studio-v2\backend

# 查看数据库（需要安装 sqlite3 命令行工具，或用代码查询）
# 或者重新调用API验证
curl http://localhost:8787/api/membership
```

---

### 测试2: 余额扣费流程 ✅

**步骤**：
1. 导航栏点击 **"我的钱包"**
2. 观察当前余额：应显示 **"¥0.00"**
3. 点击 **"模拟充值"** 按钮
4. 输入金额：`100`
5. 点击确定，应弹出成功提示
6. 余额更新为：**"¥100.00"**
7. 消费记录列表出现1条充值记录

**步骤（测试扣费）**：
1. 导航到 **"一键标题"** 页面
2. 先在会员中心检查：确保会员已过期（等1天后测试，或手动删除会员记录）
3. 填写标题生成参数，点击 **"生成标题"**
4. 观察：
   - 如果有余额：正常生成，余额扣除约 ¥0.02
   - 如果余额不足：弹窗提示 **"余额不足，请先充值"**

**预期结果**：
- ✅ 充值成功，余额增加
- ✅ 交易记录正确显示
- ✅ 生成内容时自动扣费
- ✅ 余额不足时拦截并提示

---

### 测试3: 大模型账号隐藏效果 ✅

**步骤**：
1. 导航栏查看：**"模型秘钥"** 入口已隐藏
2. 新增入口：**"大模型账号"** 可见
3. 点击 **"大模型账号"**
4. 页面只显示：
   - 1个输入框："请输入你的大模型账号"
   - 2个按钮："联系客服"、"购买密钥"
5. 点击 **"联系客服"**：弹窗显示 **"请添加客服微信：XXX（占位符）"**
6. 点击 **"购买密钥"**：弹窗显示 **"购买入口开发中"**

**步骤（测试保存账号）**：
1. 在输入框输入测试key：`sk-test123456`
2. 点击 **"保存账号"**
3. 应弹出成功提示
4. 该key底层保存到 DeepSeek 供应商

**预期结果**：
- ✅ 界面完全看不到"DeepSeek"字样
- ✅ 用户界面简洁，只有1个输入框
- ✅ 保存后底层对应DeepSeek

**验证隐藏效果**：
```bash
# 访问旧的模型秘钥页面（开发者隐藏路径）
# 浏览器输入：http://localhost:8787/#/keys
# 应该能看到多供应商管理页面（开发者专用）
```

---

### 测试4: 客服手动开通流程 ✅

**步骤**：
1. 浏览器地址栏输入：`http://localhost:8787/#/admin-activate`
2. 或者在开发者工具控制台执行：`switchView('admin-activate')`
3. 页面显示：
   - 标题："客服手动开通"
   - 输入框："开通天数"（默认1）
   - 按钮："手动开通（体验价 9.9元）"
4. 修改天数为 `3`
5. 点击 **"手动开通"** 按钮
6. 应弹出成功提示：**"开通成功！有效期 3 天"**
7. 下方"最近开通记录"列表出现1条记录，标注 **"体验价"** 橙色标签

**步骤（验证会员状态）**：
1. 回到 **"会员中心"** 页面
2. 会员状态显示：**"当前是 日会员 (体验价开通)"**
3. 到期时间为 3天后

**预期结果**：
- ✅ 客服页面可访问（但不在导航栏显示）
- ✅ 手动开通成功，价格记录为 9.9元
- ✅ activation_type 为 manual_service
- ✅ 会员状态正确标注"体验价开通"

---

### 测试5: 到期状态显示 ✅

**测试场景A: 会员有效期内**
1. 刚开通日会员
2. 会员中心显示：**"当前是 日会员，到期时间：2026年09月03日"**
3. 使用核心功能（标题、原创、改写等）：✅ 正常使用，不扣费

**测试场景B: 会员已过期**
1. 手动修改数据库 expire_date 为过去时间
   ```bash
   # 进入数据库
   sqlite3 backend/data/moruen.db
   
   # 更新到期时间为昨天
   UPDATE membership SET expire_date = datetime('now', '-1 day') WHERE id = 1;
   
   # 退出
   .exit
   ```
2. 刷新会员中心页面
3. 会员状态显示：**"会员已过期，请续费"**
4. 尝试使用核心功能：❌ 弹窗拦截 **"该功能需要开通会员或有余额"**

**测试场景C: 永久买断**
1. 开通永久买断会员
2. 会员中心显示：**"当前是 永久买断，永久有效"**
3. 数据库 expire_date 字段为 NULL

**预期结果**：
- ✅ 有效期内正常使用
- ✅ 过期后拦截并提示
- ✅ 永久买断显示"永久有效"

---

### 测试6: 权限拦截逻辑 ✅

**场景A: 未开通会员 + 余额为0**
1. 删除所有会员记录
2. 钱包余额设为0
3. 尝试使用 **"一键标题"**
4. 应弹出拦截提示：**"该功能需要开通会员或有余额，日会员仅需14.9元即可体验全部功能"**
5. 点击 **"立即开通日会员"** 按钮：跳转到会员页面并高亮日会员卡片

**场景B: 未开通会员 + 有余额**
1. 会员已过期或未开通
2. 钱包余额 > 0（如 ¥10）
3. 尝试使用 **"一键标题"**
4. ✅ 正常生成，余额扣除约 ¥0.02

**场景C: 会员有效 + 余额任意**
1. 会员状态：有效
2. 余额：任意（0或>0都可以）
3. 使用所有核心功能：✅ 全部正常使用，不扣费

**预期结果**：
- ✅ 会员和余额二选一即可使用
- ✅ 会员优先，有会员不扣余额
- ✅ 无会员但有余额，按次扣费
- ✅ 都没有，拦截并引导开通

---

## 💰 四、扣费标准（非会员用户）

| 功能 | 单次成本 | 说明 |
|------|---------|------|
| 一键标题 | ¥0.02 | 生成10条标题 |
| 万能改写 | ¥0.05 | 单篇改写 |
| 一键排版（纯排版） | 免费 | 无AI处理 |
| 一键排版（含降AI） | ¥0.03 | 降AI味处理 |
| 一键排版（含AI配图） | ¥0.10 | 调用通义万相 |
| 批量原创 | ¥0.10/篇 | 每篇文章 |
| 批量改写 | ¥0.08/篇 | 每篇改写 |

**注意**：
- 会员用户使用所有功能全部免费
- 余额用户按上述标准扣费
- Demo模式不扣费

---

## 🔧 五、功能亮点

### 1. 会员功能
- ✅ 4档会员体系（日/月/双月/永久）
- ✅ 体验价引导（新用户9.9元日会员）
- ✅ 客服手动开通（体验价标注）
- ✅ 到期状态实时显示
- ✅ 永久买断支持

### 2. 钱包功能
- ✅ 余额充值（模拟测试）
- ✅ 消费记录详细展示
- ✅ 自动扣费（按功能计费）
- ✅ 余额不足拦截

### 3. 大模型账号
- ✅ 隐藏多供应商复杂度
- ✅ 统一"大模型账号"概念
- ✅ 底层对接DeepSeek
- ✅ 客服引导购买

### 4. 权限拦截
- ✅ 统一权限中间件
- ✅ 会员或余额二选一
- ✅ 拦截提示友好
- ✅ 一键跳转会员页面

---

## 📝 六、注意事项

### 开发相关
1. **数据库文件位置**: `backend/data/moruen.db`
2. **隐藏的开发者入口**: 
   - 旧模型秘钥页面：`http://localhost:8787/#/keys`
   - 客服开通页面：`http://localhost:8787/#/admin-activate`
3. **演示模式**: 顶部工具栏勾选"演示模式"，所有功能免费使用mock数据

### 用户体验
1. **支付功能**: 当前为内部测试，页面标注"支付功能开发中"
2. **客服微信**: 占位符为 `XXX`，需后续替换真实微信号
3. **Demo模式**: 前端可勾选"演示模式"跳过权限检查

### 数据持久化
1. **SQLite数据库**: 轻量化持久存储，重启不丢失
2. **单用户系统**: 当前全局只有1个会员账户和1个钱包
3. **多用户迁移**: 后续添加 user_id 字段即可支持多用户

---

## 🚀 七、部署到服务器

完成本地测试后，执行以下命令部署到生产环境：

```bash
# 1. 停止本地开发服务器
# Ctrl+C 或 npm stop

# 2. 提交代码到Git
cd D:\moruen-studio-v2
git add .
git commit -m "feat: 实现会员、钱包、大模型账号三大功能模块"
git push origin main

# 3. SSH登录服务器
ssh root@39.102.209.193

# 4. 进入项目目录
cd /opt/moruen-studio-v2

# 5. 拉取最新代码
git pull

# 6. 重新构建并启动
docker compose build --no-cache
docker compose up -d

# 7. 查看日志确认启动成功
docker compose logs -f moruen

# 8. 访问测试
# http://39.102.209.193:8787
```

**检查清单**：
- ✅ 数据库文件自动创建（backend/data/moruen.db）
- ✅ 会员中心页面正常显示
- ✅ 钱包充值功能正常
- ✅ 大模型账号页面正常
- ✅ 权限拦截生效

---

## ⚠️ **部署提醒**

**🚨 每次完成一个功能后，记得部署到服务器！**

---

## 📞 八、问题排查

### 问题1: 服务器启动失败
```bash
# 查看错误日志
docker compose logs moruen

# 常见原因：
# - better-sqlite3 依赖未安装
# - 数据库文件权限问题
# - 端口8787被占用
```

### 问题2: 数据库查询失败
```bash
# 进入容器
docker exec -it moruen-studio-v2-moruen-1 sh

# 检查数据库文件
ls -la /app/data/moruen.db

# 手动初始化数据库
node -e "import('./lib/db.js')"
```

### 问题3: 会员状态不更新
```bash
# 重启服务器
docker compose restart moruen

# 或清空数据库重新测试
docker exec -it moruen-studio-v2-moruen-1 rm /app/data/moruen.db
docker compose restart moruen
```

---

## ✅ 功能实现状态

- ✅ SQLite数据库初始化
- ✅ 会员管理（4档会员）
- ✅ 钱包充值和扣费
- ✅ 客服手动开通
- ✅ 大模型账号管理
- ✅ 权限拦截中间件
- ✅ 前端页面和交互
- ✅ API接口完整
- ✅ 扣费逻辑集成
- ✅ 到期状态显示

**总计**：新增文件7个，修改文件5个，新增数据库表3张

---

**文档版本**: v1.0  
**最后更新**: 2026-09-02  
**实现者**: Claude Sonnet 5
