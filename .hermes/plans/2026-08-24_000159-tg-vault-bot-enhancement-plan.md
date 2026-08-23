# TG Vault Bot 实用能力增强与 Web 缺陷修复实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在不破坏现有文件、任务、存储与恢复协议的前提下，先修复审查确认的正确性和部署基线问题，再把 Telegram Bot 扩展成可日常使用的“文件收件箱 + 任务中心 + 频道归档助手”，并补齐 Web 端关键逻辑、交互和可访问性缺陷。

**Architecture:** 保留现有 Express + PostgreSQL + GramJS + React 架构，继续以 PostgreSQL 作为持久任务、订阅、会话和对账事实源；将 Bot 的命令分发、会话状态、展示层和领域服务逐步拆开。所有会产生外部副作用的功能必须固化存储目标、持有租约、写入对账证据，并通过一次性确认执行危险操作。

**Tech Stack:** Node.js 20、TypeScript、Express 4、PostgreSQL、GramJS、React 19、Vite 7、Docker Compose、Nginx、node:test/tsx。

---

## 1. 审查基线

- 审查时间：2026-08-24（CST, UTC+08:00）
- 仓库：`/www/wwwroot/tg-vault`
- 审查基线：`main` / `6b2ee50a9e4aed7806f9720505dad5bd5eb60efb`
- 规模：315 个非依赖文件，约 32,362 行代码；TypeScript/TSX 为主。
- 当前工作树在审查前已有 10 个 `docs/superpowers/**` 文件处于删除状态；这是已有用户工作，本计划不得恢复、覆盖或顺带提交这些删除。
- 本轮只做审查和文档，不实现业务代码、不重启生产容器、不向 Telegram 发送测试消息。

### 1.1 已完成的无损验证

| 检查 | 真实结果 |
|---|---|
| Backend tests | `220 passed, 0 failed` |
| Backend typecheck | 通过 |
| Backend build | 通过，`dist/index.js` 约 909.7 KiB |
| Frontend tests | `68 passed, 0 failed` |
| Frontend lint | 通过 |
| Frontend build | 通过 |
| Compose config | `docker compose config --quiet` 通过 |
| 运行状态 | frontend/backend/postgres 均 healthy |
| HTTP 探针 | `/livez=200`、`/readyz=200`、前端根页面 `200` |
| 数据一致性抽查 | 当前无 pending Telegram/yt-dlp/chunk reconciliation |
| Backend npm audit | **失败：2 个 high transitive advisories** |
| Frontend npm audit | 0 vulnerabilities |

### 1.2 证据等级

- **已验证缺陷**：通过可重复命令、实际响应、哈希或确定性源码数据流证实。
- **静态高可信风险**：源码路径明确，但未在生产账号/有状态页面执行破坏性复现。
- **产品增强**：不是现有 bug，按用户价值和实现风险排期。

---

## 2. 当前 Telegram Bot 能力盘点

现有 Bot 已经不是简单上传脚本，具备较好的安全和持久任务基础：

1. **认证与安全**
   - `/start` PIN 键盘、允许用户列表、错误锁定、TOTP 2FA。
   - 已认证用户持久化至 `telegram_auth`。
   - 危险删除、任务取消、订阅取消有二次确认或一次性令牌。
2. **文件接收与归档**
   - 私聊/群聊发送文件、相册聚合、文件命名、自动目录规则。
   - `/p`、`/ps`、`/pc` 与 `/path_rules`。
   - 重复文件策略、临时磁盘水位、并发控制。
3. **任务中心**
   - `/tasks`、任务详情、暂停、继续、取消、失败重试。
   - 普通 Bot 任务、频道任务、yt-dlp 任务有统一展示适配层。
4. **频道/群组能力**
   - 按日期、标签抓取；可包含评论区文件。
   - 订阅同步、专属目录、订阅健康信息、恢复与游标控制。
5. **yt-dlp**
   - 单 URL 下载、持久队列、阶段进度、取消、重试和对账。
6. **存储**
   - 本地、OneDrive、Google Drive、S3、OSS、WebDAV。
   - `/storage`、`/storage_switch`、存储冷却与配额保护。

这些能力应被保留；后续增强不应重新发明任务队列、存储写入或确认协议。

---

## 3. 审查发现与优先级

### 3.1 优先级定义

- **P0**：可能把文件写到错误目标、造成安全边界错误，或当前发布基线不可证明；增加功能前必须解决。
- **P1**：明显影响日常正确性、Bot 可用性或关键交互；首个迭代解决。
- **P2**：重要体验、维护性和可访问性；主功能完成前解决。
- **P3**：优化项，可进入后续小版本。

### 3.2 Telegram Bot 已验证缺陷 / 风险

#### BOT-01 · P0 · 频道向导确认的存储快照会被当前全局目标覆盖

**证据：**

