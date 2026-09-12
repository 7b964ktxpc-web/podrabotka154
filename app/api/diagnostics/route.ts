import { serviceDb } from '@/lib/service-db';
import { appUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://rweitwvwdnjxwovmvnwm.supabase.co');
  const anonSet = Boolean(process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const serviceSet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  let serviceReachable = false;
  let adminConfigured = false;
  let serviceError: string | null = null;
  if (serviceSet) {
    try {
      const { count, error } = await serviceDb().from('profiles').select('roles', { count: 'exact', head: true }).contains('roles', ['admin']);
      if (error) {
        serviceError = error.message;
      }
      else {
        serviceReachable = true;
        adminConfigured = (count ?? 0) > 0;
      }
    }
    catch (e) {
      serviceError = e instanceof Error ? e.message : 'unknown_error';
    }
  }
  else {
    serviceError = 'SUPABASE_SERVICE_ROLE_KEY not set';
  }
  return Response.json({
    appUrl: appUrl(),
    supabaseProject: url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
    anonKeyConfigured: anonSet,
    serviceRoleKeyConfigured: serviceSet,
    serviceRoleReachable: serviceReachable,
    adminConfigured: adminConfigured,
    serviceError: serviceError,
  });
}