# Portal de Afiliados — Llantera Digital

Portal independiente para administrar afiliados, cupones, mensualidades, comisiones y pagos. Incluye un panel de consulta restringido para cada afiliado.

## Stack

- React 19, TypeScript y Vite.
- Supabase Postgres, Auth, RLS y Edge Functions.
- Vercel para staging y producción.
- Resend para avisos de nuevas comisiones.

## Desarrollo local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Variables públicas permitidas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_ENV`

Nunca colocar una clave secreta o `service_role` en variables `VITE_*`.

## Comprobaciones

```powershell
npm test
npm run build
```

La aplicación muestra datos de demostración cuando no hay variables de Supabase. Este modo es exclusivamente visual y no persiste operaciones.

Consulta [despliegue](docs/DEPLOYMENT.md), [arquitectura](docs/ARCHITECTURE.md) y [pruebas de aceptación](docs/ACCEPTANCE_TESTS.md).