- `backend/src/services/telegramBot.ts:619-654` 在向导确认前记录 `targetProvider/targetAccountId`。
- `backend/src/services/telegramBot.ts:600-611` 将快照传入 enqueue options。
- `backend/src/services/telegramChannelJobs.ts:1458-1469`、`1497-1512` 把 options 放入 job params。
- 但 `backend/src/services/telegramChannelJobs.ts:631-637` 的 `createJob()` 先展开 params，再无条件用 `storageManager.getActiveTarget()` 覆盖 `storageProvider/storageAccountId`。
- 静态紧凑复现已确认“supplied target overwritten=true”。

**影响：** 用户在确认卡看到存储 A；如果确认期间系统默认被切换，持久任务可能实际锁定并写入 B。多用户或 Web/Bot 同时切换默认存储时风险更高。

**修复原则：** `createJob` 必须消费调用方提供的不可变 `StorageTargetSnapshot`，不得再次读取全局默认；仅没有明确快照的旧入口才在 admission 时获取一次默认值。

#### BOT-02 · P1 · 日期解析接受不存在的日期并自动滚动

**证据：**

- `backend/src/services/telegramBot.ts:350-352` 只验证 `YYYY-MM-DD` 形状。
- `backend/src/services/telegramChannelJobs.ts:612-628` 直接使用 `Date.UTC`，没有反向核对年月日。
- 实际执行：`2026-02-29 => 2026-03-01`，`2026-99-99 => 2034-06-07`。

**影响：** 用户输入错误日期时不会立刻收到错误，而可能扫描完全不同的时间段。

**修复原则：** 严格解析并把 UTC 年/月/日反向比较；校验开始日期不晚于结束日期；大范围扫描显示天数和二次确认。

#### BOT-03 · P1 · 频道向导仅按 userId 存状态，未绑定聊天

**证据：**

- `backend/src/services/telegramBot.ts:133` 使用 `Map<number, TelegramWizardState>`。
- `startTelegramWizard` / `handleTelegramWizardMessage` 以 `senderId` 读写，没有 chat key、起始消息或过期时间。

**影响：** 同一授权用户在私聊和群聊同时操作时，A 聊天启动的向导可被 B 聊天的普通文本推进；确认和反馈可能出现在错误会话。

**修复原则：** 状态 key 至少绑定 `userId + canonicalChatId`，并记录 origin message、创建时间、过期时间；新向导显式替换同聊天旧向导，不能覆盖另一聊天状态。

#### BOT-04 · P1 · Web 修改允许列表后，广播缓存未立即收敛

**证据：**

- `backend/src/routes/storage.ts:291-304` 只更新 `telegram_allowed_user_ids`。
- `backend/src/services/telegramState.ts:19` 的 `authenticatedUsers` 没有在该路由执行后统一重载/剔除。
- 普通命令在下一次 `isAuthenticatedAsync()` 时会安全撤销，但 `backend/src/services/telegramBot.ts:2020-2024` 的安全广播和 `1338-1344` 的清理通知直接遍历缓存。

**影响：** 已从允许列表移除、但尚未再次与 Bot 交互的用户仍可能收到登录安全通知或维护通知。

**修复原则：** 保存允许列表和认证缓存收敛应成为一个原子服务；广播收件人必须重新与当前 allowlist 求交集。

#### BOT-05 · P1 · Bot 初始化失败被吞掉，Web readiness 仍可能显示 ready

**证据：**

- `backend/src/services/telegramBot.ts:2008-2010` 捕获启动异常后仅记录日志，不向调用方抛出。
- `backend/src/index.ts:187-193` 等待 `initTelegramBot()` 后直接把应用标记 ready。

**影响：** Telegram 凭证已配置但失效时，Web/API 健康，Bot 实际不可用；监控无法区分“Bot 未启用”和“Bot 配置失败”。

**修复原则：** 输出结构化 Bot component health；新增 `TELEGRAM_REQUIRED` 策略。required 时初始化失败阻止 readiness；optional 时 Web 可运行，但 `/readyz`/管理页必须明确标记 degraded 和恢复动作。

#### BOT-06 · P2 · “更多能力”固定截断 12 项，10 个命令不可达

**证据：**

- `backend/src/services/telegramBot.ts:52-58` 使用 `visible.slice(0, 12)`，无分页。
- 当前 registry 中可展示 22 项；实测隐藏：`task_resume`、`task_cancel`、`tg_retry`、`stop_tasks`、`download_workers`、`file_concurrency`、`duplicate_mode`、`cleanup_settings`、`tg_subs`、`tg_unsub`。

**影响：** 首页宣称“更多能力”，但近半功能只能知道命令后手工输入。

**修复原则：** 按“文件 / 任务 / 频道 / 设置 / 安全”分组或分页；按钮应直接打开对应面板，而不是只回复“请发送命令”。

#### BOT-07 · P2 · 临时会话 Map 缺少统一 TTL/清理

