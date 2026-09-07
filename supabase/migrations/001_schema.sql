begin;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create table profiles(id uuid primary key references auth.users on delete cascade,display_name text not null default '',roles text[] not null default '{user}' check(roles <@ array['user','employer','admin']::text[]),created_at timestamptz not null default now());
create function on_signup() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id) values(new.id);return new;end $$;
create trigger signup after insert on auth.users for each row execute function on_signup();
create function is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select 'admin'=any(roles) from profiles where id=auth.uid()),false)$$;
create table cities(id uuid primary key default gen_random_uuid(),name text unique not null,slug text unique not null,timezone text not null default 'Asia/Novosibirsk',active boolean not null default true);
create table job_categories(id uuid primary key default gen_random_uuid(),name text unique not null,slug text unique not null,active boolean not null default true);
create table settings(key text primary key,value jsonb not null);
create table employers(id uuid primary key default gen_random_uuid(),owner_id uuid unique not null references profiles on delete cascade,slug text unique not null check(slug ~ '^[a-z0-9][a-z0-9-]{2,70}$'),name text not null check(length(name) between 2 and 160),description text not null default '',logo_url text,contact_phone text,contact_telegram text,website text,city_id uuid not null references cities,contact_person text,created_at timestamptz not null default now());
create table employer_profiles(employer_id uuid references employers on delete cascade,user_id uuid references profiles on delete cascade,primary key(employer_id,user_id));
create table telegram_sources(id uuid primary key default gen_random_uuid(),name text not null,username text unique not null,city_id uuid not null references cities,adapter text not null default 'manual' check(adapter in ('manual','bot')),chat_id bigint unique,active boolean not null default false,last_error text,created_at timestamptz not null default now());
create table telegram_messages(id uuid primary key default gen_random_uuid(),source_id uuid not null references telegram_sources on delete restrict,telegram_message_id bigint not null,message_text text not null,message_date timestamptz not null,message_url text not null,raw_payload jsonb not null,created_at timestamptz not null default now(),unique(source_id,telegram_message_id));
create table jobs(
 id uuid primary key default gen_random_uuid(),employer_id uuid references employers,
 title text not null check(length(title) between 2 and 200),description text not null check(length(description) between 10 and 20000),
 salary_min numeric check(salary_min>=0),salary_max numeric check(salary_max>=salary_min),salary_type text check(salary_type in ('shift','hour','month','task')),
 city_id uuid not null references cities,city text not null,category uuid references job_categories,address_raw text,address_normalized text,
 employment_type text,payment_type text check(payment_type in ('daily','immediate','weekly','monthly','other')),date_start date,date_end date,time_start time,time_end time,
 contact_phone text,contact_telegram text,contact_email text,photo_url text,
 source_type text not null check(source_type in ('telegram','employer','admin')),source_id uuid references telegram_sources on delete restrict,source_message_id uuid references telegram_messages,source_url text,original_text text,
 status text not null default 'draft' check(status in ('draft','pending_moderation','published','rejected','expired','archived')),ai_confidence numeric check(ai_confidence between 0 and 1),moderation_reason text,fingerprint text,
 created_at timestamptz not null default now(),published_at timestamptz,expires_at timestamptz,updated_at timestamptz not null default now(),
 search_vector tsvector generated always as (setweight(to_tsvector('russian',coalesce(title,'')),'A')||setweight(to_tsvector('russian',coalesce(description,'')),'B')) stored,
 check(date_end is null or date_start is null or date_end>=date_start),check(status<>'published' or (published_at is not null and expires_at is not null)),check(source_type<>'employer' or employer_id is not null)
);
create unique index jobs_fingerprint on jobs(fingerprint) where fingerprint is not null;
create table job_sources(job_id uuid references jobs on delete cascade,message_id uuid references telegram_messages on delete restrict,source_url text not null,primary key(job_id,message_id));
create table favorites(user_id uuid references profiles on delete cascade,job_id uuid references jobs on delete cascade,created_at timestamptz not null default now(),primary key(user_id,job_id));
create table saved_searches(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,name text not null check(length(name) between 1 and 100),filters jsonb not null,notify boolean not null default false,created_at timestamptz not null default now());
create table push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,endpoint text unique not null,p256dh text not null,auth text not null,created_at timestamptz not null default now());
create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,job_id uuid references jobs on delete cascade,kind text not null,title text not null,url text not null,dedupe_key text not null,read_at timestamptz,created_at timestamptz not null default now(),unique(user_id,dedupe_key));
create table products(id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,price_kopecks integer not null check(price_kopecks>=0),days integer not null check(days between 1 and 365),priority integer not null default 0,placements integer not null default 0 check(placements>=0),active boolean not null default false,kind text not null check(kind in ('normal','boost','highlight','vip','package','subscription')));
create table pricing_plans(id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,product_id uuid not null references products,features jsonb not null default '{}');
create table orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,employer_id uuid not null references employers,job_id uuid references jobs,product_id uuid not null references products,amount integer not null check(amount>=0),currency text not null default 'RUB',product_snapshot jsonb not null,status text not null default 'pending' check(status in ('pending','paid','refunded','cancelled')),idempotency_key uuid not null,created_at timestamptz not null default now(),unique(user_id,idempotency_key));
create table payments(id uuid primary key default gen_random_uuid(),order_id uuid unique not null references orders,provider text not null,provider_payment_id text unique not null,status text not null check(status in ('pending','paid','refunded')),amount integer not null,created_at timestamptz not null default now());
create table payment_events(provider text not null,event_id text not null,order_id uuid not null references orders,payload jsonb not null,created_at timestamptz not null default now(),primary key(provider,event_id));
create table job_promotions(id uuid primary key default gen_random_uuid(),job_id uuid not null references jobs on delete cascade,order_id uuid unique not null references orders,kind text not null,priority integer not null,starts_at timestamptz not null default now(),ends_at timestamptz not null);
create table employer_subscriptions(id uuid primary key default gen_random_uuid(),employer_id uuid not null references employers,order_id uuid unique not null references orders,starts_at timestamptz not null default now(),ends_at timestamptz not null,remaining_placements integer not null check(remaining_placements>=0));
create table job_events(id bigint generated always as identity primary key,job_id uuid not null references jobs on delete cascade,user_id uuid references profiles on delete set null,type text not null check(type in ('view','favorite','phone_click','telegram_click','email_click','share','contact_view')),created_at timestamptz not null default now());
create table admin_logs(id bigint generated always as identity primary key,actor_id uuid references profiles,action text not null,target_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create table parser_runs(id uuid primary key default gen_random_uuid(),message_id uuid not null references telegram_messages,provider text not null,result jsonb,error text,created_at timestamptz not null default now());
create table work_queue(id uuid primary key default gen_random_uuid(),kind text not null,payload jsonb not null,dedupe_key text unique not null,attempts integer not null default 0,available_at timestamptz not null default now(),locked_until timestamptz,lock_token uuid,done_at timestamptz,error text,created_at timestamptz not null default now());
create table rate_limits(key text primary key,window_start timestamptz not null,hits integer not null);
create index on jobs(status);create index on jobs(city_id);create index on jobs(city);create index on jobs(category);create index on jobs(created_at desc);create index on jobs(published_at desc);create index on jobs(salary_min);create index on jobs(expires_at);create index on jobs using gin(search_vector);create index on jobs using gin(title gin_trgm_ops);create index on telegram_messages(source_id);create index on favorites(user_id);create index on saved_searches(user_id);create index on job_events(job_id,created_at);create index on work_queue(available_at) where done_at is null;
do $$declare t text;begin foreach t in array array['profiles','cities','job_categories','settings','employers','employer_profiles','telegram_sources','telegram_messages','jobs','job_sources','favorites','saved_searches','push_subscriptions','notifications','products','pricing_plans','orders','payments','payment_events','job_promotions','employer_subscriptions','job_events','admin_logs','parser_runs','work_queue','rate_limits'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);end loop;end $$;
create policy self on profiles for select to authenticated using(id=auth.uid());
create policy public_read on cities for select using(active or is_admin());
create policy public_read on job_categories for select using(active or is_admin());
create policy public_read on employers for select using(true);
create policy self on employer_profiles for select to authenticated using(user_id=auth.uid());
create policy public_read on products for select using(active or is_admin());
create policy public_read on pricing_plans for select using(true);
create policy visible on jobs for select using((status='published' and expires_at>now()) or employer_id in (select id from employers where owner_id=auth.uid()) or is_admin());
create policy public_read on job_sources for select using(exists(select 1 from jobs j where j.id=job_id and j.status='published' and j.expires_at>now()));
create policy self on favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from jobs where id=job_id and status='published' and expires_at>now()));
create policy self on saved_searches for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy self_read on push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy self_delete on push_subscriptions for delete to authenticated using(user_id=auth.uid());
create policy self on notifications for select to authenticated using(user_id=auth.uid());
create policy self on orders for select to authenticated using(user_id=auth.uid());
create policy self on payments for select to authenticated using(exists(select 1 from orders where id=order_id and user_id=auth.uid()));
create policy self on employer_subscriptions for select to authenticated using(exists(select 1 from employers where id=employer_id and owner_id=auth.uid()));
create policy self on job_events for select to authenticated using(exists(select 1 from jobs j join employers e on e.id=j.employer_id where j.id=job_id and e.owner_id=auth.uid()));
revoke all on all tables in schema public from anon,authenticated;
grant select on profiles,cities,job_categories,employers,employer_profiles,jobs,job_sources,products,pricing_plans,favorites,saved_searches,push_subscriptions,notifications,orders,payments,employer_subscriptions,job_events,telegram_sources,telegram_messages,payment_events,job_promotions,admin_logs,parser_runs,settings,work_queue to authenticated;
grant select on cities,job_categories,employers,jobs,job_sources,products,pricing_plans to anon;
grant insert,delete on favorites to authenticated;
grant insert,update,delete on saved_searches to authenticated;
grant delete on push_subscriptions to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
commit;
