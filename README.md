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

### Investors
- investor_id
- name
- type (INVESTOR | MOTOISLA)
- created_at

### Purchases
- purchase_id
- date (YYYY-MM-DD)
- supplier
- invoice_ref
- subtotal_net
- tax_total
- total_gross
- tax_rate
- raw_doc_id
- created_at

### PurchaseLines
- purchase_line_id
- purchase_id
- line_no
- supplier_sku
- unit
- description_raw
- qty
- line_total_net
- sat_product_key
- pedimento
- line_tax_allocated
- line_total_gross
- unit_cost_net_exact
- unit_cost_gross_exact

### Lots
- lot_id
- purchase_id
- purchase_line_id
- owner_id
- supplier_sku
- internal_sku
- description
- qty_bought
- unit_cost_gross
- created_at

### Sales
- sale_id
- date
- channel
- total_gross
- notes
- created_at

### SaleLines
- sale_line_id
- sale_id
- lot_id
- sku
- qty
- unit_price_gross
- discount_gross
- revenue_gross
- cogs_gross
- profit_gross

### ProfitSplits
- split_id
- sale_id
- owner_id
- profit_share_gross
- status
- created_at

## Configuración Google Cloud / Service Account

1. Habilita **Google Sheets API**.
2. Crea una **Service Account** y genera su JSON key.
3. Comparte el Google Sheet al correo de la Service Account como **Editor**.
4. Convierte el JSON de la SA a base64 y colócalo en `.env.local`.

## Variables de entorno

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxx
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=eyJ0eXBlIjoi...
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
3. Append en `Purchases`, `PurchaseLines` y `Lots`

### POST `/api/sales`
Crea venta con líneas por lote.

Request:
- date,channel,notes,lines[{lotId,sku,qty,unitPriceGross,discountGross}]

Proceso:
1. Lee `Lots` para costo y owner
2. Calcula revenue/cogs/profit
3. Append en `Sales`, `SaleLines`, `ProfitSplits` (50/50, ACCRUED)

### GET `/api/sheets`
Healthcheck básico de conexión a Sheets.

## UI

- `/purchases/new`: formulario de importación de compra + textarea de factura
- `/sales/new`: formulario de venta con líneas dinámicas
- `/dashboard`: agregados de ventas/compras/utilidad + inventario/utilidad por owner

## Ejecutar

```bash
npm install
npm run dev
```
