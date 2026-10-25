-- Outbox: infraestructura completa de reclamación con arriendo y token.
--
-- Alcance: SOLO el outbox. No toca la vista (20261025000000) ni migraciones
-- anteriores. Es ejecutable por sí misma, después de la primera.
--
-- 1) Columnas de arriendo (`claimed_at`, `claim_expires_at`) y token.
-- 2) Índices de reclamación y de token.
-- 3) RPC definitiva de 3 argumentos: `for update skip locked`, incremento de
--    `attempts` en la misma operación, arriendo configurable, recuperación de
--    filas vencidas y de filas antiguas en 'processing' sin arriendo, y tope
--    implícito de 5 intentos.

alter table public.affiliate_notification_outbox
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists claim_token uuid;

create index if not exists affiliate_notification_outbox_claim_idx
  on public.affiliate_notification_outbox (status, claim_expires_at, created_at);

create index if not exists affiliate_notification_outbox_token_idx
  on public.affiliate_notification_outbox (claim_token);

-- La firma anterior (2 argumentos) se retira para no dejar una sobrecarga que
-- ignore el token y la gracia.
drop function if exists public.claim_affiliate_notifications(integer, integer);

create or replace function public.claim_affiliate_notifications(
  p_limit integer default 20,
  p_lease_seconds integer default 300,
  p_legacy_grace_seconds integer default 900
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
  if p_legacy_grace_seconds is null or p_legacy_grace_seconds < 0 or p_legacy_grace_seconds > 86400 then
    raise exception 'p_legacy_grace_seconds fuera de rango';
  end if;

  -- Filas que agotaron sus intentos y quedaron colgadas (por ejemplo, una caída
  -- después de reclamar) se cierran como fallidas para que sean visibles. No se
  -- reenvían: el selector solo toma intentos menores a 5.
  update public.affiliate_notification_outbox o
     set status = 'failed',
         last_error = 'intentos agotados',
         claim_expires_at = null
   where o.status = 'processing'
     and o.attempts >= 5
     and (
       (o.claim_expires_at is not null and o.claim_expires_at < now())
       or (o.claim_expires_at is null and o.created_at < now() - make_interval(secs => p_legacy_grace_seconds))
     );

  return query
  with picked as (
    select c.id
    from public.affiliate_notification_outbox c
    where c.attempts < 5
      and (
        c.status in ('pending', 'failed')
        or (c.status = 'processing' and c.claim_expires_at is not null and c.claim_expires_at < now())
        or (c.status = 'processing' and c.claim_expires_at is null
            and c.created_at < now() - make_interval(secs => p_legacy_grace_seconds))
      )
    order by c.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.affiliate_notification_outbox o
       set status = 'processing',
           claimed_at = now(),
           claim_expires_at = now() + make_interval(secs => p_lease_seconds),
           claim_token = gen_random_uuid(),
           attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.*
  )
  select * from claimed;
end $$;

revoke all on function public.claim_affiliate_notifications(integer, integer, integer) from public;
revoke all on function public.claim_affiliate_notifications(integer, integer, integer) from anon, authenticated;
grant execute on function public.claim_affiliate_notifications(integer, integer, integer) to service_role;
