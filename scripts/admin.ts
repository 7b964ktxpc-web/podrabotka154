import { serviceDb, check } from '../lib/service-db';
const id = process.argv[2];
if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    throw new Error('Usage: npm run admin -- AUTH_USER_UUID');
const c = serviceDb();
const { data: p } = check(await c.from('profiles').select('roles').eq('id', id).single());
check(await c.from('profiles').update({ roles: Array.from(new Set([...p.roles, 'admin'])) }).eq('id', id));
console.log('Admin role granted to the specified existing user.');
