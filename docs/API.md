# Contrato de la API · SINPE JUNTAUCR

La interfaz (carpeta `public/`) ya está terminada y llama a estas rutas.
Cada persona programa **sus** rutas en `src/routes/<su-archivo>.js` respetando
exactamente el método, la ruta y los nombres de campos (camelCase).

**Formato de respuesta (todas):** `{ ok: true, datos }` o `{ ok: false, mensaje }`.
El `mensaje` se muestra tal cual al usuario (por ejemplo, el error del procedimiento almacenado).

**Sesión** (la arma Persona 1 en `/login`):
`req.session.usuario = { idUsuario, idCliente, rol: 'cliente'|'admin', idEntidad }`.
Todo se filtra por la entidad de la sesión. Un cliente solo ve lo suyo.

## Datos de ejemplo (mientras una ruta no exista)

`public/js/api.js` detecta cuando Express responde **404 sin JSON** (la ruta todavía
no está programada) y usa `public/js/demo.js`, que simula la ruta con datos de ejemplo
y las mismas reglas del enunciado. En la pantalla aparece la etiqueta amarilla
**"Datos de ejemplo"**; al pasar el mouse dice qué rutas faltan.

👉 En cuanto una ruta real responda (aunque sea con error en JSON), la interfaz la usa
sola y deja de usar el ejemplo. No hay que tocar nada del frontend.

Usuarios de ejemplo (contraseña `prueba123`): `admin.juntaucr`, `ana.mora`, `luis.rojas`
en Banco JUNTAUCR; `admin.bn` en BN; `admin.bcr`, `ana.mora` en BCR.

---

## Persona 1 · Acceso y clientes (`src/routes/acceso.js`)

| Método | Ruta | Recibe | Devuelve `datos` | Pantalla |
|---|---|---|---|---|
| GET | `/api/entidades` | — | `[{ idEntidad, codigo, nombre }]` | Login |
| POST | `/api/login` | `{ idEntidad, usuario, contrasena }` | la sesión (igual que `/sesion`) | Login |
| POST | `/api/logout` | — | `true` | Menú |
| GET | `/api/sesion` | — | `{ idUsuario, idCliente, rol, idEntidad, entidad, codigo, nombre, identificacion }` · 401 si no hay | Todas |
| GET | `/api/perfil` | — | `{ idCliente, identificacion, nombres, primerApellido, segundoApellido, nombre, correo, fechaRegistro, estado }` | Cliente · Mis datos |
| PUT | `/api/perfil` | `{ nombres, primerApellido, segundoApellido, correo }` | `{ mensaje }` | Cliente · Mis datos |
| GET | `/api/clientes` | — (admin) | `[{ …cliente, nombre, cuentas (cantidad), telefonos: ['88881111'] }]` | Admin · Clientes, buscadores |
| POST | `/api/clientes` | `{ identificacion, nombres, primerApellido, segundoApellido, correo }` | `{ idCliente, usuario, contrasenaTemporal }` | Admin · Clientes |
| PUT | `/api/clientes/:id` | `{ nombres, primerApellido, segundoApellido, correo, estado }` | `{ mensaje }` | Admin · Clientes |

El login **no** pide rol: el rol sale del usuario. Un cliente INACTIVO no puede entrar.
`entidad`, `codigo` y `nombre` de la sesión se usan en el menú y los encabezados.

## Persona 2 · Cuentas y teléfonos (`src/routes/cuentas.js`)

| Método | Ruta | Recibe | Devuelve `datos` | Pantalla |
|---|---|---|---|---|
| GET | `/api/cuentas` | — | `[{ idCuenta, idCliente, iban, moneda, saldo, estado, fechaApertura, titular, identificacion, numeros: ['88881111'] }]` (admin: toda la entidad; cliente: las suyas) | Inicio, Cuentas IBAN, Transferir IBAN, Movimientos |
| GET | `/api/cuentas/iban-sugerido` | — (admin) | `{ iban }` con el código de la entidad | Admin · Cuentas IBAN |
| POST | `/api/cuentas` | `{ idCliente, moneda: 'CRC'|'USD', iban, saldo, fechaApertura }` | `{ mensaje }` | Admin · Cuentas IBAN |
| PUT | `/api/cuentas/:iban/estado` | `{ estado: 'ACTIVA'|'BLOQUEADA'|'INACTIVA' }` | `{ mensaje }` | Admin · Cuentas IBAN |
| GET | `/api/telefonos` | — | `[{ numero, fechaRegistro, idCliente, titular, identificacion, estado: 'NO_AFILIADO'|'AFILIADO'|'AFILIADO_OTRA', iban, entidad, fechaAfiliacion }]` | Teléfonos (admin y cliente), Inicio |
| POST | `/api/telefonos` | `{ numero, idCliente }` (el cliente no manda `idCliente`: se usa el de la sesión) | `{ mensaje }` | Teléfonos |

