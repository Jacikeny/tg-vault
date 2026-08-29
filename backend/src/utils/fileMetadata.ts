export type FileType = 'image' | 'video' | 'audio' | 'document' | 'other';

export function getFileType(mimeType: string | null | undefined): FileType {
    const normalized = mimeType?.toLowerCase() || '';
    if (normalized.startsWith('image/')) return 'image';
    if (normalized.startsWith('video/')) return 'video';
    if (normalized.startsWith('audio/')) return 'audio';
    if (
        normalized.startsWith('text/')
        || normalized.includes('pdf')
        || normalized.includes('document')
        || normalized.includes('sheet')
        || normalized.includes('presentation')
        || normalized.includes('word')
        || normalized.includes('excel')
        || normalized.includes('powerpoint')
    ) return 'document';
    return 'other';
}

export function formatBytes(bytes: number, binary = false): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const base = 1024;
    const units = binary ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
    const value = bytes / (base ** unit);
    return `${Number(value.toFixed(unit === 0 ? 0 : 2))} ${units[unit]}`;
}
