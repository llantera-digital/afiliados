# Llantera Digital · Portal de Afiliados

Portal independiente para administrar afiliados, cupones, mensualidades, comisiones y pagos, con una vista restringida para cada afiliado. Usa React 19, TypeScript estricto, Vite, Supabase Auth/Postgres/RLS, funciones Edge y avisos por Resend.

**Raíz:** `C:\Llantera_Digital\06_AFILIADOS`. Documentación funcional al 25 de octubre de 2026 y última revisión documental el **28-oct-2026**. Este README es la entrada del componente; el [centro de control](../00_CONTROL_DEL_PROYECTO/README.md) explica su relación con los demás proyectos. Las fechas internas de cada publicación se conservan.

## Estado y alcance

El objetivo es conservar un proyecto ordenado, comprensible y coordinado. La limpieza está terminada. No hay un despliegue ni una reestructuración pendiente como requisito para cerrar esta tarea.

| Parte | Estado |
|---|---|
| Limpieza del 24-oct | Seis archivos archivados, tres originales conservados y nueve registros verificados en `RECUERDO/INVENTARIO.csv` (evidencia local, no versionada). |
| Código actual en disco | Alta v20, conteo aplicado (migración `20261025000000`) y outbox aplicado (migración `20261025010000`, función v18). El envío real de correo sigue pendiente de verificar. No asumir que todo `supabase/` coincide con producción. |
| Versión anterior | Los dos `index.ts` originales están conservados y verificados contra las huellas anteriores al cambio. No se restauraron. |
| Producción | Alta v20 activa, con `verify_jwt=true`, confirmada en Supabase. Avisos v18, con `verify_jwt=false`. Las pruebas sintéticas publicadas se documentan abajo; no certifican todo el módulo financiero. |
| Trabajo futuro | Las tres correcciones están publicadas. Falta habilitar y comprobar el correo y su ejecución periódica, según la lista siguiente. No instalar entornos en esta PC. |

El inventario funcional y los originales están en `work/cambio-20261025/EVIDENCIAS.md` (evidencia local, no versionada) y distinguen ambas versiones sin perder trabajo. No ejecutar `db push`, migraciones ni scripts de reversión como parte de la limpieza.

## Próximo trabajo: habilitar los avisos por correo

**Estado al 25 de octubre de 2026:** outbox y función v18 publicados. **Los avisos automáticos todavía no están operativos:** la entrega de publicación registró ausencia de `AFFILIATE_CRON_SECRET` y `RESEND_API_KEY`, no se envió correo real y no se identificó un programador de esta función. Volver a comprobar estos requisitos al retomar.

1. **Configurar el acceso en Supabase.** Generar un `AFFILIATE_CRON_SECRET` privado y configurar `RESEND_API_KEY` válida en los secretos del proyecto. No incluir valores en Git, documentación, frontend ni mensajes de chat.
2. **Confirmar remitente y destinatario de prueba.** Configurar `AFFILIATE_EMAIL_FROM` con un remitente autorizado por Resend. Obtener del propietario una dirección de pruebas autorizada; no usar destinatarios de clientes. No confiar en el remitente predeterminado sin verificarlo.
3. **Probar la función publicada manualmente.** Invocar `send-affiliate-notifications` con la cabecera `x-cron-secret` válida. Comprobar respuesta `processed/sent/failed/late`, recepción real del aviso sintético, estado `sent` y registros sin secretos. La comprobación con secreto válido y el envío real aún están pendientes.
4. **Verificar reintentos e idempotencia.** Probar de forma controlada fallos, recuperación y respuesta del proveedor a la misma clave y contenido. Documentar su ventana de idempotencia y límites: no prometer entrega exactamente una vez. Conservar evidencia y limpiar solo los datos sintéticos creados.
5. **Configurar una única ejecución periódica.** Elegir el programador y la frecuencia, proteger el secreto de la llamada y registrar dónde se administra, cómo se pausa y cómo se comprueba su última ejecución. Revisar programadores existentes antes de crear otro. La tarea `simular_ventas_demo_diarias` registrada durante la revisión es ajena a los avisos y no debe modificarse para habilitarlos.
6. **Cerrar la habilitación.** Comprobar una ejecución automática exitosa y recepción real; registrar fecha, configuración sin valores secretos y resultados en este README y en la evidencia local `work/cambio-20261025/EVIDENCIAS.md`. Definir cómo revisar avisos fallidos o con cinco intentos agotados.

