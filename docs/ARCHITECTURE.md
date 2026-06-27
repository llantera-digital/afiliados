# Arquitectura

## Integración sin duplicar clientes

`public.clientes` continúa siendo la fuente de verdad. La relación usa su PK real `cliente_id text`. La primera migración agrega `ciudad`, `estado` y `pais` sin alterar columnas existentes.

Las tablas del portal se agrupan así:

- Identidad: `affiliates`, `affiliate_portal_users`, `affiliate_coupons`.
- Atribución: `client_affiliations` y snapshots inmutables de cupón/descuento.
- Reglas: plantillas `affiliate_default_commission_tiers` y copias `client_commission_tiers`.
- Cobranza: `saas_billing_periods` y `client_payments`.
- Comisiones: `affiliate_commissions`, `affiliate_payouts` e items.
- Devoluciones pagadas: `affiliate_compensations` y su aplicación a pagos futuros.
- Trazabilidad: `affiliate_audit_log` y `affiliate_notification_outbox`.

## Credenciales

El usuario ve únicamente usuario y contraseña. Internamente, el usuario se convierte en una identidad privada de Supabase Auth. Supabase guarda un hash no reversible; ninguna tabla del portal almacena contraseñas legibles.

El rol y la asociación al afiliado viven en `affiliate_portal_users`. RLS nunca toma decisiones desde `user_metadata`.

## Seguridad

Todas las tablas nuevas tienen RLS. El afiliado consulta vistas `security_invoker` con columnas mínimas. Las referencias internas, notas, contactos y comprobantes no forman parte de esas vistas.

El proyecto Supabase existente tiene tablas históricas sin RLS. Esta implementación no cambia sus políticas para evitar romper Web, App móvil o bots. Ese saneamiento requiere un proyecto independiente.

## Operaciones transaccionales

- `assign_affiliate_coupon`: valida cupón, fija afiliado y copia etapas.
- `create_billing_period`: conserva descuento y continúa numeración tras reactivación.
- `register_client_payment`: acumula abonos, rechaza sobrepagos y crea una comisión idempotente.
- `annul_client_payment`: conserva el pago, anula comisión y crea deuda si ya fue pagada.
- `replace_client_commission_tiers`: sustituye etapas futuras y audita el cambio.
- `create_affiliate_payout`: agrupa disponibles y descuenta compensaciones pendientes.
- `release_due_commissions`: libera pendientes válidas después del periodo de seguridad.

