# Especificación para Codex
## Portal Minimalista de Afiliados de Llantera Digital

### Contexto general

Llantera Digital ya cuenta con un SaaS funcional y una base de datos en Supabase que incluye una tabla de clientes. Se requiere integrar un sistema minimalista de afiliados dentro del mismo proyecto de Supabase y publicar el portal en:

`https://afiliados.llantera.digital`

El sistema debe ser deliberadamente sencillo, transparente y adaptado a ventas consultivas. No debe parecer un plugin genérico de afiliados ni incluir funciones innecesarias como multinivel, seguimiento de clics, cookies, banners, rankings o pagos automáticos.

El objetivo es resolver únicamente estas preguntas:

1. ¿Qué afiliado originó a cada cliente?
2. ¿Qué cupón utilizó el cliente al contratar?
3. ¿Qué mensualidades del SaaS fueron efectivamente cobradas?
4. ¿Qué comisión corresponde por cada mensualidad?
5. ¿Qué comisiones están pendientes, disponibles, pagadas o anuladas?
6. ¿Qué información mínima necesita ver el afiliado para confiar en el sistema sin tener acceso al proceso comercial interno?

---

# 1. Principios obligatorios

## 1.1 Atribución exclusivamente por cupón

La atribución de un cliente se determina exclusivamente por el cupón utilizado al momento de la contratación inicial.

No usar:

- cookies;
- enlaces con parámetros `ref`;
- seguimiento de clics;
- atribución por primera visita;
- atribución por primer contacto;
- registro de prospectos;
- CRM de prospectos;
- seguimiento de asistentes a talleres.

El cupón se usa una sola vez al contratar.

Al utilizar el cupón:

- se identifica al afiliado;
- se asigna permanentemente ese afiliado al cliente;
- se asigna un descuento permanente al cliente;
- se copia al cliente el esquema de comisiones aplicable;
- se genera la primera comisión únicamente cuando la primera mensualidad esté pagada por completo.

## 1.2 El afiliado original nunca cambia

Después de la contratación:

- el cliente no puede cambiar de afiliado;
- no puede aplicar otro cupón;
- no puede trasladar futuras comisiones a otro socio;
- si cancela y posteriormente regresa, conserva al afiliado original;
- al reactivarse, continúa el contador de mensualidades comisionadas donde se quedó.

La regla de “gana el último” solo aplica antes de la contratación: gana el afiliado cuyo cupón se utiliza finalmente al contratar.

## 1.3 Descuento permanente

El precio público previsto del SaaS es de $5,000 MXN mensuales, sin IVA.

Cada socio puede tener un cupón que otorgue, por ejemplo, $1,000 MXN de descuento permanente.

El cliente referido pagaría:

- Precio público: $5,000 MXN
- Descuento permanente: $1,000 MXN
- Mensualidad neta: $4,000 MXN
- IVA: se agrega únicamente cuando corresponda

El descuento debe permanecer activo mientras el cliente conserve o reactive su cuenta, incluso después de que hayan terminado las comisiones del afiliado.

No debe haber “letras chiquitas” que cancelen el descuento cuando termine el periodo de comisión.

## 1.4 Base comisionable estricta

La comisión se calcula exclusivamente sobre el importe sin IVA efectivamente cobrado por la mensualidad recurrente del SaaS Llantera Digital.

Excluir de forma tajante cualquier otro ingreso:

- implementación;
- configuración;
- alta inicial;
- migración o captura de inventario;
- etiquetas QR;
- impresoras;
- equipo;
- capacitación adicional;
- consultoría;
- publicidad;
- soporte extraordinario;
- integraciones;
- personalizaciones;
- cargos por mora;
- servicios adicionales;
- cualquier producto o concepto distinto de la mensualidad recurrente del SaaS.

Aunque varios conceptos se cobren dentro de la misma transferencia, solo la parte identificada como mensualidad del SaaS es comisionable.

## 1.5 Montos sin IVA

Todo el portal de afiliados debe mostrar montos sin IVA.

El IVA:

- no forma parte de la base comisionable;
- no forma parte de la comisión;
- no necesita mostrarse en el dashboard del afiliado.

## 1.6 Pago completo antes de generar comisión

Una comisión solo se genera cuando la mensualidad correspondiente quede pagada por completo.

