import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const compose=fs.readFileSync(new URL('../../../docker-compose.yml',import.meta.url),'utf8');
test('database image includes the vector extension required by existing production schema and backups',()=>{
  assert.match(compose,/image: pgvector\/pgvector@sha256:[a-f0-9]{64}/);
});
