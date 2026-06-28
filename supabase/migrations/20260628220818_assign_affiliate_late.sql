-- Atribución administrativa posterior al alta del cliente.
-- No genera comisiones retroactivas: el esquema comienza en la siguiente
-- mensualidad que todavía no existe para el cliente.

create or replace function public.assign_affiliate_late(
  p_client_id text,
  p_affiliate_id uuid,
  p_effective_date date,
  p_reason text
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon public.affiliate_coupons%rowtype;
  v_affiliation_id uuid;
  v_next_payment_number integer;
  v_offset integer;
begin
  if not affiliate_private.is_admin() then
    raise exception 'Acceso denegado';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'El motivo es obligatorio';
  end if;
  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'La fecha efectiva debe ser igual o anterior a hoy';
  end if;
  if not exists (select 1 from public.clientes where cliente_id = p_client_id) then
    raise exception 'Cliente inexistente';
  end if;
  if exists (select 1 from public.client_affiliations where client_id = p_client_id) then
    raise exception 'El cliente ya tiene un afiliado asignado';
  end if;
  if not exists (select 1 from public.affiliates where id = p_affiliate_id and status = 'active') then
    raise exception 'Afiliado inexistente o inactivo';
  end if;

  select c.* into v_coupon
  from public.affiliate_coupons c
  where c.affiliate_id = p_affiliate_id and c.status = 'active'
  order by c.created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'El afiliado no tiene un cupón activo';
  end if;

  select coalesce(max(payment_number), 0) + 1 into v_next_payment_number
  from public.saas_billing_periods
  where client_id = p_client_id;
  v_offset := v_next_payment_number - 1;

  insert into public.client_affiliations
    (client_id, affiliate_id, coupon_id, coupon_code_snapshot,
     discount_amount_snapshot, affiliated_at)
  values
    (p_client_id, p_affiliate_id, v_coupon.id, v_coupon.code,
     v_coupon.discount_amount, p_effective_date::timestamptz)
  returning id into v_affiliation_id;

  insert into public.client_commission_tiers
    (client_affiliation_id, start_payment_number, end_payment_number,
     commission_rate, is_indefinite, is_active, administrative_note,
     effective_from)
  select
    v_affiliation_id,
    start_payment_number + v_offset,
    case when end_payment_number is null then null else end_payment_number + v_offset end,
    commission_rate,
    is_indefinite,
    true,
    'Atribución tardía: ' || trim(p_reason),
    p_effective_date::timestamptz
  from public.affiliate_default_commission_tiers
  where affiliate_id = p_affiliate_id and is_active;
  if not found then
    raise exception 'El afiliado no tiene esquema de comisión activo';
  end if;

  insert into public.affiliate_audit_log
    (actor_user_id, action, entity_type, entity_id, new_values, reason)
  values
    (auth.uid(), 'affiliate_assigned_late', 'client_affiliation', v_affiliation_id,
     jsonb_build_object(
       'client_id', p_client_id,
       'affiliate_id', p_affiliate_id,
       'coupon', v_coupon.code,
       'discount_amount', v_coupon.discount_amount,
       'effective_date', p_effective_date,
       'first_commissionable_payment_number', v_next_payment_number
     ), trim(p_reason));

  return v_affiliation_id;
end;
$$;

revoke all on function public.assign_affiliate_late(text,uuid,date,text) from public, anon;
grant execute on function public.assign_affiliate_late(text,uuid,date,text) to authenticated;
