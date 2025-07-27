# 修复移动端Requests界面Mark Received功能缺陷

## Core Features

- 分析桌面端完整流程

- 定位移动端缺失逻辑

- 修复打印条形码步骤

- 确保功能一致性

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "shadcn"
  }
}

## Design

基于现有项目的移动端和桌面端分离式UI架构，确保修复后的移动端界面与桌面端保持功能一致性，同时适配移动端的交互特点

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 分析桌面端DesktopApp.tsx中Requests界面Ordered状态的"Mark Received"动作实现

[X] 检查桌面端打印条形码步骤的触发逻辑和相关组件

[X] 定位移动端MobileApp.tsx中对应功能的实现差异

[X] 修复移动端"Mark Received"动作后缺失的打印条形码步骤

[X] 测试移动端和桌面端功能一致性

[X] 优化移动端打印条形码的用户界面适配
