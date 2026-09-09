import type { Job, Option } from '@/lib/types';
import { saveJob } from '@/app/actions';
import { ActionForm } from './action-form';

export function JobForm({ cities, categories, job }: { cities: Option[]; categories: Option[]; job?: Job }) {
  return <ActionForm action={saveJob} label="Сохранить и посмотреть карточку">
    {job && <input type="hidden" name="id" value={job.id} />}
    <input type="hidden" name="photo_url" value={job?.photo_url || ''} />

    <div className="form-section">
      <div className="form-section-head"><span className="form-step">1</span><div><h2>Что за работа?</h2><p>Название, город, категория и понятное описание.</p></div></div>
      <div className="form-grid">
        <label className="span">Название <em>обязательно</em>
          <input name="title" required minLength={2} maxLength={200} defaultValue={job?.title} placeholder="Например: Грузчик на склад" />
          <small>Коротко напишите, кто нужен и что предстоит делать.</small>
        </label>
        <label>Город <em>обязательно</em>
          <select name="city_id" defaultValue={job?.city_id} required>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label>Категория
          <select name="category" defaultValue={job?.category || ''}><option value="">Не указана</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <small>Поможет соискателю быстрее найти вакансию.</small>
        </label>
        <label className="span">Описание <em>обязательно</em>
          <textarea name="description" minLength={10} maxLength={20000} required defaultValue={job?.description} placeholder="Например: разгрузка товара на складе. Смена 8 часов. Оплата после смены. Нужна физическая выносливость." />
          <small>Задачи, требования, длительность смены, условия и важные детали.</small>
        </label>
      </div>
    </div>

    <div className="form-section">
      <div className="form-section-head"><span className="form-step">2</span><div><h2>Оплата и график</h2><p>Чем точнее условия, тем проще кандидату принять решение.</p></div></div>
      <div className="form-grid">
        <label>Оплата от, ₽
          <input type="number" name="salary_min" min={0} max={100000000} step="0.01" defaultValue={job?.salary_min ?? ''} placeholder="4500" inputMode="decimal" />
        </label>
        <label>Оплата до, ₽
          <input type="number" name="salary_max" min={0} max={100000000} step="0.01" defaultValue={job?.salary_max ?? ''} placeholder="5000" inputMode="decimal" />
        </label>
        <label>Единица оплаты
          <select name="salary_type" defaultValue={job?.salary_type || ''}><option value="">Не указана</option><option value="shift">За смену</option><option value="hour">За час</option><option value="task">За задачу</option><option value="month">За месяц</option></select>
        </label>
        <label>Когда платите
          <select name="payment_type" defaultValue={job?.payment_type || ''}><option value="">Не указано</option><option value="immediate">Сразу после работы</option><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option><option value="other">Другой порядок</option></select>
        </label>
        <label>Дата начала
          <input type="date" name="date_start" defaultValue={job?.date_start || ''} />
        </label>
        <label>Дата окончания
          <input type="date" name="date_end" defaultValue={job?.date_end || ''} />
        </label>
        <label>Время начала
          <input type="time" name="time_start" defaultValue={job?.time_start?.slice(0, 5) || ''} />
        </label>
        <label>Время окончания
          <input type="time" name="time_end" defaultValue={job?.time_end?.slice(0, 5) || ''} />
        </label>
        <label>Тип занятости
          <input name="employment_type" maxLength={60} defaultValue={job?.employment_type || ''} placeholder="Например: Разовая работа" />
          <small>Разовая смена, временная работа, подработка или постоянная.</small>
        </label>
      </div>
    </div>

    <div className="form-section">
      <div className="form-section-head"><span className="form-step">3</span><div><h2>Где и как связаться</h2><p>Контакт нужен, чтобы соискатель мог откликнуться напрямую.</p></div></div>
      <div className="form-grid">
        <label className="span">Адрес
          <input name="address_raw" maxLength={500} defaultValue={job?.address_raw || ''} placeholder="Например: ул. Большевистская, 45" />
          <small>Укажите улицу и номер дома. Ссылки на карты появятся автоматически.</small>
        </label>
        <label>Телефон
          <input name="contact_phone" type="tel" defaultValue={job?.contact_phone || ''} placeholder="+7 900 000-00-00" inputMode="tel" />
        </label>
        <label>Telegram
          <input name="contact_telegram" defaultValue={job?.contact_telegram || ''} placeholder="@username" />
        </label>
        <label>Email
          <input type="email" name="contact_email" defaultValue={job?.contact_email || ''} placeholder="work@example.org" inputMode="email" />
          <small>Необязательно.</small>
        </label>
        <label className="span">Фото
          <input type="file" name="photo" accept="image/jpeg,image/png" />
          <small>JPEG или PNG до 800 КБ. Не загружайте документы и персональные данные.</small>
        </label>
      </div>
    </div>

    <div className="form-tip"><b>Перед отправкой</b><span>Проверьте оплату, дату, адрес и хотя бы один способ связи. После сохранения вакансия попадёт на модерацию.</span></div>
  </ActionForm>;
}
