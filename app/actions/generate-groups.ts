// Ruta: ./app/actions/generate-groups.ts

"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Persona = {
  id: string;
  numero: number;
  conflictividad: number;
};

type Distribucion = Record<number, string[]>;

// MatrizPesos encapsula la estructura de datos optimizada (puntos 1 y 2).
// Internamente usa un Float32Array triangular indexado por enteros,
// pero expone la misma interfaz que antes hacia el resto del código.
type MatrizPesos = {
  // Devuelve el peso entre dos personas por su UUID (igual que la función
  // peso() anterior, pero usando el array plano internamente).
  get(a: string, b: string): number;

  // Coste incremental de añadir `personaId` a un grupo (punto 1):
  // solo suma los pares con la persona nueva, no recalcula los pares internos.
  costeIncremental(personaId: string, grupo: string[]): number;

  // Coste completo de un grupo (necesario al calcular el coef total final).
  costeGrupo(miembros: string[]): number;

  // Conflictividad de cada persona (suma de sus pesos al cuadrado con todos).
  conflictividad(id: string): number;

  // Para calcularCoefsPorPersona: devuelve los pesos individuales con el resto.
  pesosContra(personaId: string, resto: string[]): number[];
};

type Opcion = {
  coef: number;
  distribucion: Distribucion;
};

// ─── Parámetros ───────────────────────────────────────────────────────────────

const ITERACIONES = 150;
const TOP_N       = 3;
const TOLERANCIA  = 2;
const RCL_SIZE    = 2;

// ─── Utilidades ───────────────────────────────────────────────────────────────

function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Punto 2: construcción de la matriz plana ────────────────────────────────
//
// Dado un conjunto de personas con UUIDs, asignamos a cada una un índice
// entero 0..n-1 y almacenamos todos los pesos en un Float32Array triangular.
//
// El array tiene n*(n-1)/2 posiciones. Para i < j, el peso entre las personas
// con índices i y j se guarda en la posición:
//
//   idx = i*n - i*(i+1)/2 + (j - i - 1)
//
// Esto equivale a "coger la fila i de la matriz triangular superior y avanzar
// hasta la columna j". Como solo guardamos la mitad superior, el acceso es
// siempre simétrico: peso(a,b) == peso(b,a).
//
// Ventajas respecto al objeto anidado Record<string, Record<string, number>>:
//   · Un solo lookup de entero en lugar de dos búsquedas de string en hash map.
//   · Memoria contigua → la CPU puede precachear los valores adyacentes.
//   · Float32 en lugar de number (64 bits) → la mitad de memoria por valor.

