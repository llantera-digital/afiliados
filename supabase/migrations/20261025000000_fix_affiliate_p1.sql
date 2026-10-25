-- Correcciones locales de los P1 del portal de afiliados.
-- NO aplicada en producción. Se numeró después de las migraciones existentes
-- y no modifica ninguna de ellas.
--
-- 1) Conteo de mensualidades: la vista unía periodos y etapas en el mismo
--    `from`, multiplicando filas. Ahora cada agregado va en un lateral.
-- 2) Outbox: reclamación atómica con arrendamiento (lease) y recuperación de
--    filas que quedaron en 'processing' tras una caída.

alter table public.affiliate_notification_outbox
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz;

create index if not exists affiliate_notification_outbox_claim_idx
  on public.affiliate_notification_outbox (status, claim_expires_at, created_at);

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
  coalesce(p.paid_months, 0)::integer as paid_months,
  p.last_paid_at,
  coalesce(t.tiers, '[]'::jsonb) as commission_tiers
from public.client_affiliations ca
join public.clientes c on c.cliente_id = ca.client_id
left join lateral (
  select count(*)::integer as paid_months, max(bp.completed_at) as last_paid_at
  from public.saas_billing_periods bp
  where bp.client_id = ca.client_id and bp.status = 'paid'
) p on true
left join lateral (
  select jsonb_agg(distinct jsonb_build_object(
           'start', t.start_payment_number, 'end', t.end_payment_number,
           'rate', t.commission_rate, 'indefinite', t.is_indefinite
         )) as tiers
  from public.client_commission_tiers t
  where t.client_affiliation_id = ca.id and t.is_active
) t on true
where ca.affiliate_id = affiliate_private.current_affiliate_id();

create or replace function public.claim_affiliate_notifications(
  p_limit integer default 20,
  p_lease_seconds integer default 300
) returns setof public.affiliate_notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit fuera de rango';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 1 or p_lease_seconds > 3600 then
    raise exception 'p_lease_seconds fuera de rango';
  end if;

  return query
  with picked as (
    select c.id
    from public.affiliate_notification_outbox c
    where c.attempts < 5
      and (
        c.status in ('pending', 'failed')
        or (c.status = 'processing' and c.claim_expires_at is not null and c.claim_expires_at < now())
      )
    order by c.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.affiliate_notification_outbox o
       set status = 'processing',
           claimed_at = now(),
           claim_expires_at = now() + make_interval(secs => p_lease_seconds),
           attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.*
  )
  select * from claimed;
end $$;

revoke all on function public.claim_affiliate_notifications(integer, integer) from public;
revoke all on function public.claim_affiliate_notifications(integer, integer) from anon, authenticated;
grant execute on function public.claim_affiliate_notifications(integer, integer) to service_role;
