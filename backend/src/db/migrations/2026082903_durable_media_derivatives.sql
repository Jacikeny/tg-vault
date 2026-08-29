ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_source_path VARCHAR(1000);
ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_cleanup_source BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_files_derivative_pending
    ON files (derivative_status, created_at, id)
    WHERE derivative_status IN ('queued', 'processing');
