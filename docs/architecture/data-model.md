# Modelo de dominio

Descripción conceptual de las entidades principales de Pulse Finance y sus relaciones. No es un schema de base de datos ni código: define el vocabulario y las relaciones que cualquier implementación futura debe respetar.

## Entidades

### User

Representa a la persona dueña de los datos financieros. En el MVP, cada usuario ve únicamente sus propios datos (ver [vision.md](../product/vision.md), fuera de alcance: cuentas compartidas).

- Atributos conceptuales: identificador, nombre/email, preferencias (ej. moneda por defecto, período de presupuesto por defecto).

### Account

Una cuenta donde el usuario agrupa transacciones (ej. "Efectivo", "Cuenta bancaria", "Tarjeta de crédito"). Un usuario tiene múltiples cuentas.

- Atributos conceptuales: nombre, tipo (efectivo, banco, tarjeta, otro), balance actual (derivado de sus transacciones).
- Relación: pertenece a un `User`. Tiene muchas `Transaction`.

### Category

Clasificación temática de una transacción (ej. "Comida", "Transporte", "Salario"). Personalizable por el usuario, con un set inicial sugerido.

- Atributos conceptuales: nombre, tipo (gasto o ingreso — una categoría no mezcla ambos).
- Relación: pertenece a un `User`. Tiene muchas `Transaction`. Puede estar asociada a uno o varios `Budget`.

### Transaction

Un movimiento individual de dinero: un gasto o un ingreso.

- Atributos conceptuales: monto, fecha, tipo (gasto/ingreso), nota/descripción opcional.
- Relación: pertenece a una `Account` y a una `Category`. Puede originarse de una `RecurringTransaction`.
- Regla de negocio: el monto es siempre positivo; el signo/dirección lo determina el tipo (gasto resta del balance de la cuenta, ingreso suma).

### RecurringTransaction

Plantilla que genera `Transaction` automáticamente cada período (ej. salario mensual, suscripción).

- Atributos conceptuales: monto, categoría, cuenta, frecuencia (ej. mensual, semanal), próxima fecha de ejecución.
- Relación: genera muchas `Transaction` a lo largo del tiempo.

### Budget

Límite de gasto que el usuario define para una categoría en un período determinado (ej. "Comida: $300/mes").

- Atributos conceptuales: monto límite, período (ej. mensual), categoría asociada.
- Relación: pertenece a un `User`, asociado a una `Category`.
- Regla de negocio: el progreso de un `Budget` se calcula sumando las `Transaction` de tipo gasto de su categoría dentro del período vigente.

## Relaciones (resumen)

```
User 1---N Account 1---N Transaction N---1 Category
User 1---N Category
User 1---N Budget N---1 Category
Account 1---N RecurringTransaction 1---N Transaction
```

## Notas para implementación futura

- El modelo debe soportar que una categoría se elimine o desactive sin romper transacciones históricas (ej. soft-delete o similar), aunque el mecanismo concreto se define al implementar.
- Los cálculos de balance y progreso de presupuesto son derivados, no almacenados como fuente de verdad — evitar duplicar estado que pueda desincronizarse.
