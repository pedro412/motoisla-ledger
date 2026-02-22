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
