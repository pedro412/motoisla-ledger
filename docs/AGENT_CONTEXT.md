# Contexto Rápido del Proyecto

## Objetivo

Sistema de control financiero para tienda con trazabilidad por inversionista:

- compras y lotes
- ventas y utilidad
- capital y movimientos
- auditoría y roles

## Stack

- Next.js 14 (App Router + Route Handlers)
- PostgreSQL + Prisma
- NextAuth (credentials)
- Tailwind CSS
- Vitest

## Estado funcional (actual)

- Compra con parser por formato (`LS2`, `EDGE`, `JOE_ROCKET`) + preview previa a importar.
- Cancelación de compra auditable:
  - bloquea cancelación si ya hubo ventas de sus lotes
  - marca compra/lotes como `CANCELLED`
  - crea reversa de capital (`REVERSA_COMPRA`)
- Venta con validación de stock y comisiones terminal.
- Nueva venta con selector de lote enriquecido (`lotId | SKU | descripción | disponibilidad | owner`) para facilitar captura.
- **Gastos operativos configurables**: tasa fija (`opex_rate`) aplicada sobre ventas brutas; `opexDeduction` guardado por `ProfitSplit`; utilidad neta = `profitShareGross − opexDeduction`.
- Transferencia de utilidad a capital.
- Dashboard por inversionista con desglose opex y tooltip de cálculo exacto por venta.
- Movimientos de capital (`VENTA_COSTO`) con ícono + tooltip de productos vendidos (SKU + descripción), sin columna extra.
- Configuración del sistema (`/settings`): admin puede modificar `opex_rate`; cambios auditados.
- Inventario por factura/lote (oculta canceladas por defecto, con toggle).
- Historial de ventas (`/sales`) con resumen de productos por venta y tooltip de detalle (SKU + descripción).
- Auditoría (`/auditoria`) con `AuditLog`.
- Admin puede crear usuario de inversionista y resetear su contraseña desde `Inversionistas`.
- RBAC:
  - `ADMIN`
  - `OPERADOR`
  - `INVERSIONISTA` (scoped por `ownerId`)

## Rutas clave UI

- `/dashboard`
- `/inventario`
- `/purchases/new`
- `/sales/new`
- `/investors`
- `/auditoria`
- `/settings` (solo ADMIN)
- `/login`

## APIs clave

- `POST /api/purchases`
- `POST /api/purchases/:id/cancel`
- `POST /api/sales`
- `POST /api/capital/transfer-profit`
- `POST /api/capital/reconcile`
- `GET /api/lots`
- `GET /api/investors`
- `GET /api/settings` (solo ADMIN)
- `PATCH /api/settings` (solo ADMIN)

## Pendientes prioritarios

1. Cancelación de venta (auditable, con reversas consistentes).
2. Reparto configurable de utilidad por inversionista (hoy es 50/50).
3. Auditoría avanzada (filtros/exportación/búsqueda).
