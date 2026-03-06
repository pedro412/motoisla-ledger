# Bitácora de Sesiones

## 2026-03-06

### Hecho

- Se mejoró captura en `Nueva venta`:
  - `Lot ID` cambió de input libre a selector (`select`) con etiqueta completa:
    - `lotId | SKU | descripción corta | disponible | owner`
  - Al seleccionar lote se conserva autocompletado de SKU y se muestra descripción del producto en el resumen de línea.
  - Si cambia el filtro y un lote seleccionado ya no existe en opciones, la línea se limpia para evitar selección inválida.
- Se enriqueció `Historial de ventas` (`/sales`):
  - nueva columna de productos con resumen compacto por venta (`SKU - nombre +N`).
  - tooltip con listado completo de productos vendidos (SKU + descripción).
- Se ajustó `Dashboard` en tabla de movimientos de capital:
  - para `VENTA_COSTO`, se muestra ícono junto al monto con tooltip de productos (SKU + descripción).
  - no se agregó columna extra de productos (se mantiene ancho de tabla).
  - el mapeo de productos se resuelve por `saleId + ownerId` para soportar ventas multi-owner.
- Validación ejecutada:
  - `npm run typecheck`
  - `npm run test:run -- tests/integration/operationalFlow.test.ts tests/integration/saleDelete.test.ts`

### Riesgos/Notas

- El tooltip de productos depende de relaciones `SaleLine -> Lot`; si una venta antigua no trae líneas relacionadas, no mostrará detalle.
- No hubo cambios de schema/migraciones; el detalle se calcula en lectura.

### Próximos pasos

1. Agregar prueba de UI/SSR para asegurar render estable de columna `Productos` en `/sales`.
2. Evaluar truncado/scroll en tooltip para ventas con muchos productos.

## 2026-03-03

### Hecho

- Se corrigió el modal de transferencia de utilidad en dashboard:
  - advertencia inmediata al capturar un monto parcial inválido
  - bloqueo del botón de confirmación cuando el monto es `<= 0` o excede lo disponible
  - el frontend ahora envía el monto explícito incluso en "transferir todo"
- Se evitó el comportamiento visual "encapsulado" del modal dentro de la tarjeta de capital:
  - se anuló el `transform` en hover para `.kpi-capital`, evitando que el overlay fixed quede contenido por esa tarjeta
- Se actualizó `README.md` con la nota de validación en tiempo real para transferencia parcial.

### Riesgos/Notas

- El flujo sigue permitiendo transferir toda la utilidad disponible cuando el usuario elige explícitamente esa opción; este cambio sólo endurece validación y feedback en UI.

### Próximos pasos

1. Agregar reversa auditada de `UTILIDAD_A_CAPITAL` para corregir transferencias hechas por error desde la UI.
2. Cubrir este caso con pruebas del componente o integración del flujo de transferencia.

## 2026-02-23

### Hecho

- Se adoptó flujo profesional de cambios DB para producción:
  - desarrollo con `prisma migrate dev`
  - producción con `prisma migrate deploy` desde CI/CD
  - `db push` fuera del flujo de producción
- Se agregaron scripts npm de migración explícitos:
  - `prisma:migrate:dev`
  - `prisma:migrate:deploy`
  - `prisma:db:push:dev` (solo uso local controlado)
- Se creó workflow de release en GitHub Actions:
  - archivo `.github/workflows/release-prod.yml`
  - corre en `main`
  - valida secreto `DATABASE_URL_PROD`
  - ejecuta `prisma migrate deploy` antes de `build`
- Se actualizó `README.md` con:
  - runbook de producción con migraciones versionadas
  - política de no usar `export` manual en laptop para prod
  - pasos operativos de branch -> migración -> PR -> deploy automático
- Se agregó baseline de migraciones para producción existente:
  - carpeta `prisma/migrations/20260223134500_baseline`
  - `prisma/migrations/migration_lock.toml`
  - workflow manual `.github/workflows/baseline-prod.yml` para marcar baseline aplicado una sola vez.

### Próximos pasos

1. Configurar secreto `DATABASE_URL_PROD` en GitHub.
2. Verificar primer run de `release-prod.yml` en entorno de staging/prod.
3. Confirmar rollback operativo ante fallo de migración.

## 2026-02-22

### Hecho

- Migración completa a Postgres + Prisma (sin Google Sheets operativo).
- Auth + RBAC + aislamiento por inversionista.
- Dashboard e inventario mejorados en UI/UX.
- Auditoría funcional en API y vista `/auditoria`.
- Soporte de cancelación de compra con reversa de capital.
- Soporte de parser multi-formato de factura (`LS2` y `EDGE`).
- Preview de compra con líneas, artículos, subtotal y alertas de IVA/total.
- Cobertura de pruebas unitarias e integración reforzada.
- Feature nuevo: borrado de venta (`DELETE /api/sales/:id`) con confirmación `BORRAR`.
- Restauración automática de números al borrar venta:
  - stock (al eliminar `saleLine`)
  - capital (al eliminar `capitalMovement` tipo `VENTA_COSTO`)
  - utilidad acumulada (al eliminar `profitSplit`/`saleLine`)
- Bloqueo de borrado cuando la venta ya tiene utilidad transferida (`ProfitSplit.status = TRANSFERRED`).
- Nueva vista `/sales` para gestión y borrado de ventas.
- Pruebas agregadas: `tests/integration/saleDelete.test.ts`.
- Seed endurecido con `SEED_MODE`:
  - `dev`: owners + usuarios demo
  - `bootstrap`: owners base sin usuarios
  - `safe`: no-op
- Política nueva: en producción no se crean usuarios por seed; admin se crea manualmente.
- Nuevo endpoint/UI para admin: crear usuario de inversionista ligado a `ownerId` desde pantalla de inversionistas.
- Capital inicial ahora inmutable (endpoint de ajuste deprecado/bloqueado).
- Nuevo flujo admin para capital externo:
  - aporte de capital (`APORTE_CAPITAL`)
  - retiro de capital (`RETIRO_CAPITAL`) con validación de no exceder disponible
  - movimientos auditables y visibles en dashboard.

### Próximos pasos

1. Implementar cancelación de venta (auditable y consistente).
2. Reparto configurable de utilidad por inversionista.
3. Mejoras de auditoría (filtros/export/búsqueda).

### Riesgos/Notas

- `npm run build` sigue fallando por un problema existente de prerender/chunks en `.next` (no originado por este cambio).

## 2026-02-28

### Hecho

- Nuevo endpoint admin para resetear password de usuario inversionista: `POST /api/users/investor/reset-password`.
- Pantalla `Inversionistas` ahora muestra el `username` actual y permite resetear la contraseña con validación de confirmación.
- Fix en `/dashboard` para usuarios `INVERSIONISTA`:
  - al entrar sin `ownerId` en query, usa su `ownerId` de sesión
  - evita falso positivo de "No tienes acceso al inversionista solicitado."
- Pruebas agregadas: `tests/integration/investorUserResetPassword.test.ts`.

### Riesgos/Notas

- La contraseña actual nunca se expone; solo se reemplaza el `passwordHash`.
- El flujo asume un solo usuario `INVERSIONISTA` por `ownerId`; si existen duplicados, actualiza el más antiguo.

### Nota operativa

Al terminar cada nueva sesión, agregar una nueva entrada con:

- fecha
- cambios realizados
- riesgos/notas
- próximos pasos
