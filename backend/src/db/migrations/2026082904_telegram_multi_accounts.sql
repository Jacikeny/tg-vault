CREATE TABLE IF NOT EXISTS telegram_user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id TEXT NOT NULL UNIQUE,
    username TEXT,
    display_name TEXT,
    session_ciphertext TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    health_state VARCHAR(24) NOT NULL DEFAULT 'healthy'
        CHECK (health_state IN ('healthy', 'degraded', 'session_expired')),
    cooldown_until TIMESTAMPTZ,
    weight NUMERIC(8, 3) NOT NULL DEFAULT 1 CHECK (weight > 0),
    priority INT NOT NULL DEFAULT 0,
    max_connections INT NOT NULL DEFAULT 4 CHECK (max_connections > 0),
    last_error TEXT,
    last_connected_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    session_expired_at TIMESTAMPTZ,
    is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_user_accounts_schedulable
    ON telegram_user_accounts(enabled, health_state, cooldown_until, priority DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_user_accounts_visible
    ON telegram_user_accounts(created_at, id) WHERE deleted_at IS NULL;
CREATE OR REPLACE TRIGGER telegram_user_accounts_updated_at
    BEFORE UPDATE ON telegram_user_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS telegram_account_source_access (
    account_id UUID NOT NULL REFERENCES telegram_user_accounts(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'download'
        CHECK (scope IN ('download', 'scan', 'metadata')),
    access_state VARCHAR(20) NOT NULL DEFAULT 'unknown'
        CHECK (access_state IN ('unknown', 'allowed', 'denied')),
    last_error TEXT,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_id, source_key, scope)
);
CREATE INDEX IF NOT EXISTS idx_telegram_account_source_access_lookup
    ON telegram_account_source_access(source_key, scope, access_state, checked_at DESC);
CREATE OR REPLACE TRIGGER telegram_account_source_access_updated_at
    BEFORE UPDATE ON telegram_account_source_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE telegram_background_jobs
    ADD COLUMN IF NOT EXISTS assigned_account_id UUID REFERENCES telegram_user_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tg_background_jobs_assigned_account
    ON telegram_background_jobs(assigned_account_id, status);

CREATE TABLE IF NOT EXISTS telegram_download_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES telegram_user_accounts(id) ON DELETE RESTRICT,
    source_key TEXT NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'download'
        CHECK (scope IN ('download', 'scan', 'metadata')),
    job_id UUID REFERENCES telegram_background_jobs(id) ON DELETE SET NULL,
    item_id UUID REFERENCES telegram_download_items(id) ON DELETE SET NULL,
    lease_token UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CHECK ((status = 'running' AND finished_at IS NULL) OR (status <> 'running' AND finished_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_telegram_download_attempts_account_started
    ON telegram_download_attempts(account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_download_attempts_job_item
    ON telegram_download_attempts(job_id, item_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_download_attempts_running
    ON telegram_download_attempts(account_id, source_key) WHERE status = 'running';