**Criterio de cierre:** autenticación válida comprobada, correo recibido en la bandeja autorizada, estados y reintentos verificados y programador único funcionando. Hasta entonces, describir el correo como pendiente de habilitación, aunque la función aparezca activa. Esta lista no habilita servicios por sí misma. La programación de `release_due_commissions` es un pendiente distinto y debe revisarse por separado.

## Responsabilidades y coordinación

- `06` mantiene el portal de afiliados, sus reglas específicas y las funciones `affiliate-admin-user` y `send-affiliate-notifications`.
- `public.clientes` y el proyecto Supabase son compartidos. Antes de modificar datos, permisos o esquema, revisar sus consumidores; no decidir únicamente desde este portal.
- Las migraciones de `01`, `02`, `05` y `06` tienen historias solapadas. Se conservan: no borrar ni trasladar SQL por semejanza, ni asumir que una carpeta reconstruye toda la base.
- El mapa de responsabilidades del centro de control describe las rutas actuales y decisiones pendientes. No se ha aprobado trasladar las funciones de `06` a `01`. El documento local `00_CONTROL_DEL_PROYECTO/15_mapa_fuentes_de_verdad.md` no está versionado; para una entrega, usar el README central.
- `RECUERDO/` contiene antecedentes; `work/` contiene ensayos, evidencias y originales. Ninguno es otra copia activa del portal ni un paquete de publicación.

## Pendientes funcionales fuera del cierre de limpieza

La tabla siguiente describe los hallazgos originales del 24-oct y sus criterios de cierre. Las primeras tres filas describen el comportamiento anterior: las tres correcciones están aplicadas y publicadas. Consultar el estado de cada corrección más abajo.

### Hallazgos originales y criterios para una futura corrección

La compilación y las cuatro pruebas actuales pasan, pero esas pruebas solo cubren formato de presentación e identificación interna del usuario. **No certifican cálculos financieros, aislamiento entre afiliados, altas transaccionales ni entrega de correos.**

