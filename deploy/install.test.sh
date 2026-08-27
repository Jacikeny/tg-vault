#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCENARIO="${1:-all}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq "$expected" "$file" || fail "$file 缺少：$expected"
}

make_fixture() {
  FIXTURE="$(mktemp -d)"
  trap 'rm -rf "${FIXTURE:-}"' EXIT
  mkdir -p "$FIXTURE/deploy" "$FIXTURE/backend" "$FIXTURE/fake-bin"
  cp "$ROOT/deploy/install.sh" "$FIXTURE/deploy/install.sh"
  printf 'services: {}\n' > "$FIXTURE/docker-compose.yml"
  printf '{"version":"2.2.0"}\n' > "$FIXTURE/backend/package.json"

  cat > "$FIXTURE/fake-bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == "compose" && "${2:-}" == "version" ]]; then
  exit 0
fi
printf '%s\n' "$*" >> "$INSTALL_TEST_DOCKER_LOG"
SH
  chmod +x "$FIXTURE/fake-bin/docker" "$FIXTURE/deploy/install.sh"
}

run_in_tty() {
  local input="$1"
  local output="$2"
  local status
  set +e
  printf '%b' "$input" | script -qec \
    "cd '$FIXTURE' && env -u CORS_ORIGIN -u VITE_API_URL PATH='$FIXTURE/fake-bin:$PATH' INSTALL_TEST_DOCKER_LOG='$FIXTURE/docker.log' bash deploy/install.sh" \
    /dev/null > "$output" 2>&1
  status=$?
  set -e
  if [[ $status -ne 0 ]]; then
    sed -n '1,160p' "$output" >&2
    fail "交互式安装退出码为 $status"
  fi
}

test_interactive_new_install_collects_urls_and_starts_compose() {
  make_fixture
  run_in_tty 'https://cloud.example.net\nhttps://api.example.net\n\n' "$FIXTURE/output.log"

  assert_contains "$FIXTURE/.env" 'CORS_ORIGIN=https://cloud.example.net'
  assert_contains "$FIXTURE/.env" 'VITE_API_URL=https://api.example.net'
  assert_contains "$FIXTURE/.env" 'DB_PASSWORD='
  assert_contains "$FIXTURE/output.log" '请输入 Web 前端 URL'
  assert_contains "$FIXTURE/output.log" '请输入后端 API URL'
  assert_contains "$FIXTURE/output.log" '按 Enter 保存配置并开始安装'
  assert_contains "$FIXTURE/docker.log" 'compose config --quiet'
  assert_contains "$FIXTURE/docker.log" 'compose build backend frontend'
  assert_contains "$FIXTURE/docker.log" 'compose up -d --no-build --no-deps backend frontend'
  assert_contains "$FIXTURE/docker.log" 'compose ps'
}

test_quit_does_not_create_or_start() {
  make_fixture
  run_in_tty 'https://cloud.example.net\nhttps://api.example.net\nq\n' "$FIXTURE/output.log"

  [[ ! -e "$FIXTURE/.env" ]] || fail "取消安装后不应创建 .env"
  [[ ! -e "$FIXTURE/docker.log" ]] || fail "取消安装后不应调用 Docker"
  assert_contains "$FIXTURE/output.log" '已取消，未保存配置或启动服务。'
}

test_non_interactive_uses_environment_without_waiting() {
  make_fixture
  (
    cd "$FIXTURE"
    env PATH="$FIXTURE/fake-bin:$PATH" \
      INSTALL_TEST_DOCKER_LOG="$FIXTURE/docker.log" \
      CORS_ORIGIN='https://cloud.example.net/' \
      VITE_API_URL='https://api.example.net/' \
      bash deploy/install.sh --non-interactive > "$FIXTURE/output.log" 2>&1
  )

  assert_contains "$FIXTURE/.env" 'CORS_ORIGIN=https://cloud.example.net'
  assert_contains "$FIXTURE/.env" 'VITE_API_URL=https://api.example.net'
  assert_contains "$FIXTURE/docker.log" 'compose build backend frontend'
  assert_contains "$FIXTURE/docker.log" 'compose up -d --no-build --no-deps backend frontend'
}

