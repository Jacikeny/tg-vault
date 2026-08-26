#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。请先按 https://docs.docker.com/engine/install/ 安装 Docker Engine 与 Compose 插件。" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "未找到 openssl；无法安全生成数据库和应用密钥。" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3；安装向导无法校验 URL 或安全更新 .env。" >&2
  exit 1
fi

if [[ ! -f docker-compose.yml ]]; then
  echo "请从包含 docker-compose.yml 的项目目录运行 deploy/install.sh。" >&2
  exit 1
fi

NON_INTERACTIVE=false
case "${1:-}" in
  "") ;;
  --non-interactive) NON_INTERACTIVE=true ;;
  -h|--help)
    cat <<'EOF'
用法：./deploy/install.sh [--non-interactive]

默认在终端中交互询问 Web 前端 URL 和后端 API URL。
--non-interactive  从现有 .env 或同名环境变量读取配置，不等待输入。
EOF
    exit 0
    ;;
  *)
    echo "未知参数：$1；使用 --help 查看用法。" >&2
    exit 2
    ;;
esac

if [[ "$NON_INTERACTIVE" == false && ! -t 0 ]]; then
  echo "当前没有交互式终端；请在终端中运行，或使用 --non-interactive。" >&2
  exit 2
fi

normalize_origin() {
  python3 - "$1" <<'PY'
from urllib.parse import urlsplit
import sys
value = sys.argv[1].strip()
parsed = urlsplit(value)
if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
    raise SystemExit(1)
print(f'{parsed.scheme}://{parsed.netloc}')
PY
}

prompt_origin() {
  local label="$1"
  local example="$2"
  local current="$3"
  local entered normalized
  while true; do
    echo >&2
    echo "$label" >&2
    if [[ -n "$current" && "$current" != *example.com* ]]; then
      echo "当前值：$current" >&2
      printf '直接按 Enter 保留当前值：' >&2
    else
      echo "示例：$example" >&2
      printf '> ' >&2
    fi
    IFS= read -r entered
    entered="${entered:-$current}"
    if normalized="$(normalize_origin "$entered")"; then
      printf '%s' "$normalized"
      return 0
    fi
    echo "地址无效。请输入完整的 http(s) origin，不能包含路径、查询参数或片段。" >&2
  done
}

confirm_install() {
  local choice
  while true; do
    echo
    echo "配置确认"
    echo "Web 前端 URL：$CORS_ORIGIN_VALUE"
    echo "后端 API URL：$VITE_API_URL_VALUE"
    echo
    printf '按 Enter 保存配置并开始安装，输入 e 重新编辑，输入 q 退出：'
    IFS= read -r choice
    case "${choice,,}" in
      "") return 0 ;;
      e) return 1 ;;
      q) echo "已取消，未保存配置或启动服务。"; exit 0 ;;
      *) echo "请输入 Enter、e 或 q。" >&2 ;;
    esac
  done
}

upsert_env() {
  local key="$1"
  local value="$2"
  local temp
  temp="$(mktemp)"
  python3 - "$key" "$value" .env "$temp" <<'PY'
from pathlib import Path
import sys
key, value, source, target = sys.argv[1:]
path = Path(source)
lines = path.read_text().splitlines() if path.exists() else []
replacement = f'{key}={value}'
updated = []
found = False
for line in lines:
    if line.startswith(f'{key}='):
        if not found:
            updated.append(replacement)
            found = True
        continue
    updated.append(line)
if not found:
    updated.append(replacement)
Path(target).write_text('\n'.join(updated) + '\n')
PY
  chmod 600 "$temp"
  mv "$temp" .env
}

read_env() {
  local key="$1"
  python3 - "$key" .env <<'PY'
from pathlib import Path
import sys
key = sys.argv[1]
for line in Path(sys.argv[2]).read_text().splitlines():
    if line.startswith(f'{key}='):
        print(line.split('=', 1)[1], end='')
        break
PY
}