**证据：**

- `telegramWizardStates`、`passwordInputState`、`userStates`、若干 pending confirmation Map 分散在 `telegramBot.ts`、`telegramCommands.ts`。
- 部分确认有 TTL，但向导/PIN/2FA 输入状态没有统一过期策略。

**影响：** 长期运行后可能保留僵尸交互；用户数和失败操作多时产生内存与误路由风险。

**修复原则：** 建立一个有 TTL、作用域和容量上限的 interaction store；所有交互都必须可取消、可过期、可在重启后明确失效。

### 3.3 Web 已验证缺陷 / 风险

#### WEB-01 · P1 · 重命名失败仍调用浏览器原生 alert，现有测试漏检

**证据：**

- `frontend/src/App.tsx:849-883` 两处使用裸 `alert(...)`。
- `frontend/src/services/nativeDialogContract.test.ts:17` 只匹配 `window.alert/window.confirm/window.prompt`。
- 静态紧凑检查对 `App.tsx` 返回 FAIL。

**影响：** 与产品对话框风格不一致、不可控制焦点/本地化；测试名称声称覆盖全部产品流程但实际是假阳性。

#### WEB-02 · P1 · 频道任务 stage 把 `done` 误判为 `scanning`

**证据：**

- `backend/src/services/telegramChannelJobs.ts` 使用 `scan_status='done'`。
- `backend/src/routes/tasks.ts:103` 却判断 `row.scan_status !== 'completed' ? 'scanning' : 'downloading'`。

**影响：** Web 任务中心可显示“已完成 + 扫描消息”的矛盾状态。

**修复原则：** 建立共享的 channel job → unified task mapper，集中映射 `pending/scanning/done/cancelled`，由 Bot 和 Web 共用纯函数测试。

#### WEB-03 · P2 · 搜索变化可能触发两条重复列表请求

**证据：**

- `frontend/src/App.tsx:278-331` 的 `loadFiles` 随 query options 改变。
- `390-397` 和 `399-404` 两个 effect 都依赖 `loadFiles` 并调用它。
- `LatestRequest` 会中止旧 generation，因此一般不提交旧数据，但仍产生重复请求、loading 抖动和数据库压力。

**修复原则：** 合并为一个数据加载 effect；搜索输入做 200–300 ms debounce；刷新使用独立 generation，不通过重复 effect 触发。

#### WEB-04 · P2 · 预览内下载失败只写 console，用户无反馈

**证据：**

- `frontend/src/components/ui/PreviewModal.tsx:49-54`、`249-256` 捕获下载错误后只 `console.error`。

**影响：** 点击下载无反应时用户无法知道是登录过期、云盘限额、源文件删除还是浏览器阻止。

**修复原则：** 复用统一通知组件和媒体状态分类；保留重试、复制错误 ID/请求 ID。

#### WEB-05 · P2 · 模态框焦点和语义不统一

**证据：**

- `PreviewModal` 主覆盖层没有 `role="dialog"/aria-modal`，只有内层详情卡具备语义。
- 顶部“查看原始文件 / 下载 / 关闭”部分图标按钮缺少一致 `aria-label`。
- `ConfirmDialog`、`CreateFolderModal`、`RenameModal`、`TasksPage` 内联对话框没有统一焦点陷阱、Escape、焦点归还和异步提交锁。
- `frontend/index.html:2` 固定 `lang="en"`，运行语言切换没有同步 document language。

**修复原则：** 建立一个共享 Dialog primitive，并以键盘/屏幕阅读器 E2E 验收。

### 3.4 部署、依赖与交付问题

#### OPS-01 · P0 · 当前运行前端与当前源码构建不一致

**证据：**

- 当前运行容器引用 `/assets/index-4Hc25KGO.js`。
- 当前源码构建输出 `/assets/index-CNfpF-0L.js`。
- 容器 `index.html` 与本机构建 `index.html` SHA-256 不同。
- Backend 运行 bundle 与本次本地 build 哈希一致，但镜像仍标记 `tg-vault-backend:v2.0.0`，包内版本为 `2.0.1`。

**影响：** 直接在生产页面验证源码修复会得到错误结论；回滚与审计无法只凭镜像标签判断实际代码。

#### OPS-02 · P1 · Backend 本地质量门当前被 2 个 high 依赖告警阻断

- `ip-address@10.2.0`：多项 SSRF / special-use address classification advisory。
- `brace-expansion@2.1.2`：DoS advisory。
- 路径分别来自 `express-rate-limit`/`telegram`/`socks` 和 `webdav`/`minimatch`。

必须升级 lockfile 并运行网络安全回归，而不是简单忽略 audit。

#### OPS-03 · P1 · `deploy/install.sh` 生成的 `.env` 缺少 Compose 必填项

**证据：**

