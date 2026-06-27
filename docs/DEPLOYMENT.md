# Despliegue

## 1. Precauciones

Producción y staging comparten el proyecto `Bot-Llantera`. Antes de migrar:

1. Generar y verificar un respaldo de base de datos.
2. Revisar las migraciones en `supabase/migrations`.
3. Ejecutar primero los casos de aceptación con clientes de prueba.
4. No activar RLS globalmente en tablas históricas desde este repositorio.

## 2. Migraciones

Usar una versión actual de Supabase CLI y descubrir las opciones con `supabase db --help`. El orden es:

1. `affiliates_core`
2. `affiliates_business_logic`
3. `affiliates_rls_and_views`
4. `affiliates_admin_operations`

No se aplican automáticamente desde el frontend.

## 3. Primer administrador

El primer administrador es un bootstrap deliberadamente manual:

1. Crear en Supabase Auth un usuario con correo interno `USUARIO@afiliados.llantera.digital`, contraseña segura y correo confirmado.
2. Copiar su UUID.
3. Insertar desde SQL Editor:

```sql
insert into public.affiliate_portal_users(auth_user_id, username, role)
values ('UUID_DEL_USUARIO', 'USUARIO', 'admin');
```

Los siguientes usuarios se crean desde el panel mediante la Edge Function `affiliate-admin-user`.

## 4. Edge Functions y secretos

Desplegar:

- `affiliate-admin-user` con verificación JWT.
- `send-affiliate-notifications` con validación de `AFFILIATE_CRON_SECRET`.

Secretos requeridos solo en Supabase:

- `RESEND_API_KEY`
- `AFFILIATE_EMAIL_FROM`
- `AFFILIATE_CRON_SECRET`

Configurar un cron cada pocos minutos para enviar el outbox y otro diario para ejecutar `release_due_commissions()`. La configuración se hará después de validar Resend y el respaldo.

## 5. Vercel

Crear dos proyectos o dos dominios sobre el mismo repositorio:

- Producción: `afiliados.llantera.digital`, rama `main`.
- Staging: dominio de preview o `staging-afiliados.llantera.digital`, rama de staging.

Configurar en ambos `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_APP_ENV`. El DNS de `afiliados` debe ser el CNAME que indique Vercel.

## 6. Resend

Verificar `llantera.digital` en Resend mediante SPF/DKIM. Usar inicialmente `comisiones@llantera.digital`. No desplegar el envío hasta que el dominio aparezca verificado.

