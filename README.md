# AI 报价工作台（AI Quote Workbench）

> **定位说明**：这是一个「AI 应用开发」方向的自测项目，不是客户交付项目。
> 价目表、客户和订单都是虚构的，不连接任何真实业务系统。用途是：面试时
> **有东西能当场演示**，并且每个数字都能指到代码、接口和数据库。

把客户的微信口语询价，变成一张可核对的报价单：

```text
客户原文 → 大模型提取结构化需求 → 价目表确定性核算 → 风险清单 → 数据库存档
```

## 为什么值得看

这个项目刻意把「AI」和「算钱」分开：

- **大模型只做提取**：从「尼龙5号拉链黑色 5000 米，交期 20 天」里读出产品、
  规格、颜色、数量、交期，输出 JSON。
- **价格永远由代码算**：价目表是配置，模型接触不到价格，也就不可能编造价格。
- **识别不了就阻断**：型号不在价目表、数量缺失、色号不在色卡，全部进入
  「阻断 / 待确认」清单，而不是猜一个结果。
- **没有 Key 也能跑**：LLM 不可用时自动回退到规则解析，接口和界面完全可用。

对应到 JD 的关键词：React + TypeScript、API 设计、数据库建模、LLM API 调用、
Prompt 设计、结构化输出、工具调用思路、AI 编程工具交付、降级与错误处理。

## 功能

- 粘贴或点选示例询价，一次提交
- 大模型提取（OpenAI 兼容接口：DeepSeek / OpenAI / 网关）
- 确定性报价：查价、算金额、MOQ 提示、色号校验
- 三级问题清单：`【阻断】` / `【待确认】` / `【客户备注】`
- 报价摘要一键复制
- 最近 10 条报价存入数据库，点击可回看
- 无 Key 自动降级为规则解析，并在界面标注当前模式

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4 |
| 后端 | Next.js Route Handlers（Node runtime） |
| 大模型 | OpenAI 兼容 Chat Completions + JSON 模式 |
| 数据库 | 本地 `node:sqlite`（零配置）；线上 Turso（SQLite 兼容云数据库） |
| 校验 | 服务端字段校验 + 价目表白名单 |

## 数据流

```text
浏览器（React + TypeScript）
   │  POST /api/quotes { text }
   ▼
Route Handler（Node runtime）
   ├─ lib/llm.ts     调大模型 → JSON 提取；失败/无 Key 时回退
   ├─ lib/extract.ts 规则提取兜底（无第三方依赖）
   ├─ lib/price.ts   查价目表、算金额、收集风险项（确定性）
   └─ lib/db.ts      SQLite（本地）/ Turso（线上）落库
   ▼
返回 { quote, issues, hasBlocker, mode }
```

## 本地运行

环境：Node.js 22+（本项目在 Node 26 上验证）。

```powershell
npm install
npm run dev
```

打开 <http://localhost:3000>。**不配置任何 Key 也能完整演示**，此时页面会显示
「规则解析」。提交内置三个示例，分别可以看到：正常报价、新色号提示、阻断项。

### 接入大模型（可选）

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`：

```dotenv
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=你的 Key
LLM_MODEL=deepseek-chat
```

重启 `npm run dev`，页面会显示「大模型提取」。任何 OpenAI 兼容服务都可以，
只需改 `LLM_BASE_URL` 和 `LLM_MODEL`。

### 冒烟测试

保持服务运行，另开一个终端：

```powershell
npm run smoke
```

默认请求 `http://localhost:3000`；端口不同时：

```powershell
$env:BASE_URL = "http://localhost:3100"; npm run smoke
```

测试强制走规则解析（`mock: true`），断言三个示例的合计金额、行数和阻断状态，
用于防止改代码时把报价逻辑改坏。

## API

### POST /api/quotes

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/quotes `
  -ContentType "application/json" `
  -Body '{"text":"张经理，要尼龙5号拉链黑色 5000 米，交期 20 天"}'
