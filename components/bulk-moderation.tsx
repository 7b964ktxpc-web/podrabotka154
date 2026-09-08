import { ActionForm } from '@/components/action-form';
import { bulkModerateJobs } from '@/app/actions';

export function BulkModeration({ jobs }: { jobs: Array<{ id: string; title: string }> }) {
  return <ActionForm action={bulkModerateJobs} label="Применить к выбранным" disabled={!jobs.length}>
    <div className="panel" style={{ margin: '16px 0', display: 'grid', gap: 10 }}>
      <strong>Массовая модерация</strong>
      <label>Объявления<select name="ids" multiple required size={Math.min(8, Math.max(3, jobs.length))}>
        {jobs.map((job) => <option key={job.id} value={job.id}>{job.title || 'Без названия'}</option>)}
      </select></label>
      <p className="small muted">Можно выбрать несколько объявлений. Перед публикацией проверьте данные ниже.</p>
      <label>Решение<select name="status" defaultValue="published"><option value="published">Опубликовать</option><option value="rejected">Отклонить</option><option value="archived">Архивировать</option><option value="draft">Вернуть в черновик</option></select></label>
      <label>Причина<textarea name="reason" maxLength={1000} placeholder="Причина для отклонения/возврата (необязательно)" /></label>
    </div>
  </ActionForm>;
}