| Prioridad | Hallazgo y alcance de la evidencia | Corrección y criterio de cierre |
|---|---|---|
| **P1 · altas consistentes** | `affiliate-admin-user` accede a `body.tiers.map(...)` después de crear el usuario, afiliado, perfil y cupón. Con etapas ausentes, la reproducción del cuerpo original de la función lanzó `TypeError` tras esas escrituras simuladas, sin ejecutar limpieza. Evidencia: `hallazgos-edge.json`. | Validar el cuerpo completo, tipos, rangos y etapas antes de escribir. Manejar excepciones y compensar las operaciones de Auth/BD que no puedan ser atómicas. Probar cuerpo incompleto y fallo en cada paso; no deben quedar cuentas o afiliados parciales. |
| **P1 · avisos recuperables y sin duplicados** | `send-affiliate-notifications` selecciona pendientes/fallidos y después marca `processing`, sin reclamación exclusiva. Dos ejecuciones simuladas enviaron la misma fila dos veces. Una interrupción del transporte dejó la fila en `processing`; la siguiente ejecución no la recuperó. Son reproducciones locales con SDK/correo simulados, no correos reales. | Implementar reclamación atómica, idempotencia, vencimiento/recuperación del trabajo y manejo de fallos de red/proveedor. Probar concurrencia, corte después de enviar y antes de confirmar, recuperación y límite de intentos. |
| **P1 · conteo correcto de mensualidades** | La vista `affiliate_visible_clients` calcula `count(bp.id)` tras unir periodos con etapas. La reproducción relacional mínima con los mismos joins y agregado contó **cuatro** mensualidades al existir **dos** periodos pagados y dos etapas. Evidencia: `hallazgo-conteo.json`; reproducción SQLite en memoria, no validación PostgreSQL remota. | Evitar multiplicación de filas mediante agregación independiente o conteo correcto de periodos únicos. Validar en PostgreSQL con varios periodos, varias etapas, etapas desactivadas y clientes sin pagos. No confundir este contador con una prueba de todos los importes de comisión. |
| **P1 · privacidad y aislamiento** | El hallazgo original del 24-oct detectó vistas de columnas mínimas y políticas de fila propias sobre tablas base con notas o referencias internas; no se declaró exposición real. | **Antecedente superado en la base:** el cierre posterior dejó `clientes` con RLS y sin permiso de lectura de tabla completa para `anon/authenticated`; `authenticated` conserva SELECT sobre cinco columnas comerciales sujeto a RLS; `affiliate_visible_clients` conserva `SELECT` para `authenticated`. La validación integral de permisos, columnas y aislamiento sigue pendiente de evidencia específica con dos afiliados y un administrador. Mantener la matriz de aceptación (punto 12) como regresión; no declarar cerrado el aislamiento completo solo por el estado de RLS. |
| **P1 · ciclo financiero completo** | La matriz de aceptación del negocio no tiene aquí pruebas automatizadas de pagos parciales, anulaciones, compensaciones, reactivación y payouts. El cálculo de compensaciones en `create_affiliate_payout` se obtiene antes del bloqueo posterior de esas filas: requiere una prueba específica de concurrencia entre payouts del mismo afiliado. Es revisión estática pendiente de validación transaccional. | Ejecutar la matriz descrita más abajo en un entorno de prueba separado y añadir regresiones financieras, de permisos y concurrencia. No certificar importes o pagos agrupados solo porque el frontend compila. |
| **P2 · acceso y demo explícitos** | Sin URL/clave configuradas, `AuthContext` crea una identidad local por el nombre: un usuario que comienza con `admin` recibe el rol local de administrador. No autentica contra Supabase. `VITE_APP_ENV` no controla ese recorrido y la interfaz no lo presenta claramente como demo. Esto no demuestra acceso al backend real sin credenciales. | Separar el modo de demostración explícito del modo operativo y fallar de forma visible ante configuración ausente/inválida en producción. Comprobar arranque sin variables, con marcadores de ejemplo y con sesión real. |
| **P2 · interfaz y errores de datos** | Varias consultas sustituyen errores por listas vacías o ceros; el cupón puede quedar en Cargando cuando falta configuración. No hay pantallas para todas las operaciones SQL existentes —crear periodos, anular pagos, cambiar etapas y registrar payouts— y el pago exige introducir un UUID de periodo. | Distinguir error, ausencia de datos y carga. Completar o delimitar el flujo administrativo antes de presentarlo como operación integral. Añadir estados y permisos verificables. |
| **P2 · automatizaciones y política vigente** | No hay en estos archivos evidencia de un cron activo para liberar comisiones/enviar outbox. Además, la migración posterior incorpora atribución tardía, excepción a la especificación inicial de cupón exclusivo al contratar. | Verificar programación real y dominio de correo sin asumir que están activos. Conciliar la regla de atribución tardía con la política aprobada, sin quitar esa función ni cambiar condiciones comerciales durante mantenimiento. |

### Estado de las correcciones (2026-10-25)

La corrección del alta está **publicada** en Supabase como `affiliate-admin-user` **v20** (2026-10-25T09:40:47Z; hash `6959065e9eace765bdad0c72b837ff19dddf59a06bd0c9fa1d45c1cc27c7f31c`), con `verify_jwt = true`. El **conteo está aplicado** con la migración `20261025000000`. El **outbox está aplicado y publicado**: migración `20261025010000` registrada y `send-affiliate-notifications` **v18** (2026-10-25T10:25:54Z; hash `cd6a93826b0fd7904a0e1e2a553b9064dd85fa9bc156dfad2d6f191ab872d8c0`; `verify_jwt = false`), con el envío real de correo pendiente de verificar. La versión mayor no demuestra por sí sola un cambio funcional; los cuerpos desplegados son recuperables por la API, pero no se compararon en esta revisión.

| Corrección | Archivos | Estado |
|---|---|---|
| Validación y compensación de altas | `affiliate-admin-user/index.ts` y `core.mjs` | **Publicada** (v20) |
| Conteo sin multiplicación por etapas | migración `20261025000000` | **Publicada** (vista corregida y registrada) |
| Reclamación y recuperación del outbox | migración `20261025010000` y `send-affiliate-notifications/*` | **Publicada** (v18), correo real pendiente |

**Publicación del alta.** Incluye dos defectos encontrados en la revisión previa: el JSON malformado ahora se rechaza con 400 (`parsearCuerpo`) y las compensaciones incompletas se registran con `COMPENSATION_PARTIAL` desde el adaptador. El contrato del frontend no cambió: `201 {id, username, role}` en éxito y `{error}` en error; `compensacion_incompleta` solo aparece si la compensación falla.

