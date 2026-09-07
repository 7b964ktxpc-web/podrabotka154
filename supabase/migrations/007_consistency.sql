begin;
-- Normal publication limits come from settings; keep the NORMAL reference product synchronized.
update products set days=(select (value->>'days')::int from settings where key='publication'),placements=(select (value->>'free_active_limit')::int from settings where key='publication') where code='NORMAL' and exists(select 1 from settings where key='publication');
create function sync_free_product() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.key='publication' then update products set days=(new.value->>'days')::int,placements=(new.value->>'free_active_limit')::int where code='NORMAL';end if;return new;end $$;
create trigger sync_free after insert or update on settings for each row execute function sync_free_product();
-- Preserve audit of views milestones without a paid analytics provider.
insert into settings(key,value) values('view_milestones','[10,100,1000]') on conflict do nothing;
create function view_milestone() returns trigger language plpgsql security definer set search_path=public as $$declare owner uuid;n bigint;threshold int;begin
 if new.type<>'view' then return new;end if;
 select e.owner_id into owner from jobs j join employers e on e.id=j.employer_id where j.id=new.job_id;if owner is null then return new;end if;
 select count(*) into n from job_events where job_id=new.job_id and type='view';
 for threshold in select jsonb_array_elements_text(value)::int from settings where key='view_milestones' loop
 if n>=threshold then insert into notifications(user_id,job_id,kind,title,url,dedupe_key) values(owner,new.job_id,'views','Вакансия получила '||threshold||' просмотров','/employer','views:'||new.job_id||':'||threshold) on conflict do nothing;end if;end loop;return new;end $$;
create trigger view_notification after insert on job_events for each row execute function view_milestone();
revoke execute on function sync_free_product(),view_milestone() from public,anon,authenticated;
commit;
