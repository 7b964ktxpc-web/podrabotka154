# Размещение

## Текущая схема

Проект разворачивается как **Render Web Service**. Supabase используется для PostgreSQL/Auth/Storage. Vercel и Netlify в текущей схеме не используются.

Публичный Telegram-импорт работает через GitHub Actions: расписание вызывает защищённый endpoint Render. Это позволяет не держать отдельный постоянно работающий worker для самого импорта.

## Render Web Service

`render.yaml` содержит:

- имя сервиса: `podrabotka154`;
- runtime: Node.js;
- план: `free` для MVP/тестирования;
- build: `npm install && npm run build`;
- start: `npm start`;
- health check: `/api/health`.

Переменные Render:

```text
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=<Render generates this value>
```

После создания сервиса нужен его HTTPS-адрес. Этот адрес используется как значение GitHub Secret `PODRABOTKA154_APP_URL`.

Free Web Service у Render может засыпать после периода без входящего трафика и просыпается при следующем HTTP-запросе; это нормальное ограничение бесплатного MVP.

## GitHub Actions: импорт Telegram

Файл `.github/workflows/import-public.yml` запускается каждые 5 минут и также поддерживает ручной запуск.

В GitHub Repository Secrets нужны:

```text
PODRABOTKA154_APP_URL=https://<ваш-сервис>.onrender.com
PODRABOTKA154_CRON_SECRET=<точно такой же секрет, как CRON_SECRET в Render>
```

Workflow вызывает:

```text
GET /api/telegram/import-public
Authorization: Bearer <CRON_SECRET>
```

Запуск расписания GitHub выполняется по UTC; scheduled runs могут задерживаться при высокой нагрузке.

### Важный порядок настройки

1. Создать Supabase и применить миграции `001…019`.
2. Создать Render Web Service из репозитория.
3. Заполнить Supabase-переменные.
4. Получить URL Render и убедиться, что `/api/health` отвечает `200`.
5. Взять сгенерированный Render `CRON_SECRET`.
6. Добавить два GitHub Secrets из раздела выше.
7. Запустить `import-public.yml` вручную один раз.
8. Проверить результат в админке Telegram и затем оставить расписание включённым.

## Поиск и сортировка

Каталог поддерживает:

- текстовый поиск;
- город/адрес;
- категорию;
- минимальную оплату за смену;
- дату;
- способ оплаты;
- тип занятости;
- оплату сразу;
- вакансии от работодателя;
- вакансии с адресом;
- сортировку по релевантности, новизне и оплате.

Миграции `018_search_filters.sql` и `019_search_sort.sql` синхронизируют SQL-поиск с фильтрами интерфейса и сохранёнными поисками.

## Уведомления

Цепочка новых вакансий:

`публикация → work_queue → notify_job → notifications → push queue → Web Push`.

Сохранённый поиск проверяется по тем же основным фильтрам, что и каталог. Повторные уведомления защищены dedupe-ключами.

## Карта вакансии

Автоматического геокодирования нет.

Администратор вручную:

1. открывает 2ГИС или Яндекс Карты;
2. находит точный адрес/точку;
3. копирует HTTPS-ссылку;
4. вставляет её в поле **«Ссылка на карту»** при создании или редактировании вакансии.

Пользователь видит одну кнопку **«Посмотреть карту ↗»**. Если ссылка не указана, кнопка не показывается.

## Локальная проверка

```sh
npm install
npm run typecheck
npm test
npm run build
```

## Старый worker

В репозитории worker остаётся для локальной/отдельной фоновой обработки, но он не является обязательным компонентом схемы публичного Telegram-импорта Render.

```sh
npm run worker
npm run worker:once
```

Для 24/7 фоновых задач в будущем можно использовать отдельный worker или Render Cron. Текущий бесплатный MVP использует GitHub Actions вместо постоянно работающего Render worker.

## Ограничения бесплатного MVP

Free Render предназначен для тестирования и hobby-проектов, а не для гарантированного production SLA. Перед публичным запуском дополнительно проверить Supabase, SMTP, Telegram, мобильный браузер, права ролей, резервное копирование и требования к хранению персональных данных.
