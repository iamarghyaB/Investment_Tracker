-- Applied to the dedicated InvestmentTracker project, not to existing apps.
create table public.investment_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.investment_subscriptions enable row level security;
revoke all on public.investment_subscriptions from anon, authenticated;
grant select on public.investment_subscriptions to authenticated;
grant all on public.investment_subscriptions to service_role;
create policy "Read own subscription" on public.investment_subscriptions
for select to authenticated using ((select auth.uid()) = user_id);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.\-]{0,9}$'),
  exchange text not null default 'US' check (exchange = 'US'),
  created_at timestamptz not null default now(),
  unique(user_id, exchange, symbol)
);
alter table public.watchlist_items enable row level security;
revoke all on public.watchlist_items from anon, authenticated;
grant select, insert, delete on public.watchlist_items to authenticated;
grant all on public.watchlist_items to service_role;
create policy "Read own saved stocks" on public.watchlist_items
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Paid users save own stocks" on public.watchlist_items
for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.investment_subscriptions s
    where s.user_id = (select auth.uid()) and s.status = 'active'
      and s.current_period_end > now()
  )
);
create policy "Delete own saved stocks" on public.watchlist_items
for delete to authenticated using ((select auth.uid()) = user_id);

create table public.investment_billing_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.investment_billing_events enable row level security;
revoke all on public.investment_billing_events from anon, authenticated;
grant all on public.investment_billing_events to service_role;

-- Invoker privileges: only the server's service role may call this function.
-- Customer ownership is assigned by authenticated checkout, never by client input.
create function public.investment_apply_subscription(
  p_event_id text, p_event_created bigint, p_customer_id text,
  p_subscription_id text, p_status text, p_price_id text,
  p_period_end timestamptz, p_cancel_at_period_end boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_row public.investment_subscriptions%rowtype;
begin
  select * into v_row from public.investment_subscriptions
    where stripe_customer_id = p_customer_id for update;
  if not found then raise exception 'Unregistered billing customer'; end if;
  insert into public.investment_billing_events(event_id) values(p_event_id)
    on conflict do nothing;
  if not found then return; end if;
  if p_event_created < v_row.last_event_created then return; end if;
  update public.investment_subscriptions set
    stripe_subscription_id = p_subscription_id, status = p_status,
    price_id = p_price_id, current_period_end = p_period_end,
    cancel_at_period_end = p_cancel_at_period_end,
    last_event_created = p_event_created, updated_at = now()
  where user_id = v_row.user_id;
end;
$$;
revoke all on function public.investment_apply_subscription(text,bigint,text,text,text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.investment_apply_subscription(text,bigint,text,text,text,text,timestamptz,boolean) to service_role;
