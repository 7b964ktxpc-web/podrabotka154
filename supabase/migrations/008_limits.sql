begin;
-- Bound user-owned collections even when clients talk directly to PostgREST.
create function limit_saved_searches() returns trigger language plpgsql security definer set search_path=public as $$begin
 perform 1 from profiles where id=new.user_id for update;
 if (select count(*) from saved_searches where user_id=new.user_id)>=50 then raise exception 'SEARCH_LIMIT';end if;
 if length(new.filters::text)>4000 then raise exception 'FILTER_TOO_LARGE';end if;
 if jsonb_typeof(new.filters)<>'object' then raise exception 'INVALID_FILTERS';end if;
 return new;end $$;
create trigger saved_search_limit before insert on saved_searches for each row execute function limit_saved_searches();
-- Rendering and notification pipelines accept only typed filter objects.
create function validate_search_filters() returns trigger language plpgsql as $$begin
 if jsonb_typeof(new.filters)<>'object' or length(new.filters::text)>4000 then raise exception 'INVALID_FILTERS';end if;
 if new.filters->>'min' is not null and ((new.filters->>'min')::numeric<0 or (new.filters->>'min')::numeric>100000000) then raise exception 'INVALID_FILTERS';end if;
 perform (new.filters->>'day')::date,(new.filters->>'instant')::boolean,(new.filters->>'employer')::boolean,(new.filters->>'address')::boolean;
 return new;end $$;
create trigger filters_valid before insert or update on saved_searches for each row execute function validate_search_filters();
revoke execute on function limit_saved_searches(),validate_search_filters() from public,anon,authenticated;
commit;