- `deploy/install.sh:16-24` 未写 `IMAGE_VERSION`、`OAUTH_CALLBACK_BASE_URL`、`OAUTH_FRONTEND_ORIGIN`。
- `docker-compose.yml:6,38` 要求 `IMAGE_VERSION` 必须存在。

**影响：** 新用户按脚本编辑域名后再次运行，可能在 `docker compose config` 直接失败；OAuth 配置也不完整。

#### OPS-04 · P2 · 首装 SQL 与运行时 schema 双源漂移

- 根 `init.sql` 只有 4 张基础表（88 行）。
- `backend/src/db/schema.sql` 有 19 张业务表及大量 `ALTER`（498 行）。
- 实际升级依赖 Backend 启动时执行后者。

现状可运行，但迁移来源不清晰，增加新 Bot 表时容易只改一边。

---

## 4. 目标产品形态

### 4.1 Bot 首页

首页不是“命令大全”，而是 6 个直接可操作入口：

1. **上传与保存位置**
2. **文件浏览 / 搜索**
3. **任务中心**
4. **频道归档 / 订阅**
5. **链接下载**
6. **存储与系统状态**

所有二级页面都提供“返回首页、刷新、取消当前向导”，不要求用户记忆命令。

### 4.2 最有价值的新增能力

| 优先级 | 功能 | 用户价值 |
|---|---|---|
| P1 | 每聊天/每会话存储目标 | 不再为一次上传改全局默认；避免多人互相影响 |
| P1 | `/find` 文件搜索与操作卡 | 在 Telegram 内按名字、类型、目录、时间找到文件并复制 ID、分享、收藏、移动、删除 |
| P1 | 可操作上传回执 | 成功后显示目标、目录、文件 ID；提供“查看文件、复制 ID、删除、重试失败项” |
| P1 | Bot `/status` 诊断面板 | 一眼看到 Bot、用户账号下载器、数据库、当前存储、配额、磁盘、队列、订阅健康 |
| P1 | 订阅运行中心 | 立即同步、暂停/恢复、从现在/上次游标/指定日期补抓、固定目标、失败提醒 |
| P2 | 智能链接下载向导 | 直接粘贴 URL 后预览标题、质量、音频/视频、目标目录，再确认提交 |
| P2 | 通知偏好与安静时段 | 避免批量任务刷屏；失败即时提醒、成功可汇总 |
| P2 | 用户/聊天偏好 | 语言、时区、默认目录、默认目标、通知方式按用户或聊天隔离 |
| P3 | playlist/range 下载 | 对播放列表选择范围、最大条目和预算，避免误下载整个列表 |

---

## 5. 实施阶段

## Phase 0 — 建立可证明的发布基线（先做，预计 1–2 个工程日）

### Task 0.1：隔离当前工作树

**Files:** 无业务文件修改。

1. 记录 `git status --short --branch`。
2. 不恢复现有 10 个删除文件。
3. 推荐在独立 worktree/分支开发，或先由仓库所有者决定这些删除是否属于下一提交。
4. 保存当前生产镜像 ID、数据库/文件卷备份和 Compose 配置快照。

**验收：** 新分支只包含计划内改动；`git diff --name-status` 不混入旧文档删除。

### Task 0.2：修复依赖质量门

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Test: `backend/src/utils/networkSecurity.test.ts`（如需新增）
- Test: `backend/src/services/webdavTimeout.test.ts`

1. 在临时分支执行 `npm audit fix --package-lock-only` 或精确升级上游包。
2. 明确解析 `ip-address` 与 `brace-expansion` 的最终版本和依赖路径。
3. 加强 `assertPublicHttpUrl/assertPublicStorageEndpoint` 对 IPv4 leading zero、CIDR suffix、IPv4-mapped IPv6、NAT64、重绑定结果的测试。
4. 运行全量 backend tests/typecheck/build/audit。

**验收：** `npm audit --omit=dev --audit-level=high` 退出 0；网络边界测试通过。

### Task 0.3：让构建产物可追溯

**Files:**
- Modify: `deploy/install.sh`
- Modify: `deploy/DEPLOY.md`
- Modify: `docker-compose.yml`（只在需要时）
- Test: `backend/src/services/reproducibleBuildContract.test.ts`

1. 安装脚本生成完整必填配置：`IMAGE_VERSION`、OAuth origins。
2. 本地/CI build 必须显式传 `SOURCE_REVISION` 和 `SOURCE_VERSION`。
3. 发布标签、包版本、OCI label 三者一致。
4. 部署后比较运行容器与预期前端入口 asset、backend bundle revision。

**验收：** `docker inspect` 能得到真实 commit/version；运行页面加载的新 asset 与 staging build 一致。

---

## Phase 1 — Bot 正确性与安全边界（预计 3–5 个工程日）

### Task 1.1：修复频道任务存储目标快照

