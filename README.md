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

- Consolidar pruebas de integración por rol y por flujo completo (parcialmente cubierto).

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

## Pruebas automatizadas (estado)

- Unitarias:
  - `tests/unit/ledgerMath.test.ts`
  - `tests/unit/authz.test.ts`
  - `tests/unit/rbacRoutes.test.ts`
  - `tests/unit/ownerScope.test.ts`
  - `tests/unit/audit.test.ts`
- Integración:
  - `tests/integration/ledgerFlow.test.ts` (flujo financiero de dominio)
  - `tests/integration/apiAuthz.test.ts` (401/403 por endpoint)
  - `tests/integration/roleFlows.test.ts` (scoping por rol en endpoints)
  - `tests/integration/operationalFlow.test.ts` (compra/venta exitosas con auditoría y movimientos)

## Nota sobre Google Sheets

Los endpoints `/api/sheets` y `/api/sheets/init` permanecen solo como deprecados/compatibilidad y ya no son backend operativo.

## Runbook Railway (operación)

### Variables requeridas

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Opcionales de seed:

- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_OPERATOR_USERNAME`
- `SEED_OPERATOR_PASSWORD`
- `SEED_INVESTOR_USERNAME`
- `SEED_INVESTOR_PASSWORD`
- `SEED_INVESTOR_ID`
- `SEED_INVESTOR_NAME`
- `SEED_MOTOISLA_ID`

### Primer despliegue

1. Configurar variables de entorno en Railway.
2. Ejecutar sincronización inicial:
   - `npx prisma db push`
   - `npm run prisma:generate`
3. Correr seed:
   - `npm run prisma:seed`
4. Validar:
   - `GET /api/health/db`
   - login en `/login`

### Checklist antes de liberar cambios

1. `npm run test:run`
2. `npm run typecheck`
3. `npm run build`
4. Si cambió `prisma/schema.prisma`, ejecutar `npx prisma db push` en entorno destino.
5. Verificar flujos mínimos:
   - compra -> venta -> dashboard -> auditoría