**Pruebas de la publicación.** Contra la función publicada se ejecutaron diez comprobaciones con usuarios sintéticos: 401 sin sesión, 403 sin rol admin, 400 por JSON malformado, 400 sin etapas y con etapas inválidas, 201 en alta válida, 400 por usuario duplicado, registros 1/1/1/1/2 y limpieza 0/0/0/0. Evidencia en `work/prueba-publicada/resultado.json`. Los recursos sintéticos se eliminaron y se verificó que no quedaran restos.

**Publicación del conteo.** La migración `20261025000000` se aplicó con la API de administración y se registró en `supabase_migrations.schema_migrations`; la `20261025010000` no se tocó. La vista conserva columnas, tipos, `security_invoker`, propietario y privilegios, y solo cambió el cálculo. Se probó en producción con seis clientes sintéticos: 2×2→2, 3×2→3, 2×1→2, 2×0→2, 0×2→0 y 1 pagada + 1 pendiente→1, con `last_paid_at` y etapas correctos. La limpieza dejó cero registros en las ocho tablas implicadas. La definición anterior exacta y la restauración están en `work/cambio-20261025/vista-antes.sql` y en EVIDENCIAS.md.

**Publicación del outbox.** La migración `20261025010000` se aplicó y registró: columnas `claimed_at`/`claim_expires_at`/`claim_token`, dos índices y la RPC de 3 argumentos, ejecutable solo por `service_role`. Se publicó `send-affiliate-notifications` **v18** con `verify_jwt = false` y autenticación por `x-cron-secret`. El código añade tiempo máximo por envío (10 s), presupuesto de lote (80 % del arriendo), cierre visible de las filas que agotan cinco intentos y respuesta `processed/sent/failed/late`. En producción se comprobó: 401 sin secreto, con secreto incorrecto y con secreto vacío; reclamación simultánea de 4 filas (unión 4, intersección 0, cuatro tokens distintos); rotación de token; marca con el token anterior 0 filas y con el vigente 1; recuperación de una fila sin arriendo; fila con cinco intentos cerrada como «intentos agotados»; quinto intento reclamado una vez y luego no reintentado; parámetros fuera de rango rechazados. Limpieza en cero en outbox, comisiones, periodos, afiliaciones, clientes, cupones y afiliados.

**Idempotencia de Resend.** La documentación oficial acepta `Idempotency-Key` de 1–256 caracteres y deduplica durante **24 horas**: la misma clave con el mismo payload devuelve la misma respuesta sin reenviar, y con un payload distinto responde `409 invalid_idempotent_request`. No hay entrega «exactamente una vez»: fuera de la ventana de 24 h, o si cambia el payload, un reintento puede enviar de nuevo. El código usa el `id` del aviso como clave, que es estable entre reintentos.

**Restauración.** El código desplegado de v18 se recuperó del bundle eszip y se conserva en `work/restauracion-v18/index.ts` (hash `9437875D…`), junto con el bundle íntegro. Esa copia difiere de `work/cambio-20261025/antes/` solo en la codificación de acentos y dos líneas en blanco. Para volver a v18: copiar ese `index.ts` sobre la función y desplegar; el `core.mjs` actual queda sin uso.

**Restauración del outbox.** El fuente desplegado de v16 se recuperó del bundle y está en `work/restauracion-v16/index.ts` (hash `1525D2BE…`), con el bundle íntegro. Para revertir: pausar invocaciones, copiar ese `index.ts`, desplegar y **conservar** las columnas, los índices y las filas; no hace falta borrar el esquema ni el historial.

**Limitaciones.** El envío real de correo no se verificó: entre los secretos del proyecto no están `AFFILIATE_CRON_SECRET` ni `RESEND_API_KEY`, y no hay un destinatario de pruebas autorizado. Sin `AFFILIATE_CRON_SECRET` la función rechaza toda invocación (401), así que tampoco se pudo probar el camino con secreto válido ni la respuesta `processed/sent/failed/late` desde el endpoint. No se tocaron permisos, RLS, cron, modelos ni WhatsApp. Alta en `6abf294`; conteo en `d85fdc`; el outbox se publica en un commit posterior de `main`. La sincronización de código funcional comprobada fue `51a6bf8`; las revisiones documentales posteriores no cambian esa referencia de código probado. `43b69d4` fue la sincronización anterior y se conserva como antecedente.

