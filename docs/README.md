# Docs para Agentes

Este directorio guarda contexto operativo para que cualquier agente pueda continuar el proyecto sin perder información.

## Archivos

- `docs/AGENT_CONTEXT.md`: estado actual, stack, rutas y convenciones.
- `docs/ARCHITECTURE.md`: arquitectura técnica (frontend, API, DB, auth).
- `docs/BUSINESS_RULES.md`: reglas de negocio vigentes.
- `docs/SESSION_LOG.md`: bitácora por sesión (qué se hizo y próximos pasos).

## Regla de mantenimiento

Al cerrar **cada sesión de trabajo**:

1. Agregar una entrada en `docs/SESSION_LOG.md`.
2. Si cambian reglas/arquitectura, actualizar `docs/BUSINESS_RULES.md` y/o `docs/ARCHITECTURE.md`.
3. Si cambia estado del roadmap, reflejarlo en `docs/AGENT_CONTEXT.md`.
