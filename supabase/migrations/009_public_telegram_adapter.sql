alter table telegram_sources drop constraint if exists telegram_sources_adapter_check;
alter table telegram_sources add constraint telegram_sources_adapter_check check(adapter in ('manual','bot','public_web'));
comment on column telegram_sources.adapter is 'manual, bot, or public_web (public Telegram web page import)';
