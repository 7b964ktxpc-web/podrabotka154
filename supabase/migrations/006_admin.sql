create function admin_money_stats() returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 if not is_admin() then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('orders',count(*),'paid',count(*) filter(where status='paid'),'refunded',count(*) filter(where status='refunded'),'net_kopecks',coalesce(sum(amount) filter(where status='paid'),0),'active_entitlements',(select count(*) from employer_subscriptions where ends_at>now())) into result from orders;return result;end $$;
revoke execute on function admin_money_stats() from public,anon;
grant execute on function admin_money_stats() to authenticated;
create function set_roles(p_id uuid,p_roles text[]) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_admin() then raise exception 'FORBIDDEN';end if;
 if not p_roles <@ array['user','employer','admin']::text[] or not 'user'=any(p_roles) then raise exception 'INVALID_ROLES';end if;
 lock table profiles in share row exclusive mode;
 if not 'admin'=any(p_roles) and exists(select 1 from profiles where id=p_id and 'admin'=any(roles)) and (select count(*) from profiles where 'admin'=any(roles))<=1 then raise exception 'LAST_ADMIN';end if;
 update profiles set roles=p_roles where id=p_id;
 insert into admin_logs(actor_id,action,target_id,details) values(auth.uid(),'roles_update',p_id::text,jsonb_build_object('roles',p_roles));
end $$;
revoke execute on function set_roles(uuid,text[]) from public,anon;
grant execute on function set_roles(uuid,text[]) to authenticated;
