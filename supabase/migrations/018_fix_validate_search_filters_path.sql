-- Pin the trigger function search path to avoid role-dependent name resolution.
create or replace function public.validate_search_filters()
returns trigger
language plpgsql
set search_path=public
as $function$
begin
  if jsonb_typeof(new.filters)<>'object' or length(new.filters::text)>4000 then
    raise exception 'INVALID_FILTERS';
  end if;
  if new.filters->>'min' is not null
     and ((new.filters->>'min')::numeric<0 or (new.filters->>'min')::numeric>100000000) then
    raise exception 'INVALID_FILTERS';
  end if;
  perform (new.filters->>'day')::date,
          (new.filters->>'instant')::boolean,
          (new.filters->>'employer')::boolean,
          (new.filters->>'address')::boolean;
  return new;
end
$function$;
