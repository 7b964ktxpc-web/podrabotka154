import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
export default async function Order({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; const { client, user } = await requireUser(); const { data: o } = check(await client.from('orders').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()); if (!o)
    notFound(); return <section className="panel"><h1>Тестовый заказ</h1><p className="message">Это sandbox. Денежных списаний нет. Обновление статуса возможно только после серверного подтверждения.</p><h2>{o.product_snapshot.name}</h2><p className="salary">{o.amount / 100} ₽</p><p>Статус: {o.status}</p><p className="small muted">Номер для тестирования: {o.id}</p><div className="row"><Link className="button" href={'/orders/' + id}>Обновить статус</Link><Link href="/employer">К моим вакансиям</Link></div></section>; }
