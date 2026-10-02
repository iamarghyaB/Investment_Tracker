-- Explicit server-only policy, in addition to role grants and RLS.
create policy "Server processes billing events" on public.investment_billing_events
for all to service_role using (true) with check (true);
