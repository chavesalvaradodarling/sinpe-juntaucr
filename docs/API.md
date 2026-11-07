# Contrato de la API · SINPE JUNTAUCR

Son las rutas del documento **"División del trabajo"** (6 nov). Aquí se agregan los
**nombres exactos de los campos** que espera la interfaz, para que cada persona programe
su ruta sin adivinar. Si alguien necesita cambiar algo, avisa al grupo primero.

**Formato de respuesta (todas):** `{ ok: true, datos }` o `{ ok: false, mensaje }`.
El `mensaje` (por ejemplo, el de `SIGNAL SQLSTATE '45000'`) se muestra tal cual en pantalla.

**Sesión:** `req.session.usuario = { idUsuario, idCliente, rol: 'cliente'|'admin', idEntidad }`.
La entidad y el rol salen siempre de la sesión, nunca de lo que mande el navegador.
**"Ambos"** = el mismo endpoint filtra solo: el cliente ve lo suyo y el admin ve toda la entidad.
Campos en camelCase.

## Datos de ejemplo (mientras una ruta no exista)

`public/js/api.js` detecta cuando Express responde **404 sin JSON** (la ruta no está
programada) y usa `public/js/demo.js`, que la simula con los datos del prototipo y las reglas
del enunciado. En pantalla aparece la etiqueta amarilla **"Datos de ejemplo"**; al pasar el
mouse dice qué rutas faltan. Cuando la ruta real responde, la interfaz la usa sola.

Usuarios de ejemplo (contraseña `prueba123`, Banco JUNTAUCR): `cliente.demo` (Ana) y
`admin.demo`; también `ana.mora`, `luis.rojas`, `admin.juntaucr`.

## Archivos de la interfaz por persona

| Persona | Archivo | Pantallas |
|---|---|---|
| 1 | `public/index.html`, `js/acceso.js`, `js/menu.js`, `js/ui.js`, `js/api.js`, `css/estilos.css` | Login · Mis datos · Clientes · menú y estilos |
| 2 | `js/cuentas.js` | Inicio (cliente y admin) · Cuentas IBAN · Mis teléfonos · Teléfonos |
| 3 | `js/afiliaciones.js` | Afiliar número · Afiliaciones SINPE · Historial |
| 4 | `js/transferencias.js` | SINPE · IBAN · comprobante y rechazo · Movimientos |

Cada pantalla es un `.html` en `public/cliente/` o `public/admin/` que carga esos archivos.

---

## Persona 1 · Acceso y clientes

| Método y ruta | Rol | Recibe | Devuelve `datos` |
|---|---|---|---|
| `GET /api/entidades` | público | — | `[{ idEntidad, codigo, nombre }]` |
| `POST /api/login` | público | `{ idEntidad, usuario, contrasena }` | la sesión (como `/sesion`) |
| `POST /api/logout` | público | — | `true` |
| `GET /api/sesion` | ambos | — | `{ idUsuario, idCliente, rol, idEntidad, entidad, codigo, nombre, identificacion }` · **401** si no hay sesión |
| `GET /api/perfil` | cliente | — | `{ idCliente, identificacion, nombres, primerApellido, segundoApellido, nombre, correo, fechaRegistro, estado }` |
| `PUT /api/perfil` | cliente | `{ nombres, primerApellido, segundoApellido, correo }` | `{ mensaje }` |
| `GET /api/clientes` | admin | — | `[{ idCliente, identificacion, nombres, primerApellido, segundoApellido, nombre, correo, fechaRegistro, estado, cuentas (cantidad), telefonos: ['88881111'] }]` |
| `POST /api/clientes` | admin | `{ identificacion, nombres, primerApellido, segundoApellido, correo }` | `{ idCliente, usuario, contrasenaTemporal }` |
| `PUT /api/clientes/:id` | admin | `{ nombres, primerApellido, segundoApellido, correo, estado }` | `{ mensaje }` |

El login no pide rol: sale del usuario. `nombre` = nombre completo (lo usa el menú).

## Persona 2 · Cuentas y teléfonos

| Método y ruta | Rol | Recibe | Devuelve `datos` |
|---|---|---|---|
| `GET /api/resumen` | ambos | — | ver abajo |
| `GET /api/cuentas` | admin | — | `[cuenta]` de toda la entidad |
| `POST /api/cuentas` | admin | `{ idCliente, moneda: 'CRC'\|'USD', saldo, fechaApertura }` | `{ iban }` (lo genera `sp_abrir_cuenta`: 22 caracteres con el código de la entidad) |
| `PATCH /api/cuentas/:id/estado` | admin | `{ estado: 'ACTIVA'\|'BLOQUEADA'\|'INACTIVA' }` (`:id` = idCuenta) | `{ mensaje }` |
| `GET /api/mis-cuentas` | cliente | — | `[cuenta]` del cliente en la entidad (las usa Persona 4) |
| `GET /api/telefonos` | ambos | — | `[{ numero, fechaRegistro, idCliente, titular, identificacion, estado: 'NO_AFILIADO'\|'AFILIADO'\|'AFILIADO_OTRA', iban, entidad, fechaAfiliacion }]` |
| `POST /api/telefonos` | ambos | `{ numero, idCliente }` (el cliente no manda `idCliente`) | `{ mensaje }` |

