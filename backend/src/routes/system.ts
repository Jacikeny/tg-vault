import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from './auth.js';
import type { UpdateChecker } from '../services/updateChecker.js';

export function createSystemRouter(checker: UpdateChecker): Router {
    const router = Router();
    const manualCheckLimiter = rateLimit({
        windowMs: 60_000,
        max: 3,
        message: { error: '版本检查请求过于频繁，请稍后再试' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

    router.get('/update-status', requireAuth, async (_req: Request, res: Response) => {
        noStore(res);
        try {
            res.json(await checker.getStatus());
        } catch (error) {
            console.error('读取版本状态失败:', error);
            res.status(500).json({ error: '读取版本状态失败' });
        }
    });

    router.post('/update-check', requireAuth, manualCheckLimiter, async (_req: Request, res: Response) => {
        noStore(res);
        try {
            res.json(await checker.checkNow());
        } catch (error) {
            console.error('手动检查版本失败:', error);
            res.status(500).json({ error: '检查版本失败' });
        }
    });

    return router;
}

export default createSystemRouter;
