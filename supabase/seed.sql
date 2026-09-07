-- Reference data only. No invented vacancies or employer accounts.
insert into cities(name,slug,timezone) values('Новосибирск','novosibirsk','Asia/Novosibirsk') on conflict do nothing;
insert into job_categories(name,slug) values('Грузчики','loaders'),('Курьеры','couriers'),('Водители','drivers'),('Разнорабочие','laborers'),('Склад','warehouse'),('Кассиры','cashiers'),('Уборка','cleaning'),('Строительство','construction'),('Официанты','waiters'),('Промоутеры','promoters') on conflict do nothing;
insert into settings(key,value) values('publication','{"free_active_limit":1,"days":7}'),('brand','{"name":"Подработка 154","city_slug":"novosibirsk"}') on conflict do nothing;
insert into telegram_sources(name,username,city_id,adapter,active) select 'Работа Новосибирск','rabota154NsK',id,'manual',false from cities where slug='novosibirsk' on conflict do nothing;
-- Example prices are editable DATABASE seed values, not frontend constants. Paid products disabled by default.
insert into products(code,name,price_kopecks,days,priority,placements,active,kind) values
('NORMAL','Бесплатное размещение',0,7,0,1,true,'normal'),('BOOST','Поднять',9900,1,1,0,false,'boost'),('HIGHLIGHT','Выделить',19900,7,2,0,false,'highlight'),('VIP','Закрепить среди релевантных',39900,7,3,0,false,'vip'),
('START','Пакет START',49000,30,0,5,false,'package'),('BUSINESS','Пакет BUSINESS',99000,30,0,15,false,'package'),('PRO','Пакет PRO',199000,30,0,40,false,'package'),('PRO_EMPLOYER','PRO Employer',299000,30,0,60,false,'subscription') on conflict do nothing;
insert into pricing_plans(code,name,product_id) select code,name,id from products where kind in ('package','subscription') on conflict do nothing;