Si el cliente hace pagos parciales:

- registrar cada abono;
- acumularlos contra una mensualidad específica;
- no generar comisión mientras el total pagado sea menor que el importe total de esa mensualidad;
- generar una sola comisión al completar el pago;
- contar esa mensualidad una sola vez.

## 1.7 Nunca borrar movimientos financieros

Una mensualidad, pago o comisión nunca debe eliminarse físicamente desde la interfaz normal.

Si un pago se devuelve, cancela o anula:

- marcar el pago como anulado o devuelto;
- marcar la comisión relacionada como anulada;
- conservar ambos registros en el historial;
- registrar fecha, usuario y motivo;
- ajustar los totales del dashboard sin borrar la evidencia histórica.

---

# 2. Alcance de la primera versión

Construir dos áreas:

1. Panel administrativo
2. Panel del afiliado

Usar:

- el proyecto Supabase existente;
- Usar sistema simple de acceso con Usuario y Contraseña exclusivo para el panel del afiliado.
- el stack actual del SaaS siempre que sea razonable;
- el subdominio `afiliados.llantera.digital`.
- Trabajar en un repositorio nuevo en Github.
- Tener una versión de producción y otra de Staging. En ésta se irá trabajando hasta aceptar los cambios a publicar en producción.

Antes de modificar la base de datos, inspeccionar:

- esquema actual;
- tabla existente de clientes;
- llaves primarias;
- nombres de columnas;
- relaciones;
- autenticación existente;
- convenciones del proyecto;
- componentes de interfaz ya disponibles.

No duplicar la tabla de clientes si ya existe una adecuada.

Crear migraciones SQL reversibles y documentadas.

---

# 3. Información visible para el afiliado

El afiliado no debe ver prospectos, interesados, asistentes, negociaciones ni estados comerciales.

No mostrar:

- teléfonos;
- correos;
- nombre del contacto;
- conversaciones;
- notas internas;
- motivos de rechazo;
- tareas de seguimiento;
- cotizaciones;
- otros productos o servicios contratados;
- comprobantes bancarios;
- referencias bancarias completas;
- datos fiscales;
- rentabilidad interna;
- información de otros afiliados.

El afiliado solo puede ver clientes que ya contrataron utilizando su cupón y que están relacionados con su cuenta.

## 3.1 Dashboard

Mostrar tarjetas con:

- Comisiones pendientes
- Comisiones disponibles
- Total pagado
- Clientes comisionables activos

Opcionalmente:

- Comisiones generadas durante el mes actual
- Próxima fecha estimada de pago

## 3.2 Mis clientes

Por cada cliente referido mostrar únicamente:

- nombre de la llantera;
- ciudad;
- estado general de la cuenta: activa, suspendida o cancelada;
- número de mensualidades efectivamente cobradas;
- esquema actual de comisión;
- siguiente etapa de comisión, si existe;
- fecha de la última mensualidad pagada.

No mostrar información de contacto.

## 3.3 Comisiones

Por cada comisión mostrar:

- nombre de la llantera;
- ciudad;
- fecha en que se completó el pago de la mensualidad;
- método de pago;
- número de mensualidad comisionada;
- base comisionable sin IVA;
- porcentaje aplicado;
- importe de comisión;
- estado;
- fecha de liberación;
- fecha de pago al afiliado, cuando exista.

Estados:

- `pendiente`
- `disponible`
- `pagada`
- `anulada`

## 3.4 Mi cupón

Mostrar:

- código del cupón;
- descuento permanente que recibe su público;
- porcentaje o esquema predeterminado para clientes nuevos;
- explicación resumida de la mecánica;
- estado activo o inactivo.

No implementar enlaces de afiliado.

## 3.5 Sin descarga de estados de cuenta

En la primera versión basta con consultar la información en pantalla.

No generar PDF, Excel o CSV para el afiliado.

---

# 4. Notificaciones

La única notificación obligatoria para el afiliado en la primera versión ocurre cuando se genera una comisión.

Ejemplo:

“Nueva comisión generada.
Llantera: Llantas del Norte
Ciudad: Monterrey
Comisión: $2,000.00
Estado: Pendiente
Mensualidad: 1”

No enviar notificaciones por:

