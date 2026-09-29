import { test } from "node:test";
import assert from "node:assert/strict";
import { anonimizar, restaurar } from "../src/anonimizar.js";
import { validarClasificacion, extraerJSON } from "../src/validar.js";

test("sustituye email, DNI y teléfono por marcadores", () => {
  const { texto, mapa } = anonimizar(
    "Soy Ana, mi email es ana.lopez@gmail.com, DNI 12345678Z y móvil 612 345 678"
  );
  assert.ok(!texto.includes("ana.lopez@gmail.com"));
  assert.ok(!texto.includes("12345678Z"));
  assert.ok(!texto.includes("612 345 678"));
  assert.ok(texto.includes("[EMAIL_1]") && texto.includes("[DNI_1]") && texto.includes("[TELEFONO_1]"));
  assert.equal(Object.keys(mapa).length, 3);
});

test("restaurar devuelve el texto original", () => {
  const original = "Escribid a pepe@empresa.es o al 952 123 456";
  const { texto, mapa } = anonimizar(original);
  assert.equal(restaurar(texto, mapa), original);
});

test("extrae JSON aunque venga envuelto en texto", () => {
  const obj = extraerJSON('Aquí tienes:\n```json\n{"categoria":"rgpd"}\n```');
  assert.equal(obj.categoria, "rgpd");
});

test("rechaza una clasificación con categoría inventada", () => {
  const { valido } = validarClasificacion({
    categoria: "marketing", urgencia: "alta", resumen: "x", requiere_humano: false,
  });
  assert.equal(valido, false);
});

test("acepta una clasificación correcta", () => {
  const { valido } = validarClasificacion({
    categoria: "rgpd", urgencia: "baja", resumen: "Consulta sobre cookies", requiere_humano: false,
  });
  assert.equal(valido, true);
});
