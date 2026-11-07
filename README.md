# SINPE JUNTAUCR

Node.js 20 + Express, MySQL 8 (mysql2/promise), frontend HTML/CSS/JS servido por Express.

## Cómo correrlo
1. `npm install`
2. Copiar `.env.example` a `.env` y poner su usuario de MySQL (el `.env` nunca se sube).
3. En Workbench correr, en orden: `db/01_schema.sql`, `db/02_datos_prueba.sql` y los `db/sp_*.sql`.
4. `npm start` y abrir http://localhost:3000

## Ramas
`main` protegida. Cada persona trabaja en su rama y une con pull request revisado por otra persona.

| Persona | Rama | Módulo |
|---|---|---|
| 1 | `p1-acceso` | Acceso, clientes y base del proyecto |
| 2 | `p2-cuentas` | Cuentas y teléfonos |
| 3 | `p3-afiliaciones` | Afiliaciones SINPE Móvil |
| 4 | `p4-transferencias` | Transferencias y movimientos |

Nadie edita archivos de otro módulo sin avisar.
