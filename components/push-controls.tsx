'use client';
import { useState } from 'react';
export function PushControls({ publicKey }: {
    publicKey: string;
}) {
    const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    async function toggle(enable: boolean) { setBusy(true); try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
            throw new Error('Браузер не поддерживает Web Push. На iPhone откройте установленный на главный экран сайт.');
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (enable) {
            if (await Notification.requestPermission() !== 'granted')
                throw new Error('Разрешите уведомления в настройках браузера.');
            if (!sub) {
                const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(publicKey.length / 4) * 4, '=')), c => c.charCodeAt(0));
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
            }
            const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
            if (!r.ok)
                throw new Error((await r.json()).error);
            setMessage('Уведомления включены. Сохраните поиск с отметкой «Уведомлять».');
        }
        else if (sub) {
            const r = await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
            if (!r.ok)
                throw new Error((await r.json()).error);
            await sub.unsubscribe();
            setMessage('Уведомления в этом браузере отключены.');
        }
        else
            setMessage('В этом браузере нет подписки.');
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Не удалось изменить настройки');
    }
    finally {
        setBusy(false);
    } }
    return <section><h2>Уведомления</h2><p className="small muted">На iPhone Web Push работает у сайтов, добавленных на главный экран, при поддержке вашей версией iOS.</p>{!publicKey && <p className="message">Администратор ещё не настроил Push. Уведомления доступны ниже в кабинете.</p>}<div className="row"><button disabled={!publicKey || busy} onClick={() => toggle(true)}>Включить Push</button><button disabled={busy} onClick={() => toggle(false)}>Отключить на этом устройстве</button></div><p role="status">{message}</p></section>;
}
