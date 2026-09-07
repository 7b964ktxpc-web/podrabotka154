import { requireUser } from '@/lib/auth';
import { ActionForm } from '@/components/action-form';
import { changePassword } from '@/app/actions';
export default async function Password() { await requireUser(); return <section className="panel"><h1>Новый пароль</h1><ActionForm action={changePassword} label="Изменить пароль"><label>Пароль<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label></ActionForm></section>; }
