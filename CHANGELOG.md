# v0.1, 2026-09-07

Первая исходная сборка для дальнейшего запуска. Реализованы ядро поиска, роли, размещение, модерация, ручной Telegram ingestion, отдельная очередь, sandbox-монетизация, кабинеты и документация. Сетевой запуск и интеграционная приёмка не выполнены. Результаты и ограничения см. QA.md и FEATURES.md.

## 0.1.1 — 2026-09-07
- Added canonical `/employer/jobs/new` entrypoint with backward-compatible `/jobs/new` flow.
- Added explicit map-link regression tests for 2GIS/Yandex address encoding.
- Improved search placeholders and guidance for users.
- Homepage wording now clearly targets Novosibirsk MVP.
- Added admin-managed public Telegram sources with automatic validation and scheduled import.
- Public Telegram imports feed the shared parsing/moderation queue instead of publishing jobs automatically.
