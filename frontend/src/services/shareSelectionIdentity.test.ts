import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const toolbar = fs.readFileSync(new URL('../components/ui/BulkActionToolbar.tsx', import.meta.url), 'utf8');

test('share state is keyed by the selected file identity, not only the count', () => {
    assert.match(toolbar, /selectedFileId\?: string/);
    assert.match(toolbar, /useEffect\(\(\) => \{[\s\S]*setGeneratedLink\(null\)[\s\S]*\}, \[selectedFileId\]\)/);
    assert.match(app, /selectedFileId=\{selectedFileIds\.length === 1 \? selectedFileIds\[0\] : undefined\}/);
});