**Files:**
- Modify: `backend/src/services/telegramChannelJobs.ts:631-655, 1449-1514`
- Modify: `backend/src/services/telegramBot.ts:591-654`
- Test: `backend/src/services/telegramBatchConfirmation.test.ts`
- Test: `backend/src/services/storageTargetSnapshot.test.ts`

**接口建议：**

```ts
async function createJob(input: {
  userId: number;
  chatId?: string;
  kind: string;
  source: string;
  params: Record<string, unknown>;
  target: StorageTargetSnapshot;
}): Promise<string>
```

**TDD 步骤：**

1. 写失败测试：向导快照为 account A；在 create 前把 active target 切到 B；断言持久 job 仍为 A，锁也作用于 A。
2. 运行 focused test，确认 RED。
3. 删除 `createJob()` 内第二次读取 active target 的行为。
4. 对 direct command 入口在 admission 点显式捕获一次 target。
5. 对恢复路径断言只读取持久 params，不读取当前默认。
6. 全量测试。

**验收：** 确认卡目标、job params、operation lease、文件 `storage_account_id` 四者一致。

### Task 1.2：严格日期与范围校验

**Files:**
- Modify: `backend/src/services/telegramChannelJobs.ts:612-629`
- Modify: `backend/src/services/telegramBot.ts:326-347, 631-654`
- Create/Test: `backend/src/services/telegramDateRange.test.ts`

1. `parseDateOnly` 校验 round-trip 年月日。
2. 拒绝不存在日期、结束早于开始、空范围。
3. 在确认卡显示总天数；超过建议阈值显示风险提示。
4. direct command 与向导共用同一个 parser。

**验收样例：**
- `2026-02-29` → 拒绝。
- `2024-02-29` → 接受。
- `2026-99-99` → 拒绝。
- 结束早于开始 → 拒绝，不创建 job。

### Task 1.3：建立 chat-bound interaction store

**Files:**
- Create: `backend/src/services/telegramInteractionState.ts`
- Create/Test: `backend/src/services/telegramInteractionState.test.ts`
- Modify: `backend/src/services/telegramBot.ts`
- Modify: `backend/src/services/telegramCommands.ts`

**状态至少包含：** `userId`、`chatKey`、`kind`、`step`、`originMessageId`、`createdAt`、`expiresAt`。

1. 先迁移频道下载/订阅向导。
2. 再迁移 PIN、TOTP 和路径输入提示。
3. 默认 TTL 15 分钟；容量有上限；定期清理。
4. 所有向导支持“取消”和“重新开始”；过期时给明确提示。
5. callback 必须绑定用户、聊天、消息和动作。

**验收：** A 聊天的文本不能推进 B 聊天状态；重启后旧按钮返回“已失效，请重新打开”，不静默失败。

### Task 1.4：允许列表、认证缓存与广播收敛

**Files:**
- Modify: `backend/src/utils/authSettings.ts`
- Modify: `backend/src/services/telegramState.ts`
- Modify: `backend/src/routes/storage.ts:291-309`
- Modify: `backend/src/services/telegramBot.ts:2013-2027`
- Test: `backend/src/services/telegramAuthAllowlist.test.ts`

1. 创建 `setTelegramAllowedUsersAndReconcile()`。
2. 写入 allowlist 后立即从 cache/DB auth 中剔除移除用户。
3. 广播前重新读取有效收件人交集。
4. Web 返回 added/removed/revoked 数量，并提示移除立即生效。
5. 增加 Bot `/logout` 或“撤销本设备 Bot 认证”。

**验收：** 被移除用户不能执行命令，也不再收到安全/维护广播。

### Task 1.5：Bot component health 与可观测性

**Files:**
- Create: `backend/src/services/telegramBotStatus.ts`
- Modify: `backend/src/services/telegramBot.ts`
- Modify: `backend/src/index.ts:179-193`
- Modify: `backend/src/routes/storage.ts`
- Modify: `.env.example`, `docker-compose.yml`
- Test: `backend/src/services/telegramUserClientStatus.test.ts`
- Create/Test: `backend/src/services/telegramBotReadiness.test.ts`

1. 状态：`not_configured/starting/ready/reconnecting/auth_failed/error/stopped`。
2. 记录 `checkedAt/lastConnectedAt/lastError/action`，不包含 token/session。
3. 增加 `TELEGRAM_REQUIRED`；required 时失败阻止 ready，optional 时暴露 degraded。
4. `/status` 和 Web Telegram 设置页消费同一状态。
5. 把 TIMEOUT/reconnect 转为计数和最近恢复时间，不刷大量原始日志。

**验收：** 配置错误不会显示“Bot ready”；临时重连恢复后状态自动回 ready。

---

## Phase 2 — Bot 实用功能第一批（预计 5–8 个工程日）

### Task 2.1：命令 dispatcher 与可分页首页

