# Billing Memo

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md)

**所有工具，一本清晰的账本。** 在本地管理云服务、托管、数据库、邮件、API 和订阅费用。

[下载 Windows v0.3.0](https://github.com/jeffrog-256k1/billing-memo/releases/latest) · [打开网页版](https://jeffrog-256k1.github.io/billing-memo/) · [查看示例](https://jeffrog-256k1.github.io/billing-memo/?demo=1)

![首次启动的空账本](assets/empty.png)

## 从空账本开始，一页管理

1. 首次打开是**空账本**。桌面版没有演示模式或预填订阅。
2. 输入服务名称、金额、币种、周期和首次账单日期。账单链接可选，项目、分类、备注折叠在更多字段中。
3. **我的账本**同时显示服务编辑、月度账单、已付金额和待付估算；切换月份无需离开服务列表。
4. 付款后记录实际金额。通过**账本工具**备份或恢复 JSON。

![手动选择的虚构示例](assets/overview.png)

网页版也默认空白。仅点击演示链接或在工具菜单选择演示时加载虚构数据。演示编辑不会保存或覆盖个人账本；点击“打开我的账本”返回原有记录。示例数字不是实际供应商价格。

## 更小的 Windows 应用

0.3 使用 **Tauri + 系统 WebView2** 替代 Electron。界面仍是本地 Web UI，但不再捆绑 Chromium/Node。安装 WebView2 后可离线使用。若运行时缺失或过旧，安装程序单独下载它；这部分不计入小型安装包大小。

支持 Windows 10/11 x64。运行安装程序，或解压 ZIP 后启动 **Billing Memo.exe**；ZIP 也需要 WebView2。数据保存在 **%APPDATA%/app.leejungjae.billingmemo/ledger.json**，不随 ZIP 保存在 U 盘内。发布包未签名，Windows 可能显示发布者/SmartScreen 提示。提供 SHA256SUMS.txt，不含自动更新。

从 0.2 升级时请先关闭旧版并导出 JSON。首次启动尝试复制旧默认配置中的已保存账本，不修改原文件，也不导入演示数据。失败时显示提示，可恢复 JSON；0.1/0.2 备份仍兼容。[桌面指南](docs/DESKTOP.md)

## 三个页面

- **我的账本：** 服务、账单链接、月总额、付款状态、搜索及项目/分类/状态筛选、预算和可折叠六个月预测。顶部合计始终包含全部服务，不受列表筛选影响。
- **付款日历：** 到期日期、按日筛选、月度 CSV 和未付账单 ICS 提醒。
- **期间分析：** 自选起止日期（含两端）、期间总额、月度金额和平均值、项目/分类筛选、明细及月度 CSV。可按实际付款日或计划到期日统计；最多 120 个自然月，平均值包含空月和部分月份。

## 计算与存储

支持月付、年付、一次性和用量费用；用量是**手动输入的月总额**，不会调用供应商 API。31 日账单在短月取月末，下月恢复 31 日。年费在到期月全额计入，只有月均经常性成本才除以 12。

月账单 = 已付实际金额 + 未付估算。1 月账单在 2 月支付，在账本中归于 1 月，在实际付款报告中归于 2 月。编辑、暂停或删除服务不会移除付款快照；编辑会改变包括历史月份在内的未付估算。每服务每月一张账单，额外交易可单独添加一次性服务。

支持 USD、KRW、EUR、JPY、CNY、GBP，金额按最小货币单位整数存储。KRW/JPY 无小数。汇率由用户输入，缺失时显示分币种金额和不完整的换算合计。更改显示币种会重置汇率和预算；没有自动或历史汇率。

桌面使用本地 JSON，网页使用浏览器 localStorage。无登录、后端或设备同步；两者通过 JSON 转移。恢复会确认后替换目标账本。删除浏览器数据会删除网页账本。保存失败或损坏会提示，不会静默清空。

上限：500 项服务、5,000 条付款、2 MiB 账本/导入、2000–2199 年、名称 80 字符、备注 2,000 字符。金额非负，每项最多 1,000 亿最小货币单位。仅允许无凭据的 HTTPS 链接。数据未加密，请勿保存密码、API 密钥或银行卡信息。不执行扣款、自动发票对账或后台提醒；ICS 提醒由日历应用处理。

## Development

Node.js 22.12+ and npm:

```sh
git clone https://github.com/jeffrog-256k1/billing-memo.git
cd billing-memo
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run format:check
```

The local dev command builds and previews the production CSP; rerun after source changes. Windows builds also require stable Rust, MSVC C++ Build Tools and WebView2. See [desktop build instructions](docs/DESKTOP.md). No provider keys are needed.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Dependencies](THIRD_PARTY_NOTICES.md)

Built by [jeffrog-256k1](https://github.com/jeffrog-256k1) · [leejungjae.app](https://leejungjae.app)
