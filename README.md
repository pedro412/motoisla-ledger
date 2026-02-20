# MotoIsla Ledger (Next.js + Google Sheets)

MVP append-only para control de compras, lotes, ventas y utilidad compartida en Google Sheets.

## Arquitectura

- **Frontend + backend**: Next.js 14 (App Router + Route Handlers)
- **Base de datos**: Google Sheets
- **Patrón de escritura**: append-only (sin updates/deletes)
- **Inventario disponible por lote**: `qty_bought - SUM(qty vendida)`
- **Profit split**: 50/50 por línea de venta, con `status=ACCRUED`

## Estructura del proyecto

```txt
motoisla-ledger/
  app/
    dashboard/page.tsx
    purchases/new/page.tsx
    sales/new/page.tsx
    api/
      purchases/route.ts
      sales/route.ts
      sheets/route.ts
  lib/
    sheets.ts
    ids.ts
    tax.ts
    parse/
      ls2Invoice.ts
  types/
    schemas.ts
  .env.local
  package.json
```

## Esquema de Google Sheets

Crea estas pestañas con estos encabezados (fila 1):

### Inversionistas
- id_inversionista
- nombre
- tipo (INVESTOR | MOTOISLA)
- capital_inicial
- creado_en

### Compras
- id_compra
- date (YYYY-MM-DD)
- proveedor
- referencia_factura
- subtotal_neto
- impuesto_total
- total_bruto
- tasa_impuesto
- id_documento_raw
- creado_en

### LineasCompra
- id_linea_compra
- id_compra
- numero_linea
- sku_proveedor
- unidad
- descripcion_raw
- cantidad
- total_linea_neto
- clave_sat_producto
- pedimento
- impuesto_asignado_linea
- total_linea_bruto
- costo_unitario_neto_exacto
- costo_unitario_bruto_exacto

### Lotes
- id_lote
- id_compra
- id_linea_compra
- id_owner
- sku_proveedor
- sku_interno
- descripcion
- cantidad_comprada
- costo_unitario_bruto
- creado_en

### Ventas
- id_venta
- date
- canal
- total_bruto
- notas
- creado_en

### LineasVenta
- id_linea_venta
- id_venta
- id_lote
- sku
- cantidad
- precio_unitario_bruto
- descuento_bruto
- ingreso_bruto
- costo_ventas_bruto
- utilidad_bruta

### RepartosUtilidad
- id_reparto
- id_venta
- id_owner
- participacion_utilidad_bruta
- status
- creado_en

### MovimientosCapital
- id_movimiento
- id_owner
- tipo (COMPRA | VENTA_COSTO)
- monto
- referencia_id
- fecha
- creado_en

## Configuración Google Cloud / OAuth

1. Habilita **Google Sheets API**.
2. Configura la pantalla de consentimiento OAuth en Google Cloud (tipo Interno o Externo).
3. Crea un **OAuth Client ID** (Desktop App o Web App).
4. Obtén un `refresh_token` para el scope `https://www.googleapis.com/auth/spreadsheets`.
5. Comparte el Google Sheet al usuario que autorizó OAuth como **Editor** (si no es owner).

## Variables de entorno

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxx
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
GOOGLE_OAUTH_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxx
DEFAULT_INVESTOR_ID=inv_default
MOTOISLA_OWNER_ID=motoisla_owner
```

## Endpoints

### POST `/api/purchases`
Importa compra desde texto de factura LS2.

Request:
- supplier,date,invoiceRef,subtotalNet,taxTotal,totalGross,taxRate,rawText,defaultOwnerId

Proceso:
1. Parsea líneas (`lib/parse/ls2Invoice.ts`)
2. Asigna IVA por línea (`lib/tax.ts`) para cuadrar contra factura
3. Valida capital disponible del owner en `Inversionistas` + `MovimientosCapital`
4. Append en `Compras`, `LineasCompra` y `Lotes`
5. Registra salida de capital en `MovimientosCapital` (tipo `COMPRA`)

### POST `/api/sales`
Crea venta con líneas por lote.

Request:
- date,channel,notes,terminalPayment,threeMonthsNoInterest,lines[{lotId,sku,qty,unitPriceGross,discountGross}]

Proceso:
1. Lee `Lotes` para costo y owner
2. Calcula comisión por terminal (2.00% o 5.58%), revenue neto, cogs y utilidad
3. Append en `Ventas`, `LineasVenta`, `RepartosUtilidad` (50/50, ACCRUED)
4. Registra regreso de costo al capital en `MovimientosCapital` (tipo `VENTA_COSTO`)

### GET `/api/sheets`
Healthcheck básico de conexión a Sheets.

### POST `/api/sheets/init`
Crea las pestañas necesarias (`Inversionistas`, `Compras`, `LineasCompra`, `Lotes`, `Ventas`, `LineasVenta`, `RepartosUtilidad`, `MovimientosCapital`) y agrega/actualiza encabezados en fila 1.

### GET `/api/lots`
Devuelve lotes con existencia disponible para autocompletar ventas (`lotId`, `sku`, `qtyAvailable`, `ownerId`, etc.).

### POST `/api/capital/reconcile`
Reconstruye `MovimientosCapital` desde `Lotes` (salidas por compra) y `LineasVenta` (regreso de costo por venta), limpiando primero los movimientos existentes.

### POST `/api/capital/transfer-profit`
Transfiere utilidad acumulada a capital disponible para un owner, registrando el movimiento auditable en `MovimientosCapital` con tipo `UTILIDAD_A_CAPITAL`.

### POST `/api/sales/recalculate`
Recalcula comisiones de terminal y utilidad histórica en `LineasVenta` usando los flags de cada venta (`pago_terminal`, `meses_sin_intereses_3`), y reconstruye `RepartosUtilidad` para cuadrar utilidades.

## UI

- `/purchases/new`: formulario de importación de compra + textarea de factura
- `/sales/new`: formulario de venta con líneas dinámicas
- `/dashboard`: agregados de ventas/compras/utilidad + inventario/utilidad por owner
- `/inventario`: inventario actual por factura/compra, con lotes en cajas y estatus de stock

## Ejecutar

```bash
npm install
npm run dev
```
