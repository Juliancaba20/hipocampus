// Reglas del cálculo de promedio (sin interfaz, para poder probarlas por separado).
//
// 1. Cada materia lleva la NOTA FINAL que le quedó a la persona (número entero del 0 al 10). Si rindió el final
//    varias veces, cada nota se carga por separado. Quien promocionó carga directamente la nota que le quedó.
// 2. Cuentan TODAS las notas cargadas, aprobadas o no (menos de 4 también): cada nota es un dato del promedio.
// 3. Una materia sin ninguna nota válida se considera no finalizada y no entra en el cálculo.
// 4. Los bloques opcionales (CBC, inglés) solo cuentan si la persona los activó.
// 5. Redondeo: solo el PROMEDIO GENERAL se redondea de forma normal (a dos decimales). El promedio de cada bloque
//    (año, ciclo) se muestra truncado a dos decimales: nunca se redondea hacia arriba.

export const NOTA_APROBACION = 4;

// Interpreta lo que escribió la persona. Solo acepta enteros de 0 a 10 (las notas finales no llevan decimales).
// Devuelve { vacia: true } si no escribió nada, { error: true } si no es válido, o { n } con el número.
export function leerNota(texto) {
  const t = String(texto ?? '').trim();
  if (t === '') return { vacia: true };
  if (!/^\d{1,2}$/.test(t)) return { error: true };
  const n = Number(t);
  if (n > 10) return { error: true };
  return { n };
}

// Normaliza lo guardado de una materia (por si el almacenamiento del navegador trae algo inesperado).
export function leerEntrada(e) {
  const notas = Array.isArray(e?.notas) && e.notas.length ? e.notas.map((x) => String(x ?? '')) : [''];
  return { notas };
}

// Promedio exacto (para el general, que se redondea al mostrarlo).
export function promedioDe(lista) {
  return lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null;
}

// Promedio truncado a dos decimales (para los bloques): como las notas son enteras, la cuenta se hace
// con enteros y el resultado nunca queda por encima del valor real.
export function promedioTruncado(lista) {
  if (!lista.length) return null;
  const suma = lista.reduce((a, b) => a + b, 0);
  return Math.floor((suma * 100) / lista.length) / 100;
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
        let tiene = false;
        for (const t of e.notas) {
          const r = leerNota(t);
          if (r.n !== undefined) {
            notas.push(r.n);
            tiene = true;
          }
        }
        if (tiene) conNota += 1;
      }
      return { bloque, materias, notas, conNota, promedio: promedioTruncado(notas) };
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