**Files:**
- Modify: `backend/src/utils/telegramCommandRegistry.ts`
- Create: `backend/src/services/telegramCommandDispatcher.ts`
- Create/Test: `backend/src/services/telegramCommandDispatcher.test.ts`
- Modify: `backend/src/services/telegramBot.ts`

1. registry 增加 handler key、权限、feature requirement、菜单分组。
2. dispatcher 统一 alias、认证、限流、错误消息和 tracing。
3. 首页按类别展示，支持翻页；不再 `slice(0,12)`。
4. 按钮直接调用面板 handler，而非回复“请发送 /xxx”。
5. 保持所有旧命令 alias 兼容。

**验收：** registry 中所有 `help=true` 的命令均可从首页在不记命令的情况下到达；callback data < 64 bytes。

### Task 2.2：每聊天/下一次存储目标

**Files:**
- Create: `backend/src/utils/telegramTargetStateStore.ts`
- Create/Test: `backend/src/utils/telegramTargetStateStore.test.ts`
- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/services/telegramCommands.ts`
- Modify: `backend/src/services/telegramUpload.ts`
- Modify: `backend/src/services/ytDlpDownload.ts`
- Modify: `backend/src/services/telegramChannelJobs.ts`

**命令/面板：** `/target`、下一次、当前聊天持续、清除、管理员全局默认。

**核心规则：**

- “下一次”必须像 `/p` 一样原子消费。
- 普通文件、相册、频道任务、yt-dlp 在 admission 时固化同一个 target snapshot。
- 切换全局默认只影响没有 chat override 的后续任务。
- 删除存储账户前检查 target state 引用。

**验收：** 两个聊天可同时使用不同账户；切换全局默认不改变已排队任务。

### Task 2.3：Telegram 文件浏览 / 搜索 / 操作卡

**Files:**
- Refactor/Create: `backend/src/services/fileReadModel.ts`
- Modify: `backend/src/services/fileQuery.ts`
- Create: `backend/src/services/telegramFileBrowser.ts`
- Create/Test: `backend/src/services/telegramFileBrowser.test.ts`
- Modify: `backend/src/utils/telegramCommandRegistry.ts`

**功能：**

- `/find <关键词>`、按类型、收藏、目录、日期筛选。
- keyset 分页，不使用无限 OFFSET。
- 详情卡：名称、大小、来源、目录、创建时间、短 ID。
- 操作：复制 ID、收藏/取消、生成 Web/签名链接、移动/重命名、删除确认。
- 所有 provider capability 由后端 contract 决定。

**验收：** 201+ 文件分页无重复/遗漏；每个危险操作绑定 actor/chat/message/object/TTL。

### Task 2.4：可操作上传回执

**Files:**
- Modify: `backend/src/utils/telegramMessages.ts`
- Modify: `backend/src/services/telegramUpload.ts`
- Modify: `backend/src/services/telegramTaskCenter.ts`
- Test: `backend/src/services/telegramProgressPresentation.test.ts`

1. 入队后 1 秒内给单一状态卡。
2. 成功回执显示实际存储、目录、文件 ID、duplicate outcome。
3. 批量任务只编辑一张卡，失败项可“重试失败 / 查看失败明细”。
4. 提供“搜索同目录、复制 ID、删除该文件”快捷按钮。
5. 9+ 文件继续静默模式，不刷屏。

**验收：** 用户无需打开日志即可知道文件是否保存、保存到哪里、失败后做什么。

### Task 2.5：Bot `/status` 诊断面板

**Files:**
- Create: `backend/src/services/telegramStatusPanel.ts`
- Modify: `backend/src/services/telegramCommands.ts`
- Modify: `backend/src/utils/telegramCommandRegistry.ts`
- Test: `backend/src/services/telegramStatusPanel.test.ts`

显示：Bot 连接、账号级下载器、当前 target、远端 probe/cooldown、临时磁盘、队列、失败任务、订阅最近扫描、待对账数量。

**安全：** 不显示绝对路径、凭证、token、完整 provider error；提供 request/operation ID。

---

## Phase 3 — Bot 实用功能第二批（预计 5–8 个工程日）

### Task 3.1：智能 yt-dlp 向导

**Files:**
- Modify: `backend/src/services/ytDlpDownload.ts`
- Create: `backend/src/services/ytDlpProbe.ts`
- Create/Test: `backend/src/services/ytDlpProbe.test.ts`
- Modify: `backend/src/services/telegramBot.ts`

1. 普通粘贴单一公网 URL 时提示“作为链接下载”，不自动执行。
2. 用受限 `yt-dlp --dump-single-json --skip-download` 预取标题/时长/站点；设置超时、输出上限和 AbortSignal。
3. 选项：最佳视频、音频、目标目录、target snapshot。
4. playlist 默认拒绝；用户明确开启后要求范围和最大条目。
5. Cookie 只能在 Web 端加密配置，绝不通过聊天文本输入或回显。
6. 继续保留 `--` 参数边界、SSRF 校验、持久执行 generation/lease。

**验收：** 无确认不下载；超大播放列表不能误触；取消可终止子进程并清理目录。

### Task 3.2：订阅运行中心

**Files:**
- Modify: `backend/src/services/telegramChannelJobs.ts`
- Modify: `backend/src/services/telegramSubscriptionManagement.ts`
- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/services/telegramBot.ts`
- Test: `backend/src/services/telegramSubscriptionManagement.test.ts`

