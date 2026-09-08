import type { Option } from '@/lib/types';
import type { SearchFilters } from '@/lib/domain';

export function CatalogFilters({ f, categories }: { f: SearchFilters; categories: Option[] }) {
  return <form action="/jobs" className="filters">
    <h2>Уточнить поиск</h2>
    <input type="hidden" name="q" value={f.q}/>
    <input type="hidden" name="where" value={f.where}/>
    <div className="filter-fields">
      <label>Категория<select name="category" defaultValue={f.category}><option value="">Все категории</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Оплата от, ₽<input type="number" name="min" min="0" defaultValue={f.min ?? ''} placeholder="Например, 3000"/></label>
      <label>Когда<select name="day" defaultValue={f.day || ''}><option value="">Любая дата</option><option value="today">Сегодня</option><option value="tomorrow">Завтра</option>{f.day && <option value={f.day}>{f.day}</option>}</select></label>
      <label>Способ оплаты<select name="payment" defaultValue={f.payment}><option value="">Любой</option><option value="immediate">Сразу / после смены</option><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option></select></label>
      <label>Тип занятости<select name="employment" defaultValue={f.employment}><option value="">Любой</option><option value="Подработка">Подработка</option><option value="Разовая работа">Разовая работа</option><option value="Постоянная">Постоянная</option></select></label>
      <label>Сортировка<select name="sort" defaultValue={f.sort}><option value="relevance">По релевантности</option><option value="recent">Сначала новые</option><option value="salary_desc">Сначала высокая оплата</option><option value="salary_asc">Сначала низкая оплата</option></select></label>
    </div>
    <label className="check"><input type="checkbox" name="instant" value="1" defaultChecked={f.instant}/>С оплатой сразу</label>
    <label className="check"><input type="checkbox" name="employer" value="1" defaultChecked={f.employer}/>От работодателя</label>
    <label className="check"><input type="checkbox" name="address" value="1" defaultChecked={f.address}/>С адресом</label>
    <button className="primary">Применить</button>
    <p><a href="/jobs" className="small muted">Сбросить фильтры</a></p>
    <p className="small muted">Порог сравнивается с указанной минимальной оплатой вакансии; единица зависит от типа оплаты.</p>
  </form>;
}
