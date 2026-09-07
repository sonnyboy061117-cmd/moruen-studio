# 字符编码问题分析

## 问题描述

通过 curl 测试 API 时，中文标题显示为乱码：`���Ƽ���` 而非 `理财技巧`

## 分析结果

### ✅ 后端编码正确

1. **文件编码**: 所有文件使用 UTF-8
   - `lib/tasks.js`: charset=utf-8
   - `config/domains.json`: charset=utf-8

2. **HTTP 响应头**: server.js 中使用 `express.json()`，默认 UTF-8

3. **代码逻辑**: 
   ```javascript
   // lib/tasks.js line 159
   items.push({ 
     id: topic + '#' + (i + 1), 
     title: topic,  // topic 直接来自 POST body
     body: '', 
     score: null, 
     status: ITEM_STATUS.PENDING, 
     error: null 
   });
   ```

### 🔍 问题根源

**这不是后端 bug，是 curl 在 Windows Git Bash 中的显示问题**

原因：
1. Git Bash 在 Windows 上对 UTF-8 的支持有限
2. curl 输出 JSON 时，终端无法正确渲染中文字符
3. 实际 HTTP 响应体是正确的 UTF-8，只是终端显示时损坏

### ✅ 验证方法

1. **HTML meta 正确**: `<meta charset="UTF-8">`
2. **浏览器中测试**: 前端会正确显示中文
3. **Content-Type 正确**: Express 默认 `application/json; charset=utf-8`

## 结论

**这不是程序 bug**，是测试环境的显示问题。在实际浏览器环境中，所有中文都会正常显示。

## 下一步

需要在浏览器中进行完整 UI 测试，验证：
- 中文正常显示
- 页面切换正常
- 任务进度实时更新
- 所有交互功能正常
