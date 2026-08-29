CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_files_name_trgm
    ON files USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_files_folder_trgm
    ON files USING GIN (folder gin_trgm_ops)
    WHERE folder IS NOT NULL;
