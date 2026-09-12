# Подработка 154

MVP сервиса поиска подработок, первый город — Новосибирск.

**Текущая схема размещения:** Web на Render + Supabase, автоматический импорт публичных Telegram-каналов и обработка очереди запускаются GitHub Actions. Vercel и Netlify в текущей схеме не используются.

## Начать локально

1. Создайте Supabase-проект и настройте `.env.local` по [SETUP.md](SETUP.md).
2. Примените SQL-миграции `001…022` и `supabase/seed.sql`.
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

`.github/workflows/import-public.yml` запускается каждые 5 минут, начиная с 7-й минуты каждого часа (`7-57/5`), и вручную через `workflow_dispatch`.

GitHub Actions запускает `npm run import-public`, который напрямую обращается к Supabase с service-role ключом, получает активные источники `public_web`, читает публичные Telegram-страницы `t.me/s/<username>` и сохраняет оригиналы сообщений через RPC. После сохранения сообщения попадают в очередь `parse`.

Автоматической публикации из Telegram нет: после разбора вакансия сохраняется со статусом `pending_moderation` и ждёт ручного решения администратора.

Для работы расписания в GitHub Repository Secrets должны быть заданы:

- `PODRABOTKA154_SUPABASE_URL` — URL проекта Supabase;
- `PODRABOTKA154_SUPABASE_SERVICE_ROLE_KEY` — серверный ключ Supabase.

## Уведомления и Web Push

Публикация вакансии создаёт задачу `notify_job`, которая подбирает пользователей с подходящими сохранёнными поисками. Затем для их Push-подписок создаются задачи отправки. Это обрабатывает бесплатный workflow `.github/workflows/notifications-worker.yml` каждые 5 минут и также вручную через `workflow_dispatch`.

Очередь блокируется на 10 минут, поэтому lease не истекает раньше максимального времени одного запуска worker.

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

`render.yaml` описывает бесплатный Web Service с Node.js, `npm run build` / `npm start` и health check `/api/health`.

Обязательные переменные Render:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `PUSH_PUBLIC_KEY`
- `PUSH_PRIVATE_KEY`
- `PUSH_SUBJECT`

## Проверки

CI GitHub Actions выполняет:

```sh
npm run typecheck
npm test
npm run build
```

Рабочий порядок production-пайплайна:

**Worker → Telegram public import → Parser → Moderation → Publication → Final Render check**

Final Render check включает проверку реального production-деплоя, health endpoint, главной страницы, каталога, карточки вакансии, ссылок на карту и отсутствия автоматической публикации импортированных Telegram-вакансий.

## Документация

[ARCHITECTURE.md](ARCHITECTURE.md) · [SETUP.md](SETUP.md) · [TELEGRAM.md](TELEGRAM.md) · [PAYMENTS.md](PAYMENTS.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [SECURITY.md](SECURITY.md) · [QA.md](QA.md) · [FEATURES.md](FEATURES.md) · [AGENTS.md](AGENTS.md)
