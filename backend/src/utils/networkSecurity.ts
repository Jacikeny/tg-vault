import dns from 'dns/promises';
import net from 'net';

function ipv4ToInt(ip: string): number {
    return ip.split('.').reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0);
}

function isPrivateIPv4(ip: string): boolean {
    const n = ipv4ToInt(ip);
    const ranges: Array<[string, string]> = [
        ['0.0.0.0', '0.255.255.255'],
        ['10.0.0.0', '10.255.255.255'],
        ['127.0.0.0', '127.255.255.255'],
        ['169.254.0.0', '169.254.255.255'],
        ['172.16.0.0', '172.31.255.255'],
        ['192.168.0.0', '192.168.255.255'],
        ['224.0.0.0', '239.255.255.255'],
        ['240.0.0.0', '255.255.255.255'],
    ];
    return ranges.some(([start, end]) => n >= ipv4ToInt(start) && n <= ipv4ToInt(end));
}

function embeddedIPv4FromIPv6(ip: string): string | null {
    const normalized = ip.toLowerCase().split('%', 1)[0];
    const dotted = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
    if (dotted && net.isIP(dotted) === 4) return dotted;

    const segments = normalized.split(':').filter(Boolean);
    if (segments.length < 2) return null;
    const high = Number.parseInt(segments.at(-2) || '', 16);
    const low = Number.parseInt(segments.at(-1) || '', 16);
    if (!Number.isInteger(high) || !Number.isInteger(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) return null;
    return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
}

function isPrivateIPv6(ip: string): boolean {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
    const isMapped = normalized.startsWith('::ffff:');
    const isNat64 = normalized.startsWith('64:ff9b::');
    if (!isMapped && !isNat64) return false;
    const embedded = embeddedIPv4FromIPv6(normalized);
    return !embedded || isPrivateIPv4(embedded);
}

export function isPrivateAddress(ip: string): boolean {
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIPv4(ip);
    if (version === 6) return isPrivateIPv6(ip);
    return true;
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('链接格式无效');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('仅允许 http/https 链接');
    }
    const hostname = parsed.hostname;
    if (!hostname || ['localhost', 'localhost.localdomain'].includes(hostname.toLowerCase())) {
        throw new Error('不允许访问本机地址');
    }
    const directIpVersion = net.isIP(hostname);
    const addresses = directIpVersion ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(item => isPrivateAddress(item.address))) {
        throw new Error('不允许访问内网、回环或保留地址');
    }
    return parsed;
}

export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
    const parsed = await assertPublicHttpUrl(rawUrl);
    if (parsed.protocol !== 'https:') {
        throw new Error('生产存储端点仅允许 https 链接');
    }
    return parsed;
}

export async function assertPublicStorageEndpoint(rawUrl: string): Promise<URL> {
    const parsed = await assertPublicHttpUrl(rawUrl);
    if (parsed.protocol !== 'https:' && process.env.ALLOW_INSECURE_STORAGE_ENDPOINTS !== 'true') {
        throw new Error('存储端点仅允许 https；如确需 http，请显式设置 ALLOW_INSECURE_STORAGE_ENDPOINTS=true');
    }
    return parsed;
}
