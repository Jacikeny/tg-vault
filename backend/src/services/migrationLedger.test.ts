import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const db = fs.readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const init = fs.readFileSync(new URL('../../../init.sql', import.meta.url), 'utf8');

test('database startup records a canonical schema migration ledger', () => {
    assert.match(schema, /CREATE TABLE IF NOT EXISTS schema_migrations/);
    assert.match(db, /applyCanonicalSchemaMigration/);
    assert.match(db, /INSERT INTO schema_migrations/);
    assert.match(db, /CANONICAL_SCHEMA_VERSION/);
});

test('first-install init is generated from the same canonical schema source', () => {
    assert.match(init, /GENERATED FROM backend\/src\/db\/schema\.sql/);
    assert.match(init, /schema_migrations/);
    assert.match(init, /telegram_notification_preferences/);
});

test('legacy ad-hoc startup migrations no longer duplicate schema ownership', () => {
    const initializer = db.slice(db.indexOf('async function initializeDatabase'), db.indexOf('export function ensureDatabaseInitialized'));
    assert.doesNotMatch(initializer, /ALTER TABLE files ADD COLUMN/);
    assert.doesNotMatch(initializer, /CREATE TABLE IF NOT EXISTS web_sessions/);
});
