begin;
create function notify_job(p_job uuid) returns void language plpgsql security definer set search_path=public as $$begin
 insert into notifications(user_id,job_id,kind,title,url,dedupe_key)
 select s.user_id,j.id,'new_job',j.title,'/jobs/'||j.id,'new-job:'||j.id from saved_searches s cross join jobs j
 where j.id=p_job and j.status='published' and j.expires_at>now() and s.notify and j.published_at>=s.created_at
 and (coalesce(s.filters->>'q','')='' or j.search_vector@@websearch_to_tsquery('russian',s.filters->>'q') or strpos(lower(j.title),lower(s.filters->>'q'))>0)
 and (coalesce(s.filters->>'where','')='' or strpos(lower(j.city||' '||coalesce(j.address_normalized,'')),lower(s.filters->>'where'))>0)
 and (coalesce(s.filters->>'category','')='' or j.category::text=s.filters->>'category')
 and (nullif(s.filters->>'min','') is null or (j.salary_type='shift' and j.salary_min>=(s.filters->>'min')::numeric))
 and (nullif(s.filters->>'day','') is null or (j.date_start<=(s.filters->>'day')::date and coalesce(j.date_end,j.date_start)>=(s.filters->>'day')::date))
 and (coalesce((s.filters->>'instant')::boolean,false)=false or j.payment_type in ('daily','immediate'))
 and (coalesce((s.filters->>'employer')::boolean,false)=false or j.source_type='employer')
 and (coalesce((s.filters->>'address')::boolean,false)=false or nullif(trim(j.address_normalized),'') is not null)
 on conflict do nothing;
end $$;
create function enqueue_notification() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into work_queue(kind,payload,dedupe_key) select 'push',jsonb_build_object('notification_id',new.id,'subscription_id',s.id),'push:'||new.id||':'||s.id from push_subscriptions s where s.user_id=new.user_id on conflict do nothing;return new;end $$;
create trigger notification_push after insert on notifications for each row execute function enqueue_notification();
create function favorite_event() returns trigger language plpgsql security definer set search_path=public as $$begin insert into job_events(job_id,user_id,type) values(new.job_id,new.user_id,'favorite');return new;end $$;
create trigger favorite_added after insert on favorites for each row execute function favorite_event();
revoke execute on function notify_job(uuid),enqueue_notification(),favorite_event() from public,anon,authenticated;
grant execute on function notify_job(uuid) to service_role;
commit;