- registro de prospectos;
- visitas;
- clics;
- asistencia a talleres;
- negociaciones;
- cotizaciones;
- rechazos;
- seguimiento.

El canal puede ser correo electrónico inicialmente. Si el proyecto ya tiene una infraestructura de notificaciones reutilizable, aprovecharla.

---

# 5. Reglas de comisiones

## 5.1 Esquema por etapas

No programar rígidamente “50% durante 12 meses”.

Cada relación cliente-afiliado debe permitir un esquema editable por etapas.

Ejemplos:

### Ejemplo A

- Mensualidades 1 a 12: 50%
- Mensualidades 13 a 24: 10%
- Después de la 24: 0%

### Ejemplo B

- Mensualidades 1 a 18: 40%
- Después: 0%

### Ejemplo C

- Mensualidades 1 a 12: 35%
- Mensualidad 13 en adelante: 15% indefinido

Cada etapa debe permitir:

- número inicial de mensualidad;
- número final de mensualidad;
- porcentaje;
- etapa indefinida opcional;
- estado activo;
- fecha de creación;
- nota administrativa opcional.

Validaciones:

- no permitir etapas traslapadas;
- no permitir porcentajes negativos;
- no permitir porcentajes mayores a 100%;
- no permitir rangos inválidos;
- solo una etapa puede ser indefinida;
- la etapa indefinida debe ser la última.

## 5.2 Plantilla predeterminada del afiliado

Cada afiliado debe tener un esquema predeterminado para clientes nuevos.

Al contratar un cliente con su cupón:

- copiar el esquema predeterminado;
- guardarlo como esquema propio de la relación cliente-afiliado;
- no depender dinámicamente del esquema actual del afiliado para comisiones históricas.

Esto permite que los primeros clientes tengan un porcentaje y los posteriores otro.

## 5.3 Modificación de porcentajes

El administrador debe poder:

1. Cambiar el esquema predeterminado solo para clientes futuros.
2. Cambiar el esquema de un cliente específico.
3. Aplicar un nuevo esquema a todos los clientes comisionables activos de un afiliado.

Cuando se cambie el esquema de clientes activos:

- aplicar el cambio solo a comisiones futuras;
- no recalcular automáticamente comisiones ya generadas;
- no modificar comisiones disponibles, pagadas o anuladas;
- registrar una bitácora con valores anteriores y nuevos;
- pedir confirmación explícita en la interfaz.

## 5.4 Reactivaciones

Si un cliente cancela después de 7 mensualidades y regresa meses después:

- conserva afiliado;
- conserva descuento;
- no reinicia contador;
- la siguiente mensualidad será la número 8;
- aplicar la etapa correspondiente a la mensualidad 8.

## 5.5 Periodo de seguridad

Cuando se complete una mensualidad:

- crear la comisión;
- estado inicial: `pendiente`;
- fecha de liberación: 15 días después.

Al llegar la fecha de liberación:

- cambiar automáticamente a `disponible`, salvo que el pago o la comisión hayan sido anulados.

Puede implementarse con:

- cron job;
- tarea programada;
- Supabase Edge Function programada;
- proceso administrativo idempotente.

## 5.6 Corte y pago

Regla operativa:

- corte al último día de cada mes;
- pago de comisiones disponibles entre los días 5 y 10 del mes siguiente;
- sin monto mínimo en la primera versión.

El pago al afiliado puede registrarse manualmente desde el panel administrativo.

Al marcar comisiones como pagadas:

- permitir seleccionar varias comisiones disponibles;
- registrar fecha de pago;
- método;
- referencia opcional interna;
- usuario administrador;
- mantener trazabilidad.

---

# 6. Métodos de pago del cliente

El sistema debe aceptar el registro manual de pagos por:

- transferencia;
- tarjeta;
- depósito;
- efectivo;
- otro.

El método de pago es visible para el afiliado, pero no la referencia bancaria ni el comprobante.

Cada pago debe registrar:

- cliente;
- mensualidad o periodo al que se aplica;
- fecha;
- importe;
- importe sin IVA;
- concepto;
- método;
- estado;
- usuario que lo registró;
- fecha de creación.

Si existen pagos parciales, relacionarlos con la mensualidad correspondiente.

---

# 7. Modelo de datos sugerido

