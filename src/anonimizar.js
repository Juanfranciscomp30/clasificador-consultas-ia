// Seudonimización: antes de enviar texto a un proveedor externo de IA,
// sustituimos los datos personales por marcadores ([EMAIL_1], [DNI_1]...).
// El "mapa" se queda en NUESTRO servidor, así la IA nunca ve el dato real
// y después podemos restaurarlo si hace falta (principio de minimización RGPD).

const PATRONES = [
  { tipo: "EMAIL", regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { tipo: "IBAN", regex: /\bES\d{2}(?:\s?\d{4}){5}\b/gi },
  { tipo: "DNI", regex: /\b\d{8}[A-HJ-NP-TV-Z]\b/gi },          // DNI: 8 números + letra
  { tipo: "NIE", regex: /\b[XYZ]\d{7}[A-HJ-NP-TV-Z]\b/gi },      // NIE: X/Y/Z + 7 números + letra
  { tipo: "TELEFONO", regex: /(?:\+34\s?)?\b[6789]\d{2}\s?\d{3}\s?\d{3}\b/g },
];

export function anonimizar(texto) {
  const mapa = {};
  const contadores = {};
  let resultado = texto;

  for (const { tipo, regex } of PATRONES) {
    resultado = resultado.replace(regex, (encontrado) => {
      contadores[tipo] = (contadores[tipo] || 0) + 1;
      const marcador = `[${tipo}_${contadores[tipo]}]`;
      mapa[marcador] = encontrado;
      return marcador;
    });
  }

  return { texto: resultado, mapa };
}

export function restaurar(texto, mapa) {
  let resultado = texto;
  for (const [marcador, original] of Object.entries(mapa)) {
    resultado = resultado.split(marcador).join(original);
  }
  return resultado;
}
