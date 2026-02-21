# MotoIsla Ledger (Next.js + PostgreSQL + Prisma)

Sistema financiero para tienda, con trazabilidad de compras, lotes, ventas, capital y utilidad por inversionista.

## Estado actual del proyecto

### Hecho

- Migración de backend a PostgreSQL + Prisma (Google Sheets deprecado).
- Flujo base operativo:
  - alta inversionistas y capital inicial
  - compra con validación de capital
  - creación de lotes por compra/factura
  - venta con validación de stock por lote
  - comisiones terminal (0%, 2%, 5.58%)
  - utilidad + capital + transferencia utilidad->capital
  - recálculo y reconciliación
- Multi-inversionista:
  - dashboard por inversionista
  - inventario por lotes/factura
- Auth con `next-auth` (credentials).
- RBAC inicial:
  - `ADMIN`, `OPERADOR`, `INVERSIONISTA`
  - aislamiento por `ownerId` para inversionistas
- Auditoría:
  - `AuditLog` con actor, acción, entidad y payload
  - vista `/auditoria`
- UI refresh:
  - nuevo shell (sidebar + topbar)
  - paleta y componentes base (Tailwind + utilidades UI)

### En progreso

- Consolidar pruebas de integración por rol y por flujo completo.

### Backlog (priorizado)

- Motor de reparto configurable por inversionista (actualmente está fijo 50/50 en venta y recalculate).
- Auditoría avanzada (filtros por rango, exportación, búsqueda full-text).
- Endurecer reglas de negocio opcionales (por ejemplo, no mezclar lotes de distintos inversionistas en una venta).

## Stack

- Next.js 14 (App Router + Route Handlers)
- PostgreSQL
- Prisma ORM
- NextAuth (credentials)
- Zod
- Tailwind CSS
- Vitest

## Configuración rápida

1. Crear `.env.local` desde `.env.example`.
2. Definir mínimo:

```bash
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=pon_un_secret_largo
```

3. Sincronizar schema y generar cliente:

```bash
npx prisma db push
npm run prisma:generate
```

4. Seed inicial (owners + usuarios por rol):

```bash
npm run prisma:seed
```

Esto crea por defecto:

- owner inversionista `inv_lic`
- owner `motoisla`
- usuario `admin` (rol `ADMIN`)
- usuario `operador` (rol `OPERADOR`)
- usuario `inversionista` (rol `INVERSIONISTA`, ligado a `inv_lic`)

5. Levantar app:

```bash
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test:run`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`
- `npm run prisma:seed`

## Rutas UI

- `/dashboard`
- `/inventario`
- `/investors`
- `/purchases/new`
- `/sales/new`
- `/auditoria`
- `/login`

## Endpoints principales

### Salud

- `GET /api/health/db`

### Auth

- `GET|POST /api/auth/[...nextauth]`

### Inversionistas

- `GET /api/investors`
- `POST /api/investors`
- `PATCH /api/investors/:id/capital`

### Compras / lotes / ventas

- `POST /api/purchases`
- `GET /api/lots?ownerId=<id>`
- `POST /api/sales`
- `POST /api/sales/recalculate`

### Capital

- `POST /api/capital/transfer-profit`
- `POST /api/capital/reconcile`

## Seguridad y permisos

- `ADMIN`
  - acceso total.
- `OPERADOR`
  - operación diaria (compras/ventas), sin acciones de admin sensibles.
- `INVERSIONISTA`
  - acceso restringido a su propio `ownerId`.
  - no puede operar compras/ventas de otros ni gestionar inversionistas.

## Nota sobre Google Sheets

Los endpoints `/api/sheets` y `/api/sheets/init` permanecen solo como deprecados/compatibilidad y ya no son backend operativo.