Adaptar los nombres al esquema actual. No crear estructuras redundantes.

## 7.1 `affiliates`

Campos sugeridos:

- `id uuid primary key`
- `auth_user_id uuid unique`
- `name text not null`
- `email text`
- `phone text`
- `status text`
- `affiliate_type text`
- `default_discount_amount numeric`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

Estados sugeridos:

- `active`
- `inactive`
- `suspended`

## 7.2 `affiliate_coupons`

- `id uuid primary key`
- `affiliate_id uuid references affiliates`
- `code text unique not null`
- `discount_amount numeric not null`
- `is_permanent boolean default true`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

El cupón identifica al afiliado y define el descuento inicial.

## 7.3 `affiliate_default_commission_tiers`

Plantilla para clientes nuevos.

- `id uuid primary key`
- `affiliate_id uuid references affiliates`
- `start_payment_number integer not null`
- `end_payment_number integer null`
- `commission_rate numeric not null`
- `is_indefinite boolean default false`
- `is_active boolean default true`
- `created_at timestamptz`

## 7.4 `client_affiliations`

Relación permanente entre cliente y afiliado.

- `id uuid primary key`
- `client_id uuid references existing_clients_table`
- `affiliate_id uuid references affiliates`
- `coupon_id uuid references affiliate_coupons`
- `coupon_code_snapshot text`
- `discount_amount_snapshot numeric`
- `affiliated_at timestamptz`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

Restricción:

- un cliente solo puede tener una afiliación original activa;
- no permitir cambiar afiliado desde la interfaz normal.

## 7.5 `client_commission_tiers`

Esquema copiado y editable por cliente.

- `id uuid primary key`
- `client_affiliation_id uuid references client_affiliations`
- `start_payment_number integer not null`
- `end_payment_number integer null`
- `commission_rate numeric not null`
- `is_indefinite boolean default false`
- `is_active boolean default true`
- `created_at timestamptz`
- `updated_at timestamptz`

## 7.6 `saas_billing_periods`

Representa cada mensualidad esperada.

- `id uuid primary key`
- `client_id uuid references existing_clients_table`
- `period_start date`
- `period_end date`
- `payment_number integer`
- `monthly_fee numeric`
- `discount_amount numeric`
- `commissionable_amount numeric`
- `amount_paid numeric default 0`
- `status text`
- `completed_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Estados:

- `pending`
- `partially_paid`
- `paid`
- `cancelled`
- `refunded`

## 7.7 `client_payments`

- `id uuid primary key`
- `client_id uuid references existing_clients_table`
- `billing_period_id uuid references saas_billing_periods`
- `payment_date date`
- `amount numeric`
- `amount_without_tax numeric`
- `concept text`
- `payment_method text`
- `status text`
- `internal_reference text null`
- `created_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Estados:

- `confirmed`
- `pending`
- `cancelled`
- `refunded`

## 7.8 `affiliate_commissions`

