// La IA puede equivocarse o devolver texto que no es JSON.
// Nunca nos fiamos a ciegas: comprobamos la estructura antes de usarla.

export const CATEGORIAS = ["rgpd", "canal_denuncias", "facturacion", "soporte_tecnico", "otro"];
export const URGENCIAS = ["alta", "media", "baja"];

export function extraerJSON(texto) {
  // A veces el modelo envuelve el JSON en ```json ... ``` o añade una frase.
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(texto.slice(inicio, fin + 1));
}

export function validarClasificacion(obj) {
  const errores = [];
  if (!obj || typeof obj !== "object") errores.push("No es un objeto");
  else {
    if (!CATEGORIAS.includes(obj.categoria)) errores.push(`categoria inválida: ${obj.categoria}`);
    if (!URGENCIAS.includes(obj.urgencia)) errores.push(`urgencia inválida: ${obj.urgencia}`);
    if (typeof obj.resumen !== "string" || obj.resumen.length === 0) errores.push("falta resumen");
    if (typeof obj.requiere_humano !== "boolean") errores.push("requiere_humano debe ser true/false");
  }
  return { valido: errores.length === 0, errores };
}
