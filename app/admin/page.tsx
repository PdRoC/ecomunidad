"use client";

import { useState, useEffect } from "react";
import { generateGroups, getGroupPreviews, type OpcionPreview } from "@/app/actions/generate-groups";
import { createClient } from "@/lib/supabase/client";

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Celebracion = {
  id_celebracion: string;
  nombre: string;
};

// Mapa de repeticiones: "idA|idB" -> número de veces que han coincidido
type RepMap = Record<string, number>;

// ─── Utilidades de color ──────────────────────────────────────────────────────

/**
 * Clave canónica para un par (orden no importa).
 * La tabla puede tener la fila como (A→B) o (B→A); con esto cubrimos ambos.
 */
function parKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [idComunidad, setIdComunidad]       = useState<string | null>(null);
  const [celebraciones, setCelebraciones]   = useState<Celebracion[]>([]);
  const [tipoSeleccionado, setTipoSelec]    = useState<string>("");
  const [generando, setGenerando]           = useState(false);
  const [cargandoPrev, setCargandoPrev]     = useState(false);
  const [opciones, setOpciones]             = useState<OpcionPreview[]>([]);
  const [mensaje, setMensaje]               = useState<{ ok: boolean; texto: string } | null>(null);

  // Datos de emparejamientos
  const [repMap, setRepMap]                 = useState<RepMap>({});
  const [globalMax, setGlobalMax]           = useState<number>(0);
  const [globalMin, setGlobalMin]           = useState<number>(0);

  // ── Cargar comunidad del usuario y sus celebraciones ─────────────────────
  useEffect(() => {
    async function cargar() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: persona } = await supabase
        .from("personas")
        .select("id_comunidad")
        .eq("auth_user_id", user.id)
        .single();

      if (!persona) return;
      setIdComunidad(persona.id_comunidad);

      const { data: rels } = await supabase
        .from("rel_comunidad_celebracion")
        .select("id_celebracion, celebraciones ( id_celebracion, nombre )")
        .eq("id_comunidad", persona.id_comunidad)
        .gt("num_grupos", 0);

      if (rels?.length) {
        const cels = rels.map((r: { id_celebracion: string; celebraciones: unknown }) => {
          const cel = r.celebraciones as unknown as Celebracion;
          return { id_celebracion: cel.id_celebracion, nombre: cel.nombre };
        });
        setCelebraciones(cels);
        setTipoSelec(cels[0].id_celebracion);
      }
    }
    cargar();
  }, []);

  // ── Cargar previsualización al cambiar de tipo ────────────────────────────
  useEffect(() => {
    if (!idComunidad || !tipoSeleccionado) return;
    cargarPrevisualizacion();
  }, [idComunidad, tipoSeleccionado]);

  async function cargarPrevisualizacion() {
    if (!idComunidad || !tipoSeleccionado) return;
    setCargandoPrev(true);

    // Cargar opciones y emparejamientos en paralelo
    const [result] = await Promise.all([
      getGroupPreviews(idComunidad, tipoSeleccionado),
      cargarEmparejamientos(idComunidad),
    ]);

    if (result.ok) setOpciones(result.data ?? []);
    setCargandoPrev(false);
  }

  /**
   * Carga toda la tabla aux_coef_emparejamientos para la comunidad,
   * construye el mapa de repeticiones y calcula el máximo y mínimo globales.
   */
  async function cargarEmparejamientos(comunidad: string) {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("aux_coef_emparejamientos")
      .select("id_persona, id_pareja, coef_repeticion")
      .eq("id_comunidad", comunidad);

    if (error || !data?.length) return;

    const map: RepMap = {};
    let max = -Infinity;
    let min = Infinity;

    for (const row of data) {
      // Usamos clave canónica para que (A,B) y (B,A) apunten al mismo valor
      const key = parKey(row.id_persona, row.id_pareja);
      const coef = row.coef_repeticion ?? 0;
      // Si la tabla tiene ambas direcciones, nos quedamos con el mayor
      if (map[key] === undefined || coef > map[key]) map[key] = coef;
      if (coef > max) max = coef;
      if (coef < min) min = coef;
    }

    setRepMap(map);
    setGlobalMax(max === -Infinity ? 0 : max);
    setGlobalMin(min === Infinity  ? 0 : min);
  }

  /**
   * Para una persona dentro de un grupo, devuelve la clase de color
   * según el coef con cada compañero individualmente, con prioridad:
   *   rojo > azul > amarillo > verde
   *
   *  - Algún par alcanza el máximo global       → rojo
   *  - Algún par está en el mínimo global        → azul
   *  - Algún par está en máximo − 1              → amarillo
   *  - Resto                                     → verde
   */
  function colorPersonaEnGrupo(
    idPersona: string,
    compañeros: { id: string }[],
  ): string {
    let tieneRojo     = false;
    let tieneAzul     = false;
    let tieneAmarillo = false;

    for (const c of compañeros) {
      if (c.id === idPersona) continue;
      const coef = repMap[parKey(idPersona, c.id)] ?? 0;

      if (coef >= globalMax)           tieneRojo     = true;
      else if (coef <= globalMin)      tieneAzul     = true;
      else if (coef === globalMax - 1) tieneAmarillo = true;
    }

    if (tieneRojo)     return "bg-red-100 text-red-700 ring-1 ring-red-300";
    if (tieneAzul)     return "bg-blue-100 text-blue-700 ring-1 ring-blue-300";
    if (tieneAmarillo) return "bg-amber-100 text-amber-700 ring-1 ring-amber-300";
    return "bg-green-100 text-green-700 ring-1 ring-green-300";
  }

  // ── Generar grupos ────────────────────────────────────────────────────────
  async function handleGenerar() {
    if (!idComunidad || !tipoSeleccionado) return;
    setGenerando(true);
    setMensaje(null);

    const result = await generateGroups(idComunidad, tipoSeleccionado);

    if (result.ok) {
      setMensaje({ ok: true, texto: "Grupos generados correctamente." });
      await cargarPrevisualizacion();
    } else {
      setMensaje({ ok: false, texto: result.error ?? "Error desconocido." });
    }
    setGenerando(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Cabecera */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Generación de grupos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Selecciona el tipo de celebración y genera las propuestas de distribución.
          </p>
        </div>

        {/* Selector de celebración + botón */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Tipo de celebración
            </label>
            <select
              value={tipoSeleccionado}
              onChange={(e) => setTipoSelec(e.target.value)}
              disabled={generando}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {celebraciones.map((c) => (
                <option key={c.id_celebracion} value={c.id_celebracion}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerar}
            disabled={generando || !tipoSeleccionado}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generando ? "Generando…" : "Generar grupos"}
          </button>
        </div>

        {/* Leyenda de colores */}
        {opciones.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-red-100 text-red-700 ring-1 ring-red-300 font-semibold">
              Máxima repetición
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-amber-100 text-amber-700 ring-1 ring-amber-300 font-semibold">
              Repetición alta (máx − 1)
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-green-100 text-green-700 ring-1 ring-green-300 font-semibold">
              Repetición normal
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-blue-100 text-blue-700 ring-1 ring-blue-300 font-semibold">
              Mínima repetición
            </span>
          </div>
        )}

        {/* Mensaje de resultado */}
        {mensaje && (
          <div
            className={`rounded-md px-4 py-3 text-sm ${
              mensaje.ok
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {/* Previsualización */}
        {cargandoPrev && (
          <p className="text-sm text-gray-400">Cargando propuestas…</p>
        )}

        {!cargandoPrev && opciones.length > 0 && (
          <div className="space-y-6">
            {opciones.map((opcion) => (
              <div
                key={opcion.idGeneracion}
                className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Cabecera de la opción */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">
                    Opción {opcion.idGeneracion}
                  </span>
                  <span className="text-xs text-gray-400">
                    Coef. total: {opcion.coefTotal}
                  </span>
                </div>

                {/* Grupos en columnas */}
                <div
                  className="grid gap-4 p-4"
                  style={{
                    gridTemplateColumns: `repeat(${opcion.grupos.length}, minmax(0, 1fr))`,
                  }}
                >
                  {opcion.grupos.map((grupo) => (
                    <div key={grupo.idGrupo}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                        Grupo {grupo.idGrupo}
                      </p>
                      <ul className="space-y-1">
                        {grupo.personas.map((p) => {
                          const claseColor = colorPersonaEnGrupo(p.id, grupo.personas);
                          return (
                            <li
                              key={p.id}
                              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                            >
                              <span className="text-gray-800">{p.nombre}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ml-2 ${claseColor}`}>
                                {p.coef}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!cargandoPrev && opciones.length === 0 && !generando && tipoSeleccionado && (
          <p className="text-sm text-gray-400">
            No hay propuestas guardadas para esta celebración. Pulsa «Generar grupos» para crearlas.
          </p>
        )}

      </div>
    </main>
  );
}