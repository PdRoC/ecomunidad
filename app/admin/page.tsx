"use client";

import { useState, useEffect } from "react";
import { generateGroups, getGroupPreviews, type OpcionPreview } from "@/app/actions/generate-groups";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Celebracion = { id_celebracion: string; nombre: string };
type RepMap = Record<string, number>;

// ─── Utilidades ───────────────────────────────────────────────────────────────
function parKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminPage() {
  const [idComunidad, setIdComunidad]     = useState<string | null>(null);
  const [celebraciones, setCelebraciones] = useState<Celebracion[]>([]);
  const [tipoSeleccionado, setTipoSelec]  = useState<string>("");
  const [generando, setGenerando]         = useState(false);
  const [cargandoPrev, setCargandoPrev]   = useState(false);
  const [opciones, setOpciones]           = useState<OpcionPreview[]>([]);
  const [mensaje, setMensaje]             = useState<{ ok: boolean; texto: string } | null>(null);
  const [repMap, setRepMap]               = useState<RepMap>({});
  const [globalMax, setGlobalMax]         = useState(0);
  const [globalMin, setGlobalMin]         = useState(0);

  // ── Cargar comunidad y celebraciones ──────────────────────────────────────
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

  useEffect(() => {
    if (!idComunidad || !tipoSeleccionado) return;
    cargarPrevisualizacion();
  }, [idComunidad, tipoSeleccionado]);

  async function cargarPrevisualizacion() {
    if (!idComunidad || !tipoSeleccionado) return;
    setCargandoPrev(true);
    const [result] = await Promise.all([
      getGroupPreviews(idComunidad, tipoSeleccionado),
      cargarEmparejamientos(idComunidad),
    ]);
    if (result.ok) setOpciones(result.data ?? []);
    setCargandoPrev(false);
  }

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
      const key = parKey(row.id_persona, row.id_pareja);
      const coef = row.coef_repeticion ?? 0;
      if (map[key] === undefined || coef > map[key]) map[key] = coef;
      if (coef > max) max = coef;
      if (coef < min) min = coef;
    }

    setRepMap(map);
    setGlobalMax(max === -Infinity ? 0 : max);
    setGlobalMin(min === Infinity  ? 0 : min);
  }

  function colorPersonaEnGrupo(idPersona: string, compañeros: { id: string }[]): string {
    let tieneRojo = false, tieneAzul = false, tieneAmarillo = false;

    for (const c of compañeros) {
      if (c.id === idPersona) continue;
      const coef = repMap[parKey(idPersona, c.id)] ?? 0;
      if      (coef >= globalMax)           tieneRojo     = true;
      else if (coef <= globalMin)           tieneAzul     = true;
      else if (coef === globalMax - 1)      tieneAmarillo = true;
    }

    if (tieneRojo)     return styles.badgeRojo;
    if (tieneAzul)     return styles.badgeAzul;
    if (tieneAmarillo) return styles.badgeAmarillo;
    return styles.badgeVerde;
  }

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
    <main className={styles.pageWrapper}>
      <div className={styles.inner}>

        {/* Cabecera */}
        <header className="page-header">
          <h1>Generación de grupos</h1>
          <p>Selecciona el tipo de celebración y genera las propuestas de distribución</p>
        </header>

        {/* Selector + botón */}
        <div className={styles.controls}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tipo de celebración</label>
            <select
              value={tipoSeleccionado}
              onChange={(e) => setTipoSelec(e.target.value)}
              disabled={generando}
              className={styles.select}
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
            className={styles.btnGenerar}
          >
            {generando ? "Generando…" : "Generar grupos"}
          </button>
        </div>

        {/* Leyenda */}
        {opciones.length > 0 && (
          <div className={styles.leyenda}>
            <span className={`${styles.badge} ${styles.badgeRojo}`}>Máxima repetición</span>
            <span className={`${styles.badge} ${styles.badgeAmarillo}`}>Repetición alta (máx − 1)</span>
            <span className={`${styles.badge} ${styles.badgeVerde}`}>Repetición normal</span>
            <span className={`${styles.badge} ${styles.badgeAzul}`}>Mínima repetición</span>
          </div>
        )}

        {/* Mensaje */}
        {mensaje && (
          <div className={mensaje.ok ? styles.mensajeOk : styles.mensajeErr}>
            {mensaje.texto}
          </div>
        )}

        {/* Loading */}
        {cargandoPrev && (
          <p className={styles.cargando}>Cargando propuestas…</p>
        )}

        {/* Opciones */}
        {!cargandoPrev && opciones.length > 0 && (
          <div className={styles.opcionesList}>
            {opciones.map((opcion) => (
              <div key={opcion.idGeneracion} className={styles.opcionCard}>
                <div className={styles.opcionHeader}>
                  <span className={styles.opcionTitle}>Opción {opcion.idGeneracion}</span>
                  <span className={styles.opcionCoef}>Coef. total: {opcion.coefTotal}</span>
                </div>
                <div className={styles.gruposScroll}>
                  <div
                    className={styles.gruposRow}
                    style={{ minWidth: `${opcion.grupos.length * 160}px` }}
                  >
                    {opcion.grupos.map((grupo) => (
                      <div key={grupo.idGrupo} className={styles.grupoCol}>
                        <p className={styles.grupoLabel}>Grupo {grupo.idGrupo}</p>
                        <ul className={styles.personasList}>
                          {grupo.personas.map((p) => (
                            <li key={p.id} className={styles.personaItem}>
                              <span className={styles.personaNombre}>{p.nombre}</span>
                              <span className={`${styles.coefBadge} ${colorPersonaEnGrupo(p.id, grupo.personas)}`}>
                                {p.coef}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!cargandoPrev && opciones.length === 0 && !generando && tipoSeleccionado && (
          <p className="empty-msg">
            No hay propuestas guardadas para esta celebración. Pulsa «Generar grupos» para crearlas.
          </p>
        )}

      </div>
    </main>
  );
}