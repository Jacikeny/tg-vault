import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    LocalStorageProvider as PublicLocalStorageProvider,
    StorageProbeError as PublicStorageProbeError,
} from '../storage.js';
import { StorageProbeError } from './contracts.js';
import { LocalStorageProvider } from './localStorageProvider.js';

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as NodeJS.ReadableStream & AsyncIterable<Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

test('storage.ts preserves the extracted local provider and error exports', () => {
    assert.equal(PublicLocalStorageProvider, LocalStorageProvider);
    assert.equal(PublicStorageProbeError, StorageProbeError);
});

test('extracted local provider preserves save, read, delete, and share behavior', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tg-vault-local-storage-'));
    const uploadDir = path.join(root, 'uploads');
    const tempPath = path.join(root, 'incoming.txt');

    try {
        await fs.promises.writeFile(tempPath, 'stored locally');
        const provider = new LocalStorageProvider(uploadDir);

        await provider.probe();
        const storedPath = await provider.saveFile(tempPath, 'saved.txt', 'text/plain', 'nested');
        assert.equal(storedPath, path.join(uploadDir, 'nested', 'saved.txt'));
        assert.equal(await readStream(await provider.getFileStream(storedPath)), 'stored locally');
        assert.equal(await provider.getPreviewUrl(storedPath), '');
        assert.deepEqual(await provider.createShareLink(storedPath), {
            link: '',
            error: '本地存储暂不支持生成分享链接，请使用 OneDrive 存储。',
        });

        await provider.deleteFile(storedPath);
        assert.equal(fs.existsSync(storedPath), false);
    } finally {
        await fs.promises.rm(root, { recursive: true, force: true });
    }
});

test('extracted local provider still rejects paths outside its upload directory', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tg-vault-local-storage-'));
    const uploadDir = path.join(root, 'uploads');
    const outsidePath = path.join(root, 'outside.txt');

    try {
        await fs.promises.writeFile(outsidePath, 'do not expose');
        const provider = new LocalStorageProvider(uploadDir);

        await assert.rejects(() => provider.getFileStream(outsidePath), /Unsafe path outside storage directory/);
        await assert.rejects(() => provider.deleteFile(outsidePath), /Unsafe path outside storage directory/);
        assert.equal(await fs.promises.readFile(outsidePath, 'utf8'), 'do not expose');
    } finally {
        await fs.promises.rm(root, { recursive: true, force: true });
    }
});
