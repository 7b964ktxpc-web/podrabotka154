import type { Job, Option } from '@/lib/types';
import { saveJob } from '@/app/actions';
import { ActionForm } from './action-form';

export function JobForm({ cities, categories, job }: {
  cities: Option[];
  categories: Option[];
  job?: Job;
}) {
  return <ActionForm action={saveJob} label="Сохранить и посмотреть карточку">
    {job && <input type="hidden" name="id" value={job.id} />}
    <input type="hidden" name="photo_url" value={job?.photo_url || ''} />
    <div className="form-grid">
      <label className="span">Название
        <input name="title" required minLength={2} maxLength={200} defaultValue={job?.title} placeholder="Например: Грузчик на склад" />
        <small>Напишите простыми словами, кто нужен и на какую работу. Например: «Курьер на подработку».</small>
      </label>
      <label>Город
        <select name="city_id" defaultValue={job?.city_id} required>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <small>Выберите город, где человек будет работать.</small>
      </label>
      <label>Категория
        <select name="category" defaultValue={job?.category || ''}><option value="">Не указана</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <small>Выберите ближайшую категорию, чтобы вакансию было проще найти.</small>
      </label>
      <label className="span">Описание
        <textarea name="description" minLength={10} maxLength={20000} required defaultValue={job?.description} placeholder="Например: разгрузка товара на складе. Смена 8 часов. Оплата после смены. Нужна физическая выносливость." />
        <small>Здесь укажите задачи, требования, длительность смены, условия и важные детали.</small>
      </label>
      <label>Оплата от, ₽
        <input type="number" name="salary_min" min={0} max={100000000} step="0.01" defaultValue={job?.salary_min ?? ''} placeholder="4500" />
        <small>Минимальная сумма.</small>
      </label>
      <label>Оплата до, ₽
        <input type="number" name="salary_max" min={0} max={100000000} step="0.01" defaultValue={job?.salary_max ?? ''} placeholder="5000" />
        <small>Максимальная сумма.</small>
      </label>
      <label>Единица оплаты
        <select name="salary_type" defaultValue={job?.salary_type || ''}><option value="">Не указана</option><option value="shift">За смену</option><option value="hour">За час</option><option value="task">За задачу</option><option value="month">За месяц</option></select>
        <small>Например, 4500 ₽ за смену.</small>
      </label>
      <label>Когда платите
        <select name="payment_type" defaultValue={job?.payment_type || ''}><option value="">Не указано</option><option value="immediate">Сразу после работы</option><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option><option value="other">Другой порядок</option></select>
        <small>Фактический порядок выплаты.</small>
      </label>
      <label>Дата начала
        <input type="date" name="date_start" defaultValue={job?.date_start || ''} />
        <small>Когда начинается работа.</small>
      </label>
      <label>Дата окончания
        <input type="date" name="date_end" defaultValue={job?.date_end || ''} />
        <small>Когда заканчивается работа.</small>
      </label>
      <label>Время начала
        <input type="time" name="time_start" defaultValue={job?.time_start?.slice(0, 5) || ''} />
        <small>Например: 08:00.</small>
      </label>
      <label>Время окончания
        <input type="time" name="time_end" defaultValue={job?.time_end?.slice(0, 5) || ''} />
        <small>Например: 20:00.</small>
      </label>
      <label className="span">Адрес
        <input name="address_raw" maxLength={500} defaultValue={job?.address_raw || ''} placeholder="Например: ул. Большевистская, 45" />
        <small>Адрес показывается в карточке. Координаты и автоматическое геокодирование не используются.</small>
      </label>
      <label className="span">Ссылка на карту
        <input name="map_url" type="url" inputMode="url" maxLength={2000} defaultValue={job?.map_url || ''} placeholder="https://yandex.ru/maps/... или https://2gis.ru/..." />
        <small>Администратор сам находит точку в 2ГИС или Яндекс Картах, копирует ссылку и вставляет её сюда. На сайте будет одна кнопка «Посмотреть карту».</small>
      </label>
      <label>Телефон
        <input name="contact_phone" type="tel" defaultValue={job?.contact_phone || ''} placeholder="Например: +7 900 000-00-00" />
        <small>Телефон работодателя.</small>
      </label>
      <label>Telegram
        <input name="contact_telegram" defaultValue={job?.contact_telegram || ''} placeholder="Например: @username" />
        <small>Username Telegram.</small>
      </label>
      <label>Email
        <input type="email" name="contact_email" defaultValue={job?.contact_email || ''} placeholder="Например: work@example.org" />
        <small>Необязательно.</small>
      </label>
      <label>Тип занятости
        <input name="employment_type" maxLength={60} defaultValue={job?.employment_type || ''} placeholder="Например: Разовая работа" />
        <small>Разовая, временная, подработка или постоянная.</small>
      </label>
      <label className="span">Фото
        <input type="file" name="photo" accept="image/jpeg,image/png" />
        <small>JPEG/PNG до 800 КБ.</small>
      </label>
    </div>
  </ActionForm>;
}
