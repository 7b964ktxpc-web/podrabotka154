export function allowedPushEndpoint(endpoint: string): boolean {
    try {
        const u = new URL(endpoint);
        if (u.protocol !== 'https:' || u.username || u.password || u.port)
            return false;
        return u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.push.services.mozilla.com') || u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.notify.windows.com');
    }
    catch {
        return false;
    }
}
