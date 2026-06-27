-- Funciones transaccionales e idempotentes del portal de afiliados.

create schema if not exists affiliate_private;
revoke all on schema affiliate_private from public, anon, authenticated;

create or replace function affiliate_private.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.affiliate_portal_users
    where auth_user_id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function affiliate_private.current_affiliate_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $$
  select affiliate_id from public.affiliate_portal_users
  where auth_user_id = auth.uid() and role = 'affiliate' and is_active;
$$;

grant usage on schema affiliate_private to authenticated;
grant execute on function affiliate_private.is_admin() to authenticated;
grant execute on function affiliate_private.current_affiliate_id() to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'affiliates','affiliate_portal_users','affiliate_coupons',
    'affiliate_default_commission_tiers','client_affiliations','client_commission_tiers',
    'saas_billing_periods','client_payments','affiliate_commissions'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

create table public.affiliate_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  recipient text not null,
  template text not null default 'commission_generated',
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.assign_affiliate_coupon(
  p_client_id text,
  p_coupon_code text
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon public.affiliate_coupons%rowtype;
  v_affiliation_id uuid;
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  if not exists (select 1 from public.clientes where cliente_id = p_client_id) then
    raise exception 'Cliente inexistente';
  end if;
  if exists (select 1 from public.client_affiliations where client_id = p_client_id) then
    raise exception 'El cliente ya tiene afiliado original';
  end if;

  select c.* into v_coupon
  from public.affiliate_coupons c join public.affiliates a on a.id = c.affiliate_id
  where upper(c.code) = upper(trim(p_coupon_code)) and c.status = 'active' and a.status = 'active'
  for update of c;
  if not found then raise exception 'Cupón inválido o inactivo'; end if;

  insert into public.client_affiliations
    (client_id, affiliate_id, coupon_id, coupon_code_snapshot, discount_amount_snapshot)
  values (p_client_id, v_coupon.affiliate_id, v_coupon.id, v_coupon.code, v_coupon.discount_amount)
  returning id into v_affiliation_id;

  insert into public.client_commission_tiers
    (client_affiliation_id, start_payment_number, end_payment_number, commission_rate, is_indefinite, is_active, administrative_note)
  select v_affiliation_id, start_payment_number, end_payment_number, commission_rate, is_indefinite, is_active,
         'Copiado de plantilla al contratar'
  from public.affiliate_default_commission_tiers
  where affiliate_id = v_coupon.affiliate_id and is_active;

  if not found then raise exception 'El afiliado no tiene esquema de comisión activo'; end if;

  insert into public.affiliate_audit_log(actor_user_id, action, entity_type, entity_id, new_values)
  values (auth.uid(), 'client_affiliated', 'client_affiliation', v_affiliation_id,
    jsonb_build_object('client_id', p_client_id, 'affiliate_id', v_coupon.affiliate_id,
      'coupon', v_coupon.code, 'discount_amount', v_coupon.discount_amount));
  return v_affiliation_id;
end;
$$;

create or replace function public.register_client_payment(
  p_billing_period_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_amount_without_tax numeric,
  p_concept text,
  p_payment_method text,
  p_internal_reference text default null,
  p_is_commissionable boolean default true
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.saas_billing_periods%rowtype;
  v_payment_id uuid;
  v_total numeric(12,2);
  v_aff public.client_affiliations%rowtype;
  v_rate numeric(5,2);
  v_commission_id uuid;
  v_affiliate_email text;
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  if p_amount <= 0 or p_amount_without_tax <= 0 or p_amount_without_tax > p_amount then
    raise exception 'Importes inválidos';
  end if;

  select * into v_period from public.saas_billing_periods
  where id = p_billing_period_id for update;
  if not found then raise exception 'Mensualidad inexistente'; end if;
  if v_period.status in ('cancelled','refunded') then raise exception 'Mensualidad no cobrable'; end if;

  select coalesce(sum(amount_without_tax), 0) into v_total
  from public.client_payments
  where billing_period_id = p_billing_period_id and status = 'confirmed' and is_commissionable;
  if p_is_commissionable and v_total + p_amount_without_tax > v_period.commissionable_amount then
    raise exception 'El pago excede el saldo de la mensualidad';
  end if;

  insert into public.client_payments
    (client_id, billing_period_id, payment_date, amount, amount_without_tax, concept,
     is_commissionable, payment_method, status, internal_reference, created_by)
  values
    (v_period.client_id, v_period.id, p_payment_date, p_amount, p_amount_without_tax, p_concept,
     p_is_commissionable, p_payment_method, 'confirmed', p_internal_reference, auth.uid())
  returning id into v_payment_id;

  select coalesce(sum(amount_without_tax), 0) into v_total
  from public.client_payments
  where billing_period_id = p_billing_period_id and status = 'confirmed' and is_commissionable;

  update public.saas_billing_periods set
    amount_paid = v_total,
    status = case when v_total = 0 then 'pending'
                  when v_total < commissionable_amount then 'partially_paid' else 'paid' end,
    completed_at = case when v_total = commissionable_amount then coalesce(completed_at, now()) else null end
  where id = p_billing_period_id returning * into v_period;

  if v_total = v_period.commissionable_amount then
    select * into v_aff from public.client_affiliations
    where client_id = v_period.client_id;
    if found then
      select commission_rate into v_rate from public.client_commission_tiers
      where client_affiliation_id = v_aff.id and is_active
        and start_payment_number <= v_period.payment_number
        and (is_indefinite or end_payment_number >= v_period.payment_number)
      order by start_payment_number desc limit 1;

      if v_rate is not null and v_rate > 0 then
        insert into public.affiliate_commissions
          (affiliate_id, client_id, client_affiliation_id, billing_period_id, payment_number,
           commissionable_amount, commission_rate, commission_amount, payment_method, status, release_at)
        values
          (v_aff.affiliate_id, v_period.client_id, v_aff.id, v_period.id, v_period.payment_number,
           v_period.commissionable_amount, v_rate,
           round(v_period.commissionable_amount * v_rate / 100, 2), p_payment_method, 'pending', now() + interval '15 days')
        on conflict (billing_period_id) do nothing
        returning id into v_commission_id;

        if v_commission_id is not null then
          select email into v_affiliate_email from public.affiliates where id = v_aff.affiliate_id;
          if v_affiliate_email is not null then
            insert into public.affiliate_notification_outbox(affiliate_id, commission_id, recipient, payload)
            select v_aff.affiliate_id, v_commission_id, v_affiliate_email,
              jsonb_build_object('llantera', c.nombre_negocio, 'ciudad', c.ciudad,
                'commission_amount', round(v_period.commissionable_amount * v_rate / 100, 2),
                'status', 'pending', 'payment_number', v_period.payment_number)
            from public.clientes c where c.cliente_id = v_period.client_id;
          end if;
        end if;
      end if;
    end if;
  end if;

  insert into public.affiliate_audit_log(actor_user_id, action, entity_type, entity_id, new_values)
  values (auth.uid(), 'payment_registered', 'client_payment', v_payment_id,
    jsonb_build_object('billing_period_id', p_billing_period_id, 'amount_without_tax', p_amount_without_tax,
      'commissionable', p_is_commissionable));
  return v_payment_id;
end;
$$;

create or replace function public.annul_client_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.client_payments%rowtype;
  v_period public.saas_billing_periods%rowtype;
  v_comm public.affiliate_commissions%rowtype;
  v_total numeric(12,2);
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'El motivo es obligatorio'; end if;
  select * into v_payment from public.client_payments where id = p_payment_id for update;
  if not found or v_payment.status <> 'confirmed' then raise exception 'Pago no anulable'; end if;

  update public.client_payments set status = 'cancelled', annulled_at = now(), annulment_reason = p_reason
  where id = p_payment_id;
  select * into v_period from public.saas_billing_periods where id = v_payment.billing_period_id for update;
  select coalesce(sum(amount_without_tax), 0) into v_total from public.client_payments
    where billing_period_id = v_period.id and status = 'confirmed' and is_commissionable;
  update public.saas_billing_periods set amount_paid = v_total,
    status = case when v_total = 0 then 'pending' else 'partially_paid' end,
    completed_at = null where id = v_period.id;

  select * into v_comm from public.affiliate_commissions where billing_period_id = v_period.id for update;
  if found and v_total < v_period.commissionable_amount then
    update public.affiliate_commissions set status = 'annulled', annulled_at = now(), annulment_reason = p_reason
    where id = v_comm.id;
    if v_comm.status = 'paid' then
      insert into public.affiliate_compensations
        (affiliate_id, commission_id, original_amount, remaining_amount, reason)
      values (v_comm.affiliate_id, v_comm.id, v_comm.commission_amount, v_comm.commission_amount, p_reason)
      on conflict (commission_id) do nothing;
    end if;
  end if;

  insert into public.affiliate_audit_log(actor_user_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (auth.uid(), 'payment_annulled', 'client_payment', p_payment_id,
    to_jsonb(v_payment), jsonb_build_object('status','cancelled'), p_reason);
end;
$$;

create or replace function public.release_due_commissions()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.affiliate_commissions c set status = 'available', updated_at = now()
  from public.saas_billing_periods b
  where c.billing_period_id = b.id and c.status = 'pending' and c.release_at <= now() and b.status = 'paid';
  get diagnostics v_count = row_count;
  insert into public.affiliate_audit_log(action, entity_type, new_values)
  values ('commissions_released', 'batch', jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

revoke all on function public.assign_affiliate_coupon(text,text) from public, anon;
revoke all on function public.register_client_payment(uuid,date,numeric,numeric,text,text,text,boolean) from public, anon;
revoke all on function public.annul_client_payment(uuid,text) from public, anon;
revoke all on function public.release_due_commissions() from public, anon, authenticated;
grant execute on function public.assign_affiliate_coupon(text,text) to authenticated;
grant execute on function public.register_client_payment(uuid,date,numeric,numeric,text,text,text,boolean) to authenticated;
grant execute on function public.annul_client_payment(uuid,text) to authenticated;
