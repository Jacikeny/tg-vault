import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from './chunkHash.js';

const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function restoreCrypto(): void {
    if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
}

test('sha256Hex hashes chunks when Web Crypto subtle is unavailable on an HTTP origin', async () => {
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {},
    });

    try {
        for (const length of [0, 1, 55, 56, 63, 64, 65, 1024, 1024 * 1024]) {
            const bytes = Uint8Array.from({ length }, (_, index) => (index * 31 + 17) & 0xff);
            const expected = createHash('sha256').update(bytes).digest('hex');
            assert.equal(await sha256Hex(new Blob([bytes])), expected, `failed for ${length} bytes`);
        }
    } finally {
        restoreCrypto();
    }
});

test('sha256Hex uses Web Crypto when available', async () => {
    restoreCrypto();
    const blob = new Blob(['secure context']);
    const expected = createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
    assert.equal(await sha256Hex(blob), expected);
});
