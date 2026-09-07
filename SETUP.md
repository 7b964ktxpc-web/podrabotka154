# Первый запуск

## 1. Среда

Node.js 22.18+ с npm, Git по желанию, доступ в интернет для пакетов и Supabase. Подойдёт Windows, macOS или Linux. Телефон не обязан хранить код или секреты; использовать терминал на телефоне для первого запуска не рекомендуется.

```sh
node --version
npm --version
npm install
```

Зависимости заданы совместимыми диапазонами. Здесь нет `package-lock.json`, потому что пакеты нельзя было получить из сети. После первой успешной установки сохраните и проверьте lockfile, выполните `npm audit`, затем закоммитьте его и используйте `npm ci`. Не применяйте `npm audit fix --force` вслепую.

## 2. Supabase

Откройте https://supabase.com/dashboard и создайте **новый** проект на подходящем бесплатном тарифе. Проверьте текущие квоты, доступность из своего региона и требования к размещению персональных данных. Пароль PostgreSQL храните у себя.

В SQL Editor поочерёдно выполните полное содержимое:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_functions.sql`
3. `supabase/migrations/003_storage.sql`
4. `supabase/migrations/004_notifications.sql`
5. `supabase/migrations/005_analytics.sql`
6. `supabase/migrations/006_admin.sql`
7. `supabase/migrations/007_consistency.sql`
8. `supabase/migrations/008_limits.sql`
9. `supabase/seed.sql`

Эти миграции создают новую схему: не выполняйте их повторно и не применяйте к чужому работающему проекту. Supabase предоставляет `auth.users`, роли `anon/authenticated/service_role` и схему Storage. Обычный PostgreSQL без Supabase Auth/Storage не является drop-in заменой данной реализации.

## 3. Переменные

Скопируйте `.env.example` в `.env.local` (Windows: `Copy-Item .env.example .env.local`, macOS/Linux: `cp .env.example .env.local`).

| Переменная | Значение |
|---|---|
| NEXT_PUBLIC_APP_URL | `http://localhost:3000` локально, фактический HTTPS-домен на хостинге |
| SUPABASE_URL | URL проекта Supabase |
| SUPABASE_ANON_KEY | anon/publishable key для публичного API под RLS; в этой архитектуре используется на сервере |
| SUPABASE_SERVICE_ROLE_KEY | привилегированный серверный ключ, никогда не `NEXT_PUBLIC_…` |
| DEMO_DATA | `false`; демовакансии в архив не включены |
| PARSER_PROVIDER | `conservative` |
| TELEGRAM_BOT_TOKEN | только для управляемого вами бота, необязателен при ручном импорте |
| TELEGRAM_WEBHOOK_SECRET | случайные 32+ символа A-Z/a-z/0-9/_/- |
| TELEGRAM_API_ID / TELEGRAM_API_HASH | зарезервированы, текущая версия их не использует |
| WORKER_INTERVAL_SECONDS | интервал циклов, минимум 10 секунд |
| WORKER_BATCH_SIZE | заданий за цикл, от 1 до 20 |
| PUSH_PUBLIC_KEY / PUSH_PRIVATE_KEY | пара VAPID, публичный ключ может быть передан браузеру |
| PUSH_SUBJECT | ваш реальный `mailto:` контакт администратора |
| PAYMENT_PROVIDER | `sandbox` |
| PAYMENT_WEBHOOK_SECRET | случайный секрет 32+ символа, не пароль аккаунта |
| SANDBOX_PAYMENTS_ENABLED | `false` по умолчанию; `true` только для тестового flow |
| TEST_SUPABASE_* | отдельная одноразовая тестовая база, не production |
| E2E_* | аккаунты только для тестового окружения |

Выполните проверку наличия значений:

```sh
node --env-file=.env.local scripts/check-env.mjs
```

Она не подтверждает доступность серверов. Ключ `AI_API_KEY` не нужен, платный AI не используется.

## 4. Auth и почта

В Supabase Auth задайте Site URL и Redirect URLs:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=/profile/password`
- те же пути на фактическом HTTPS-домене.

Включите подтверждение email. Настройте собственный SMTP для общедоступной регистрации и сброса пароля: https://supabase.com/docs/guides/auth/auth-smtp. Встроенная почта Supabase ограничена адресами команды и тестовыми лимитами; это не бесплатная production-почта для всех посетителей. Выберите SMTP с подходящими бесплатными лимитами, настройте подтверждённого отправителя, SPF/DKIM. Покупать сервис без проверки необходимости не нужно.

Для изолированных тестов аккаунты можно создавать через Supabase Dashboard с подтверждённым email. Отключение проверки email не является рекомендуемой production-настройкой.

## 5. Запуск

```sh
npm run typecheck
npm test
npm run dev
```

Откройте http://localhost:3000. В отдельном терминале:

```sh
npm run worker
```

Зарегистрируйтесь, подтвердите email. В Supabase Auth Users найдите UUID и выдайте роль:

```sh
npm run admin -- AUTH_USER_UUID
```

Откройте `/profile`, затем `/admin`. Секреты остаются на сервере. Для работодателя сначала заполните `/employer`.

## 6. Первое реальное объявление

Для работодателя: профиль → разместить → предпросмотр → отправить на публикацию → администратор проверяет → опубликовать.

Для вашего случая с чужим каналом: `/admin/telegram` → активировать источник в manual-режиме → вставить **реальный** номер, дату и полный текст сообщения, на публикацию которого есть основание → worker → модерация. Не заменяйте импорт вымышленными примерами.

## 7. Push

```sh
npm run keys
```

Сохраните пару ключей в env, перезапустите web и worker. Откройте сайт на HTTPS либо localhost, войдите, сохраните поиск с уведомлениями и включите Push в профиле. Опубликуйте подходящую вакансию **после** создания поиска. Worker отправит уведомление.

На iOS поддержка Web Push зависит от версии ОС и установки сайта на главный экран. Неподдерживаемые браузеры должны показывать объяснение. Не сохраняйте приватный VAPID-ключ в браузере.

## 8. Проверка перед размещением

```sh
npm run build
npm run start
```

Полный порядок проверок в QA.md. При ошибке остановите выпуск и исправьте её. Архив не содержит результатов реального запуска Supabase или Next.
