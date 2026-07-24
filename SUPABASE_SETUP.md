# Supabase 上线配置

## 1. 创建项目

在 Supabase 创建一个新项目，然后进入项目的 SQL Editor。

## 2. 初始化数据库

复制并执行：

```text
supabase/schema.sql
```

这个脚本会创建：

- `public.trades`：交易记录表
- `public.user_preferences`：用户偏好表
- `public.weekly_reports`：AI 周报表
- `trade_amount`：每笔交易金额，用于自动计算仓位
- `account_total_amount`：账户总资金，用于统一仓位口径
- RLS 策略：每个用户只能读取、创建、修改、删除自己的数据

如果之前已经执行过旧版 SQL，也可以直接重新执行这个文件。里面包含 `add column if not exists`，会补齐新增字段。

## 3. 开启 Auth

在 Supabase Dashboard 中进入 Authentication：

- 开启 Email 登录
- 开启 Email/Password 登录
- 注册确认邮件可以保留开启，用于确认用户邮箱归属
- 确认站点 URL 配置为你的线上域名
- Redirect URLs 加入 `https://你的域名/reset-password`
- 本地开发时可加入 `http://localhost:3000`、`http://localhost:3000/reset-password`、`http://localhost:3002` 和 `http://localhost:3002/reset-password`

## 4. 配置环境变量

本地创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon public key
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
OPENAI_FALLBACK_MODELS=
SUPABASE_AUTH_HOOK_SECRET=你的 Supabase Send SMS Hook Secret
TENCENTCLOUD_SECRET_ID=你的腾讯云 SecretId
TENCENTCLOUD_SECRET_KEY=你的腾讯云 SecretKey
TENCENT_SMS_SDK_APP_ID=你的短信应用 SDKAppID
TENCENT_SMS_SIGN_NAME=你的短信签名
TENCENT_SMS_TEMPLATE_ID=你的短信模板 ID
TENCENT_SMS_REGION=ap-guangzhou
```

Vercel 部署时，在 Project Settings -> Environment Variables 中配置同样的变量。

`OPENAI_MODEL` 可以不填，默认使用 `gpt-4.1-mini`。

如果使用第三方 AI 中转服务，把 `OPENAI_API_BASE_URL` 改成中转服务提供的 base URL，例如：

```bash
OPENAI_API_BASE_URL=https://你的中转域名/v1
```

代码也兼容 `API_BASE_URL` 这个变量名；两个都配置时优先使用 `OPENAI_API_BASE_URL`。
AI 周报会优先调用 `/responses`，如果中转服务不支持，会自动切换到 `/chat/completions`。
如果中转平台某个模型没有可用通道，可以配置备用模型列表：

```bash
OPENAI_MODEL=你的主模型
OPENAI_FALLBACK_MODELS=备用模型1,备用模型2
```

行情当前不需要额外配置 API Key：

- A 股：东方财富公开行情接口，失败时自动切换到新浪行情备用源
- 港股：腾讯行情接口
- 美股：腾讯行情接口

## 5. 预留腾讯云短信登录

项目保留了 Supabase Send SMS Hook 接口，但当前登录页暂未开放手机号登录：

```text
/api/auth/send-sms
```

上线后，在 Supabase Dashboard -> Authentication -> Hooks -> Send SMS 中配置 HTTP Request：

```text
https://你的域名/api/auth/send-sms
```

然后把 Supabase 生成的 Hook Secret 填到 Vercel 环境变量 `SUPABASE_AUTH_HOOK_SECRET`。

腾讯云短信侧需要先完成：

- 开通短信服务
- 创建短信应用，拿到 `TENCENT_SMS_SDK_APP_ID`
- 申请短信签名，填入 `TENCENT_SMS_SIGN_NAME`
- 申请验证码模板，模板里保留 1 个变量用于验证码，填入 `TENCENT_SMS_TEMPLATE_ID`
- 创建访问密钥，填入 `TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY`

手机号需要使用国际格式，例如中国大陆手机号写作 `+8613800138000`。

## 6. 当前数据流

- 用户通过 `/login` 邮箱和密码登录，也可以注册新账号
- 登录页支持忘记密码，重置邮件会跳转到 `/reset-password`
- “我的”页支持修改登录邮箱和登录密码
- 首页从 Supabase `trades` 表读取交易记录
- 新建交易写入 Supabase `trades` 表
- 新建交易填写交易金额，系统按“我的”里设置的账户总资金自动计算仓位比例
- 持仓二级页读取同一股票代码下的交易记录
- 日志详情页读取单条交易日志
- “我的”页读取用户邮箱、交易统计和 `user_preferences`
- 首页点击 AI 周报后，请求 `/api/weekly-report`，服务端调用 OpenAI 生成报告并保存到 `weekly_reports`

## 7. 权限边界

RLS 使用 `auth.uid() = user_id` 做隔离。前端即使请求其他用户的记录，也不会通过数据库权限校验。
