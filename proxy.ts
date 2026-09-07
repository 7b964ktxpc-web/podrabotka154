import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
        return response;
    const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        cookies: { getAll() { return request.cookies.getAll(); }, setAll(values) { for (const { name, value } of values)
                request.cookies.set(name, value); response = NextResponse.next({ request }); for (const { name, value, options } of values)
                response.cookies.set(name, value, options); } }
    });
    await supabase.auth.getUser();
    return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|api/telegram|api/payments).*)'] };
