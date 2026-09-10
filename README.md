# Подработка 154

MVP сервиса поиска подработок, первый город — Новосибирск.

**Текущая схема размещения:** Web на Render + Supabase, автоматический импорт публичных Telegram-каналов и обработка очереди запускаются GitHub Actions. Vercel и Netlify в текущей схеме не используются.

## Начать локально

1. Создайте Supabase-проект и настройте `.env.local` по [SETUP.md](SETUP.md).
2. Примените SQL-миграции `001…020` и `supabase/seed.sql`.
3. Установите зависимости и запустите проверки:

```sh
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Используйте Node.js 22.18+ и npm. Секреты не отправляйте в чаты и не коммитьте `.env.local`.

## Что реализовано

- Next.js App Router, React, TypeScript и Tailwind.
- Каталог вакансий, поиск, категории, фильтры, пагинация и страницы вакансий.
- Supabase Auth, роли, профиль работодателя, создание/редактирование вакансий и модерация.
- Избранное, сохранённые поиски, уведомления и Web Push.
- Публичный Telegram-импорт с сохранением оригиналов сообщений, дедупликацией и консервативным парсером без платного AI.
- Очередь разбора Telegram с состояниями `pending / processing / processed / error` и повторными попытками.
- Админка для источников Telegram, импорта, разбора и модерации.
- Ручная ссылка на карту: администратор сам открывает 2ГИС или Яндекс Карты, копирует точную HTTPS-ссылку и вставляет её в поле **«Ссылка на карту»**. Автоматического геокодирования нет.
- На публичной вакансии используется одна кнопка **«Посмотреть карту ↗»**, если ссылка задана.
- Платежи оставлены только как sandbox-механика для дальнейшего развития.

## Telegram-импорт

`.github/workflows/import-public.yml` запускается каждые 5 минут, начиная с 7-й минуты каждого часа (`7-57/5`), и вручную через `workflow_dispatch`. GitHub Actions вызывает:

`GET /api/telegram/import-public`

с `Authorization: Bearer <CRON_SECRET>`.

Для работы расписания в GitHub Repository Secrets должны быть заданы:

- `PODRABOTKA154_APP_URL` — HTTPS-адрес приложения Render;
- `PODRABOTKA154_CRON_SECRET` — то же значение, что `CRON_SECRET` в Render.

## Уведомления и Web Push

Публикация вакансии создаёт задачу `notify_job`, которая подбирает пользователей с подходящими сохранёнными поисками. Затем для их Push-подписок создаются задачи отправки. Это обрабатывает бесплатный workflow `.github/workflows/notifications-worker.yml` каждые 5 минут и также вручную через `workflow_dispatch`.

Для него нужны GitHub Repository Secrets:

- `PODRABOTKA154_SUPABASE_URL`
- `PODRABOTKA154_SUPABASE_SERVICE_ROLE_KEY`
- `PODRABOTKA154_PUSH_PUBLIC_KEY`
- `PODRABOTKA154_PUSH_PRIVATE_KEY`
- `PODRABOTKA154_PUSH_SUBJECT`

Для самого Render Web Service также нужны:

- `PUSH_PUBLIC_KEY`
- `PUSH_PRIVATE_KEY`
- `PUSH_SUBJECT`

`PUSH_PUBLIC_KEY` используется сервером для передачи публичного VAPID-ключа браузеру. `PUSH_PRIVATE_KEY` и `PUSH_SUBJECT` остаются серверными секретами. Значения пары VAPID в Render и GitHub Actions должны соответствовать одной паре ключей.

`PODRABOTKA154_SUPABASE_SERVICE_ROLE_KEY` используется только внутри GitHub Actions и не должен попадать в браузер или клиентский код.

## Render

`render.yaml` описывает бесплатный Web Service `podrabotka154` с Node.js и `npm run build` / `npm start`.

Обязательные переменные Render:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `PUSH_PUBLIC_KEY`
- `PUSH_PRIVATE_KEY`
- `PUSH_SUBJECT`

`CRON_SECRET` генерируется Render в Blueprint-конфигурации; после создания сервиса его значение нужно скопировать в GitHub Secret `PODRABOTKA154_CRON_SECRET`.

## Проверки

CI GitHub Actions выполняет:

```sh
npm run typecheck
npm test
npm run build
```

Это не заменяет проверку реального Supabase, Render, Telegram, мобильного браузера и production-секретов.

## Документация

[ARCHITECTURE.md](ARCHITECTURE.md) · [SETUP.md](SETUP.md) · [TELEGRAM.md](TELEGRAM.md) · [PAYMENTS.md](PAYMENTS.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [SECURITY.md](SECURITY.md) · [QA.md](QA.md) · [FEATURES.md](FEATURES.md) · [AGENTS.md](AGENTS.md)