La batería conjunta reportó **24 aprobadas / 11 fallidas antes** y **35 / 0 después** (alta, conteo y outbox). La revisión posterior ejecutó además las **13/13 pruebas específicas del alta**; no son 35 pruebas exclusivas del alta. El portal pasó **4/4 pruebas**, TypeScript y Vite. Estas comprobaciones no certifican todo el negocio financiero.

Las **39/39 comprobaciones adicionales** pertenecen a un ensayo embebido con tablas sintéticas, sustituto de Auth y privilegios preparados para las pruebas. Ejerce RLS de PostgreSQL, pero no reproduce por sí solo Auth, la API o el correo reales. La visibilidad de `clientes` allí no acredita los grants de producción.

**Corrección de estado (28-oct-2026):** la entrega anterior registró RLS desactivado en producción y dejó los privilegios efectivos pendientes. La comprobación de metadatos posterior muestra `clientes` con `relrowsecurity=true`, sin permiso de lectura de tabla completa para `anon/authenticated`. `anon` tampoco puede leer columnas; `authenticated` conserva SELECT sobre `cliente_id`, `nombre_negocio`, `ciudad`, `estado` y `pais`, sujeto a RLS. En `affiliate_visible_clients`, `authenticated` tiene permiso SELECT. Esto **supera el antecedente de RLS desactivado**, pero no sustituye la validación integral de permisos, columnas y aislamiento entre dos afiliados; esa prueba sigue pendiente.

| Referencia conservada | Uso |
|---|---|
| `work/cambio-20261025/EVIDENCIAS.md` (local, no versionado) | Seis archivos, originales, huellas, hechos reportados y supuestos. |
| `work/ensayo-20261024/LEEME.md` (local, no versionado) | Reproducciones y límites; no es necesario ejecutarlo para cerrar la limpieza. |
| Análisis de correcciones del centro de control | Antecedente local no versionado; el estado actual está en este README y en el README central. |
| Plan de validación y despliegue de 06 | Antecedente local no versionado; no autoriza ejecutar la matriz financiera. |

Los originales y scripts de reversión se conservan; no se ejecutaron. Tampoco se movieron los cambios a otra raíz o se sincronizaron con otros proyectos. El código desplegado de v18 se recuperó del bundle y se conserva en `work/restauracion-v18/`, junto con la evidencia de la publicación.

## Estructura vigente

| Ruta | Responsabilidad |
|---|---|
| `src/main.tsx`, `src/App.tsx` | Montaje React, BrowserRouter y rutas por rol. |
| `src/auth/AuthContext.tsx` | Sesión Supabase y perfil en `affiliate_portal_users`; recorrido local sin configuración descrito arriba. |
| `src/screens/AdminScreens.tsx` | Resumen, altas, afiliación tardía, pagos, comisiones y auditoría del administrador. |
| `src/screens/AffiliateScreens.tsx` | Resumen, clientes, comisiones y cupón del afiliado. |
| `src/components/`, `src/styles.css` | Presentación y navegación compartidas. |
| `src/lib/supabase.ts`, `src/types.ts` | Cliente Supabase, traducción de usuario a identidad interna y tipos de interfaz. |
| `src/lib/format.ts`, `format.test.ts` | Formatos MXN/fechas/estados y cuatro pruebas de presentación. |
| `supabase/migrations/` | Cinco migraciones anteriores y las dos correcciones **aplicadas** (conteo y outbox); conservar nombre, orden y contenido. |
| `supabase/functions/affiliate-admin-user/` | Alta administrativa de usuarios, afiliados, cupón y etapas. |
| `supabase/functions/send-affiliate-notifications/` | Procesamiento de avisos por correo desde el outbox. |
| `supabase/config.toml` | Proyecto y verificación JWT de funciones. |
| `vite.config.ts`, `tsconfig*.json`, `vercel.json` | Compilación, tipos y rutas de alojamiento. |
| `.env.example`, `.env.local` | Plantilla pública y configuración privada existente. |
| `.vercel/` | Vinculación y metadatos locales del sitio, conservados. |
| `dist/`, `node_modules/` | Resultado y dependencias regenerables, fuera de Git. |
| `work/revision-20261024/` | Evidencias y herramientas locales de revisión. |
| `RECUERDO/` | Documentación anterior, especificación original, datos demo sin uso y archivo manual de credenciales. |
| `.git/` | Historial original, conservado. |

