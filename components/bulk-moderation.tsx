'use client';

import { useMemo, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { bulkModerateJobs } from '@/app/actions';

type Job = { id: string; title: string };

export function BulkModeration({ jobs }: { jobs: Job[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = jobs.length > 0 && selected.length === jobs.length;
  const count = selected.length;
  const options = useMemo(() => jobs.map((job) => ({ ...job, title: job.title || 'Без названия' })), [jobs]);
  const toggleAll = () => setSelected(allSelected ? [] : options.map((job) => job.id));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <ActionForm action={bulkModerateJobs} label={count ? `Применить к выбранным (${count})` : 'Выберите объявления'} disabled={!count}>
    <div className="panel" style={{ margin: '16px 0', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong>Массовая модерация</strong>
        <button type="button" className="button" onClick={toggleAll}>{allSelected ? 'Снять выбор' : `Выбрать все (${jobs.length})`}</button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map((job) => <label key={job.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" name="ids" value={job.id} checked={selected.includes(job.id)} onChange={() => toggle(job.id)} />
          <span>{job.title}</span>
        </label>)}
      </div>
      <label>Решение<select name="status" defaultValue="" required>
        <option value="" disabled>Выберите решение</option>
        <option value="published">Опубликовать</option>
        <option value="rejected">Отклонить</option>
        <option value="archived">Архивировать</option>
        <option value="draft">Вернуть в черновик</option>
      </select></label>
      <label>Причина<textarea name="reason" maxLength={1000} placeholder="Что нужно исправить или почему принято решение" /></label>
      <p className="small muted">Публикация — явное действие. Выберите «Опубликовать» только после проверки оплаты, адреса и контактов.</p>
    </div>
  </ActionForm>;
}
