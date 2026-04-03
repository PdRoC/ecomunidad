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
type Pesos = Record<string, Record<string, number>>;

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

function peso(pesos: Pesos, a: string, b: string): number {
  return pesos[a]?.[b] ?? pesos[b]?.[a] ?? 0;
}

function costeGrupo(miembros: string[], pesos: Pesos): number {
  let total = 0;
  for (let i = 0; i < miembros.length; i++)
    for (let j = i + 1; j < miembros.length; j++)
      total += peso(pesos, miembros[i], miembros[j]) ** 2;
  return total;
}

function costeIncremental(personaId: string, grupoActual: string[], pesos: Pesos): number {
  return grupoActual.reduce((s, m) => s + peso(pesos, personaId, m) ** 2, 0);
}

function calcularConflictividad(
  personas: Pick<Persona, "id">[],
  pesos: Pesos
): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const { id } of personas) {
    let suma = 0;
    for (const val of Object.values(pesos[id] ?? {})) suma += val ** 2;
    for (const fila of Object.values(pesos)) suma += (fila[id] ?? 0) ** 2;
    mapa[id] = suma;
  }
  return mapa;
}

// ─── Fase 1: construcción GRASP ───────────────────────────────────────────────

function construirSolucion(
  personas: Persona[],
  numGrupos: number,
  pesos: Pesos
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
          costeIncremental(persona.id, grupos[a], pesos) -
          costeIncremental(persona.id, grupos[b], pesos)
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
  pesos: Pesos
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

            const restA = grupos[gA].filter((_, k) => k !== i);
            const restB = grupos[gB].filter((_, k) => k !== j);

            const delta =
              costeIncremental(pB, restA, pesos) +
              costeIncremental(pA, restB, pesos) -
              costeIncremental(pA, restA, pesos) -
              costeIncremental(pB, restB, pesos);

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

  const coef = Object.values(grupos).reduce((s, m) => s + costeGrupo(m, pesos), 0);
  return { distribucion: grupos, coef };
}

// ─── Coeficientes individuales para persistir ─────────────────────────────────

function calcularCoefsPorPersona(
  idComunidad: string,
  tipo: string,
  idGeneracion: number,
  distribucion: Distribucion,
  pesos: Pesos
) {
  const filas = [];
  for (const [grupoStr, miembros] of Object.entries(distribucion)) {
    const idGrupo = Number(grupoStr);
    for (const persona of miembros) {
      const coefs = miembros
        .filter((m) => m !== persona)
        .map((c) => peso(pesos, persona, c));

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

  // ── Pesos en memoria ─────────────────────────────────────────────────────
  const pesos: Pesos = {};
  for (const row of pesosRaw ?? []) {
    if (!pesos[row.id_persona]) pesos[row.id_persona] = {};
    pesos[row.id_persona][row.id_pareja] = row.coef_repeticion ?? 0;
  }

  const mapaConflictividad = calcularConflictividad(personasRaw, pesos);

  const personas: Persona[] = personasRaw.map((p) => ({
    id:             p.id,
    numero:         p.numero,
    conflictividad: mapaConflictividad[p.id] ?? 0,
  }));

  const plazasPorPersona: Record<string, number> = Object.fromEntries(
    personas.map((p) => [p.id, p.numero])
  );

  // ── Generar nuevas opciones ───────────────────────────────────────────────
  const mejores: Opcion[] = [];

  for (let i = 0; i < ITERACIONES; i++) {
    const distribucion = construirSolucion(personas, numGrupos, pesos);
    const solucion = busquedaLocal(distribucion, plazasPorPersona, pesos);
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
        (s, m) => s + costeGrupo(m, pesos), 0
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
    calcularCoefsPorPersona(idComunidad, tipo, ranking + 1, opcion.distribucion, pesos)
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