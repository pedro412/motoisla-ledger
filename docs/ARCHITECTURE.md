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
3. Lee `opexRate` desde `SystemSetting` (`lib/settings.ts → getOpexRate()`).
4. Crea `Sale` + `SaleLine`.
5. Crea `ProfitSplit` (50/50) con `opexRate` y `opexDeduction = grossRevenue × opexRate × 0.5`.
6. Crea `CapitalMovement` tipo `VENTA_COSTO`.
7. Registra auditoría.

## Cálculos financieros

- Capital actual = capital inicial + suma movimientos capital.
- Inventario = suma costo de lotes activos no vendidos.
- Utilidad acumulada neta = suma(`profitShareGross` − `opexDeduction`) por owner (`NULL` → `0`).
- Utilidad disponible a transferir = utilidad acumulada neta − transferido.

## Configuración del sistema (`/settings`)

- Modelo `SystemSetting`: pares `key/value` persistidos en DB.
- `lib/settings.ts`: helpers `getSetting`, `getOpexRate`, `setSetting`.
- `GET/PATCH /api/settings`: solo `ADMIN`; PATCH audita con entity `SETTING`.
- `INVERSIONISTA` bloqueado en middleware y `rbacRoutes`.

## Archivos clave

- `app/api/purchases/route.ts`
- `app/api/purchases/[id]/cancel/route.ts`
- `app/api/sales/route.ts`
- `app/api/settings/route.ts`
- `app/dashboard/page.tsx`
- `app/settings/page.tsx`
- `app/inventario/page.tsx`
- `lib/capital.ts`
- `lib/settings.ts`
- `lib/audit.ts`
- `lib/authz.ts`
- `lib/domain/ledgerMath.ts`
- `prisma/schema.prisma`