ensure_generated_secret() {
  local key="$1"
  if [[ -z "$(read_env "$key")" ]]; then
    upsert_env "$key" "$(openssl rand -hex 32)"
  fi
}

created_env=false
CURRENT_CORS_ORIGIN=""
CURRENT_VITE_API_URL=""
if [[ -f .env ]]; then
  CURRENT_CORS_ORIGIN="$(read_env CORS_ORIGIN)"
  CURRENT_VITE_API_URL="$(read_env VITE_API_URL)"
else
  created_env=true
fi
CORS_ORIGIN_VALUE="${CORS_ORIGIN:-$CURRENT_CORS_ORIGIN}"
VITE_API_URL_VALUE="${VITE_API_URL:-$CURRENT_VITE_API_URL}"

if [[ "$NON_INTERACTIVE" == false ]]; then
  echo "TG Vault 安装向导"
  while true; do
    CORS_ORIGIN_VALUE="$(prompt_origin '请输入 Web 前端 URL' 'https://cloud.example.com' "$CORS_ORIGIN_VALUE")"
    VITE_API_URL_VALUE="$(prompt_origin '请输入后端 API URL' 'https://api.example.com' "$VITE_API_URL_VALUE")"
    if [[ "$CORS_ORIGIN_VALUE" != https://* || "$VITE_API_URL_VALUE" != https://* ]]; then
      echo "警告：当前配置包含 HTTP 地址，登录 Cookie 或接口流量可能无法获得生产级保护。" >&2
    fi
    if confirm_install; then
      break
    fi
  done
else
  if [[ -z "$CORS_ORIGIN_VALUE" || -z "$VITE_API_URL_VALUE" ]]; then
    echo "非交互模式需要在 .env 或环境变量中提供 CORS_ORIGIN 和 VITE_API_URL。" >&2
    exit 2
  fi
  if ! CORS_ORIGIN_VALUE="$(normalize_origin "$CORS_ORIGIN_VALUE")"; then
    echo "CORS_ORIGIN 必须是完整的 http(s) origin，不能包含路径、查询参数或片段。" >&2
    exit 2
  fi
  if ! VITE_API_URL_VALUE="$(normalize_origin "$VITE_API_URL_VALUE")"; then
    echo "VITE_API_URL 必须是完整的 http(s) origin，不能包含路径、查询参数或片段。" >&2
    exit 2
  fi
fi

if [[ "$created_env" == true ]]; then
  umask 077
  touch .env
fi
upsert_env CORS_ORIGIN "$CORS_ORIGIN_VALUE"
upsert_env VITE_API_URL "$VITE_API_URL_VALUE"
if [[ "$created_env" == true ]]; then
  upsert_env COOKIE_SECURE true
  upsert_env COOKIE_SECURE_FORCE true
fi

chmod 600 .env
ensure_generated_secret DB_PASSWORD
if [[ "$created_env" == true ]]; then
  ensure_generated_secret SESSION_SECRET
  ensure_generated_secret STORAGE_CREDENTIALS_SECRET
fi

SOURCE_REVISION="$(git rev-parse HEAD 2>/dev/null || printf unknown)"
SOURCE_VERSION="$(git describe --tags --exact-match 2>/dev/null || node -p "'v' + require('./backend/package.json').version" 2>/dev/null || printf worktree)"
IMAGE_VERSION="$SOURCE_VERSION"
upsert_env SOURCE_REVISION "$SOURCE_REVISION"
upsert_env SOURCE_VERSION "$SOURCE_VERSION"
upsert_env IMAGE_VERSION "$IMAGE_VERSION"

docker compose config --quiet
docker compose up -d --build
docker compose ps

echo
echo "TG Vault 安装完成"
echo "Web：$CORS_ORIGIN_VALUE"
echo "API：$VITE_API_URL_VALUE"
echo
echo "请在宿主机 Nginx/面板中配置 HTTPS："
echo "  Web  -> http://127.0.0.1:47832"
echo "  API  -> http://127.0.0.1:51947"
echo "验证：curl -fsS http://127.0.0.1:51947/readyz"