```

返回：

```json
{
  "id": 1,
  "mode": "rule",
  "quote": {
    "customer": "张经理",
    "lines": [
      {
        "line": 1, "sku": "NYL-5#", "name": "尼龙拉链", "spec": "5#",
        "color": "BLK-01", "qty": 5000, "unit": "米",
        "price": 1.65, "amount": 8250, "status": "正常"
      }
    ],
    "total": 8250,
    "currency": "CNY",
    "taxIncluded": true
  },
  "issues": ["【客户要求】交期 20 天，需确认排产能否满足"],
  "hasBlocker": false
}
```

### GET /api/quotes

返回最近 10 条报价（含原文和完整快照）。

## 目录结构

```text
ai-quote-app/
├── app/
│   ├── api/quotes/route.ts   # POST 报价 / GET 历史
│   ├── page.tsx              # 工作台界面（Client Component）
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── catalog.ts            # 价目表、色卡、SKU 对齐
│   ├── extract.ts            # 规则提取兜底
│   ├── llm.ts                # 大模型提取 + JSON 校验
│   ├── price.ts              # 确定性报价引擎
│   ├── db.ts                 # SQLite / Turso 双后端持久化
│   ├── format.ts             # 展示格式化
│   └── types.ts              # 前后端共用领域类型
├── .env.example
└── README.md
```

## 关键设计取舍（面试可讲）

1. **模型不碰价格**
   价目表在 `lib/catalog.ts`，模型输出只包含 sku / 数量 / 颜色。即使用户在
   询价里写「按 0.01 元报」，模型也没有价格可改；服务端再用白名单核对 SKU。
   这是「模型负责理解，代码负责规则」的分工。

2. **三类问题，边界清晰**
   - `【阻断】`：型号不在价目表、结果为空 → 不出价；
   - `【待确认】`：缺数量、低于 MOQ、非标色号、交期 → 照常报价但必须复核；
   - `【客户备注】`：原样透传，避免信息丢失。

3. **结构化输出 + 双层兜底**
   Prompt 中给出 JSON 结构和价目表；返回值要经过 `normalizeExtraction` 校验，
   解析失败、网络失败、没有 Key 都会降级到规则提取。降级不是隐藏错误，界面会
   明确标注当前模式，并把原因显示出来。

4. **数据库访问的预渲染陷阱**
   历史记录依赖运行时的环境变量和数据库。如果 GET 接口在构建期执行，结果会
   被静态化。`app/api/quotes/route.ts` 里先 `await connection()`，强制查询发生
   在请求时。这是 Next 16 Cache Components 下的实际坑。

5. **报价快照不可变**
   每条记录存原文、提取结果、报价和问题清单的完整 JSON。价格表以后改了，
   历史报价仍然可追溯。

## 3 分钟演示脚本

1. 点「标准询价」→ 提交：展示逐行报价、合计、交期提示。
2. 点「新色号」→ 提交：展示非标色号进入待确认，但报价不中断。
3. 点「信息缺失」→ 提交：展示「装饰扣」不在价目表 → 阻断，整单不允许直接外发。
4. 刷新页面 → 最近报价仍在（SQLite）。
5. 打开 `lib/price.ts` 和 `lib/llm.ts`，说明「模型只提取、代码才算钱」的分工。

## 部署（Vercel + Turso）

本地使用 `node:sqlite`；线上配置两个环境变量后，`lib/db.ts` 会自动切换到
Turso（SQLite 兼容的云数据库），接口代码不变。

1. 用 GitHub 登录 [Turso](https://turso.tech)，创建一个数据库（建议选新加坡
   或东京区域），复制 Database URL（形如 `libsql://xxx.turso.io`）。
2. 在数据库设置里创建一个 Token（或运行 `turso db tokens create <数据库名>`）。
3. 在 [Vercel](https://vercel.com) 导入本仓库，添加环境变量：
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - 可选：`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`
4. 点击 Deploy。首次请求会自动建表，历史记录随即可用。

> 公共演示站不建议配 `LLM_API_KEY`，避免额度被别人刷；不配 Key 时规则解析
> 仍可完整演示。面试现场可以用本地 `.env.local` 展示大模型模式。

## 已知边界

- 本地 SQLite 存在 `.data/quotes.db`，适合本机演示；部署到 Vercel 时按上面
  的步骤配置 Turso 即可，无需改代码。
- 规则提取只覆盖内置的拉链、扣子、织带写法；真实业务应持续补规则或用模型。
- 没有登录、权限、限流和审计；这是单用户演示项目。
- 价目表、客户、订单均为虚构数据。

## 如实表述边界

可以这样说：

> 我自己做了一个 AI 报价工作台：Next.js + TypeScript 全栈，调用大模型把客户
> 询价提取成结构化 JSON，再用确定性价目表算价，结果存 SQLite。无 Key 时会
> 自动降级到规则解析，接口和界面都有错误处理，项目有完整文档。

不要这样说：

> 我给客户做过报价系统 / 有企业级全栈项目经验。

前者经得起追问，后者一查就穿帮，还会把真实做过的部分一起拖下水。
