type CookieEnvironment = {
    NODE_ENV?: string;
    COOKIE_SECURE?: string;
    COOKIE_SECURE_FORCE?: string;
};

export function shouldUseSecureCookie(env: CookieEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    COOKIE_SECURE: process.env.COOKIE_SECURE,
    COOKIE_SECURE_FORCE: process.env.COOKIE_SECURE_FORCE,
}): boolean {
    const forced = env.COOKIE_SECURE_FORCE?.trim().toLowerCase();
    if (forced === 'true') return true;
    if (forced === 'false') return false;
    const explicit = env.COOKIE_SECURE?.trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return env.NODE_ENV === 'production';
}
