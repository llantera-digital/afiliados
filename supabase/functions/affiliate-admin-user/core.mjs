// Núcleo del alta de usuarios del portal de afiliados.
// Sin dependencias de Deno ni de Supabase: recibe las operaciones como `deps`,
// de modo que se puede probar con dobles.
//
// Cambios respecto al comportamiento anterior:
//  - todo el cuerpo se valida antes de la primera escritura;
//  - cualquier fallo compensa lo ya creado, en orden inverso;
//  - el resultado incluye qué se compensó, para auditoría.

export function emailInterno(username) {
  return `${String(username).trim().toLocaleLowerCase('es-MX').replace(/[^a-z0-9._-]/g, '')}@afiliados.llantera.digital`;
}

// Lectura del cuerpo con respuesta controlada: JSON malformado, vacío o que no
// sea un objeto se rechazan antes de tocar la base o Auth.
export function parsearCuerpo(texto) {
  const crudo = typeof texto === 'string' ? texto.trim() : '';
  if (!crudo) return { ok: false, error: 'Cuerpo vacío' };
  let body;
  try { body = JSON.parse(crudo); }
  catch { return { ok: false, error: 'JSON inválido' }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Cuerpo inválido' };
  }
  return { ok: true, body };
}

export function validarAlta(body) {
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  const role = body?.role === 'admin' ? 'admin' : 'affiliate';
  const affiliateId = role === 'affiliate' && body?.affiliate_id ? String(body.affiliate_id) : null;

  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) || password.length < 8) {
    return { ok: false, error: 'Datos de usuario inválidos' };
  }

  const datos = { username, password, role, affiliateId, name: '', email: '', discount: 0, coupon: null, tiers: null };
  if (role !== 'affiliate' || affiliateId) return { ok: true, datos };

  datos.name = String(body.name ?? '').trim();
  datos.email = String(body.email ?? '').trim();
  datos.discount = Number(body.discount_amount ?? 0);
  datos.coupon = String(body.coupon ?? '').trim();

  if (!datos.name) return { ok: false, error: 'Falta el nombre del afiliado' };
  if (!Number.isFinite(datos.discount) || datos.discount < 0) return { ok: false, error: 'Descuento inválido' };
  if (!datos.coupon) return { ok: false, error: 'Falta el cupón' };
  if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
    return { ok: false, error: 'Faltan las etapas de comisión' };
  }

  const tiers = [];
  for (const bruto of body.tiers) {
    const inicio = Number(bruto?.start);
    const fin = bruto?.end === null || bruto?.end === undefined ? null : Number(bruto.end);
    const tasa = Number(bruto?.rate);
    const indefinida = Boolean(bruto?.indefinite);
    if (!Number.isInteger(inicio) || inicio < 1) return { ok: false, error: 'Etapa con inicio inválido' };
    if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) return { ok: false, error: 'Etapa con tasa inválida' };
    if (!indefinida && (!Number.isInteger(fin) || fin < inicio)) return { ok: false, error: 'Etapa con fin inválido' };
    tiers.push({
      start_payment_number: inicio,
      end_payment_number: indefinida ? null : fin,
      commission_rate: tasa,
      is_indefinite: indefinida
    });
  }

  const rangos = tiers
    .map(t => ({ inicio: t.start_payment_number, fin: t.is_indefinite ? Number.POSITIVE_INFINITY : t.end_payment_number }))
    .sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < rangos.length; i++) {
    if (rangos[i].inicio <= rangos[i - 1].fin) return { ok: false, error: 'Etapas traslapadas' };
  }

  datos.tiers = tiers;
  return { ok: true, datos };
}

export async function ejecutarAlta(deps, datos) {
  const creado = { usuario: null, afiliado: null, perfil: false, cupon: false, etapas: false };
  try {
    creado.usuario = await deps.crearUsuario({
      email: emailInterno(datos.username),
      password: datos.password,
      role: datos.role
    });

    let affiliateId = datos.affiliateId;
    if (datos.role === 'affiliate' && !affiliateId) {
      creado.afiliado = await deps.crearAfiliado({
        name: datos.name,
        email: datos.email,
        default_discount_amount: datos.discount
      });
      affiliateId = creado.afiliado.id;
    }

    await deps.crearPerfil({
      auth_user_id: creado.usuario.id,
      username: datos.username,
      role: datos.role,
      affiliate_id: affiliateId
    });
    creado.perfil = true;

    if (datos.role === 'affiliate' && !datos.affiliateId) {
      await deps.crearCupon({
        affiliate_id: affiliateId,
        code: datos.coupon,
        discount_amount: datos.discount
      });
      creado.cupon = true;

      await deps.crearEtapas(datos.tiers.map(t => ({ affiliate_id: affiliateId, ...t })));
      creado.etapas = true;
    }

    return { status: 201, body: { id: creado.usuario.id, username: datos.username, role: datos.role }, compensacion: null };
  } catch (error) {
    const compensacion = await compensar(deps, creado);
    if (compensacion.fallidos.length) {
      deps.registrar?.('COMPENSATION_PARTIAL', {
        error: String(error?.message ?? error),
        pasos: compensacion.pasos,
        fallidos: compensacion.fallidos
      });
      return {
        status: 400,
        body: {
          error: String(error?.message ?? 'No se pudo completar el alta'),
          compensacion_incompleta: true,
          compensacion: compensacion.pasos
        },
        compensacion: compensacion.pasos
      };
    }
    return {
      status: 400,
      body: { error: String(error?.message ?? 'No se pudo completar el alta') },
      compensacion: compensacion.pasos
    };
  }
}

async function compensar(deps, creado) {
  const pasos = [];
  const fallidos = [];
  const intentar = async (nombre, accion) => {
    try { await accion(); pasos.push(nombre); }
    catch (error) {
      const detalle = String(error?.message ?? error);
      pasos.push(`${nombre}:fallo:${detalle}`);
      fallidos.push({ paso: nombre, error: detalle });
    }
  };

  if (creado.afiliado) {
    if (creado.etapas) await intentar('etapas', () => deps.borrarEtapasDeAfiliado(creado.afiliado.id));
    if (creado.cupon) await intentar('cupon', () => deps.borrarCuponesDeAfiliado(creado.afiliado.id));
  }
  if (creado.perfil) await intentar('perfil', () => deps.borrarPerfil(creado.usuario.id));
  if (creado.afiliado) await intentar('afiliado', () => deps.borrarAfiliado(creado.afiliado.id));
  if (creado.usuario) await intentar('usuario', () => deps.borrarUsuario(creado.usuario.id));

  return { pasos, fallidos };
}