**cuenta** = `{ idCuenta, idCliente, iban, moneda, saldo, estado, fechaApertura, titular, identificacion, numeros: ['88881111'] }`
(`numeros` = teléfonos afiliados a esa cuenta).

**`/api/resumen` del cliente:** `{ cuentas: [cuenta], telefonos: { total, afiliados }, ultimos: [movimiento × 5] }`
**`/api/resumen` del admin:** `{ clientes: { activos, inactivos }, cuentas: { total, bloqueadas, inactivas }, numerosAfiliados, movimientosPeriodo (30 días), afiliaciones: [{ numero, idCliente, titular, identificacion, iban, fechaAfiliacion }] }`

## Persona 3 · Afiliaciones SINPE Móvil

| Método y ruta | Rol | Recibe | Devuelve `datos` |
|---|---|---|---|
| `GET /api/afiliaciones/:idCliente` | ambos | (el cliente solo puede pedir el suyo) | `{ cliente: { …, nombre }, telefonos: [como /telefonos], cuentas: [cuenta] }` |
| `POST /api/afiliaciones` | ambos | `{ numero, iban, idCliente }` (el cliente no manda `idCliente`) | `{ mensaje }` |
| `DELETE /api/afiliaciones/:numero` | ambos | — | `{ mensaje }` |
| `POST /api/afiliaciones/:numero/traslado` | ambos | `{ iban }` (cuenta nueva) | `{ mensaje }` |
| `GET /api/historial-afiliaciones` | ambos | — | `[{ idHistorial, fechaEvento, accion: 'AFILIACION'\|'DESAFILIACION', numero, iban, idCliente, titular, usuario }]` más recientes primero |

Los filtros del historial (fechas, evento, titular, número) se hacen en la pantalla.

## Persona 4 · Transferencias y movimientos

| Método y ruta | Rol | Recibe | Devuelve `datos` |
|---|---|---|---|
| `GET /api/sinpe/destino/:numero` | cliente | — | `{ numero, titular, afiliado, iban, entidad }` |
| `POST /api/transferencias/sinpe` | cliente | `{ numeroOrigen, numeroDestino, monto, detalle }` | comprobante |
| `POST /api/transferencias/iban` | cliente | `{ ibanOrigen, ibanDestino, monto, detalle }` | comprobante |
| `GET /api/cuentas-matriculadas` | cliente | — | `[{ iban, titular, entidad, moneda, estado }]` (terceros del cliente) |
| `POST /api/cuentas-matriculadas` | cliente | `{ iban }` | la cuenta matriculada (misma forma) |
| `GET /api/movimientos?desde=&hasta=&cuenta=` | ambos | fechas `AAAA-MM-DD`; `cuenta` = IBAN (opcional) | `[movimiento]` más recientes primero |

**comprobante** = `{ idTransferencia, fecha, tipo, monto, moneda, detalle, ibanOrigen, entidadOrigen, ibanDestino, entidadDestino, titularDestino, telefonoOrigen, telefonoDestino, saldoAntes, saldoDespues }`

**movimiento** = `{ idTransferencia, fecha, tipo: 'SINPE_MOVIL'|'IBAN', movimiento: 'ENVIADA'|'RECIBIDA'|'ENTRE_MIS_CUENTAS'|null, monto, moneda, detalle, ibanOrigen, titularOrigen, codigoOrigen, ibanDestino, titularDestino, codigoDestino, telefonoOrigen, telefonoDestino }`
(`movimiento` es `null` para el admin).

**SINPE:** el cliente elige la cuenta origen, pero solo salen sus cuentas activas en colones
con número afiliado (se arman con `/api/mis-cuentas`), una opción por número. Así llega
`numeroOrigen`, como pide el enunciado (2.8).
**IBAN:** destino "Propias" (sus otras cuentas) o "Terceros" (cuentas matriculadas).
Distinta moneda se rechaza (regla 8) hasta que el profe diga otra cosa; si se usa
`tipo_cambio`, el comprobante puede agregar `montoDestino`, `monedaDestino` y `tipoCambio`
(la pantalla ya los muestra si vienen).
