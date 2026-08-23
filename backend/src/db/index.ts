import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { buildSqlLogEvent, parseSqlLoggingConfig, shouldLogSqlQuery, sqlOperation } from '../utils/dbLogging.js';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://tgvault:password@localhost:5432/tgvault',
});

let initializationPromise: Promise<void> | null = null;
const CANONICAL_SCHEMA_VERSION = 2026082401;

async function applyCanonicalSchemaMigration(schemaSql: string): Promise<void> {
    const checksum = crypto.createHash('sha256').update(schemaSql).digest('hex');
    await pool.query(
        `INSERT INTO schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [CANONICAL_SCHEMA_VERSION, 'canonical-expand-schema', checksum],
    );
}

// 自动初始化数据库表结构
async function initializeDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = await fs.readFile(schemaPath, 'utf-8');

        // 智能分割 SQL 语句（处理 PL/pgSQL 的 $$ 块）
        const statements: string[] = [];
        let current = '';
        let inDollarQuote = false;

        for (let i = 0; i < schemaSql.length; i++) {
            const char = schemaSql[i];
            current += char;

            // 检测 $$ 块的开始和结束
            if (char === '$' && schemaSql[i + 1] === '$') {
                inDollarQuote = !inDollarQuote;
                current += '$';
                i++; // 跳过下一个 $
            } else if (char === ';' && !inDollarQuote) {
                const stmt = current.trim();
                if (stmt.length > 1) {
                    const withoutLeadingLineComments = stmt.replace(/^\s*(--[^\n]*\n\s*)+/g, '').trim();
                    if (withoutLeadingLineComments.length > 0) {
                        statements.push(withoutLeadingLineComments.slice(0, -1)); // 移除末尾的分号
                    }
                }
                current = '';
            }
        }
        // 添加最后一条语句（如果没有以分号结尾）
        const lastStmt = current.trim();
        if (lastStmt.length > 0) {
            const withoutLeadingLineComments = lastStmt.replace(/^\s*(--[^\n]*\n\s*)+/g, '').trim();
            if (withoutLeadingLineComments.length > 0) {
                statements.push(withoutLeadingLineComments);
            }
        }

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (err: any) {
                // 如果是表已存在的错误，忽略
                if (err.message?.includes('already exists')) {
                    continue;
                }
                throw err;
            }
        }

        await applyCanonicalSchemaMigration(schemaSql);

        console.log('✅ 数据库表结构初始化完成');
    } catch (err: any) {
        console.error('❌ 数据库初始化失败:', err);
        throw err;
    }
}

export function ensureDatabaseInitialized(): Promise<void> {
    if (!initializationPromise) initializationPromise = initializeDatabase();
    return initializationPromise;
}

const sqlLoggingConfig = parseSqlLoggingConfig();

pool.on('connect', () => {
    if (process.env.LOG_LEVEL === 'debug') console.log(JSON.stringify({ event: 'db.connected' }));
});

pool.on('error', (err) => {
    console.error(JSON.stringify({ event: 'db.pool_error', code: (err as any)?.code || 'UNKNOWN' }));
});

export const query = async (text: string, params?: unknown[]) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (shouldLogSqlQuery(duration, sqlLoggingConfig)) {
        console.log(JSON.stringify(buildSqlLogEvent({
            durationMs: duration,
            rowCount: res.rowCount,
            operation: sqlOperation(text),
        })));
    }
    return res;
};

export default { pool, query };
