
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { pool, query } from '../db/index.js';
import { validateApiKey, requireApiKeyPermission } from '../middleware/apiKey.js';

import { storageManager } from '../services/storage.js';
import { assertStorageTargetWritable, isStorageCooldownError, sendStorageCooldownHttpError } from '../services/storageCooldownGuard.js';
import { getSignedUrl } from '../middleware/signedUrl.js';
import { getUniqueStoredName } from '../utils/fileUtils.js';
import { buildStorageFolderWithRules, getStoragePathRules } from '../utils/storagePath.js';
import { findDuplicateFile, getDuplicateMode } from '../utils/duplicatePolicy.js';
import { saveAndIndexWithCompensation } from '../services/storageWrite.js';
import { rateLimit } from 'express-rate-limit';
import { acquireStorageAccountOperationLease, type StorageAccountOperationLease } from '../services/storageAccountOperation.js';
import { lockStorageAccountForUse } from '../services/storageAccountLifecycle.js';
import { normalizeFolderPath } from '../utils/folderPath.js';
import { buildUploadCapabilities, SIMPLE_UPLOAD_MAX_BYTES } from '../utils/uploadCapabilities.js';
import { getFileType } from '../utils/fileMetadata.js';
import { enqueueMediaDerivatives } from '../services/mediaDerivatives.js';

const router = Router();
export const apiRouter = Router();

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '上传请求过于频繁，请稍后再试' },
});

// 修复中文文件名编码问题
function decodeFilename(filename: string): string {
    try {
        const urlDecoded = decodeURIComponent(filename);
        if (urlDecoded !== filename) {
            return urlDecoded;
        }
    } catch {
        // 解码失败，继续尝试其他方法
    }

    try {
        const bytes = Buffer.from(filename, 'binary');
        const decoded = bytes.toString('utf8');
        if (!decoded.includes('\ufffd') && decoded !== filename) {
            return decoded;
        }
    } catch {
        // 解码失败
    }

    return filename;
}

const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 配置 multer 存储到临时目录
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const storedName = `${uuidv4()}${ext}`;
        cb(null, storedName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: SIMPLE_UPLOAD_MAX_BYTES,
    }
});

// 处理上传请求
const handleUpload = async (req: Request, res: Response, source: string = 'web') => {
    if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    const file = req.file;
    const { folder, targetProvider, targetAccountId } = req.body;
    const originalName = decodeFilename(file.originalname);
    const mimeType = file.mimetype;
    const size = file.size;
    const tempPath = path.resolve(file.path);
    let storageLease: StorageAccountOperationLease | null = null;

    let target;
    try {
        if (targetProvider) {
            if (targetAccountId) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const account = await lockStorageAccountForUse(client, String(targetAccountId));
                    if (account.type !== String(targetProvider)) throw new Error('上传目标账户与 provider 不匹配');
                    await client.query('COMMIT');
                } catch (error) {
                    await client.query('ROLLBACK').catch(() => undefined);
                    throw error;
                } finally {
                    client.release();
                }
            } else if (String(targetProvider) !== 'local') {
                throw new Error('云存储上传目标缺少账户');
            }
            target = storageManager.getTarget(String(targetProvider), targetAccountId ? String(targetAccountId) : null);
        } else {
            target = storageManager.getActiveTarget();
        }
    } catch (error) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return res.status(409).json({ error: error instanceof Error ? error.message : '上传目标无效' });
    }
    const { provider, accountId: activeAccountId } = target;
    let requestedFolder: string | null = null;
    try {
        requestedFolder = folder ? normalizeFolderPath(folder) : null;
    } catch (error) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return res.status(400).json({ error: error instanceof Error ? error.message : '文件夹路径无效' });
    }
    const storageRules = await getStoragePathRules();
    const storageFolder = buildStorageFolderWithRules({ source, folder: requestedFolder, mimeType, fileName: originalName }, storageRules);
    // 3. 生成唯一的存储文件名
    const storedName = await getUniqueStoredName(originalName, storageFolder, activeAccountId);

    console.log(`[Upload] 📁 Received file: ${originalName} (${mimeType}, ${size} bytes)`);
    console.log(`[Upload] 🏠 Local temp path: ${tempPath}`);

    try {
        storageLease = await acquireStorageAccountOperationLease(pool, activeAccountId, 'web_upload');
        // 1. 使用请求开始时捕获的不可变存储目标
        await assertStorageTargetWritable(target);
        console.log(`[Upload] 🛠️  Current storage provider: ${provider.name}, activeAccountId: ${activeAccountId || 'none (local)'}`);

        const duplicateMode = await getDuplicateMode();
        if (duplicateMode === 'skip') {
            const duplicate = await findDuplicateFile(originalName, storageFolder, size, activeAccountId);
            if (duplicate) {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return res.json({
                    success: true,
                    skipped: true,
                    reason: 'duplicate',
                    file: {
                        id: duplicate.id,
                        name: duplicate.name,
                        size: duplicate.size,
                        folder: duplicate.folder,
                        date: duplicate.created_at,
                    }
                });
            }
        }

        const type = getFileType(mimeType);
        const derivativeStatus = type === 'image' || type === 'video' ? 'queued' : 'not_required';

        let result: Awaited<ReturnType<typeof query>>;
        const storedPath = await saveAndIndexWithCompensation(provider, tempPath, storedName, mimeType, storageFolder, async savedPath => {
            result = await query(
                `INSERT INTO files
                (name, stored_name, type, mime_type, size, path, source, folder, storage_account_id,
                 derivative_status, derivative_source_path, derivative_cleanup_source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id, created_at, name, type, size`,
                [originalName, storedName, type, mimeType, size, savedPath, provider.name, storageFolder, activeAccountId,
                    derivativeStatus, derivativeStatus === 'queued' ? (provider.name === 'local' ? savedPath : tempPath) : null,
                    derivativeStatus === 'queued' && provider.name !== 'local']
            );
        });
        const newFile = result!.rows[0];

        if (derivativeStatus === 'queued') {
            enqueueMediaDerivatives({
                fileId: String(newFile.id),
                sourcePath: provider.name === 'local' ? storedPath : tempPath,
                storedName,
                mimeType,
                cleanupSource: provider.name !== 'local',
            });
        } else if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        res.json({
            success: true,
            file: {
                id: newFile.id,
                name: newFile.name,
                type: newFile.type,
                size: newFile.size,
                derivativeStatus,
                previewUrl: getSignedUrl(newFile.id, 'preview'),
                date: newFile.created_at,
                source: provider.name,
                folder: storageFolder,
                storageAccountId: activeAccountId,
                target: { provider: provider.name, accountId: activeAccountId, folder: storageFolder },
            }
        });
    } catch (error) {
        console.error('上传处理失败:', error);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (isStorageCooldownError(error)) {
            return sendStorageCooldownHttpError(res, error);
        }
        res.status(500).json({ error: '文件上传失败' });
    } finally {
        await storageLease?.release();
    }
};

// 服务端上传能力契约（前端必须以此决定直传/分片与展示真实限制）
router.get('/capabilities', (_req: Request, res: Response) => {
    res.json(buildUploadCapabilities());
});

// 内部上传接口（前端使用）
router.post('/', uploadLimiter, upload.single('file'), async (req: Request, res: Response) => {
    await handleUpload(req, res, 'web');
});

// 外部 API 上传接口（仅 API Key + upload 权限）
apiRouter.post('/', uploadLimiter, validateApiKey, requireApiKeyPermission('upload'), upload.single('file'), async (req: Request, res: Response) => {
    await handleUpload(req, res, 'api');
});

export default router;
