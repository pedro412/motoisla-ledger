# Reglas de Negocio (vigentes)

## Capital y compras

- No se permite registrar compra si `totalGross` excede capital disponible del inversionista.
- Cada compra activa genera salida de capital (`COMPRA`).
- Una compra cancelada genera reversa de capital (`REVERSA_COMPRA`).

## Cancelación de compra

- Solo `ADMIN`/`OPERADOR`.
- Requiere motivo.
- No se puede cancelar si cualquier lote de esa compra ya tuvo ventas.
- Al cancelar:
  - compra y lotes quedan en estado `CANCELLED`
  - se audita el evento

## Ventas y stock

- Solo se venden lotes `ACTIVE`.
- No se permite vender más cantidad que disponible por lote.
- Comisión por cobro:
  - sin terminal: `0%`
  - terminal débito/1 exhibición: `2%`
  - terminal 3 MSI: `5.58%`

## Utilidad

- Reparto actual: `50/50` inversionista vs MotoIsla.
- Transferencia de utilidad a capital permitida (total o parcial), auditable.

## Gastos operativos (opex)

- Se aplica una **tasa fija configurable** (`opex_rate`, default `17.5%`) sobre las ventas brutas de cada línea de venta.
- Fórmula por línea por owner: `opexDeduction = grossRevenue × opexRate × 0.5`
- El campo `opexDeduction` se guarda en `ProfitSplit` junto con la `opexRate` vigente al momento de la venta.
- **Utilidad neta del inversionista** = `profitShareGross − opexDeduction`
- Registros históricos (`opexDeduction = NULL`) se tratan como `0` → sin impacto en datos pasados.
- El endpoint `POST /api/sales/recalculate` **no** aplica opex (preserva comportamiento histórico).
- Solo `ADMIN` puede modificar la tasa desde `/settings` (audita en `AuditLog` con entity `SETTING`).

## Configuración del sistema

- Modelo `SystemSetting` guarda pares `key/value` configurables por admin.
- Clave disponible: `opex_rate` (número entre 0 y 1).
- Cambios se registran en `AuditLog` con `entity: SETTING`, `action: "setting.updated"`.

## RBAC

- `ADMIN`: control total.
- `OPERADOR`: operación diaria (compras/ventas/captura).
- `INVERSIONISTA`: acceso restringido a su `ownerId`.

## Auditoría

- Eventos críticos deben registrarse en `AuditLog` con:
  - actor
  - acción
  - entidad
  - payload
