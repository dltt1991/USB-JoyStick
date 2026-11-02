# USB Joystick Implementation Plan

> **For agentic workers:** Execute inline in this session, using the approved design.

**Goal:** 在本地网页实时显示 USB 游戏控制器的两个轴。

**Architecture:** 单文件 index.html 使用 Gamepad API 和 requestAnimationFrame，轴选择和设备选择保留在页面状态中。测试通过 Node vm 执行页面原脚本，并模拟浏览器设备输入。

**Tech Stack:** HTML、CSS、JavaScript、Node 内置 assert/vm。

## Global Constraints

- 无运行依赖，无构建步骤，本地 localhost 运行。
- 显示浏览器归一化值，缺少数据时显示破折号。
- 不支持私有 USB 协议；不对未连接的真实硬件宣称验证成功。

### Task 1: 实现和验证实时监视页面

**Files:** 创建 index.html、test.mjs、README.md。

- [x] 编写 test.mjs，模拟空设备、非零索引设备、轴变化、轴切换、设备切换、轴不足、断开及 API 错误；执行 `node test.mjs` 确认初始失败。
- [x] 编写 index.html：getGamepads 每帧轮询；使用 textContent 显示设备字符串；轴选项根据真实轴数生成；支持轴反向；缺少数据清空读数。
- [x] 执行 `node test.mjs`，确认所有断言通过。
- [x] 编写 README.md，记录 `python3 -m http.server 8000 --bind 127.0.0.1`、连接流程和协议限制。
- [x] 启动本地服务器并通过 HTTP 检查页面成功返回，复核文档与实现一致。
