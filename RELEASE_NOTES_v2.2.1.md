## TG Vault v2.2.1

本版本集中修复 HTTP 部署、分片续传、Web 密码变更与安装脚本兼容性问题。

### 修复与改进

- 修复 HTTP 来源不提供 Web Crypto `subtle` 时，分片上传无法计算 SHA-256、导致上传或续传失败的问题；新增纯前端 SHA-256 回退实现，并保留 HTTPS 环境下的原生 Web Crypto 路径。
- 加强分片续传身份校验：恢复上传前逐块核对已上传内容哈希，避免同名同大小但内容不同的文件错误复用旧会话。
- 修复启用加密设置存储后修改 Web 管理密码失败的问题；密码读取和写入现在均正确经过加解密，并在事务中撤销现有 Web 会话。
- 改进安装脚本对受限环境的兼容性，不再依赖 `node` 或 `openssl`，统一使用 Python 读取版本和生成安全随机密钥。
- 补充正式部署的 Cookie 安全开关及回归测试，避免遗留环境变量意外削弱 HTTPS Cookie 策略。

### 升级

```bash
git fetch origin
git pull --ff-only origin main
./deploy/install.sh
```

升级前建议备份 PostgreSQL 和完整 `file-storage` 卷。

### 完整变更

[v2.2.0...v2.2.1](https://github.com/hicocos/tg-vault/compare/v2.2.0...v2.2.1)