function construirMatrizPesos(
  personas: Pick<Persona, "id">[],
  pesosRaw: { id_persona: string; id_pareja: string; coef_repeticion: number | null }[]
): MatrizPesos {
  const n = personas.length;

  // Mapa UUID → índice entero (O(1) en los accesos calientes)
  const idx = new Map<string, number>();
  personas.forEach((p, i) => idx.set(p.id, i));

  // Array triangular plano. Inicializado a cero (personas sin historial = 0).
  const mat = new Float32Array(n * (n - 1) / 2);

  // Función de traducción de par (i, j) con i < j a posición en el array.
  function pos(i: number, j: number): number {
    return i * n - Math.trunc(i * (i + 1) / 2) + (j - i - 1);
  }

  // Rellenamos el array con los datos de Supabase.
  for (const row of pesosRaw) {
    const i = idx.get(row.id_persona);
    const j = idx.get(row.id_pareja);
    if (i === undefined || j === undefined) continue;
    const [lo, hi] = i < j ? [i, j] : [j, i];
    mat[pos(lo, hi)] = row.coef_repeticion ?? 0;
  }

  // Función interna de acceso por índice (no por UUID).
  function getByIdx(i: number, j: number): number {
    if (i === j) return 0;
    const [lo, hi] = i < j ? [i, j] : [j, i];
    return mat[pos(lo, hi)];
  }

  return {
    get(a: string, b: string): number {
      const i = idx.get(a);
      const j = idx.get(b);
      if (i === undefined || j === undefined) return 0;
      return getByIdx(i, j);
    },

    // ─── Punto 1: coste incremental con caché ────────────────────────────
    //
    // Al evaluar si añadir `personaId` a un grupo, lo único que cambia en
    // el coste total son los pares que involucran a esa persona.
    // Los pares internos del grupo (P1↔P2, P1↔P3, etc.) NO cambian.
    //
    // Por eso esta función SOLO suma los pesos entre `personaId` y cada
    // miembro actual del grupo, elevados al cuadrado.  Es O(k) donde k
    // es el tamaño del grupo, frente al O(k²) del recálculo completo.
    //
    // En busquedaLocal esto se usa para calcular el delta de un swap:
    //   delta = costeIncremental(pB, restA) + costeIncremental(pA, restB)
    //         - costeIncremental(pA, restA) - costeIncremental(pB, restB)
    // Si delta < 0, el swap mejora la solución. Los pares internos de
    // restA y restB se cancelan en la resta y ni siquiera hay que calcularlos.
    costeIncremental(personaId: string, grupo: string[]): number {
      const pi = idx.get(personaId);
      if (pi === undefined) return 0;
      let total = 0;
      for (const m of grupo) {
        const mi = idx.get(m);
        if (mi === undefined) continue;
        const v = getByIdx(pi, mi);
        total += v * v;
      }
      return total;
    },

    costeGrupo(miembros: string[]): number {
      let total = 0;
      for (let a = 0; a < miembros.length; a++) {
        const ai = idx.get(miembros[a]);
        if (ai === undefined) continue;
        for (let b = a + 1; b < miembros.length; b++) {
          const bi = idx.get(miembros[b]);
          if (bi === undefined) continue;
          const v = getByIdx(ai, bi);
          total += v * v;
        }
      }
      return total;
    },

    conflictividad(id: string): number {
      const pi = idx.get(id);
      if (pi === undefined) return 0;
      let suma = 0;
      for (let j = 0; j < n; j++) {
        if (j === pi) continue;
        const v = getByIdx(pi, j);
        suma += v * v;
      }
      return suma;
    },

    pesosContra(personaId: string, resto: string[]): number[] {
      return resto.map((m) => this.get(personaId, m));
    },
  };
}

// ─── Fase 1: construcción GRASP ───────────────────────────────────────────────

function construirSolucion(
  personas: Persona[],
  numGrupos: number,
  mat: MatrizPesos
): Distribucion {
  const plazas: Record<number, number> = {};
  const grupos: Distribucion           = {};

  for (let g = 1; g <= numGrupos; g++) { plazas[g] = 0; grupos[g] = []; }

  const ordenadas = [...personas].sort(
    (a, b) => b.conflictividad - a.conflictividad + (Math.random() - 0.5) * 2
  );

  for (const persona of ordenadas) {
    const minPlazas = Math.min(...Object.values(plazas));

    const elegibles = Object.keys(plazas)
      .map(Number)
      .filter((g) => plazas[g] + persona.numero <= minPlazas + TOLERANCIA)
      .sort(
        (a, b) =>
          mat.costeIncremental(persona.id, grupos[a]) -
          mat.costeIncremental(persona.id, grupos[b])
      );

    if (!elegibles.length) continue;

    const grupoElegido = sample(elegibles.slice(0, RCL_SIZE));
    plazas[grupoElegido] += persona.numero;
    grupos[grupoElegido].push(persona.id);
  }

  return grupos;
}

// ─── Fase 2: búsqueda local (2-opt swap entre grupos) ────────────────────────

