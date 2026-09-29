// Integración con el modelo de IA por API (Anthropic / Claude).
// Si no hay API key, funciona en "modo simulado" con reglas simples,
// para poder enseñar el flujo completo sin gastar ni depender de internet.

import { CATEGORIAS, URGENCIAS, extraerJSON, validarClasificacion } from "./validar.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 20000;
const MAX_REINTENTOS = 2;

const SYSTEM_PROMPT = `Eres un asistente de una consultora de protección de datos (RGPD/LOPD).
Tu tarea es clasificar consultas de clientes para enviarlas al departamento correcto.
Los datos personales ya vienen sustituidos por marcadores como [EMAIL_1] o [DNI_1]; no intentes adivinarlos.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, con esta forma:
{
  "categoria": uno de ${JSON.stringify(CATEGORIAS)},
  "urgencia": uno de ${JSON.stringify(URGENCIAS)},
  "resumen": "resumen breve en una frase",
  "requiere_humano": true si el caso es delicado (denuncias, brechas de seguridad, plazos legales) o dudoso
}`;

export function modoActual() {
  return process.env.ANTHROPIC_API_KEY ? "ia" : "simulado";
}

export async function clasificarConsulta(textoAnonimizado) {
  if (modoActual() === "simulado") return clasificarSimulado(textoAnonimizado);

  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    try {
      const textoRespuesta = await llamarAPI(textoAnonimizado);
      const datos = extraerJSON(textoRespuesta);
      const { valido, errores } = validarClasificacion(datos);
      if (!valido) throw new Error("JSON con formato incorrecto: " + errores.join(", "));
      return { ...datos, modo: "ia", intentos: intento + 1 };
    } catch (err) {
      ultimoError = err;
      if (err.noReintentar) break;
      // Espera exponencial: 1s, 2s... para no saturar la API
      await new Promise((r) => setTimeout(r, 1000 * 2 ** intento));
    }
  }

  // Plan B: si la IA falla, no perdemos la consulta, la mandamos a revisión humana.
  return {
    categoria: "otro",
    urgencia: "media",
    resumen: "No se pudo clasificar automáticamente",
    requiere_humano: true,
    modo: "fallback",
    error: ultimoError?.message,
  };
}

async function llamarAPI(texto) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY, // la clave vive en el servidor, nunca en el frontend
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODELO || "claude-sonnet-4-5",
        max_tokens: 300, // limita la longitud (y el coste) de la respuesta
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: texto }],
      }),
    });

    if (!res.ok) {
      const err = new Error(`API respondió ${res.status}`);
      // 429 (demasiadas peticiones) y 5xx son temporales: se reintenta. 400/401 no.
      if (res.status !== 429 && res.status < 500) err.noReintentar = true;
      throw err;
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// Reglas simples solo para la demo sin API key.
function clasificarSimulado(texto) {
  const t = texto.toLowerCase();
  let categoria = "otro";
  if (/denuncia|acoso|fraude|irregularidad/.test(t)) categoria = "canal_denuncias";
  else if (/factura|pago|cobro|recibo/.test(t)) categoria = "facturacion";
  else if (/rgpd|datos|brecha|lopd|consentimiento|cookies|derecho de acceso/.test(t)) categoria = "rgpd";
  else if (/error|no funciona|contraseña|acceso a la app|portal/.test(t)) categoria = "soporte_tecnico";

  const noUrgente = /no es urgente|sin prisa/.test(t);
  const urgente = !noUrgente && /urgente|\bya\b|\bhoy\b|brecha|acoso|plazo|inspecci[oó]n|sanci[oó]n/.test(t);
  return {
    categoria,
    urgencia: urgente ? "alta" : noUrgente ? "baja" : "media",
    resumen: texto.length > 90 ? texto.slice(0, 90) + "…" : texto,
    requiere_humano: categoria === "canal_denuncias" || urgente,
    modo: "simulado",
  };
}
