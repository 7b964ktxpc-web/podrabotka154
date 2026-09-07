import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { hasRole } from "./domain";
export async function requireUser() { const client = await db(); const { data: { user }, error } = await client.auth.getUser(); if (error || !user)
    redirect('/login'); return { client, user }; }
export async function requireAdmin() { const ctx = await requireUser(); const { data } = await ctx.client.from('profiles').select('roles').eq('id', ctx.user.id).single(); if (!hasRole(data?.roles ?? null, 'admin'))
    redirect('/profile?notice=forbidden'); return ctx; }
