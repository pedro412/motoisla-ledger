# Bitácora de Sesiones

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

### Nota operativa

Al terminar cada nueva sesión, agregar una nueva entrada con:

- fecha
- cambios realizados
- riesgos/notas
- próximos pasos
