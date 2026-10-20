const SESSION_QUERY_PARAM = '__vizzySession';

export function appWebSocketUrl(path: string): string {
    const url = new URL(
        `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`,
        window.location.href
    );
    const session = new URL(window.location.href).searchParams.get(SESSION_QUERY_PARAM);
    if (session) url.searchParams.set(SESSION_QUERY_PARAM, session);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.href;
}
