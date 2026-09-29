// Servidor Express con un webhook que recibe consultas de clientes.
// Flujo: webhook → anonimizar → IA por API → validar → acción (enrutar).

import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anonimizar } from "./anonimizar.js";
import { clasificarConsulta, modoActual } from "./ia.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Qué departamento recibe cada categoría (la "acción" final de la automatización)
const DEPARTAMENTOS = {
  rgpd: "Equipo legal RGPD",
  canal_denuncias: "Responsable del canal de denuncias",
  facturacion: "Administración",
  soporte_tecnico: "Soporte técnico",
  otro: "Atención al cliente",
};

// Registro en memoria (en producción iría a una base de datos).
// Solo guardamos el texto anonimizado: minimización de datos.
const registro = [];

app.post("/webhook/consulta", async (req, res) => {
  const mensaje = req.body?.mensaje;
  if (typeof mensaje !== "string" || mensaje.trim().length === 0) {
    return res.status(400).json({ error: "Falta el campo 'mensaje'" });
  }

  const { texto: textoAnonimizado, mapa } = anonimizar(mensaje);
  const clasificacion = await clasificarConsulta(textoAnonimizado);
  const departamento = DEPARTAMENTOS[clasificacion.categoria];

  registro.push({
    fecha: new Date().toISOString(),
    texto: textoAnonimizado,
    ...clasificacion,
    departamento,
  });

  res.json({
    textoEnviadoALaIA: textoAnonimizado,
    datosProtegidos: Object.keys(mapa).length,
    clasificacion,
    accion: clasificacion.requiere_humano
      ? `Enviar a ${departamento} para revisión manual`
      : `Asignar automáticamente a ${departamento}`,
  });
});

app.get("/api/registro", (_req, res) => res.json(registro.slice(-20).reverse()));
app.get("/api/estado", (_req, res) => res.json({ modo: modoActual() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}  (modo: ${modoActual()})`);
});
