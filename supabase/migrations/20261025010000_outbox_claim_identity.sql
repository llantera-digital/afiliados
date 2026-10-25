-- Identidad de reclamación y recuperación de avisos antiguos.
-- Segunda migración local del arreglo del outbox. No modifica las anteriores.
--
-- 1) `claim_token`: cada reclamación emite un token. Las marcas de enviado o
--    fallido exigen ese token, de modo que un worker cuyo arriendo venció y fue
--    reemplazado no puede sobrescribir el estado del nuevo dueño.
-- 2) Avisos en 'processing' sin arriendo (filas anteriores a esta migración o
--    de una caída antes de existir la columna): se recuperan cuando superan una
--    gracia configurable, por omisión 900 s desde su creación.

alter table public.affiliate_notification_outbox
  add column if not exists claim_token uuid;

create index if not exists affiliate_notification_outbox_token_idx
  on public.affiliate_notification_outbox (claim_token);

-- La firma anterior (2 argumentos) se retira para no dejar una sobrecarga que
-- ignore el token y la gracia.
drop function if exists public.claim_affiliate_notifications(integer, integer);

create function public.claim_affiliate_notifications(
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
