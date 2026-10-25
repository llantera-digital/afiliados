-- Corrección del conteo de mensualidades en affiliate_visible_clients.
--
-- Alcance: SOLO la vista. La infraestructura del outbox (columnas, índices y
-- RPC) vive en 20261025010000_outbox_claim_identity.sql.
--
-- Motivo: la vista unía periodos y etapas en el mismo `from`, de modo que cada
-- periodo se multiplicaba por cada etapa activa. Ahora cada agregado va en un
-- lateral independiente y el número de mensualidades no depende de las etapas.
-- Se conservan columnas, tipos, security_invoker y el filtro por afiliado.
--
-- Reversión: ver work/cambio-20261025/revertir.sql, que repone la definición
-- anterior capturada de producción.

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
