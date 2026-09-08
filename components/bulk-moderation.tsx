'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { bulkModerateJobs } from '@/app/actions';

export function BulkModeration({ ids }: { ids: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = selected.length === ids.length && ids.length > 0;
  const toggleAll = () => setSelected(all ? [] : ids);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);

  return <ActionForm action={bulkModerateJobs} label="Применить к выбранным" disabled={!selected.length}>
    <div className="panel" style={{ margin: '16px 0', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Массовая модерация</strong>
        <button type="button" className="button" onClick={toggleAll}>{all ? 'Снять выбор' : 'Выбрать все'}</button>
      </div>
      <p className="small muted">Выбрано: {selected.length}. Для публикации сначала проверьте адрес, оплату и контакты.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: 220 }}>Решение<select name="status" defaultValue="published"><option value="published">Опубликовать</option><option value="rejected">Отклонить</option><option value="archived">Архивировать</option><option value="draft">Вернуть в черновик</option></select></label>
        <label style={{ flex: 1, minWidth: 220 }}>Причина<textarea name="reason" maxLength={1000} placeholder="Причина для отклонения/возврата (необязательно)" /></label>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {ids.map((id) => <label key={id} style={{ display: 'none' }}><input type="checkbox" name="ids" value={id} checked={selected.includes(id)} onChange={() => toggle(id)} />{id}</label>)}
      </div>
    </div>
  </ActionForm>;
}