test_existing_install_keeps_urls_on_enter() {
  make_fixture
  cat > "$FIXTURE/.env" <<'EOF'
CORS_ORIGIN=https://existing-cloud.example.net
VITE_API_URL=https://existing-api.example.net
DB_PASSWORD=keep-this-password
SESSION_SECRET=keep-this-session
STORAGE_CREDENTIALS_SECRET=keep-this-storage-secret
IMAGE_VERSION=v1.0.0
SOURCE_REVISION=stale-revision
SOURCE_VERSION=v1.0.0
EOF
  run_in_tty '\n\n\n' "$FIXTURE/output.log"

  assert_contains "$FIXTURE/.env" 'CORS_ORIGIN=https://existing-cloud.example.net'
  assert_contains "$FIXTURE/.env" 'VITE_API_URL=https://existing-api.example.net'
  assert_contains "$FIXTURE/.env" 'DB_PASSWORD=keep-this-password'
  assert_contains "$FIXTURE/.env" 'SESSION_SECRET=keep-this-session'
  assert_contains "$FIXTURE/.env" 'STORAGE_CREDENTIALS_SECRET=keep-this-storage-secret'
  if grep -Eq '^(IMAGE_VERSION|SOURCE_REVISION|SOURCE_VERSION)=' "$FIXTURE/.env"; then
    fail "升级后应清理旧版持久化版本元数据"
  fi
  assert_contains "$FIXTURE/output.log" '直接按 Enter 保留当前值'
}

test_environment_check_offers_to_install_missing_tools() {
  make_fixture
  cat > "$FIXTURE/fake-bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == "compose" && "${2:-}" == "version" ]]; then
  exit 1
fi
printf '%s\n' "$*" >> "$INSTALL_TEST_DOCKER_LOG"
SH
  cat > "$FIXTURE/fake-bin/apt-get" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$INSTALL_TEST_PACKAGE_LOG"
SH
  chmod +x "$FIXTURE/fake-bin/docker" "$FIXTURE/fake-bin/apt-get"
  set +e
  printf '1\n' | script -qec \
    "cd '$FIXTURE' && env PATH='$FIXTURE/fake-bin:$PATH' INSTALL_TEST_SKIP_ENV_RECHECK=true INSTALL_TEST_DOCKER_LOG='$FIXTURE/docker.log' INSTALL_TEST_PACKAGE_LOG='$FIXTURE/packages.log' bash deploy/install.sh" \
    /dev/null > "$FIXTURE/output.log" 2>&1
  status=$?
  set -e
  [[ $status -ne 0 ]] || fail "模拟缺失 Compose 时应在安装后重新检测并失败"
  assert_contains "$FIXTURE/output.log" '服务器环境检测'
  assert_contains "$FIXTURE/output.log" 'Docker Compose 插件'
  assert_contains "$FIXTURE/output.log" '请选择处理方式'
  assert_contains "$FIXTURE/packages.log" 'update'
  assert_contains "$FIXTURE/packages.log" 'install -y docker-compose-plugin'
}

test_secret_generation_does_not_require_openssl() {
  make_fixture
  openssl_stub="$FIXTURE/fake-bin/openssl"
  cat > "$openssl_stub" <<'SH'
#!/usr/bin/env bash
echo "openssl 不应被调用" >&2
exit 99
SH
  chmod +x "$openssl_stub"
  (
    cd "$FIXTURE"
    env PATH="$FIXTURE/fake-bin:$PATH" \
      INSTALL_TEST_DOCKER_LOG="$FIXTURE/docker.log" \
      CORS_ORIGIN='https://cloud.example.net' \
      VITE_API_URL='https://api.example.net' \
      bash deploy/install.sh --non-interactive > "$FIXTURE/output.log" 2>&1
  )
  assert_contains "$FIXTURE/.env" 'DB_PASSWORD='
  if grep -Fq 'openssl 不应被调用' "$FIXTURE/output.log"; then
    fail "安装脚本不应调用 openssl"
  fi
}

case "$SCENARIO" in
  interactive-new) test_interactive_new_install_collects_urls_and_starts_compose ;;
  quit) test_quit_does_not_create_or_start ;;
  non-interactive) test_non_interactive_uses_environment_without_waiting ;;
  existing) test_existing_install_keeps_urls_on_enter ;;
  environment) test_environment_check_offers_to_install_missing_tools ;;
  no-openssl) test_secret_generation_does_not_require_openssl ;;
  all)
    test_interactive_new_install_collects_urls_and_starts_compose
    test_quit_does_not_create_or_start
    test_non_interactive_uses_environment_without_waiting
    test_existing_install_keeps_urls_on_enter
    test_environment_check_offers_to_install_missing_tools
    test_secret_generation_does_not_require_openssl
    ;;
  *) fail "未知测试场景：$SCENARIO" ;;
esac

echo "PASS: $SCENARIO"