function busquedaLocal(
  distribucion: Distribucion,
  plazasPorPersona: Record<string, number>,
  mat: MatrizPesos
): Opcion {
  const grupos: Distribucion = Object.fromEntries(
    Object.entries(distribucion).map(([g, m]) => [g, [...m]])
  );

  const ids = Object.keys(grupos).map(Number);
  let mejorado = true;

  while (mejorado) {
    mejorado = false;

    for (let ai = 0; ai < ids.length - 1 && !mejorado; ai++) {
      for (let bi = ai + 1; bi < ids.length && !mejorado; bi++) {
        const gA = ids[ai];
        const gB = ids[bi];

        const plazasA = grupos[gA].reduce((s, p) => s + plazasPorPersona[p], 0);
        const plazasB = grupos[gB].reduce((s, p) => s + plazasPorPersona[p], 0);

        for (let i = 0; i < grupos[gA].length && !mejorado; i++) {
          for (let j = 0; j < grupos[gB].length && !mejorado; j++) {
            const pA = grupos[gA][i];
            const pB = grupos[gB][j];

            const newPlazasA = plazasA - plazasPorPersona[pA] + plazasPorPersona[pB];
            const newPlazasB = plazasB - plazasPorPersona[pB] + plazasPorPersona[pA];
            if (Math.abs(newPlazasA - newPlazasB) > TOLERANCIA) continue;

            // Punto 1 aplicado: restA y restB son los grupos sin la persona
            // que sale. El delta solo mide los pares que CAMBIAN (los que
            // involucran a pA o pB). Los pares internos restA↔restA y
            // restB↔restB se cancelan en la resta y no hay que calcularlos.
            const restA = grupos[gA].filter((_, k) => k !== i);
            const restB = grupos[gB].filter((_, k) => k !== j);

            const delta =
              mat.costeIncremental(pB, restA) +
              mat.costeIncremental(pA, restB) -
              mat.costeIncremental(pA, restA) -
              mat.costeIncremental(pB, restB);

            if (delta < 0) {
              grupos[gA][i] = pB;
              grupos[gB][j] = pA;
              mejorado = true;
            }
          }
        }
      }
    }
  }

  const coef = Object.values(grupos).reduce((s, m) => s + mat.costeGrupo(m), 0);
  return { distribucion: grupos, coef };
}

// ─── Coeficientes individuales para persistir ─────────────────────────────────

function calcularCoefsPorPersona(
  idComunidad: string,
  tipo: string,
  idGeneracion: number,
  distribucion: Distribucion,
  mat: MatrizPesos
) {
  const filas = [];
  for (const [grupoStr, miembros] of Object.entries(distribucion)) {
    const idGrupo = Number(grupoStr);
    for (const persona of miembros) {
      const resto = miembros.filter((m) => m !== persona);
      const coefs = mat.pesosContra(persona, resto);

      filas.push({
        id_comunidad:    idComunidad,
        tipo,
        id_generacion:   idGeneracion,
        id_grupo:        idGrupo,
        id_persona:      persona,
        coef_repeticion: coefs.reduce((s, v) => s + v, 0),
        coef_minimo:     coefs.length ? Math.min(...coefs) : null,
        coef_maximo:     coefs.length ? Math.max(...coefs) : null,
      });
    }
  }
  return filas;
}

// ─── Acción principal ──────────────────────────────────────────────────────────