- `id uuid primary key`
- `affiliate_id uuid references affiliates`
- `client_id uuid references existing_clients_table`
- `client_affiliation_id uuid references client_affiliations`
- `billing_period_id uuid references saas_billing_periods`
- `payment_number integer`
- `commissionable_amount numeric`
- `commission_rate numeric`
- `commission_amount numeric`
- `status text`
- `generated_at timestamptz`
- `release_at timestamptz`
- `paid_at timestamptz null`
- `annulled_at timestamptz null`
- `annulment_reason text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Restricción única:

- una sola comisión por afiliado y periodo de facturación.

## 7.9 `affiliate_payouts`

- `id uuid primary key`
- `affiliate_id uuid references affiliates`
- `payout_date date`
- `amount numeric`
- `payment_method text`
- `internal_reference text null`
- `created_by uuid`
- `created_at timestamptz`

Crear tabla puente si un pago agrupa varias comisiones:

`affiliate_payout_items`

- `payout_id`
- `commission_id`

## 7.10 `affiliate_audit_log`

- `id uuid primary key`
- `actor_user_id uuid`
- `action text`
- `entity_type text`
- `entity_id uuid`
- `old_values jsonb`
- `new_values jsonb`
- `reason text null`
- `created_at timestamptz`

Registrar como mínimo:

- creación de afiliado;
- creación o desactivación de cupón;
- afiliación de cliente;
- cambio de esquema;
- registro de pago;
- anulación de pago;
- generación de comisión;
- liberación;
- pago;
- anulación.

---

# 8. Lógica automática

## 8.1 Al contratar con cupón

Implementar una función transaccional que:

1. Valide el cupón.
2. Confirme que está activo.
3. Obtenga al afiliado.
4. Confirme que el cliente no tenga afiliación previa.
5. Cree `client_affiliations`.
6. Guarde snapshot del cupón y descuento.
7. Copie las etapas predeterminadas a `client_commission_tiers`.
8. Asigne el descuento permanente al cliente.
9. Registre auditoría.

No generar comisión todavía si la mensualidad no está pagada completamente.

## 8.2 Al registrar un pago

1. Validar que el pago esté asociado a un periodo.
2. Sumar abonos confirmados.
3. Actualizar `amount_paid`.
4. Si no completa la mensualidad, marcar `partially_paid`.
5. Si completa la mensualidad:
   - marcar `paid`;
   - fijar `completed_at`;
   - determinar `payment_number`;
   - obtener la etapa aplicable;
   - calcular comisión;
   - crear una sola comisión;
   - fijar `release_at = generated_at + 15 días`;
   - enviar notificación al afiliado;
   - registrar auditoría.

Debe ser idempotente: repetir la operación no debe duplicar comisiones.

## 8.3 Al anular o devolver

1. Cambiar estado del pago.
2. Recalcular total pagado del periodo.
3. Si el periodo deja de estar completamente pagado:
   - actualizar estado;
   - marcar comisión como anulada;
   - guardar motivo;
   - no eliminar.
4. Registrar auditoría.

## 8.4 Liberación automática

Proceso periódico:

- buscar comisiones `pendiente`;
- verificar que `release_at <= now()`;
- verificar que el pago siga válido;
- cambiar a `disponible`;
- registrar auditoría.

---

# 9. Seguridad y RLS

Aplicar Row Level Security a todas las tablas.

## Afiliado

Puede leer únicamente:

- su registro;
- sus cupones;
- clientes afiliados a él, con columnas limitadas;
- sus comisiones;
- sus pagos de comisión.

No puede:

- insertar pagos;
- modificar clientes;
- editar comisiones;
- cambiar porcentajes;
- ver otros afiliados;
- ver teléfonos, correos o notas internas;
- ver referencias bancarias;
- cambiar afiliaciones.

## Administrador

Puede gestionar todo mediante un rol seguro.

No confiar únicamente en ocultar botones del frontend.

Crear vistas seguras específicas para el portal del afiliado, por ejemplo:

- `affiliate_dashboard_summary`
- `affiliate_visible_clients`
- `affiliate_visible_commissions`
- `affiliate_visible_coupon`

Estas vistas deben exponer solo las columnas permitidas.

---

# 10. Interfaz del panel administrativo

Pantallas mínimas:

## 10.1 Afiliados

- listado;
- alta;
- edición;
- activación/suspensión;
- cupón;
- descuento;
- esquema predeterminado;
- notas internas.

## 10.2 Clientes afiliados

- cliente;
- afiliado;
- cupón;
- descuento;
- esquema;
- mensualidades cobradas;
- estado;
- historial.

## 10.3 Registrar pago

- cliente;
- periodo;
- importe;
- concepto;
- método;
- fecha;
- referencia interna opcional.

Mostrar claramente si el pago:

- no completa mensualidad;
- completa mensualidad;
- generará comisión;
- no es comisionable por concepto.

## 10.4 Comisiones

Filtros:

- afiliado;
- cliente;
- estado;
- periodo;
- fecha.

Acciones:

- ver detalle;
- anular con motivo;
- marcar disponible manualmente solo con permiso especial;
- incluir en pago al afiliado.

## 10.5 Pagos a afiliados

- seleccionar comisiones disponibles;
- mostrar total;
- registrar pago;
- actualizar estados;
- generar bitácora.

## 10.6 Auditoría

Vista de solo lectura con:

- fecha;
- usuario;
- acción;
- entidad;
- valores anteriores;
- valores nuevos;
- motivo.

---

# 11. Interfaz del afiliado

Diseño:

- moderno;
- limpio;
- confiable;
- optimizado para móvil;
- sin exceso de tablas o tecnicismos;
- consistente con la identidad de Llantera Digital;
- montos en MXN;
- fechas en formato mexicano;
- estados con etiquetas claras.

Pantallas:

1. Iniciar sesión
2. Dashboard
3. Mis clientes
4. Comisiones
5. Mi cupón
6. Cerrar sesión

No incluir:

- prospectos;
- leads;
- clics;
- conversiones;
- materiales de marketing en esta primera versión;
- solicitudes de retiro;
- chat;
- soporte interno;
- rankings;
- gamificación.

---

# 12. Criterios de aceptación

La implementación se considera correcta si se pueden probar estos casos:

## Caso 1: contratación con cupón

- Crear afiliado.
- Crear cupón.
- Definir descuento.
- Definir etapas 1–12 al 50% y 13–24 al 10%.
- Contratar cliente con cupón.
- Confirmar afiliación permanente.
- Confirmar descuento permanente.
- Confirmar copia del esquema.

## Caso 2: pago completo

- Registrar mensualidad de $4,000.
- Registrar pago completo.
- Generar comisión al 50%.
- Comisión = $2,000.
- Estado = pendiente.
- Liberación = 15 días después.

## Caso 3: pago parcial

- Registrar abono de $2,000.
- No generar comisión.
- Registrar segundo abono de $2,000.
- Generar una sola comisión.
- Contar una sola mensualidad.

## Caso 4: pago no comisionable

- Registrar $4,000 de mensualidad.
- Registrar $1,500 de capacitación.
- Comisión solo sobre $4,000.
- No generar comisión por capacitación.

## Caso 5: anulación

- Anular pago completo.
- Comisión pasa a anulada.
- No se borra.
- Totales se ajustan.
- Auditoría conserva motivo.

## Caso 6: reactivación

- Cliente paga 7 mensualidades.
- Se cancela.
- Se reactiva meses después.
- Conserva descuento y afiliado.
- El siguiente pago es mensualidad 8.
- No reinicia contador.

## Caso 7: cambio de esquema

- Afiliado pasa de 35% a 50%.
- Elegir “solo futuros”.
- Clientes antiguos conservan esquema.
- Nuevos clientes reciben 50%.
- Probar “aplicar a activos”.
- Solo comisiones futuras cambian.
- Históricas permanecen intactas.

## Caso 8: privacidad

- Un afiliado no puede ver datos de otro.
- No puede consultar contactos.
- No puede modificar pagos.
- No puede cambiar comisiones.
- No puede acceder directamente por URL o API a registros ajenos.

---

# 13. Exclusiones explícitas

No construir en esta fase:

- multinivel;
- subafiliados;
- cookies;
- tracking de clics;
- enlaces referidos;
- atribución de prospectos;
- CRM;
- pipeline;
- formularios de prospectos;
- pagos automáticos;
- retiros automáticos;
- integración bancaria;
- PayPal/Stripe Connect;
- facturación automática;
- rankings;
- concursos;
- gamificación;
- banners;
- biblioteca de materiales;
- chat;
- notificaciones de leads;
- exportación PDF/Excel/CSV para afiliados;
- app móvil nativa.

---

# 14. Entregables esperados de Codex

Antes de programar, entregar:

1. Resumen del esquema actual encontrado.
2. Plan de integración sin duplicar tablas.
3. Lista de migraciones.
4. Riesgos detectados.
5. Preguntas únicamente si existe una ambigüedad crítica.

Después implementar:

1. Migraciones SQL.
2. Políticas RLS.
3. Funciones o procedimientos.
4. Panel administrativo.
5. Panel del afiliado.
6. Notificación de comisión generada.
7. Pruebas de los casos de aceptación.
8. Documentación de despliegue.
9. Variables de entorno necesarias.
10. Instrucciones para conectar `afiliados.llantera.digital`.

No reemplazar ni romper funciones existentes del SaaS.

Trabajar en una rama separada.

Realizar cambios incrementales y verificables.

No asumir nombres de tablas o columnas existentes: inspeccionarlos primero.

No exponer claves de servicio en el frontend.

Usar operaciones transaccionales para contratación, pagos, comisiones y anulaciones.

Priorizar claridad, seguridad y trazabilidad sobre automatización excesiva.
