# Arquitectura Técnica

## Vista general

- Frontend: App Router con páginas server/client.
- Backend: Route Handlers (`app/api/**`).
- Persistencia: Prisma sobre PostgreSQL.
- AuthN/AuthZ:
  - NextAuth credentials
  - middleware para protección de rutas
  - helpers RBAC en `lib/authz.ts`

## Flujo de compras

1. Usuario staff captura datos y texto de factura.
2. Se parsea por formato (`lib/parse/invoiceParser.ts`).
3. API crea:
   - `Purchase`
   - `PurchaseLine`
   - `Lot`
   - `CapitalMovement` tipo `COMPRA`
4. Se registra auditoría (`AuditLog`).

## Flujo de cancelación de compra

1. API valida rol staff.
2. Verifica que compra exista y esté activa.
3. Verifica que sus lotes no tengan ventas.
4. Marca:
   - `Purchase.status = CANCELLED`
   - `Lot.status = CANCELLED`
5. Crea `CapitalMovement` tipo `REVERSA_COMPRA`.
6. Registra evento en `AuditLog`.

## Flujo de ventas

1. Valida stock por lote activo.
2. Calcula comisión (0%, 2%, 5.58%).
3. Crea `Sale` + `SaleLine`.
4. Crea `ProfitSplit` (hoy 50/50).
5. Crea `CapitalMovement` tipo `VENTA_COSTO`.
6. Registra auditoría.

## Cálculos financieros

- Capital actual = capital inicial + suma movimientos capital.
- Inventario = suma costo de lotes activos no vendidos.
- Utilidad acumulada = suma `ProfitSplit` por owner.
- Utilidad disponible a transferir = utilidad acumulada - transferido.

## Archivos clave

- `app/api/purchases/route.ts`
- `app/api/purchases/[id]/cancel/route.ts`
- `app/api/sales/route.ts`
- `app/dashboard/page.tsx`
- `app/inventario/page.tsx`
- `lib/capital.ts`
- `lib/audit.ts`
- `lib/authz.ts`
- `prisma/schema.prisma`
