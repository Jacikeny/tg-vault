import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const compose = fs.readFileSync(new URL('../../../docker-compose.yml', import.meta.url), 'utf8');

test('database image is pinned to standard PostgreSQL without the abandoned pgvector dependency', () => {
    assert.match(compose, /image: postgres@sha256:[a-f0-9]{64}/);
    assert.doesNotMatch(compose, /pgvector\/pgvector/);
});
