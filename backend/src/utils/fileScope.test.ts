import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePhysicalDeletePath } from './fileScope.js';

test('WebDAV directory placeholders delete the represented collection, not the synthetic marker path', () => {
    assert.equal(resolvePhysicalDeletePath({
        name: '.folder',
        mime_type: 'application/x-directory',
        source: 'webdav',
        path: '.folder',
        folder: 'demo/nested',
    }), 'demo/nested/');
});

test('ordinary cloud objects retain their stored provider path', () => {
    assert.equal(resolvePhysicalDeletePath({
        name: 'report.pdf',
        mime_type: 'application/pdf',
        source: 'webdav',
        path: 'docs/report-123.pdf',
        folder: 'docs',
    }), 'docs/report-123.pdf');
});
