-- Operaciones administrativas restantes: mensualidades, esquemas y pagos agrupados.

create or replace function public.create_billing_period(
  p_client_id text, p_period_start date, p_period_end date, p_monthly_fee numeric
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_aff public.client_affiliations%rowtype; v_id uuid; v_number integer;
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  select * into v_aff from public.client_affiliations where client_id=p_client_id;
  if not found then raise exception 'El cliente no tiene afiliación'; end if;
  if p_monthly_fee < v_aff.discount_amount_snapshot then raise exception 'La mensualidad es menor al descuento permanente'; end if;
  select coalesce(max(payment_number),0)+1 into v_number from public.saas_billing_periods where client_id=p_client_id;
  insert into public.saas_billing_periods(client_id,period_start,period_end,payment_number,monthly_fee,discount_amount,commissionable_amount)
  values(p_client_id,p_period_start,p_period_end,v_number,p_monthly_fee,v_aff.discount_amount_snapshot,p_monthly_fee-v_aff.discount_amount_snapshot)
  returning id into v_id;
  insert into public.affiliate_audit_log(actor_user_id,action,entity_type,entity_id,new_values)
  values(auth.uid(),'billing_period_created','saas_billing_period',v_id,jsonb_build_object('client_id',p_client_id,'payment_number',v_number));
  return v_id;
end $$;

create or replace function public.replace_client_commission_tiers(
  p_client_affiliation_id uuid, p_tiers jsonb, p_reason text
) returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_old jsonb; v_tier jsonb;
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  if jsonb_typeof(p_tiers)<>'array' or jsonb_array_length(p_tiers)=0 then raise exception 'El esquema debe contener etapas'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'El motivo es obligatorio'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by start_payment_number),'[]') into v_old
    from public.client_commission_tiers t where client_affiliation_id=p_client_affiliation_id and is_active;
  update public.client_commission_tiers set is_active=false where client_affiliation_id=p_client_affiliation_id and is_active;
  for v_tier in select value from jsonb_array_elements(p_tiers) loop
    insert into public.client_commission_tiers(client_affiliation_id,start_payment_number,end_payment_number,commission_rate,is_indefinite,is_active,administrative_note)
    values(p_client_affiliation_id,(v_tier->>'start')::integer,nullif(v_tier->>'end','')::integer,(v_tier->>'rate')::numeric,
      coalesce((v_tier->>'indefinite')::boolean,false),true,p_reason);
  end loop;
  insert into public.affiliate_audit_log(actor_user_id,action,entity_type,entity_id,old_values,new_values,reason)
  values(auth.uid(),'commission_tiers_replaced','client_affiliation',p_client_affiliation_id,v_old,p_tiers,p_reason);
end $$;

create or replace function public.create_affiliate_payout(
  p_affiliate_id uuid, p_commission_ids uuid[], p_payout_date date,
  p_payment_method text, p_internal_reference text default null
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_gross numeric(12,2); v_comp_total numeric(12,2); v_apply numeric(12,2); v_payout uuid; v_comp public.affiliate_compensations%rowtype;
begin
  if not affiliate_private.is_admin() then raise exception 'Acceso denegado'; end if;
  if coalesce(array_length(p_commission_ids,1),0)=0 then raise exception 'Selecciona al menos una comisión'; end if;
  perform 1 from public.affiliate_commissions where id=any(p_commission_ids) for update;
  if (select count(*) from public.affiliate_commissions where id=any(p_commission_ids) and affiliate_id=p_affiliate_id and status='available') <> array_length(p_commission_ids,1) then
    raise exception 'Todas las comisiones deben estar disponibles y pertenecer al afiliado';
  end if;
  select sum(commission_amount) into v_gross from public.affiliate_commissions where id=any(p_commission_ids);
  select least(v_gross,coalesce(sum(remaining_amount),0)) into v_comp_total from public.affiliate_compensations where affiliate_id=p_affiliate_id and status='pending';
  insert into public.affiliate_payouts(affiliate_id,payout_date,gross_amount,compensation_amount,net_amount,payment_method,internal_reference,created_by)
  values(p_affiliate_id,p_payout_date,v_gross,v_comp_total,v_gross-v_comp_total,p_payment_method,p_internal_reference,auth.uid()) returning id into v_payout;
  insert into public.affiliate_payout_items(payout_id,commission_id) select v_payout,unnest(p_commission_ids);
  update public.affiliate_commissions set status='paid',paid_at=p_payout_date::timestamptz where id=any(p_commission_ids);
  v_apply:=v_comp_total;
  for v_comp in select * from public.affiliate_compensations where affiliate_id=p_affiliate_id and status='pending' order by created_at for update loop
    exit when v_apply<=0;
    if v_comp.remaining_amount<=v_apply then
      insert into public.affiliate_payout_compensations values(v_payout,v_comp.id,v_comp.remaining_amount);
      v_apply:=v_apply-v_comp.remaining_amount;
      update public.affiliate_compensations set remaining_amount=0,status='settled',settled_at=now() where id=v_comp.id;
    else
      insert into public.affiliate_payout_compensations values(v_payout,v_comp.id,v_apply);
      update public.affiliate_compensations set remaining_amount=remaining_amount-v_apply where id=v_comp.id;
      v_apply:=0;
    end if;
  end loop;
  insert into public.affiliate_audit_log(actor_user_id,action,entity_type,entity_id,new_values)
  values(auth.uid(),'affiliate_payout_created','affiliate_payout',v_payout,jsonb_build_object('gross',v_gross,'compensation',v_comp_total,'net',v_gross-v_comp_total));
  return v_payout;
end $$;

revoke all on function public.create_billing_period(text,date,date,numeric) from public,anon;
revoke all on function public.replace_client_commission_tiers(uuid,jsonb,text) from public,anon;
revoke all on function public.create_affiliate_payout(uuid,uuid[],date,text,text) from public,anon;
grant execute on function public.create_billing_period(text,date,date,numeric) to authenticated;
grant execute on function public.replace_client_commission_tiers(uuid,jsonb,text) to authenticated;
grant execute on function public.create_affiliate_payout(uuid,uuid[],date,text,text) to authenticated;

