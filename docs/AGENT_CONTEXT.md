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

- Compra con parser por formato (`LS2`, `EDGE`) + preview previa a importar.
- Cancelación de compra auditable:
  - bloquea cancelación si ya hubo ventas de sus lotes
  - marca compra/lotes como `CANCELLED`
  - crea reversa de capital (`REVERSA_COMPRA`)
- Venta con validación de stock y comisiones terminal.
- Transferencia de utilidad a capital.
- Dashboard por inversionista.
- Inventario por factura/lote (oculta canceladas por defecto, con toggle).
- Auditoría (`/auditoria`) con `AuditLog`.
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
- `/login`

## APIs clave

- `POST /api/purchases`
- `POST /api/purchases/:id/cancel`
- `POST /api/sales`
- `POST /api/capital/transfer-profit`
- `POST /api/capital/reconcile`
- `GET /api/lots`
- `GET /api/investors`

## Pendientes prioritarios

1. Cancelación de venta (auditable, con reversas consistentes).
2. Reparto configurable de utilidad por inversionista (hoy es 50/50).
3. Auditoría avanzada (filtros/exportación/búsqueda).
