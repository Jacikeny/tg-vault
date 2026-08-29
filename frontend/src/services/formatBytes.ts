export function formatBytes(bytes: number, options: { binary?: boolean; maximumFractionDigits?: number } = {}): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const binary = options.binary ?? true;
    const base = binary ? 1024 : 1000;
    const units = binary ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
    const maximumFractionDigits = options.maximumFractionDigits ?? (unit === 0 ? 0 : 1);
    return `${(bytes / (base ** unit)).toFixed(maximumFractionDigits)} ${units[unit]}`;
}
