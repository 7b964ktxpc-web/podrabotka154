begin;

-- Queue claiming is an internal worker operation. Keep the security-definer RPC
-- inaccessible to browser roles even if the original function inherited PUBLIC execute.
revoke execute on function public.claim_work(integer) from public, anon, authenticated;
grant execute on function public.claim_work(integer) to service_role;

commit;
