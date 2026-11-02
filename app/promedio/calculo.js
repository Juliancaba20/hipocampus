// Reglas del cálculo de promedio (sin interfaz, para poder probarlas por separado).
//
// 1. Cuentan TODAS las notas cargadas, aprobadas o no (menos de 4 también): cada nota es un dato del promedio.
// 2. Una materia sin ninguna nota válida se considera no finalizada y no entra en el cálculo.
// 3. En una materia promocionada solo cuenta un dato: el promedio de los parciales, que es su nota final.
// 4. Los bloques opcionales (CBC, inglés) solo cuentan si la persona los activó.

export const NOTA_APROBACION = 4;

// Interpreta lo que escribió la persona. Acepta coma o punto decimal y valores de 0 a 10.
// Devuelve { vacia: true } si no escribió nada, { error: true } si no es válido, o { n } con el número.
export function leerNota(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return { vacia: true };
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: true };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 10) return { error: true };
  return { n };
}

// Normaliza lo guardado de una materia (por si el almacenamiento del navegador trae algo inesperado).
export function leerEntrada(e) {
  const notas = Array.isArray(e?.notas) && e.notas.length ? e.notas.map((x) => String(x ?? '')) : [''];
  return { prom: e?.prom === true, notas };
}

export function promedioDe(lista) {
  return lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null;
}

export function formatear(n) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// carrera: objeto de carreras.js · propias: materias agregadas por la persona · guardadas: { [idMateria]: entrada }
// incluir: { [idBloque]: true } con los bloques opcionales activados.
export function calcular(carrera, propias, guardadas, incluir) {
  const bloques = carrera.bloques
    .filter((b) => !b.opcional || incluir?.[b.id] === true)
    .map((bloque) => {
      const materias = [...bloque.materias, ...propias.filter((p) => p.bloque === bloque.id)];
      const notas = [];
      let conNota = 0;
      for (const m of materias) {
        const e = leerEntrada(guardadas?.[m.id]);
        const usadas = e.prom ? e.notas.slice(0, 1) : e.notas;
        let tiene = false;
        for (const t of usadas) {
          const r = leerNota(t);
          if (r.n !== undefined) {
            notas.push(r.n);
            tiene = true;
          }
        }
        if (tiene) conNota += 1;
      }
      return { bloque, materias, notas, conNota, promedio: promedioDe(notas) };
    });
  const todas = bloques.flatMap((b) => b.notas);
  return {
    bloques,
    promedio: promedioDe(todas),
    cantidadNotas: todas.length,
    aplazos: todas.filter((n) => n < NOTA_APROBACION).length,
    materiasConNota: bloques.reduce((a, b) => a + b.conNota, 0),
  };
}
