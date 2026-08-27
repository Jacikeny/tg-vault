import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFilePageQuery, cursorForFile, decodeFileQueryCursor, normalizeFileQuery } from './fileQuery.js';

const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
];

test('name cursor, SQL order key, and next-page boundary use the same projected value', () => {
    const ordered = [
        { id: ids[0], name: 'A', sort_value: 'a' },
        { id: ids[1], name: 'a', sort_value: 'a' },
        { id: ids[2], name: 'B', sort_value: 'b' },
    ];
    const encoded = cursorForFile(ordered[1], 'name', 'asc');
    const cursor = decodeFileQueryCursor(encoded, 'name', 'asc');
    assert.deepEqual(cursor, { sort: 'name', direction: 'asc', value: 'a', id: ids[1] });

    const query = buildFilePageQuery({ kind: 'local' }, {
        ...normalizeFileQuery({ sort: 'name', direction: 'asc', limit: '2' }),
        cursor: encoded,
    });
    assert.match(query.text, /LOWER\(name\) AS sort_value/);
    assert.match(query.text, /\(LOWER\(name\), id\) > \(\$2, \$3::uuid\)/);
    assert.match(query.text, /ORDER BY LOWER\(name\) ASC, id ASC/);
    assert.deepEqual(query.params.slice(1, 3), ['a', ids[1]]);

    const nextPage = ordered.filter(row => row.sort_value > cursor!.value || (row.sort_value === cursor!.value && row.id > cursor!.id));
    assert.deepEqual(nextPage, [ordered[2]]);
});
