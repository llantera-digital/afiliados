-- Portal de Afiliados Llantera Digital: esquema base.
-- Reversa documentada: eliminar en orden inverso las tablas affiliate_* y saas_billing_periods,
-- client_payments, client_commission_tiers, client_affiliations; después retirar ciudad/estado/pais.

create extension if not exists btree_gist with schema extensions;

alter table public.clientes add column if not exists ciudad text;
alter table public.clientes add column if not exists estado text;
alter table public.clientes add column if not exists pais text not null default 'México';

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  affiliate_type text,
  default_discount_amount numeric(12,2) not null default 0 check (default_discount_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_portal_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null check (role in ('admin','affiliate')),
  affiliate_id uuid unique references public.affiliates(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_user_requires_affiliate check (
    (role = 'affiliate' and affiliate_id is not null) or (role = 'admin' and affiliate_id is null)
  )
);
create unique index affiliate_portal_users_username_lower_idx
  on public.affiliate_portal_users (lower(username));

create table public.affiliate_coupons (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  code text not null,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  is_permanent boolean not null default true check (is_permanent),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index affiliate_coupons_code_upper_idx on public.affiliate_coupons (upper(code));

create table public.affiliate_default_commission_tiers (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  start_payment_number integer not null check (start_payment_number > 0),
  end_payment_number integer,
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  is_indefinite boolean not null default false,
  is_active boolean not null default true,
  administrative_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint default_tier_valid_end check (
    (is_indefinite and end_payment_number is null) or
    (not is_indefinite and end_payment_number >= start_payment_number)
  )
);
create unique index one_indefinite_default_tier
  on public.affiliate_default_commission_tiers (affiliate_id)
  where is_indefinite and is_active;
alter table public.affiliate_default_commission_tiers
  add constraint default_tiers_no_overlap
  exclude using gist (
    affiliate_id with =,
    int4range(start_payment_number, coalesce(end_payment_number + 1, 2147483647), '[)') with &&
  ) where (is_active);

create table public.client_affiliations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique references public.clientes(cliente_id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  coupon_id uuid not null references public.affiliate_coupons(id) on delete restrict,
  coupon_code_snapshot text not null,
  discount_amount_snapshot numeric(12,2) not null check (discount_amount_snapshot >= 0),
  affiliated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_commission_tiers (
  id uuid primary key default gen_random_uuid(),
  client_affiliation_id uuid not null references public.client_affiliations(id) on delete cascade,
  start_payment_number integer not null check (start_payment_number > 0),
  end_payment_number integer,
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  is_indefinite boolean not null default false,
  is_active boolean not null default true,
  administrative_note text,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_tier_valid_end check (
    (is_indefinite and end_payment_number is null) or
    (not is_indefinite and end_payment_number >= start_payment_number)
  )
);
create unique index one_indefinite_client_tier
  on public.client_commission_tiers (client_affiliation_id)
  where is_indefinite and is_active;
alter table public.client_commission_tiers
  add constraint client_tiers_no_overlap
  exclude using gist (
    client_affiliation_id with =,
    int4range(start_payment_number, coalesce(end_payment_number + 1, 2147483647), '[)') with &&
  ) where (is_active);

create table public.saas_billing_periods (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clientes(cliente_id) on delete restrict,
  period_start date not null,
  period_end date not null,
  payment_number integer not null check (payment_number > 0),
  monthly_fee numeric(12,2) not null check (monthly_fee >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  commissionable_amount numeric(12,2) not null check (commissionable_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','cancelled','refunded')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_period_dates check (period_end >= period_start),
  constraint fee_math check (commissionable_amount = monthly_fee - discount_amount),
  unique (client_id, payment_number),
  unique (client_id, period_start, period_end)
);

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clientes(cliente_id) on delete restrict,
  billing_period_id uuid not null references public.saas_billing_periods(id) on delete restrict,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  amount_without_tax numeric(12,2) not null check (amount_without_tax > 0 and amount_without_tax <= amount),
  concept text not null,
  is_commissionable boolean not null default true,
  payment_method text not null check (payment_method in ('transferencia','tarjeta','deposito','efectivo','otro')),
  status text not null default 'confirmed' check (status in ('confirmed','pending','cancelled','refunded')),
  internal_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  annulled_at timestamptz,
  annulment_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  client_id text not null references public.clientes(cliente_id) on delete restrict,
  client_affiliation_id uuid not null references public.client_affiliations(id) on delete restrict,
  billing_period_id uuid not null unique references public.saas_billing_periods(id) on delete restrict,
  payment_number integer not null check (payment_number > 0),
  commissionable_amount numeric(12,2) not null check (commissionable_amount >= 0),
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  payment_method text not null check (payment_method in ('transferencia','tarjeta','deposito','efectivo','otro')),
  status text not null default 'pending' check (status in ('pending','available','paid','annulled')),
  generated_at timestamptz not null default now(),
  release_at timestamptz not null,
  paid_at timestamptz,
  annulled_at timestamptz,
  annulment_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  payout_date date not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  compensation_amount numeric(12,2) not null default 0 check (compensation_amount >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  payment_method text not null,
  internal_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint payout_math check (net_amount = gross_amount - compensation_amount)
);

create table public.affiliate_payout_items (
  payout_id uuid not null references public.affiliate_payouts(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  primary key (payout_id, commission_id)
);

create table public.affiliate_compensations (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  original_amount numeric(12,2) not null check (original_amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  status text not null default 'pending' check (status in ('pending','settled')),
  reason text not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table public.affiliate_payout_compensations (
  payout_id uuid not null references public.affiliate_payouts(id) on delete restrict,
  compensation_id uuid not null references public.affiliate_compensations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  primary key (payout_id, compensation_id)
);

create table public.affiliate_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index client_affiliations_affiliate_idx on public.client_affiliations(affiliate_id);
create index billing_periods_client_status_idx on public.saas_billing_periods(client_id, status);
create index client_payments_period_status_idx on public.client_payments(billing_period_id, status);
create index affiliate_commissions_affiliate_status_idx on public.affiliate_commissions(affiliate_id, status, release_at);
create index affiliate_audit_entity_idx on public.affiliate_audit_log(entity_type, entity_id, created_at desc);
