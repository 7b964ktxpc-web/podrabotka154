# Развёртывание на Render

## Рабочий контур

Проект разворачивается из ветки `render`. Production Vercel не используется для этого контура.

Перед деплоем GitHub Actions должен пройти все проверки:

```sh
npm install
npm run typecheck
npm test
npm run build
```

В текущей ветке эти проверки уже проходят в `render-ci`.

## Render Blueprint

`render.yaml` описывает два сервиса:

1. `podrabotka154` — Node/Next.js web service.
2. `podrabotka154-telegram-import` — cron service, который каждые 15 минут запускает `scripts/render-cron-import.mjs`.

Переменные окружения web/cron:

```text
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Cron также получает:

```text
RENDER_URL=https://podrabotka154.onrender.com
```

`CRON_SECRET` не хранится в GitHub и не коммитится в репозиторий.

## Telegram-импорт

Web endpoint:

```text
GET /api/telegram/import-public
Authorization: Bearer <CRON_SECRET>
```

Endpoint читает активные публичные Telegram-источники, сохраняет новые сообщения, разбирает новые публикации консервативным парсером и отправляет вакансии в очередь ручной модерации.

Для первого источника используется публичный канал `@rabota154NsK`.

Важно: наличие Blueprint-файла в GitHub само по себе не доказывает, что Render уже синхронизировал cron. Фактический статус cron нужно проверять в панели Render после синхронизации Blueprint.

## Почему cron вынесен отдельно

Web-сервис отвечает за сайт и HTTP API. Telegram-импорт не должен зависеть от браузера пользователя. Поэтому планировщик запускается отдельным Render cron service.

Worker очереди (`worker/index.ts`) остаётся отдельным процессом. Для задач MVP публикация из Telegram выполняется самим import endpoint, а очередь используется для остальных фоновых операций.

## Проверка после деплоя

Порядок проверки:

1. Открыть `/` и `/jobs`.
2. Проверить доступ к `/api/telegram/import-public` с `CRON_SECRET`.
3. Убедиться, что новые `telegram_messages` появляются в Supabase.
4. Убедиться, что новые вакансии получают статус `pending_moderation`.
5. Проверить модерацию в `/admin/moderation`.
6. После ручной публикации проверить вакансию в `/jobs`.
7. Проверить повторный запуск импорта: уже сохранённые сообщения не должны создавать дубли.

## Локальный worker

```sh
npm run worker
# или один ограниченный цикл
npm run worker:once
```

Для локальной работы нужен `.env.local`.

## Эксплуатация

Перед открытием сервиса реальным пользователям отдельно проверьте резервное копирование Supabase, ротацию секретов, SMTP, сроки хранения сырых Telegram-сообщений, юридическое основание републикации объявлений и требования к локализации данных.
