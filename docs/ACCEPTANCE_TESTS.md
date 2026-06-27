# Matriz de aceptación

Ejecutar con datos identificados como prueba y conservar evidencia de auditoría.

1. Crear afiliado, cupón de $1,000 y etapas 1–12 al 50%, 13–24 al 10%.
2. Afiliar un cliente y comprobar snapshots y copia de etapas.
3. Crear mensualidad pública de $5,000; comprobar base neta de $4,000.
4. Pagar $4,000 y comprobar comisión única de $2,000, pendiente y liberación +15 días.
5. Repetir con dos abonos de $2,000; no debe existir comisión tras el primero.
6. Registrar capacitación como no comisionable; no debe modificar `amount_paid`.
7. Intentar un sobrepago; la función debe rechazarlo sin insertar movimientos.
8. Anular el pago completo; pago y comisión permanecen, ambos con estado/motivo adecuado.
9. Si la comisión ya estaba pagada, comprobar compensación para el siguiente payout.
10. Cancelar tras siete mensualidades, reactivar y crear la mensualidad ocho.
11. Cambiar etapas; comprobar que comisiones históricas conservan tasa e importe.
12. Iniciar como otro afiliado e intentar consultar URLs y API ajenas; debe devolver cero filas.
13. Verificar que vistas del afiliado no incluyen correo, teléfono, referencia ni notas.

