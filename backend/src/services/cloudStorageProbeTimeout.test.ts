import assert from 'node:assert/strict';
import test from 'node:test';
import { AliyunOSSStorageProvider, S3StorageProvider } from './storage.js';

test('Aliyun OSS connection probe passes the short probe timeout to the SDK', async () => {
    const provider = new AliyunOSSStorageProvider('probe', 'oss-cn-hangzhou', 'key', 'secret', 'bucket-name', 20);
    let receivedTimeout: number | undefined;
    (provider as any).client = {
        list: async (_query: unknown, options?: { timeout?: number }) => {
            receivedTimeout = options?.timeout;
            await new Promise<void>(() => undefined);
        },
    };

    await assert.rejects(() => provider.probe(), /aliyun_oss.*连接测试失败.*连接测试超时/i);
    assert.equal(receivedTimeout, 20);
});

test('S3 connection probe aborts a stalled SDK request at the short deadline', async () => {
    const provider = new S3StorageProvider('probe', 'https://s3.example.com', 'us-east-1', 'key', 'secret', 'bucket-name', false, 20);
    let signal: AbortSignal | undefined;
    (provider as any).client = {
        send: async (_command: unknown, options?: { abortSignal?: AbortSignal }) => {
            signal = options?.abortSignal;
            await new Promise<void>((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal?.reason || new Error('aborted')), { once: true });
            });
        },
    };

    await assert.rejects(() => provider.probe(), /s3.*连接测试失败.*连接测试超时/i);
    assert.equal(signal?.aborted, true);
});
