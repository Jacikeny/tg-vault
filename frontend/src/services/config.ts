const getApiBase = () => {
    // import.meta.env is injected by Vite; Node-based unit tests intentionally have no env object.
    const env = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string; PROD?: boolean } }).env;
    const envUrl = env?.VITE_API_URL;
    if (envUrl && envUrl !== 'http://localhost:51947' && envUrl !== '') {
        return envUrl;
    }

    // 如果在生产环境且没有配置，fallback 到相对路径（同域代理模式）
    if (env?.PROD) {
        return '';
    }
    return 'http://localhost:51947';
};

export const API_BASE = getApiBase();
console.log('🚀 TG Vault API_BASE:', API_BASE || '(relative path)');
