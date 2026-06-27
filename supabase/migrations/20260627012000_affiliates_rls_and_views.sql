-- RLS: toda tabla nueva queda cerrada por defecto. El frontend usa vistas de columnas mínimas.

alter table public.affiliates enable row level security;
alter table public.affiliate_portal_users enable row level security;
alter table public.affiliate_coupons enable row level security;
alter table public.affiliate_default_commission_tiers enable row level security;
alter table public.client_affiliations enable row level security;
alter table public.client_commission_tiers enable row level security;
alter table public.saas_billing_periods enable row level security;
alter table public.client_payments enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_payout_items enable row level security;
alter table public.affiliate_compensations enable row level security;
alter table public.affiliate_payout_compensations enable row level security;
alter table public.affiliate_audit_log enable row level security;
alter table public.affiliate_notification_outbox enable row level security;

create policy admin_all_affiliates on public.affiliates for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_self on public.affiliates for select to authenticated
  using (id = (select affiliate_private.current_affiliate_id()));

create policy user_read_self on public.affiliate_portal_users for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select affiliate_private.is_admin()));
create policy admin_all_portal_users on public.affiliate_portal_users for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));

create policy admin_all_coupons on public.affiliate_coupons for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_coupons on public.affiliate_coupons for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));

create policy admin_all_default_tiers on public.affiliate_default_commission_tiers for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_default_tiers on public.affiliate_default_commission_tiers for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));

create policy admin_all_affiliations on public.client_affiliations for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_affiliations on public.client_affiliations for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));

create policy admin_all_client_tiers on public.client_commission_tiers for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_client_tiers on public.client_commission_tiers for select to authenticated
  using (exists (select 1 from public.client_affiliations ca where ca.id = client_affiliation_id
    and ca.affiliate_id = (select affiliate_private.current_affiliate_id())));

create policy admin_all_billing_periods on public.saas_billing_periods for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_billing_periods on public.saas_billing_periods for select to authenticated
  using (exists (select 1 from public.client_affiliations ca where ca.client_id = saas_billing_periods.client_id
    and ca.affiliate_id = (select affiliate_private.current_affiliate_id())));

create policy admin_all_client_payments on public.client_payments for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy admin_all_commissions on public.affiliate_commissions for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_commissions on public.affiliate_commissions for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));

create policy admin_all_payouts on public.affiliate_payouts for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_payouts on public.affiliate_payouts for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));
create policy admin_all_payout_items on public.affiliate_payout_items for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_payout_items on public.affiliate_payout_items for select to authenticated
  using (exists (select 1 from public.affiliate_payouts p where p.id = payout_id
    and p.affiliate_id = (select affiliate_private.current_affiliate_id())));

create policy admin_all_compensations on public.affiliate_compensations for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));
create policy affiliate_read_compensations on public.affiliate_compensations for select to authenticated
  using (affiliate_id = (select affiliate_private.current_affiliate_id()));
create policy admin_all_payout_compensations on public.affiliate_payout_compensations for all to authenticated
  using ((select affiliate_private.is_admin())) with check ((select affiliate_private.is_admin()));

create policy admin_read_audit on public.affiliate_audit_log for select to authenticated
  using ((select affiliate_private.is_admin()));
create policy admin_read_outbox on public.affiliate_notification_outbox for select to authenticated
  using ((select affiliate_private.is_admin()));

create or replace view public.affiliate_dashboard_summary
with (security_invoker = true)
as
select
  a.id as affiliate_id,
  (select coalesce(sum(c.commission_amount),0) from public.affiliate_commissions c where c.affiliate_id=a.id and c.status='pending')::numeric(12,2) as pending_amount,
  (select coalesce(sum(c.commission_amount),0) from public.affiliate_commissions c where c.affiliate_id=a.id and c.status='available')::numeric(12,2) as available_amount,
  (select coalesce(sum(c.commission_amount),0) from public.affiliate_commissions c where c.affiliate_id=a.id and c.status='paid')::numeric(12,2) as paid_amount,
  (select count(*) from public.client_affiliations ca where ca.affiliate_id=a.id and ca.status='active')::integer as active_clients
from public.affiliates a
where a.id = affiliate_private.current_affiliate_id()
;

create or replace view public.affiliate_visible_clients
with (security_invoker = true)
as
select
  ca.id as affiliation_id,
  c.nombre_negocio,
  c.ciudad,
  c.estado,
  c.pais,
  ca.status,
  count(bp.id) filter (where bp.status = 'paid')::integer as paid_months,
  max(bp.completed_at) filter (where bp.status = 'paid') as last_paid_at,
  coalesce(jsonb_agg(distinct jsonb_build_object(
    'start', t.start_payment_number, 'end', t.end_payment_number,
    'rate', t.commission_rate, 'indefinite', t.is_indefinite
  )) filter (where t.id is not null and t.is_active), '[]'::jsonb) as commission_tiers
from public.client_affiliations ca
join public.clientes c on c.cliente_id = ca.client_id
left join public.saas_billing_periods bp on bp.client_id = ca.client_id
left join public.client_commission_tiers t on t.client_affiliation_id = ca.id
where ca.affiliate_id = affiliate_private.current_affiliate_id()
group by ca.id, c.nombre_negocio, c.ciudad, c.estado, c.pais, ca.status;

create or replace view public.affiliate_visible_commissions
with (security_invoker = true)
as
select
  ac.id,
  c.nombre_negocio,
  c.ciudad,
  bp.completed_at,
  ac.payment_method,
  ac.payment_number,
  ac.commissionable_amount,
  ac.commission_rate,
  ac.commission_amount,
  ac.status,
  ac.release_at,
  ac.paid_at
from public.affiliate_commissions ac
join public.clientes c on c.cliente_id = ac.client_id
join public.saas_billing_periods bp on bp.id = ac.billing_period_id
where ac.affiliate_id = affiliate_private.current_affiliate_id();

create or replace view public.affiliate_visible_coupon
with (security_invoker = true)
as
select c.code, c.discount_amount, c.status,
  coalesce(jsonb_agg(jsonb_build_object(
    'start', t.start_payment_number, 'end', t.end_payment_number,
    'rate', t.commission_rate, 'indefinite', t.is_indefinite
  ) order by t.start_payment_number) filter (where t.id is not null and t.is_active), '[]'::jsonb) as default_tiers
from public.affiliate_coupons c
left join public.affiliate_default_commission_tiers t on t.affiliate_id = c.affiliate_id
where c.affiliate_id = affiliate_private.current_affiliate_id()
group by c.id;

revoke all on public.affiliate_dashboard_summary, public.affiliate_visible_clients,
  public.affiliate_visible_commissions, public.affiliate_visible_coupon from anon, public;
grant select on public.affiliate_dashboard_summary, public.affiliate_visible_clients,
  public.affiliate_visible_commissions, public.affiliate_visible_coupon to authenticated;
