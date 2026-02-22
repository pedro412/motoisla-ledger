# Bitácora de Sesiones

## 2026-02-22

### Hecho

- Migración completa a Postgres + Prisma (sin Google Sheets operativo).
- Auth + RBAC + aislamiento por inversionista.
- Dashboard e inventario mejorados en UI/UX.
- Auditoría funcional en API y vista `/auditoria`.
- Soporte de cancelación de compra con reversa de capital.
- Soporte de parser multi-formato de factura (`LS2` y `EDGE`).
- Preview de compra con líneas, artículos, subtotal y alertas de IVA/total.
- Cobertura de pruebas unitarias e integración reforzada.

### Próximos pasos

1. Implementar cancelación de venta (auditable y consistente).
2. Reparto configurable de utilidad por inversionista.
3. Mejoras de auditoría (filtros/export/búsqueda).

### Nota operativa

Al terminar cada nueva sesión, agregar una nueva entrada con:

- fecha
- cambios realizados
- riesgos/notas
- próximos pasos
