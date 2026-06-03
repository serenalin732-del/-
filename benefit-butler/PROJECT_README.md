# 薅卡管家 / Credit Card Butler

一个本地运行的信用卡福利管理原型，用来追踪高年费卡福利、还款提醒、积分来源和年度回本情况。

## 怎么打开

直接用浏览器打开：

`Credit Card Butler/index.html`

数据会保存在当前浏览器的 localStorage 里。第一版不需要服务器，也不需要账号。

## 已包含

- 添加自定义信用卡
- 常见卡模板：Amex Platinum、Amex Gold、Capital One Venture X、Chase Sapphire Reserve
- 添加和追踪福利使用进度
- 还款到期日和提前提醒天数
- 单张卡生成 `.ics` 日历提醒，可导入手机日历
- 积分记录、消费分类和截图上传入口
- 年度报告和历史快照
- Supabase 数据表、RLS、私有 Storage 策略草案：`supabase/schema.sql`
- Cloudflare + Supabase 隐私架构说明：`PRIVACY_ARCHITECTURE.md`

## 下一步适合做

- 接入手机推送 / 日历提醒
- 接入银行交易同步
- 接入 OCR 读取 statement 或截图
- 从官方资料更新卡片福利模板
- 多人家庭空间和权限

## 后端隐私文件

准备迁移到 Supabase 时，先阅读：

- `PRIVACY_ARCHITECTURE.md`
- `supabase/schema.sql`
- `SUPABASE_AUTH_REDIRECT.md`

默认设计是：用户数据表全部开启 RLS，上传文件进入 private bucket，不在前端放 service role key，不保存完整卡号或 CVV。

## 开启 Supabase 同步

1. 在 Supabase SQL editor 里运行 `supabase/schema.sql`。
2. 在 Supabase Storage 创建 private bucket：`private-documents`。
3. 打开 `supabase-config.js`，填入你的 Supabase Project URL 和 anon key。
4. 部署到 Cloudflare Pages，或本地打开 `index.html` 测试。
5. 页面右上角点“登录同步”，用邮箱和密码登录或注册。

前端只使用 anon key。`service_role`、Plaid secret、OCR/OpenAI key 都不要放进这个文件。
