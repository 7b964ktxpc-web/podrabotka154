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
        <small>Здесь укажите задачи, требования, длительность смены, условия и важные детали. Не оставляйте только название.</small>
      </label>

      <label>Оплата от, ₽
        <input type="number" name="salary_min" min={0} max={100000000} step="0.01" defaultValue={job?.salary_min ?? ''} placeholder="4500" />
        <small>Минимальная сумма. Если оплата фиксированная — можно указать только её.</small>
      </label>

      <label>Оплата до, ₽
        <input type="number" name="salary_max" min={0} max={100000000} step="0.01" defaultValue={job?.salary_max ?? ''} placeholder="5000" />
        <small>Максимальная сумма, если она зависит от объёма или условий работы.</small>
      </label>

      <label>Единица оплаты
        <select name="salary_type" defaultValue={job?.salary_type || ''}><option value="">Не указана</option><option value="shift">За смену</option><option value="hour">За час</option><option value="task">За задачу</option><option value="month">За месяц</option></select>
        <small>Например, 4500 ₽ за смену или 500 ₽ за час.</small>
      </label>

      <label>Когда платите
        <select name="payment_type" defaultValue={job?.payment_type || ''}><option value="">Не указано</option><option value="immediate">Сразу после работы</option><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option><option value="other">Другой порядок</option></select>
        <small>Выберите фактический порядок выплаты. Если есть нюансы — напишите их в описании.</small>
      </label>

      <label>Дата начала
        <input type="date" name="date_start" defaultValue={job?.date_start || ''} />
        <small>Когда начинается работа. Оставьте пустым, если дата пока неизвестна.</small>
      </label>

      <label>Дата окончания
        <input type="date" name="date_end" defaultValue={job?.date_end || ''} />
        <small>Когда вакансия или работа заканчивается. Для постоянной работы можно оставить пустым.</small>
      </label>

      <label>Время начала
        <input type="time" name="time_start" defaultValue={job?.time_start?.slice(0, 5) || ''} />
        <small>Например: 08:00. Указывайте местное время города работы.</small>
      </label>

      <label>Время окончания
        <input type="time" name="time_end" defaultValue={job?.time_end?.slice(0, 5) || ''} />
        <small>Например: 20:00. Для ночной смены укажите время окончания следующего дня в описании.</small>
      </label>

      <label className="span">Адрес
        <input name="address_raw" maxLength={500} defaultValue={job?.address_raw || ''} placeholder="Например: ул. Большевистская, 45" />
        <small>Укажите улицу и номер дома, если они известны. Если адреса нет — оставьте пустым. Кнопки 2ГИС и Яндекс Карты появятся автоматически только при наличии адреса.</small>
      </label>

      <label>Телефон
        <input name="contact_phone" type="tel" defaultValue={job?.contact_phone || ''} placeholder="Например: +7 900 000-00-00" />
        <small>Телефон, по которому кандидат сможет связаться с работодателем.</small>
      </label>

      <label>Telegram
        <input name="contact_telegram" defaultValue={job?.contact_telegram || ''} placeholder="Например: @username" />
        <small>Укажите username Telegram, например @username. Не вставляйте ссылку на исходное объявление.</small>
      </label>

      <label>Email
        <input type="email" name="contact_email" defaultValue={job?.contact_email || ''} placeholder="Например: work@example.org" />
        <small>Необязательно. Адрес будет виден кандидатам.</small>
      </label>

      <label>Тип занятости
        <input name="employment_type" maxLength={60} defaultValue={job?.employment_type || ''} placeholder="Например: Разовая работа" />
        <small>Напишите: разовая смена, временная работа, подработка или постоянная работа.</small>
      </label>

      <label className="span">Фото
        <input type="file" name="photo" accept="image/jpeg,image/png" />
        <small>Можно добавить фото места работы или результата. Только JPEG/PNG до 800 КБ. Не загружайте документы и персональные данные.</small>
      </label>
    </div>
  </ActionForm>;
}