新增：立即同步、暂停、恢复、修改 target、从现在开始、按日期补抓、查看最近结果、失败项重试。

订阅 target 必须有明确模式：

- `follow_global`：每次扫描 admission 时快照当前默认。
- `fixed`：固定 provider/account，删除账户时阻止或要求迁移。

**验收：** 每个订阅能回答“上次何时成功、下次何时扫描、为什么暂停、文件写到哪里”。

### Task 3.3：通知偏好、安静时段与摘要

**Files:**
- Create: `backend/src/services/telegramNotificationPreferences.ts`
- Create/Test: `backend/src/services/telegramNotificationPreferences.test.ts`
- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/services/telegramBot.ts`

支持按用户/聊天设置：失败即时、成功即时/摘要、安全通知、订阅摘要、时区、quiet hours。

**验收：** 安全告警不被静音；普通成功消息按策略汇总；跨时区测试使用固定时钟。

---

## Phase 4 — Web 逻辑与交互修复（预计 3–5 个工程日）

### Task 4.1：消除原生对话框与测试盲点

**Files:**
- Modify: `frontend/src/App.tsx:849-883`
- Modify: `frontend/src/services/nativeDialogContract.test.ts`
- Modify: `frontend/src/components/ui/RenameModal.tsx`

1. 使用 Notification/产品 Dialog 显示重命名错误。
2. 测试同时拒绝 `alert(`、`window.alert(`、`globalThis.alert(` 及 confirm/prompt。
3. 重命名提交期间禁用按钮，错误保留输入与焦点。

### Task 4.2：统一任务状态 mapper

**Files:**
- Create: `backend/src/services/unifiedTaskMapper.ts`
- Create/Test: `backend/src/services/unifiedTaskMapper.test.ts`
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/services/telegramTaskCenter.ts`

验收 `scan_status=done` 不显示 scanning；API 的 `total` 表示真实过滤总数，另提供 `returned` 或分页游标。

### Task 4.3：合并列表请求与搜索 debounce

**Files:**
- Create: `frontend/src/hooks/useFileQuery.ts`
- Modify: `frontend/src/App.tsx:194-404`
- Test: `frontend/src/services/latestRequest.test.ts`
- Create/Test: `frontend/src/services/fileQueryEffect.test.ts`

**验收：** 每次 settled query 只产生一组 files + aggregation 请求；快速输入只提交最后查询；刷新不重置当前列表直到新结果成功。

### Task 4.4：统一用户可见错误

**Files:**
- Modify: `frontend/src/components/ui/PreviewModal.tsx`
- Modify: `frontend/src/components/ui/FileCard.tsx`
- Modify: `frontend/src/services/api.ts`

下载、复制、打开原文件、分享失败都显示可操作通知；401 统一退出，429 显示 retry time，410 显示源已删除，503 显示稍后重试和 request ID。

### Task 4.5：共享 Dialog 与可访问性

**Files:**
- Create: `frontend/src/components/ui/Dialog.tsx`
- Modify: `ConfirmDialog.tsx`, `CreateFolderModal.tsx`, `RenameModal.tsx`, `MoveModal.tsx`, `PreviewModal.tsx`, `TasksPage.tsx`, `SettingsPage.tsx`
- Modify: `frontend/src/i18n.ts`
- Test: component/E2E accessibility tests

**验收：**

- Tab 不离开 dialog；Escape 关闭允许关闭的 dialog；关闭后焦点回到触发器。
- icon button 有 accessible name。
- `document.documentElement.lang` 随语言切换。
- `prefers-reduced-motion` 生效。
- 移动端 360px 无横向裁切。

---

## Phase 5 — 结构收敛与发布（预计 2–3 个工程日）

### Task 5.1：拆分超大模块但不重写领域协议

建议目标：

```text
backend/src/bot/
├── connection.ts
├── dispatcher.ts
├── context.ts
├── interactions.ts
├── callbacks/
├── commands/
│   ├── home.ts
│   ├── files.ts
│   ├── tasks.ts
│   ├── channels.ts
│   ├── storage.ts
│   └── security.ts
└── presentation/
```

- `telegramUpload.ts` 保留下载/存储领域逻辑，逐步抽出 presentation 和 in-memory tracking。
- `telegramChannelJobs.ts` 保留持久 job/lease/cursor 协议，抽出纯 mapper 和扫描器。
- 每次仅移动一个边界并保持 tests green；禁止一次大爆炸重写。

### Task 5.2：迁移单一来源

1. 新增版本化 migration ledger（例如 `schema_migrations`）。
2. `init.sql` 只负责调用/镜像 canonical schema，或从构建时同一源生成。
3. 所有 migration 使用 expand → backfill → contract；旧镜像至少能读取新 schema。
4. migrations 在 staging 的生产备份副本上演练。

### Task 5.3：发布候选验证

必须全部通过：

```bash
cd backend
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run build

cd ../frontend
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run lint
npm run build

cd ..
docker compose config --quiet
bash deploy/backup-restore.test.sh
python3 backend/scripts/verify_db_optimizations.py
python3 backend/scripts/verify_private_invite_support.py
python3 backend/scripts/verify_telegram_task_queue_status.py
```

发布前还要在**独立测试 Bot token、测试 Telegram 账号、隔离数据库/卷**上跑手工 smoke，不能让 staging 和生产同时使用同一个 Bot token/session。

---

## 6. 验收矩阵

| 场景 | 预期 |
|---|---|
| 确认频道任务后切换全局存储 | 任务仍写入确认卡显示的目标 |
| 两个聊天同时启动不同向导 | 状态互不推进/覆盖 |
| 输入 2026-99-99 | 立即拒绝，不创建任务 |
| 从 Web allowlist 移除用户 | 命令立即拒绝，广播也不再发送 |
| Bot token 无效且 required | `/readyz=503`，给恢复动作 |
| Bot optional 且连接失败 | Web 可用，但状态明确 degraded |
| “更多能力”页面 | 22 项都可到达，不截断 |
| 单聊设置 target A、群聊 target B | 并行任务分别写入 A/B |
| 搜索 201+ 文件 | keyset 分页无重复/遗漏 |
| 相册 20 项，3 项失败 | 一张状态卡；可只重试 3 项 |
| yt-dlp 粘贴 playlist | 默认只预览并要求范围，不自动全量下载 |
| Web 快速输入 10 个字符 | 只提交最后稳定 query；无旧数据覆盖 |
| 频道 job `scan_status=done` | Web 不显示“扫描中” |
| 键盘操作所有 modal | 焦点受控、Escape/返回一致 |
| Backend 重启 | 持久频道/yt-dlp 恢复；普通 in-memory 任务明确标 interrupted |
| 写入后 DB 失败 | 有 reconciliation 证据，不宣称成功 |

---

## 7. 风险与取舍

1. **不要把所有普通 Bot 上传立刻改成完全数据库队列。** 先保留现有 transfer snapshot + in-memory execution，避免一次性重写高风险下载路径。
2. **不要让 per-chat target 复用全局 `storageManager.switchAccount()`。** override 是 admission 输入，不是修改系统默认。
3. **不要为了“人性化”发送更多消息。** 默认编辑一张状态卡，批量成功做摘要，失败才突出提醒。
4. **不要在 Telegram 收 Cookie、密码或云盘凭证。** 敏感配置只经 Web、加密存储并有审计。
5. **不要仅依赖静态正则测试。** 对 dispatcher、mapper、state store 写纯行为测试；对 Web 关键旅程增加真实浏览器 E2E。
6. **不要用同一个 Telegram Bot token 做蓝绿双实例。** 没有 update ownership 设计前，只允许单 active Bot consumer。

---

## 8. 产品决策（建议默认值）

| 问题 | 建议默认 |
|---|---|
| Bot 是否只支持单一管理员 | 保留单 Web 管理员，但允许多 Telegram 用户；新增 admin/member 角色后再开放全局设置 |
| 群聊是否允许向导 | 允许，但必须 chat-bound；危险操作只允许发起者完成 |
| 存储选择作用域 | 默认“当前聊天会话”，管理员可显式修改系统默认 |
| 订阅 target | 默认 follow-global；用户可改 fixed，并在确认卡明确展示 |
| Bot readiness | 生产 Telegram 部署设 `TELEGRAM_REQUIRED=true` |
| 2FA | 短期保留全局 TOTP；多用户正式化时迁移为每用户 TOTP/设备凭据 |
| 成功通知 | 单文件即时，批量/订阅摘要；失败即时 |
| playlist | 默认禁用；明确确认范围和最大条目后启用 |

---

## 9. 完成定义

“完成”不是代码合并，而是同时满足：

- 所有 P0/P1 缺陷有回归测试并修复。
- 新功能从 Bot 首页可发现，不要求阅读 README 才会用。
- 存储目标、权限、危险确认、租约、对账不变量不退化。
- Backend/Frontend tests、lint、typecheck、build、audit 全绿。
- 独立 staging Bot 完成验收矩阵。
- 有一致备份、显式镜像版本、source revision 和经过演练的回滚步骤。
- 生产部署后验证运行前端 asset、backend image label、`/readyz`、Bot `/status` 与关键命令。
