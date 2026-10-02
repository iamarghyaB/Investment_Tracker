-- Ephemeral database fixtures. Everything rolls back, including auth users.
begin;
select set_config('investment.test_a', gen_random_uuid()::text, true);
select set_config('investment.test_b', gen_random_uuid()::text, true);
insert into auth.users(id, email, aud, role) values
  (current_setting('investment.test_a')::uuid, 'rls-a-' || current_setting('investment.test_a') || '@example.invalid', 'authenticated', 'authenticated'),
  (current_setting('investment.test_b')::uuid, 'rls-b-' || current_setting('investment.test_b') || '@example.invalid', 'authenticated', 'authenticated');
insert into public.investment_subscriptions(user_id, stripe_customer_id, status, current_period_end) values
  (current_setting('investment.test_a')::uuid, 'test-customer-' || current_setting('investment.test_a'), 'active', now() + interval '1 month'),
  (current_setting('investment.test_b')::uuid, 'test-customer-' || current_setting('investment.test_b'), 'incomplete', null);
insert into public.watchlist_items(user_id, symbol) values
  (current_setting('investment.test_a')::uuid, 'AAPL'),
  (current_setting('investment.test_b')::uuid, 'MSFT');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('investment.test_a'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.watchlist_items) <> 1 then raise exception 'FAIL: user A sees another user'; end if;
  if (select count(*) from public.investment_subscriptions) <> 1 then raise exception 'FAIL: subscription isolation'; end if;
  insert into public.watchlist_items(user_id,symbol) values(current_setting('investment.test_a')::uuid,'NVDA');
  begin
    insert into public.watchlist_items(user_id,symbol) values(current_setting('investment.test_b')::uuid,'NVDA');
    raise exception 'FAIL: cross-user insertion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.investment_subscriptions set status='active';
    raise exception 'FAIL: user changed paid entitlement';
  exception when insufficient_privilege then null; end;
  begin
    perform public.investment_apply_subscription('forged',1,'x','x','active','x',now()+interval '1 month',false);
    raise exception 'FAIL: authenticated user called billing sync';
  exception when insufficient_privilege then null; end;
  delete from public.watchlist_items where user_id=current_setting('investment.test_b')::uuid;
  if found then raise exception 'FAIL: cross-user delete'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('investment.test_b'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.watchlist_items) <> 1 then raise exception 'FAIL: user B sees another user'; end if;
  begin
    insert into public.watchlist_items(user_id,symbol) values(current_setting('investment.test_b')::uuid,'TSLA');
    raise exception 'FAIL: free user saved a stock';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.investment_subscriptions set current_period_end=now()-interval '1 minute' where user_id=current_setting('investment.test_a')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('investment.test_a'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    insert into public.watchlist_items(user_id,symbol) values(current_setting('investment.test_a')::uuid,'TSLA');
    raise exception 'FAIL: expired user saved a stock';
  exception when insufficient_privilege then null; end;
  delete from public.watchlist_items where symbol='NVDA';
  if not found then raise exception 'FAIL: expired user cannot remove own stock'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.watchlist_items;
    raise exception 'FAIL: anonymous watchlist access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Webhook event replay and ordering cannot restore canceled access.
select public.investment_apply_subscription('test-new', 20,
  'test-customer-' || current_setting('investment.test_a'), 'test-subscription',
  'canceled', 'test-price', now(), false);
select public.investment_apply_subscription('test-old', 10,
  'test-customer-' || current_setting('investment.test_a'), 'test-subscription',
  'active', 'test-price', now()+interval '1 month', false);
select public.investment_apply_subscription('test-new', 30,
  'test-customer-' || current_setting('investment.test_a'), 'test-subscription',
  'active', 'test-price', now()+interval '1 month', false);
do $$ begin
  if (select status from public.investment_subscriptions where user_id=current_setting('investment.test_a')::uuid) <> 'canceled' then
    raise exception 'FAIL: stale or replayed webhook restored access';
  end if;
end $$;
select 'PASS: two-user isolation, paid-only saves, cross-user write denial, entitlement tamper denial, expiry, and anonymous denial' as result;
rollback;
