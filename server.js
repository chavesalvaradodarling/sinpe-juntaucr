// Persona 1: arranca Express y monta las rutas
require('dotenv').config();
const express = require('express');
const session = require('express-session');

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));

app.use('/api', require('./src/routes/acceso'));          // Persona 1
app.use('/api', require('./src/routes/cuentas'));         // Persona 2
app.use('/api', require('./src/routes/afiliaciones'));    // Persona 3
app.use('/api', require('./src/routes/transferencias'));  // Persona 4

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SINPE JUNTAUCR en http://localhost:${PORT}`));