Se conservan las identidades Portal de Afiliados y Llantera Digital. MP Responde corresponde al proyecto Android de Marketplace, no a este portal.

## Comandos de referencia

Son referencias técnicas para mantenimiento, no una instrucción para instalar un entorno en la PC del usuario. El portal se aloja en Vercel.

Desde PowerShell:

```powershell
cd C:\Llantera_Digital\06_AFILIADOS
npm ci
npm run dev
```

Usar el lockfile existente; esta revisión no actualizó dependencias. En este equipo ya están instaladas. Para una instalación nueva, completar `.env.local` a partir del ejemplo sin sobrescribir un archivo existente.

```powershell
npm test
npm run build
npm run preview
```

`npm test` ejecuta Vitest. `npm run build` ejecuta primero `tsc --noEmit -p tsconfig.app.json` y después Vite; aquí sí se exige que los tipos del frontend pasen. `preview` sirve el resultado compilado. Las funciones Edge y el SQL requieren comprobaciones aparte; el build no los aplica ni los publica.

No hay una APK o app Android en esta carpeta. El producto se distribuye como portal web.

## Configuración pública y secretos

Variables que se incorporan al frontend al compilar:

- `VITE_SUPABASE_URL`: origen del proyecto de datos.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave pública del cliente.
- `VITE_APP_ENV`: etiqueta de entorno declarada; actualmente no impone aislamiento ni desactiva automáticamente el recorrido demo.

El modo operativo requiere una URL y clave válidas. El cliente se crea también sin configuración usando un origen de marcador; eso no constituye un backend de pruebas. El archivo de datos demo anterior no estaba importado por las pantallas y quedó archivado; las listas vacías actuales no equivalen a una demostración funcional de todos los procesos.

