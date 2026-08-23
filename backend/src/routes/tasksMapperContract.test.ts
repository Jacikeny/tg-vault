import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const routes = fs.readFileSync(new URL('./tasks.ts', import.meta.url), 'utf8');
const taskCenter = fs.readFileSync(new URL('../services/telegramTaskCenter.ts', import.meta.url), 'utf8');

function routeBlock(start: string, end: string): string {
    const startIndex = routes.indexOf(start);
    const endIndex = routes.indexOf(end, startIndex + start.length);
    assert(startIndex >= 0, `missing route block start: ${start}`);
    assert(endIndex > startIndex, `missing route block end: ${end}`);
    return routes.slice(startIndex, endIndex);
}

test('Web and Telegram channel views consume the shared channel mapper', () => {
    assert.match(routes, /mapTelegramChannelJob/);
    assert.match(taskCenter, /telegramChannelJobTaskState/);
    assert.doesNotMatch(routes, /row\.scan_status !== 'completed'/);
});

test('task list reports filtered total separately from returned page size', () => {
    const listRoute = routeBlock("router.get('/', requireAuth", "router.post('/dismissals/prepare'");
    assert.match(listRoute, /const total = filtered\.length/);
    assert.match(listRoute, /const page = filtered\.slice\(0, limit\)/);
    assert.match(listRoute, /tasks: page/);
    assert.match(listRoute, /total/);
    assert.match(listRoute, /returned: page\.length/);
    assert.doesNotMatch(listRoute, /total: filtered\.length/);
});
