import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appUrl } from '@/lib/env';
export async function GET(req: Request) { const url = new URL(req.url); const code = url.searchParams.get('code'); if (code) {
    const client = await db();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
        const next = url.searchParams.get('next') === '/profile/password' ? '/profile/password' : '/profile';
        return NextResponse.redirect(appUrl() + next);
    }
} const failed = url.searchParams.get('error') === 'access_denied' ? '?notice=confirmation_failed&reason=access_denied' : '?notice=confirmation_failed';
return NextResponse.redirect(appUrl() + '/login' + failed); }
