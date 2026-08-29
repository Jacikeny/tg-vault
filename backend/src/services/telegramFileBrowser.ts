import { formatBytes } from '../utils/telegramUtils.js';
import { query } from '../db/index.js';
import {
    buildFilePageQuery,
    cursorForFile,
    normalizeFileQuery,
    type FileQueryScope,
} from './fileQuery.js';

export interface TelegramFileBrowserPage {
    files: any[];
    nextCursor: string | null;
    hasMore: boolean;
}

export type TelegramFileBrowserAction = 'detail' | 'copy' | 'favorite' | 'link' | 'move' | 'rename' | 'delete';

export interface TelegramFileBrowserCallback {
    action: TelegramFileBrowserAction;
    fileId: string;
}

export function encodeTelegramFileCallback(action: TelegramFileBrowserAction, fileId: string): string {
    const value = `fb_${action}_${fileId}`;
    if (Buffer.byteLength(value, 'utf8') > 64) throw new Error('Telegram callback data exceeds 64 bytes');
    return value;
}

export function parseTelegramFileCallback(data: string): TelegramFileBrowserCallback | null {
    const match = data.match(/^fb_(detail|copy|favorite|link|move|rename|delete)_([0-9a-f-]{36})$/i);
    return match ? { action: match[1].toLowerCase() as TelegramFileBrowserAction, fileId: match[2].toLowerCase() } : null;
}

function compactText(value: unknown, maxLength: number): string {
    const text = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/[*_`[\]\\]/g, '').trim();
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

export function buildTelegramFileActionRows(file: any): Array<Array<{ text: string; data: string }>> {
    const id = String(file.id);
    const rows: Array<Array<{ text: string; data: string }>> = [
        [{ text: '详情', data: encodeTelegramFileCallback('detail', id) }, { text: '复制 ID', data: encodeTelegramFileCallback('copy', id) }],
        [{ text: file.is_favorite ? '取消收藏' : '收藏', data: encodeTelegramFileCallback('favorite', id) }],
        [{ text: '签名链接', data: encodeTelegramFileCallback('link', id) }],
        [{ text: '移动', data: encodeTelegramFileCallback('move', id) }, { text: '重命名', data: encodeTelegramFileCallback('rename', id) }],
        [{ text: '删除…', data: encodeTelegramFileCallback('delete', id) }],
    ];
    return rows;
}

export function buildTelegramFileDetail(file: any): string {
    return [
        `📄 **${compactText(file.name, 80) || '未命名文件'}**`,
        `🆔 ${file.id}`,
        `📦 ${formatBytes(Number(file.size || 0))} · ${compactText(file.type || '其他', 20)}`,
        `📍 ${compactText(file.source || '本地存储', 50)}`,
        `📁 ${compactText(file.folder || '根目录', 100)}`,
        `🕒 ${file.created_at ? new Date(file.created_at).toLocaleString('zh-CN', { hour12: false }) : '未知'}`,
    ].join('\n');
}

export async function resolveTelegramFileScope(): Promise<FileQueryScope> {
    const { storageManager } = await import('./storage.js');
    const target = storageManager.getActiveTarget();
    return target.provider.name === 'local'
        ? { kind: 'local' }
        : { kind: 'account', accountId: target.accountId || '' };
}

export async function queryTelegramFiles(
    rawOptions: Record<string, unknown>,
    dependencies: {
        runQuery?: typeof query;
        scope?: FileQueryScope;
    } = {},
): Promise<TelegramFileBrowserPage> {
    const options = normalizeFileQuery({ ...rawOptions, limit: String(rawOptions.limit || 8) });
    const scope = dependencies.scope || await resolveTelegramFileScope();
    const built = buildFilePageQuery(scope, options);
    const result = await (dependencies.runQuery || query)(built.text, built.params);
    const files = result.rows.slice(0, options.limit);
    return {
        files,
        hasMore: result.rows.length > options.limit,
        nextCursor: result.rows.length > options.limit && files.length > 0
            ? cursorForFile(files[files.length - 1], options.sort, options.direction)
            : null,
    };
}

export function buildTelegramFileCard(file: any, index: number): string {
    const shortId = String(file.id || '').slice(0, 12);
    const createdAt = file.created_at ? new Date(file.created_at).toLocaleString('zh-CN', { hour12: false }) : '未知';
    const name = compactText(file.name, 46) || '未命名文件';
    const folder = compactText(file.folder || '根目录', 60);
    return [
        `${index + 1}. ${file.is_favorite ? '⭐ ' : ''}${name}`,
        `   🆔 ${shortId} · ${compactText(file.type || '其他', 16)} · ${formatBytes(Number(file.size || 0))}`,
        `   📁 ${folder} · ${createdAt}`,
    ].join('\n');
}

export function buildTelegramFileBrowserText(page: TelegramFileBrowserPage, queryText: string): string {
    return [
        `🔎 **文件搜索**：${compactText(queryText || '最近文件', 80)}`,
        '',
        ...(page.files.length > 0 ? page.files.map(buildTelegramFileCard) : ['没有匹配文件。']),
        '',
        '点击文件可查看详情、复制 ID、收藏、生成链接、移动/重命名或进入删除确认。',
    ].join('\n');
}
