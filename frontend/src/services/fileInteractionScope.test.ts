import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('route scope changes clear selections and object-specific overlays', () => {
    const clearState = app.slice(app.indexOf('const clearFileInteractionState'), app.indexOf('const applyRoute'));
    const applyRoute = app.slice(app.indexOf('const applyRoute'), app.indexOf('const navigateRoute'));
    for (const reset of [
        'setIsSelectionMode(false)', 'setSelectedFileIds([])', 'setSelectedFolderNames([])',
        'setSelectedFile(null)', 'setDeletingFile(null)', 'setRenamingFile(null)',
        'setRenamingFolder(null)', 'setMovingFile(null)', 'setMovingFolder(null)',
    ]) assert.match(clearState, new RegExp(reset.replace(/[()[\]]/g, '\\$&')));
    assert.match(applyRoute, /clearFileInteractionState\(\)/);
});

test('search scope changes clear selections before replacing the URL', () => {
    const updateSearch = app.slice(app.indexOf('const updateSearchQuery'), app.indexOf('const handleSettingsSectionChange'));
    assert.match(updateSearch, /clearFileInteractionState\(\)/);
});