export async function generateGroups(
  idComunidad: string,
  tipo: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  // ── Verificar que el usuario pertenece a esta comunidad ──────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id_comunidad", idComunidad)
    .eq("auth_user_id", user.id)
    .single();

  if (!persona) return { ok: false, error: "Sin permisos para esta comunidad" };

  // ── Queries en paralelo ───────────────────────────────────────────────────
  const [
    { data: personasRaw },
    { data: pesosRaw },
    { data: celebracion },
  ] = await Promise.all([
    supabase
      .from("personas")
      .select("id, numero")
      .eq("id_comunidad", idComunidad)
      .eq("is_disponible", true),
    supabase
      .from("aux_coef_emparejamientos")
      .select("id_persona, id_pareja, coef_repeticion")
      .eq("id_comunidad", idComunidad),
    supabase
      .from("rel_comunidad_celebracion")
      .select("num_grupos")
      .eq("id_comunidad", idComunidad)
      .eq("id_celebracion", tipo)
      .single(),
  ]);

  if (!personasRaw?.length)
    return { ok: false, error: "Sin personas disponibles" };
  if (!celebracion)
    return { ok: false, error: "Celebración no encontrada para esta comunidad" };

  const numGrupos = celebracion.num_grupos;
  if (!numGrupos)
    return { ok: false, error: "Número de grupos no configurado" };

  // ── Punto 2: construir matriz plana una sola vez ──────────────────────────
  // A partir de aquí todo el algoritmo usa `mat` en lugar de `pesos`.
  // La construcción es O(n²) pero ocurre una sola vez antes del bucle.
  const mat = construirMatrizPesos(personasRaw, pesosRaw ?? []);

  const personas: Persona[] = personasRaw.map((p) => ({
    id:             p.id,
    numero:         p.numero,
    conflictividad: mat.conflictividad(p.id),
  }));

  const plazasPorPersona: Record<string, number> = Object.fromEntries(
    personas.map((p) => [p.id, p.numero])
  );

  // ── Generar nuevas opciones ───────────────────────────────────────────────
  const mejores: Opcion[] = [];

  for (let i = 0; i < ITERACIONES; i++) {
    const distribucion = construirSolucion(personas, numGrupos, mat);
    const solucion = busquedaLocal(distribucion, plazasPorPersona, mat);
    mejores.push(solucion);
    mejores.sort((a, b) => a.coef - b.coef);
    if (mejores.length > TOP_N) mejores.pop();
  }

  // ── Fusionar con opciones existentes ─────────────────────────────────────
  const { data: filasExistentes } = await supabase
    .from("rel_persona_grupo_temp")
    .select("id_generacion, id_grupo, id_persona")
    .eq("id_comunidad", idComunidad)
    .eq("tipo", tipo);

  if (filasExistentes?.length) {
    const opcionesExistentes = new Map<number, Distribucion>();
    for (const fila of filasExistentes) {
      if (!opcionesExistentes.has(fila.id_generacion)) {
        opcionesExistentes.set(fila.id_generacion, {});
      }
      const dist = opcionesExistentes.get(fila.id_generacion)!;
      if (!dist[fila.id_grupo]) dist[fila.id_grupo] = [];
      dist[fila.id_grupo].push(fila.id_persona);
    }

    for (const distribucion of opcionesExistentes.values()) {
      const coef = Object.values(distribucion).reduce(
        (s, m) => s + mat.costeGrupo(m), 0
      );
      mejores.push({ coef, distribucion });
    }

    mejores.sort((a, b) => a.coef - b.coef);
    while (mejores.length > TOP_N) mejores.pop();
  }

  // ── Persistir ─────────────────────────────────────────────────────────────
  await supabase
    .from("rel_persona_grupo_temp")
    .delete()
    .eq("id_comunidad", idComunidad)
    .eq("tipo", tipo);

  const filas = mejores.flatMap((opcion, ranking) =>
    calcularCoefsPorPersona(idComunidad, tipo, ranking + 1, opcion.distribucion, mat)
  );

  if (filas.length) {
    const { error: errIns } = await supabase
      .from("rel_persona_grupo_temp")
      .insert(filas);

    if (errIns)
      return { ok: false, error: errIns.message };
  }

  return { ok: true };
}

// ─── Leer opciones guardadas para previsualización ────────────────────────────

export type OpcionPreview = {
  idGeneracion: number;
  coefTotal: number;
  grupos: {
    idGrupo: number;
    personas: { id: string; nombre: string; coef: number }[];
  }[];
};

export async function getGroupPreviews(
  idComunidad: string,
  tipo: string
): Promise<{ ok: boolean; data?: OpcionPreview[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rel_persona_grupo_temp")
    .select(`
      id_generacion,
      id_grupo,
      coef_repeticion,
      personas ( id, nombre )
    `)
    .eq("id_comunidad", idComunidad)
    .eq("tipo", tipo)
    .order("id_generacion")
    .order("id_grupo");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: true, data: [] };

  // Agrupar por generación → grupo
  const mapaGen = new Map<number, Map<number, OpcionPreview["grupos"][0]>>();

  for (const fila of data) {
    if (!mapaGen.has(fila.id_generacion)) mapaGen.set(fila.id_generacion, new Map());
    const mapaGrupo = mapaGen.get(fila.id_generacion)!;

    if (!mapaGrupo.has(fila.id_grupo))
      mapaGrupo.set(fila.id_grupo, { idGrupo: fila.id_grupo, personas: [] });

    const p = fila.personas as unknown as { id: string; nombre: string } | null;
    if (p) {
      mapaGrupo.get(fila.id_grupo)!.personas.push({
        id:     p.id,
        nombre: p.nombre,
        coef:   fila.coef_repeticion ?? 0,
      });
    }
  }

  const opciones: OpcionPreview[] = [];
  for (const [idGeneracion, mapaGrupo] of mapaGen) {
    const grupos = Array.from(mapaGrupo.values()).sort((a, b) => a.idGrupo - b.idGrupo);
    const coefTotal = grupos.reduce(
      (s, g) => s + g.personas.reduce((gs, p) => gs + p.coef, 0),
      0
    );
    opciones.push({ idGeneracion, coefTotal, grupos });
  }

  return { ok: true, data: opciones.sort((a, b) => a.idGeneracion - b.idGeneracion) };
}