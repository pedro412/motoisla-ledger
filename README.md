# MotoIsla Ledger (Next.js + PostgreSQL + Prisma)

Sistema de control financiero para compras, lotes, ventas, utilidad y capital por inversionista.

## Stack actual

- Next.js 14 (App Router + Route Handlers)
- PostgreSQL
- Prisma ORM
- Zod para validación
- Vitest para pruebas unitarias e integración de dominio

## Configuración rápida

1. Crea `.env.local` desde `.env.example`.
2. Define al menos:

```bash
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=pon_un_secret_largo
```

3. Sincroniza schema en DB:

```bash
npx prisma db push
npm run prisma:generate
```

4. Seed inicial (owner inversionista, owner motoisla, admin):

```bash
npm run prisma:seed
```

5. Levanta app:

```bash
npm run dev
```

## Scripts

- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`
- `npm run prisma:seed`
- `npm run test:run`
- `npm run typecheck`

## Endpoints principales

### Salud

- `GET /api/health/db`
  - healthcheck PostgreSQL.

### Inversionistas

- `GET /api/investors`
- `POST /api/investors`
- `PATCH /api/investors/:id/capital`

### Compras

- `POST /api/purchases`
  - valida capital del inversionista
  - parsea factura
  - crea compra, líneas, lotes y movimiento de capital `COMPRA`.

### Ventas

- `POST /api/sales`
  - valida stock por lote
  - calcula comisión terminal (0%, 2%, 5.58%)
  - crea venta, líneas y reparto utilidad
  - registra `VENTA_COSTO` en capital.

- `POST /api/sales/recalculate`
  - recálculo de utilidad/comisiones históricas sobre DB.

- `GET /api/lots?ownerId=<id>`
  - lotes con stock disponible, opcionalmente filtrados por inversionista.

### Capital

- `POST /api/capital/transfer-profit`
  - transfiere utilidad acumulada a capital (total o parcial).

- `POST /api/capital/reconcile`
  - reconstruye movimientos de capital desde ledger.

## UI

- `/dashboard` (filtro por inversionista con `?ownerId=`).
- `/investors` (alta/ajuste de inversionistas).
- `/purchases/new`
- `/sales/new`
- `/inventario`

## Pruebas

- Unitarias: `tests/unit/ledgerMath.test.ts`
- Integración de flujo financiero: `tests/integration/ledgerFlow.test.ts`

Ejecutar:

```bash
npm run test:run
```

## Nota sobre Google Sheets

Los endpoints `/api/sheets` y `/api/sheets/init` quedaron como **deprecados** y ya no son el backend operativo.
