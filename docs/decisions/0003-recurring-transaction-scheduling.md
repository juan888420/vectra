# ADR-0003: Estrategia de recurrencia anchored para `RecurringTransaction`

## Estado

`accepted`

## Contexto

RFC-0015 implementó el motor de recurrencias: `RecurrenceFrequency` (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `YEARLY`), el campo `nextExecutionDate` en `RecurringTransaction`, y un processor idempotente que genera `Transaction` a partir de plantillas vencidas (ver [`data-model.md`](../architecture/data-model.md) sección 2 y [ADR-0002](0002-prisma-domain-mapping.md)).

Para `MONTHLY` y `YEARLY` surge un problema que `DAILY`/`WEEKLY`/`BIWEEKLY` no tienen: no todos los meses tienen el mismo número de días, y no todos los años son bisiestos. Una plantilla mensual creada el 31 de enero no tiene un "31 de febrero" al que avanzar. Había que decidir explícitamente cómo se calcula la siguiente ocurrencia cuando el día ancla no existe en el mes destino.

## Decisión

**Recurrencia _anchored_, no _drifting_**. El día (y, para `YEARLY`, el mes) de `startDate` es el ancla permanente del schedule. Cada cálculo de la siguiente ocurrencia parte del ancla original, no de la última fecha generada:

- Si el mes destino tiene menos días que el ancla, la ocurrencia se recorta (_clamp_) al último día de ese mes.
- El mes siguiente, el cálculo vuelve a intentar el día ancla original — no seguir recortando desde el valor ya recortado.

Ejemplo mensual, ancla 31: `31-ene → 28-feb → 31-mar → 30-abr → 31-may → ...` (el patrón de "meses cortos" no se acumula).

Ejemplo anual, ancla 29-feb: cae en `28-feb` en años comunes y vuelve a `29-feb` exactamente en el próximo año bisiesto.

Implementado en [`lib/recurrence.ts`](../../apps/api/src/lib/recurrence.ts) (`calculateNextExecutionDate`), que recibe `startDate` explícitamente como ancla en cada llamada — no infiere el ancla de la fecha "actual" que se le pasa.

### Alternativa descartada: recurrencia _drifting_

La alternativa más simple de implementar es calcular cada ocurrencia a partir de la anterior ya generada (`addMonths(nextExecutionDate, 1)`), sin recordar el día original. Con ancla 31: `31-ene → 28-feb → 28-mar → 28-abr → ...` — una vez que un mes corto recorta la fecha, el schedule se "encoge" permanentemente, incluso en meses que sí tendrían 31 días.

Se descartó porque:

- Contradice la expectativa razonable del usuario ("cobro el 31, o el último día si el mes es corto" — no "cobro el 28 para siempre después de febrero").
- Es el comportamiento que sistemas de facturación recurrente conocidos (ej. Stripe Billing) evitan explícitamente por la misma razón.
- El costo de implementarlo bien (guardar/leer el ancla) es mínimo: una columna que ya existe (`startDate`) y un parámetro adicional en una función pura.

## Consecuencias

- `calculateNextExecutionDate(current, frequency, startDate)` requiere `startDate` en toda llamada para `MONTHLY`/`YEARLY`; el processor siempre lo tiene disponible en la plantilla, así que no hay costo operativo.
- El comportamiento está cubierto por tests unitarios exhaustivos (cambios de mes, meses de distinta longitud, años bisiestos, y el _round trip_ de volver al ancla tras un mes corto) en [`tests/recurrence.test.ts`](../../apps/api/tests/recurrence.test.ts).
- Si en el futuro se necesita `RecurrenceFrequency` con intervalos custom (ej. "cada 2 meses", ver sección 6 de `data-model.md`), la misma noción de ancla se extiende naturalmente: el ancla sigue siendo `startDate`, solo cambia el multiplicador de meses.
