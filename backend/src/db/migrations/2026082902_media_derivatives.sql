ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_status VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE files ADD COLUMN IF NOT EXISTS derivative_error TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'files_derivative_status_check'
    ) THEN
        ALTER TABLE files ADD CONSTRAINT files_derivative_status_check
            CHECK (derivative_status IN ('queued', 'processing', 'ready', 'failed', 'not_required'));
    END IF;
END
$$;