`numeros` = teléfonos afiliados a esa cuenta. `AFILIADO` = afiliado en esta entidad;
`AFILIADO_OTRA` = afiliado en otra (se muestra `entidad`). Registrar ≠ afiliar.

## Persona 3 · Afiliaciones (`src/routes/afiliaciones.js`)

| Método | Ruta | Recibe | Devuelve `datos` | Pantalla |
|---|---|---|---|---|
| GET | `/api/afiliaciones` | — | `[{ numero, idCliente, titular, identificacion, iban, fechaAfiliacion }]` (vigentes en la entidad) | Admin · Inicio, Cliente · Afiliación |
| GET | `/api/afiliaciones/ficha?idCliente=` | admin manda `idCliente`; cliente no | `{ cliente, telefonos: [como /telefonos], cuentas: [como /cuentas] }` | Afiliación |
| POST | `/api/afiliaciones` | `{ numero, iban, idCliente? }` | `{ mensaje }` | Afiliar |
| PUT | `/api/afiliaciones/:numero` | `{ iban }` (cuenta nueva) | `{ mensaje }` | Trasladar |
| DELETE | `/api/afiliaciones/:numero` | — | `{ mensaje }` | Desafiliar |
| GET | `/api/afiliaciones/historial` | — | `[{ idHistorial, fechaEvento, accion: 'AFILIACION'|'DESAFILIACION', numero, iban, idCliente, titular, usuario }]` | Historial |

Reglas: cuenta ACTIVA, en colones, del mismo titular que el teléfono y de esta entidad.
Trasladar = desafiliar + afiliar en una sola transacción (si falla el paso 2, se revierte todo).

## Persona 4 · Transferencias y movimientos (`src/routes/transferencias.js`)

| Método | Ruta | Recibe | Devuelve `datos` | Pantalla |
|---|---|---|---|---|
| GET | `/api/transferencias/origenes` | — | `[{ iban, saldo, numero }]` solo cuentas del cliente con número afiliado | SINPE |
| GET | `/api/transferencias/destino-sinpe/:numero` | — | `{ numero, titular, afiliado, iban, entidad }` | SINPE (vista previa) |
| POST | `/api/transferencias/sinpe` | `{ numeroOrigen, numeroDestino, monto, detalle }` | comprobante ↓ | SINPE |
| GET | `/api/transferencias/destino-iban/:iban` | — | `{ iban, titular, entidad, moneda, estado }` | IBAN (vista previa) |
| POST | `/api/transferencias/iban` | `{ ibanOrigen, ibanDestino, monto, detalle }` | comprobante ↓ | IBAN |
| GET | `/api/movimientos?desde=&hasta=[&iban=][&idCliente=]` | fechas `AAAA-MM-DD` | `[{ idTransferencia, fecha, tipo: 'SINPE_MOVIL'|'IBAN', movimiento: 'ENVIADA'|'RECIBIDA'|'ENTRE_MIS_CUENTAS'|null, monto, moneda, detalle, ibanOrigen, titularOrigen, codigoOrigen, ibanDestino, titularDestino, codigoDestino, telefonoOrigen, telefonoDestino }]` más recientes primero | Movimientos, Inicio |

**Comprobante:** `{ idTransferencia, fecha, tipo, monto, moneda, detalle, ibanOrigen, entidadOrigen, ibanDestino, entidadDestino, titularDestino, telefonoOrigen, telefonoDestino, saldoAntes, saldoDespues }`.

El SINPE se elige por **cuenta**, pero cada opción lleva su número afiliado: al backend
llega `numeroOrigen` (teléfono), como pide el enunciado (2.8). `movimiento` es `null` para el admin.

⚠️ **Pendiente de confirmar con el profe:** la interfaz trata la transferencia IBAN como
**misma moneda** (regla 8). El comentario de `01_schema.sql` menciona una tabla `tipo_cambio`;
si se decide convertir monedas, el comprobante puede agregar `montoDestino`, `monedaDestino`
y `tipoCambio` (la pantalla ya los muestra si vienen).
