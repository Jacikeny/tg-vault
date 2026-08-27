## TG Vault v2.2.0

本版本新增 OpenList 原生存储接入与版本更新提醒，并集中修复文件浏览、存储切换、OAuth、任务中心和移动端交互中的一致性问题。

### 新功能

- 新增 OpenList 原生存储提供商：可在 TG Vault 内配置地址、根目录、用户名和密码，支持连接测试、上传、下载、预览、范围请求和删除。
- 新增版本检查：设置页可手动检查 GitHub 最新稳定版，检测到新版本时在 Web 端展示提醒，并向符合条件的已认证 Telegram 用户发送一次通知。
- 存储账户能力现在可准确控制上传、分享和删除等界面操作，避免对只读存储显示不可执行动作。

### 修复与改进

- 修复文件排序与游标分页不一致、加载更多竞态、搜索快照过期、收藏夹过滤和手动刷新残留旧状态等问题。
- 修复文件夹重命名/移动后的 URL 路由同步，以及文件移动完成后列表未按服务端状态刷新的问题。
- 修复切换存储账户时配置与容量统计不同步，并在上传前锁定目标账户，避免传到错误存储。
- 修复 OAuth 弹窗关闭、超时和消息校验流程；加强公网请求的 DNS、重定向和 SSRF 防护。
- 改进任务轮询串行化、任务快速筛选及按账户清理任务的准确性。
- 改进移动端和键盘操作、对话框异步失败反馈、上传失败原因展示及中英文界面一致性。
- 修复构建产物数据库 schema 同步，确保源码、初始化脚本与发布镜像一致。
- `.env.example` 不再包含 `IMAGE_VERSION`、`SOURCE_VERSION`、`SOURCE_REVISION`。应用版本统一从 `backend/package.json` 读取，Git 修订号在部署时读取，构建元数据只临时传给 Docker，不再持久化到 `.env`。
- `deploy/install.sh` 升级旧部署时会清理遗留版本字段，避免旧 `.env` 覆盖新版本；同时只重建和替换前后端，不重建 PostgreSQL。

### 升级

```bash
git fetch origin
git pull --ff-only origin main
./deploy/install.sh
```

升级前建议备份 PostgreSQL 和完整 `file-storage` 卷。

### 完整变更

[v2.1.1...v2.2.0](https://github.com/hicocos/tg-vault/compare/v2.1.1...v2.2.0)
