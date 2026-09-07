import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import { saveLimits, saveReference } from '@/app/actions';
export default async function Settings() {
    const { client } = await requireAdmin();
    const { data: settings } = check(await client.from('settings').select('value').eq('key', 'publication').single());
    const { data: cities } = check(await client.from('cities').select('*').order('name'));
    const { data: categories } = check(await client.from('job_categories').select('*').order('name'));
    function reference(table: string, p?: Record<string, string | boolean>) { return <ActionForm action={saveReference}><input type="hidden" name="table" value={table}/><input type="hidden" name="id" value={String(p?.id || '')}/><label>Название<input name="name" required defaultValue={String(p?.name || '')}/></label><label>Slug<input name="slug" required defaultValue={String(p?.slug || '')} placeholder="latin-letters"/></label>{table === 'cities' && <label>Часовой пояс IANA<input name="timezone" required defaultValue={String(p?.timezone || '')} placeholder="Asia/Novosibirsk"/></label>}<label className="check"><input type="checkbox" name="active" defaultChecked={p ? Boolean(p.active) : true}/>Активен</label></ActionForm>; }
    return <section className="panel"><h1>Настройки</h1><h2>Бесплатные размещения</h2><ActionForm action={saveLimits}><label>Лимит активных и ожидающих проверки вакансий<input type="number" min={0} max={100} name="free_active_limit" required defaultValue={settings.value.free_active_limit}/></label><label>Срок публикации, дней<input type="number" min={1} max={365} name="days" required defaultValue={settings.value.days}/></label></ActionForm><hr className="divider"/><h2>Города</h2>{cities?.map(c => <details key={c.id}><summary>{c.name}</summary>{reference('cities', c)}</details>)}<details><summary>+ Добавить город</summary>{reference('cities')}</details><h2 style={{ marginTop: 32 }}>Категории</h2>{categories?.map(c => <details key={c.id}><summary>{c.name}</summary>{reference('job_categories', c)}</details>)}<details><summary>+ Добавить категорию</summary>{reference('job_categories')}</details></section>;
}