En Supabase, las funciones requieren `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en servidor. Los avisos usan además `RESEND_API_KEY`, `AFFILIATE_EMAIL_FROM` y `AFFILIATE_CRON_SECRET`. Estos secretos no pertenecen al ejemplo del frontend ni a variables `VITE_*`. El ejemplo se dejó solo con configuración pública; los archivos reales no se editaron.

El procesador de avisos acepta además, con estos valores predeterminados: `AFFILIATE_OUTBOX_BATCH` (20, entre 1 y 100), `AFFILIATE_OUTBOX_LEASE_SECONDS` (300, entre 1 y 3600), `AFFILIATE_OUTBOX_LEGACY_GRACE_SECONDS` (900, entre 0 y 86400), `AFFILIATE_OUTBOX_SEND_TIMEOUT_MS` (10000, entre 1000 y 30000) y `AFFILIATE_OUTBOX_MAX_RUN_SECONDS` (240, entre 5 y 3600; el lote se corta al 80 % del arriendo). El adaptador usa los valores predeterminados cuando la configuración no es válida; la RPC rechaza argumentos fuera de sus rangos.

`CREDENCIALES.txt` no es leído por el código. Se conservó en `RECUERDO/CREDENCIALES.txt`, con el mismo contenido y permisos, sin mostrarlo ni copiar sus valores al README. El archivo histórico, evidencias, variables privadas y metadatos locales quedan excluidos de Git. Mantenerlos también fuera de contextos de publicación.

## Acceso y rutas

El personal introduce usuario y contraseña. El código convierte el usuario en una dirección interna `usuario@afiliados.llantera.digital` para Supabase Auth; el rol y la relación con el afiliado se consultan en `affiliate_portal_users`, filtrando usuarios activos. Las decisiones de RLS no se basan en `user_metadata`.

| Área | Rutas |
|---|---|
| Acceso | `/login` |
| Afiliado | `/portal`, `/portal/clientes`, `/portal/comisiones`, `/portal/cupon` |
| Administrador | `/admin`, `/admin/afiliados`, `/admin/clientes`, `/admin/pagos`, `/admin/comisiones`, `/admin/auditoria` |

Las rutas protegidas redirigen según el rol. Esa protección de la interfaz debe complementarse con comprobaciones reales de permisos en funciones, RPC y tablas. El primer administrador requiere un alta controlada en Supabase Auth y su perfil administrativo; no se creó ninguno durante esta revisión. Las altas posteriores utilizan `affiliate-admin-user`, que valida una sesión y perfil de administrador antes de operar.

## Datos y reglas de negocio

`public.clientes` sigue siendo la fuente común de llanteras; la relación utiliza `cliente_id text`. No crear una copia independiente del catálogo de clientes ni activar RLS globalmente sobre tablas antiguas desde este mantenimiento.

El esquema local agrupa:

- Identidad y atribución: `affiliates`, `affiliate_portal_users`, `affiliate_coupons`, `client_affiliations`.
- Etapas: `affiliate_default_commission_tiers`, copiadas a `client_commission_tiers` al afiliar.
- Cobranza: `saas_billing_periods`, `client_payments`.
- Comisiones/pagos: `affiliate_commissions`, `affiliate_payouts`, sus integrantes y compensaciones.
- Auditoría y avisos: `affiliate_audit_log`, `affiliate_notification_outbox`.

La especificación original establece atribución por cupón al contratar, permanencia del afiliado y descuento del cliente, y continuidad del contador de mensualidades tras reactivación. La migración `assign_affiliate_late` agrega una atribución administrativa posterior con motivo, fecha efectiva y etapas desplazadas a la siguiente mensualidad existente por crear; no genera retroactivamente comisiones. La interfaz actual incluye esa operación. Conciliar esta excepción con la política comercial vigente antes de ampliar el flujo.

Solo la mensualidad recurrente del SaaS, sin IVA y cobrada por completo, es base comisionable. Abonos parciales todavía no generan comisión. Implementación, equipo, capacitación, publicidad y otros conceptos no deben aumentar esa base. Los ejemplos históricos de $5,000, descuento $1,000 y comisión 50% son escenarios de aceptación, no tarifas que esta revisión haya fijado como vigentes.

Las etapas se copian al cliente y deben preservar condiciones históricas; cambiar una plantilla no debe recalcular comisiones ya generadas. La comisión se crea pendiente, con liberación a los 15 días según el código. Anular un pago conserva el movimiento y puede anular una comisión o generar compensación si ya se pagó. No borrar movimientos financieros para cuadrar saldos.

La especificación prevé corte mensual y pago manual del disponible entre días 5 y 10 del siguiente mes, sin mínimo inicial; esa política se conserva como referencia para conciliación operativa. El portal no realiza transferencias bancarias automáticas ni implementa multinivel, atribución por cookies o seguimiento de clics.

## Funciones y programación

Las RPC locales incluyen `assign_affiliate_coupon`, `assign_affiliate_late`, `create_billing_period`, `register_client_payment`, `annul_client_payment`, `replace_client_commission_tiers`, `create_affiliate_payout` y `release_due_commissions`. Las cinco migraciones anteriores se conservaron; de las dos nuevas, ambas están aplicadas. No asumir que los historiales locales pueden ejecutarse en bloque contra el esquema remoto.

`affiliate-admin-user` tiene verificación JWT declarada y comprueba además la sesión y el rol dentro de la función. `send-affiliate-notifications` tiene `verify_jwt = false` y exige `x-cron-secret` igual a `AFFILIATE_CRON_SECRET`; esto no lo convierte en un endpoint público sin autenticación.

El código local y la función publicada v18 reclaman avisos mediante la nueva RPC, con token y arriendo; el lote predeterminado es 20 y el máximo de intentos es cinco. La migración `20261025010000` está aplicada. Lo pendiente es habilitar secretos, remitente, entrega real y ejecución periódica, siguiendo la lista inicial. La liberación de comisiones necesita su propia programación administrativa o de servidor; no se creó ni se activó un cron durante esta revisión.

La configuración original señalaba que staging y producción comparten proyecto Supabase. No asumir aislamiento de datos solo por usar otro dominio o `VITE_APP_ENV=staging`; verificar un entorno de prueba adecuado antes de ejecutar la matriz financiera.

## Matriz de aceptación pendiente de ejecutar integralmente

Usar datos inequívocamente ficticios en un entorno de prueba y conservar auditoría. Estos casos son requisitos de validación, no resultados ya aprobados:

1. Crear afiliado, cupón y etapas; comprobar validación de rangos y recuperación ante fallos de alta.
2. Afiliar un cliente y comprobar snapshots y copia de etapas; cubrir también atribución tardía y ausencia de cambio del afiliado original.
3. Crear mensualidad de ejemplo de $5,000 con descuento $1,000 y comprobar base de $4,000 sin IVA.
4. Pagar $4,000 y comprobar una única comisión de $2,000 al 50%, pendiente y liberación después de 15 días.
5. Repetir con dos abonos de $2,000: no debe existir comisión tras el primero.
6. Registrar un concepto no comisionable y comprobar que no altera el saldo de mensualidad.
7. Intentar un sobrepago y comprobar rechazo sin movimientos parciales.
8. Anular un pago completo y conservar pago/comisión con estados y motivo correctos; comprobar cobro posterior sin duplicidad ni comisión incorrectamente anulada.
9. Anular tras pagar una comisión y comprobar compensación del payout siguiente, también con operaciones concurrentes.
10. Cancelar tras siete mensualidades y reactivar: continuar con la octava y su etapa correspondiente.
11. Cambiar etapas futuras sin alterar tasa ni importe históricos.
12. Probar dos afiliados, URLs, API, tablas base y vistas: no deben obtener filas ajenas ni datos internos.
13. Comprobar que correo, teléfono, notas y referencias privadas no aparecen en la información accesible del afiliado, y que los avisos resisten concurrencia e interrupciones sin perderse o duplicarse.

Añadir casos del contador con varias etapas, estados de carga/error y ausencia de variables. Las cuatro pruebas actuales no cubren esta matriz.

## Alojamiento y resultado histórico de la limpieza del 24-oct

Vercel conserva su vinculación en `.vercel/` y el fallback SPA de `vercel.json`. El build genera `dist/`. No se cambió el dominio, la vinculación o el destino remoto. Las funciones Supabase y las migraciones tienen despliegues independientes; no se publican con Vite.

**Publicación y recuperación verificadas (26-oct, actualizada al 28-oct):** el proyecto Vercel `afiliados-llantera-digital` está vinculado a GitHub `llantera-digital/afiliados`, productionBranch `main`. El deployment funcional comprobado el 28-oct es `dpl_8vZg43JibBrv6hQqQBQuEWb33D5D`, READY, source=git, commit `51a6bf8`, con URL canónica **https://afiliados-llantera-digital.vercel.app**. El deployment anterior `dpl_AZGhAFwtfLqA6J5gz5oLFKi3so4A`/`43b69d4` se conserva como antecedente. Un push a `main` genera un deployment; las funciones y migraciones Supabase se publican por separado. Para recuperar el portal, promover en Vercel un deployment productivo anterior que esté READY; no se ejecutó esa promoción. La publicación verificada de este componente es Git/main. Que el CLI Vercel esté disponible en el equipo no acredita un procedimiento CLI probado para 06.

Se archivaron **seis archivos**: los tres documentos técnicos anteriores, la especificación original, el archivo manual de credenciales y un archivo demo sin referencias. Se preservaron **tres originales antes de editar**: README, reglas de Git y ejemplo de variables. Los **nueve registros** de `RECUERDO/INVENTARIO.csv` se verificaron por tamaño y SHA-256.

Durante la limpieza del 24-oct se conservaron sin cambios **33 archivos operativos y de configuración**, incluidos código, pruebas, funciones, migraciones, dependencias, configuración de alojamiento, `.env.local` y vinculación de Vercel. Las correcciones posteriores del 25-oct son una etapa distinta, identificada arriba. Este resultado histórico no afirma que los dos `index.ts` continúen sin cambios hoy.

La compilación pasó tanto TypeScript estricto del frontend como Vite antes y después. Las cuatro pruebas Vitest también pasan en ambas ejecuciones. Los **tres archivos compilados son idénticos por SHA-256**. Las evidencias están en `work/revision-20261024/`; las comprobaciones locales no certifican funcionamiento financiero ni permisos efectivos en producción.

No se modificaron credenciales, datos reales, comisiones, usuarios, pagos o suscripciones. No se enviaron correos reales, aplicaron migraciones, activaron tareas programadas ni desplegaron servicios. No se tocaron las otras carpetas del proyecto.

## Recuperar antecedentes

`RECUERDO/INVENTARIO.csv` contiene acción, ruta original, destino, tamaño y SHA-256. La estructura y el contenido histórico se conservan; `RECUERDO/antes-de-editar/` guarda los originales de los archivos revisados.

Para recuperar un archivo, verificar su huella y compararlo antes de copiarlo a su ruta original. No restaurar configuraciones o ejecutar instrucciones/SQL históricos en bloque. El archivo manual de credenciales conserva su ACL y requiere la misma reserva que antes; no incluir `RECUERDO` en Git ni en paquetes de despliegue.
