# MotoIsla Ledger (Next.js + PostgreSQL + Prisma)

Sistema financiero para tienda, con trazabilidad de compras, lotes, ventas, capital y utilidad por inversionista.

Documentación extendida para agentes: `docs/README.md`.

## Estado actual del proyecto

### Hecho

- Migración de backend a PostgreSQL + Prisma (Google Sheets deprecado).
- Flujo base operativo:
  - alta inversionistas y capital inicial
  - alta de usuario por inversionista (admin)
  - aporte/retiro de capital externo (admin)
  - compra con validación de capital
  - cancelación de compra (auditable, con reversa de capital y bloqueo por ventas existentes)
  - creación de lotes por compra/factura
  - venta con validación de stock por lote
  - comisiones terminal (0%, 2%, 5.58%)
  - utilidad + capital + transferencia utilidad->capital
  - borrado de venta (auditable) con restauración de stock/capital/utilidad
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
  - dashboard con gráficas (Recharts)
  - login limpio (sin menú)
  - botones de acción con estado loading + spinner
  - validación en tiempo real en transferencia parcial de utilidad (warning + bloqueo de confirmación si excede lo disponible)
  - mensajes de éxito/error amigables en formularios de compra/venta
  - refresco visual de dashboard tras operaciones críticas

### En progreso

- Consolidar pruebas de integración por rol y por flujo completo (parcialmente cubierto).

### Backlog (priorizado)

- Cancelación/reversa avanzada de venta con reglas más estrictas de dependencias posteriores.
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
SEED_MODE=dev
```

3. Crear/aplicar migración local y generar cliente:

```bash
npx prisma migrate dev --name init
npm run prisma:generate
```

`db push` queda solo para casos locales excepcionales; el flujo normal usa migraciones versionadas.

4. Seed inicial:

```bash
# Local (demo con usuarios)
npm run prisma:seed:dev
```

Esto crea por defecto:

- owner inversionista `inv_lic`
- owner `motoisla`
- usuario `admin` (rol `ADMIN`)
- usuario `operador` (rol `OPERADOR`)
- usuario `inversionista` (rol `INVERSIONISTA`, ligado a `inv_lic`)

Modos de seed:

| `SEED_MODE` | Qué hace | Uso recomendado |
|---|---|---|
| `dev` | Crea owners + usuarios demo | Desarrollo local |
| `bootstrap` | Crea owners base desde `SEED_BOOTSTRAP_OWNERS_JSON`, sin usuarios | Arranque inicial de producción |
| `safe` | No-op (no crea datos) | Producción por defecto |

Advertencia de seguridad:
- Nunca usar `SEED_MODE=dev` en producción.
- En `NODE_ENV=production` sin `SEED_MODE`, el script cae a `safe`.

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
- `npm run prisma:migrate:dev`
- `npm run prisma:migrate:deploy`
- `npm run prisma:db:push:dev`
- `npm run prisma:studio`
- `npm run prisma:seed`
- `npm run prisma:seed:dev`
- `npm run prisma:seed:bootstrap`
- `npm run prisma:seed:safe`

## Rutas UI

- `/dashboard`
- `/inventario`
- `/investors`
- `/purchases/new`
- `/sales/new`
- `/sales`
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
- `PATCH /api/investors/:id/capital` (deprecado/bloqueado)
- `POST /api/users/investor`
- `POST /api/users/investor/reset-password`
- `POST /api/investors/:id/capital/movements`

### Compras / lotes / ventas

- `POST /api/purchases`
- `POST /api/purchases/:id/cancel`
- `GET /api/lots?ownerId=<id>`
- `POST /api/sales`
- `DELETE /api/sales/:id`
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
  - `tests/integration/saleDelete.test.ts` (borrado de venta y restauración contable)

## Nota sobre Google Sheets

Los endpoints `/api/sheets` y `/api/sheets/init` permanecen solo como deprecados/compatibilidad y ya no son backend operativo.

## Runbook Railway (operación)

### Variables requeridas

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `SEED_MODE` (`bootstrap` para arranque inicial, luego `safe`)
- `SEED_BOOTSTRAP_OWNERS_JSON` (cuando `SEED_MODE=bootstrap`)

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
  
Nota:
- Variables `SEED_ADMIN_*`, `SEED_OPERATOR_*`, `SEED_INVESTOR_*` aplican solo en `SEED_MODE=dev`.

### Primer despliegue

1. Configurar variables de entorno en Railway.
2. Aplicar migraciones versionadas:
   - `npx prisma migrate deploy`
   - `npm run prisma:generate`
3. Bootstrap de owners (sin usuarios):
   - `SEED_MODE=bootstrap npm run prisma:seed:bootstrap`
4. Crear admin principal manualmente (password hasheado, no seed).
5. Cambiar `SEED_MODE` a `safe`.
6. Validar:
   - `GET /api/health/db`
   - login en `/login`

### Checklist antes de liberar cambios

1. `npm run test:run`
2. `npm run typecheck`
3. `npm run build`
4. Si cambió `prisma/schema.prisma`, crear migración en branch (`npx prisma migrate dev --name <cambio>`) y aplicar en destino con `npx prisma migrate deploy`.
5. Verificar flujos mínimos:
   - compra -> venta -> dashboard -> auditoría

## Flujo profesional de DB en producción

### Política

- Producción usa solo `prisma migrate deploy`.
- `db push` no se usa en producción (solo emergencia explícita, auditada).
- `DATABASE_URL` de prod vive en secretos del pipeline (no en laptop ni en `.env.local`).

### Pipeline CI/CD (GitHub Actions)

- Workflow: `.github/workflows/release-prod.yml`
- Trigger: `push` a `main` o ejecución manual (`workflow_dispatch`).
- Requiere secreto: `DATABASE_URL_PROD`.
- Pasos:
  1. `npm ci`
  2. `npm run prisma:generate`
  3. `npm run prisma:migrate:deploy` usando `DATABASE_URL_PROD`
  4. `npm run build`

Si falla migración, el workflow se detiene y no continúa el release.

### Baseline para DB productiva existente (one-time)

Si producción ya tenía tablas creadas antes de versionar migraciones, ejecutar una sola vez:

- Workflow manual: `.github/workflows/baseline-prod.yml`
- Inputs:
  - `baseline_migration`: `20260223134500_baseline`
  - `confirm`: `BASELINE`

Este workflow ejecuta:
1. `prisma migrate resolve --applied 20260223134500_baseline`
2. `prisma migrate deploy`

Después de ese baseline inicial, operar normalmente con `release-prod.yml`.

### Flujo diario de cambios de schema

1. En feature branch: editar `prisma/schema.prisma`.
2. Crear migración: `npx prisma migrate dev --name <descripcion>`.
3. Ejecutar: `npm run prisma:generate`, `npm run test:run`, `npm run typecheck`, `npm run build`.
4. Commit incluyendo `prisma/migrations/*`.
5. PR y aprobación.
6. Merge a `main`; CI aplica `migrate deploy` contra producción.

## Siguientes pasos

1. Endurecer reversa de venta:
   - reglas adicionales de orden cronológico/dependencias posteriores
   - estrategia de reversa "soft cancel" además de borrado
2. Implementar reparto configurable por inversionista (reemplazar 50/50 fijo).
3. Mejorar auditoría:
   - filtros por rango de fecha
   - exportación CSV
   - búsqueda por entidad/id/actor
