# Первый запуск

## 1. Среда

Node.js 22.18+ с npm, Git по желанию, доступ в интернет для пакетов и Supabase. Подойдёт Windows, macOS или Linux.

```sh
node --version
npm --version
npm install
```

Lockfile пока отсутствует, поэтому Render/CI используют `npm install`. После успешной установки отдельно сохраните lockfile и перейдите на `npm ci`, когда это будет сделано осознанно.

## 2. Supabase

Используйте проект Supabase и применяйте миграции из `supabase/migrations` **по порядку от 001 до текущей (019)**. Не запускайте их повторно в уже инициализированной базе и не смешивайте миграции этого проекта с чужой схемой.

Ветка `render` уже рассчитана на актуальную схему с публичным Telegram-импортом, дедупликацией и ограничением прямого доступа к импортным RPC. Для существующего проекта сначала проверьте `supabase/migrations` и список применённых миграций в Supabase.

После миграций при необходимости примените `supabase/seed.sql` только к новой/тестовой базе.

## 3. Переменные окружения

Скопируйте `.env.example` в `.env.local`.

| Переменная | Значение |
|---|---|
| NEXT_PUBLIC_APP_URL | `http://localhost:3000` локально; на Render — фактический HTTPS-адрес |
| SUPABASE_URL | URL проекта Supabase |
| SUPABASE_ANON_KEY | publishable/anon key для клиентских операций под RLS |
| SUPABASE_SERVICE_ROLE_KEY | серверный привилегированный ключ, никогда не `NEXT_PUBLIC_…` |
| DEMO_DATA | `false` |
| PARSER_PROVIDER | `conservative` |
| CRON_SECRET | секрет для Render cron → `/api/telegram/import-public` |
| TELEGRAM_BOT_TOKEN | необязателен для публичного web-импорта; нужен только для bot webhook-сценария |
| TELEGRAM_WEBHOOK_SECRET | случайный секрет для webhook |
| TELEGRAM_API_ID / TELEGRAM_API_HASH | текущая версия публичного web-адаптера их не требует |
| WORKER_INTERVAL_SECONDS | интервал worker, минимум 10 секунд |
| WORKER_BATCH_SIZE | заданий за цикл, 1–20 |
| PUSH_PUBLIC_KEY / PUSH_PRIVATE_KEY | VAPID-пара |
| PUSH_SUBJECT | реальный `mailto:` контакт администратора |
| PAYMENT_PROVIDER | `sandbox` |
| PAYMENT_WEBHOOK_SECRET | случайный секрет |
| SANDBOX_PAYMENTS_ENABLED | `false`, включать только для тестов |

Проверьте env:

```sh
node --env-file=.env.local scripts/check-env.mjs
```

Платный `AI_API_KEY` для текущего conservative-парсера не нужен.

## 4. Render

Рабочая ветка — `render`.

Web-сервис:

```text
https://podrabotka154.onrender.com
```

Blueprint `render.yaml` содержит web service и отдельный cron `podrabotka154-telegram-import`, который каждые 15 минут запускает `scripts/render-cron-import.mjs`.

Важно: файл `render.yaml` сам по себе не подтверждает, что Render уже синхронизировал cron. Это проверяется в панели Render.

## 5. Telegram-импорт

Для публичного канала используется `@rabota154NsK`.

Endpoint:

```text
GET /api/telegram/import-public
Authorization: Bearer <CRON_SECRET>
```

Импорт получает публичные сообщения, сохраняет новые записи в `telegram_messages`, разбирает их консервативным парсером и создаёт/обновляет вакансии со статусом `pending_moderation`. Автоматической публикации нет.

Повторный импорт не должен создавать второй job для того же Telegram-сообщения.

## 6. Auth и администратор

В Supabase Auth задайте Site URL и callback/redirect URL для локального адреса и фактического Render HTTPS-домена.

После регистрации пользователя подтвердите email, найдите UUID в Supabase Authentication → Users и локально выполните:

```sh
npm run admin -- AUTH_USER_UUID
```

Не публикуйте UUID, пароли или service-role ключ в GitHub/чаты.

## 7. Локальный запуск

```sh
npm run typecheck
npm test
npm run build
npm start
```

Отдельный worker:

```sh
npm run worker
# или один цикл
npm run worker:once
```

Для задач Telegram web-импорта worker не нужен: публичный импорт выполняется самим endpoint. Worker нужен для остальных фоновых задач очереди.

## 8. Первое реальное объявление

Путь работодателя:

`профиль → разместить → предпросмотр → отправить → модерация → публикация`.

Путь Telegram:

`Render cron/import → Supabase → /admin/moderation → проверить поля → опубликовать`.

Если в тексте нет адреса, даты, времени, оплаты или контакта — ничего не придумывать. Модератор должен проверить оригинал и при необходимости вернуть объявление в черновик.

## 9. Push

Сгенерируйте VAPID-ключи:

```sh
npm run keys
```

Сохраните ключи в env, войдите на HTTPS, сохраните поиск с уведомлениями и включите Push в профиле.

## 10. Финальная проверка

Перед открытием сервиса:

```sh
npm run typecheck
npm test
npm run build
```

Затем проверьте на Render `/`, `/jobs`, `/login`, `/admin/moderation`, публичный Telegram-import и повторный импорт без дублей. Полный acceptance checklist находится в `QA.md`.
