"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ─────────────────────────────────────────────────────────────────────
type PersonaGrupo = {
  id_grupo: number;
  personas: string[];
};

type GruposPorTipo = {
  [tipo: string]: PersonaGrupo[];
};

type DebugInfo = {
  tipo: string;
  ultimaGen: number | null;
  rowsRel: number;
  rowsPersonas: number;
  error?: string;
}[];

// ─── Hook principal ────────────────────────────────────────────────────────────
function useUltimosGrupos(idComunidad: string | null) {
  const [grupos, setGrupos] = useState<GruposPorTipo>({});
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>([]);

  useEffect(() => {
    if (!idComunidad) {
      setLoading(false);
      return;
    }

    async function fetchGrupos() {
      setLoading(true);
      const resultado: GruposPorTipo = {};
      const debug: DebugInfo = [];

      const tipos = ["peticion", "salmo", "eucaristia"];

      for (const tipo of tipos) {
        const info: DebugInfo[0] = {
          tipo,
          ultimaGen: null,
          rowsRel: 0,
          rowsPersonas: 0,
        };

        try {
          // ── 1. Última generación ──────────────────────────────────────────
          const { data: genData, error: genErr } = await supabase
            .from("grupos")
            .select("id_generacion")
            .eq("tipo", tipo)
            .eq("id_comunidad", idComunidad)
            .order("id_generacion", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (genErr) {
            info.error = `gen: ${genErr.message}`;
            debug.push(info);
            continue;
          }
          if (!genData) {
            info.error = "sin generaciones para este tipo";
            debug.push(info);
            continue;
          }

          info.ultimaGen = genData.id_generacion;

          // ── 2. Filas de rel_persona_grupo ─────────────────────────────────
          const { data: relData, error: relErr } = await supabase
            .from("rel_persona_grupo")
            .select("id_grupo, id_persona")
            .eq("tipo", tipo)
            .eq("id_generacion", genData.id_generacion)
            .eq("id_comunidad", idComunidad)
            .order("id_grupo");

          if (relErr) {
            info.error = `rel: ${relErr.message}`;
            debug.push(info);
            continue;
          }
          if (!relData || relData.length === 0) {
            info.error = "rel_persona_grupo vacío para esta generación";
            debug.push(info);
            continue;
          }

          info.rowsRel = relData.length;

          // ── 3. Buscar nombres de personas ─────────────────────────────────
          const ids = [...new Set(relData.map((r) => r.id_persona).filter(Boolean))];

          const { data: personasData, error: persErr } = await supabase
            .from("personas")
            .select("id, nombre")
            .in("id", ids);

          if (persErr) {
            info.error = `personas: ${persErr.message}`;
            debug.push(info);
            continue;
          }

          info.rowsPersonas = personasData?.length ?? 0;

          const personasMap = new Map(
            (personasData ?? []).map((p) => [p.id, p.nombre])
          );

          // ── 4. Agrupar por id_grupo ───────────────────────────────────────
          const agrupado: { [key: number]: PersonaGrupo } = {};
          for (const row of relData) {
            if (!agrupado[row.id_grupo]) {
              agrupado[row.id_grupo] = { id_grupo: row.id_grupo, personas: [] };
            }
            const nombre = personasMap.get(row.id_persona);
            if (nombre) agrupado[row.id_grupo].personas.push(nombre);
          }

          resultado[tipo] = Object.values(agrupado).sort(
            (a, b) => a.id_grupo - b.id_grupo
          );
        } catch (e: any) {
          info.error = String(e?.message ?? e);
        }

        debug.push(info);
      }

      setGrupos(resultado);
      setDebugInfo(debug);
      setLoading(false);
    }

    fetchGrupos();
  }, [idComunidad]);

  return { grupos, loading, debugInfo };
}

// ─── Utilidad: copiar ──────────────────────────────────────────────────────────
function buildTextoPlano(tipo: string, grupos: PersonaGrupo[]): string {
  const label = tipo === "Eucaristia" ? "Eucaristía" : tipo;
  let texto = `*Grupos ${label}*\n`;
  for (const g of grupos) {
    texto += `\n*Grupo ${g.id_grupo}*\n`;
    for (const nombre of g.personas) texto += `${nombre}\n`;
  }
  return texto;
}

// ─── Tarjeta ───────────────────────────────────────────────────────────────────
function TarjetaGrupos({
  tipo, label, grupos, icono, color,
}: {
  tipo: string; label: string; grupos: PersonaGrupo[]; icono: string; color: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(buildTextoPlano(tipo, grupos)).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <div className="card">
      <div className="card-header" style={{ borderLeft: `4px solid ${color}` }}>
        <span className="card-icon">{icono}</span>
        <h3 className="card-title">{label}</h3>
      </div>
      <div className="card-body">
        {grupos.length === 0 ? (
          <p className="empty-msg">No hay grupos disponibles</p>
        ) : (
          grupos.map((g) => (
            <div key={g.id_grupo} className="grupo">
              <div className="grupo-header" style={{ color }}>
                Grupo {g.id_grupo}
              </div>
              <table className="grupo-table">
                <tbody>
                  {g.personas.map((nombre, i) => (
                    <tr key={i}>
                      <td>{nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
      <div className="card-footer">
        <button
          onClick={copiar}
          className={`btn-copiar ${copiado ? "copiado" : ""}`}
          style={{ backgroundColor: copiado ? "#4caf50" : color }}
        >
          {copiado ? "✓ Copiado" : "Copiar al portapapeles"}
        </button>
      </div>
    </div>
  );
}

// ─── Panel de depuración ───────────────────────────────────────────────────────
function DebugPanel({
  idComunidad,
  debugInfo,
}: {
  idComunidad: string | null;
  debugInfo: DebugInfo;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => setOpen(!open)}>
        🔍 Panel de depuración (eliminar cuando funcione) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="debug-body">
          <p>
            <strong>SUPABASE_URL:</strong>{" "}
            {process.env.NEXT_PUBLIC_SUPABASE_URL
              ? `✅ ${process.env.NEXT_PUBLIC_SUPABASE_URL}`
              : "❌ NO definida"}
          </p>
          <p>
            <strong>ANON_KEY:</strong>{" "}
            {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
              ? "✅ definida"
              : "❌ NO definida"}
          </p>
          <p>
            <strong>id_comunidad:</strong>{" "}
            {idComunidad ?? (
              <span className="debug-error">
                ❌ null — añade NEXT_PUBLIC_DEFAULT_COMUNIDAD en .env.local
              </span>
            )}
          </p>
          <hr />
          {debugInfo.length === 0 && <p>Sin datos aún...</p>}
          {debugInfo.map((d) => (
            <div key={d.tipo} className="debug-row">
              <strong>{d.tipo}</strong>
              {" · última gen: "}
              {d.ultimaGen ?? "—"}
              {" · filas rel: "}
              {d.rowsRel}
              {" · personas encontradas: "}
              {d.rowsPersonas}
              {d.error && (
                <span className="debug-error"> ⚠️ {d.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────
export default function IndexPage() {
  // TODO: reemplazar por el id_comunidad del usuario autenticado
  const idComunidad = process.env.NEXT_PUBLIC_DEFAULT_COMUNIDAD ?? null;
  const { grupos, loading, debugInfo } = useUltimosGrupos(idComunidad);

  const tarjetas = [
    { tipo: "peticion",   label: "Petición",  icono: "🙏", color: "#8B6914" },
    { tipo: "salmo",      label: "Salmo",      icono: "📖", color: "#5C4A1E" },
    { tipo: "eucaristia", label: "Eucaristía", icono: "✝️", color: "#A0522D" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Lato', sans-serif; background: #f5f0e8; color: #2c2416; min-height: 100vh; }

        .page-wrapper { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

        .page-header { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #d4c9a8; position: relative; }
        .page-header::after { content: '✦'; position: absolute; bottom: -0.65rem; left: 50%; transform: translateX(-50%); background: #f5f0e8; padding: 0 0.5rem; color: #8B6914; }
        .page-header h1 { font-family: 'Playfair Display', serif; font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 700; color: #3a2c14; }
        .page-header p { margin-top: 0.4rem; font-size: 0.9rem; color: #7a6840; font-weight: 300; letter-spacing: 0.06em; text-transform: uppercase; }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }

        .card { background: #fffdf7; border: 1px solid #e0d8c0; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 12px rgba(60,40,10,0.06); transition: box-shadow 0.2s; }
        .card:hover { box-shadow: 0 6px 24px rgba(60,40,10,0.12); }
        .card-header { padding: 1rem 1.25rem; background: #faf6ec; border-bottom: 1px solid #e8e0c8; display: flex; align-items: center; gap: 0.6rem; }
        .card-icon { font-size: 1.2rem; }
        .card-title { font-family: 'Playfair Display', serif; font-size: 1.15rem; font-weight: 600; color: #3a2c14; }
        .card-body { padding: 1.25rem; flex: 1; overflow-y: auto; max-height: 420px; }
        .card-footer { padding: 0.85rem 1.25rem; background: #faf6ec; border-top: 1px solid #e8e0c8; display: flex; justify-content: flex-end; }

        .grupo { margin-bottom: 1.1rem; }
        .grupo-header { font-family: 'Playfair Display', serif; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem; }
        .grupo-table { width: 100%; border-collapse: collapse; }
        .grupo-table td { padding: 0.35rem 0.6rem; font-size: 0.92rem; color: #3a2c14; border-bottom: 1px solid #ede5cc; }
        .grupo-table tr:last-child td { border-bottom: none; }
        .grupo-table tr:hover td { background: #f5eedc; }
        .empty-msg { font-size: 0.88rem; color: #9a8860; font-style: italic; text-align: center; padding: 1rem 0; }

        .btn-copiar { color: #fff; border: none; padding: 0.45rem 1.1rem; border-radius: 5px; font-family: 'Lato', sans-serif; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s, background-color 0.3s; }
        .btn-copiar:hover { opacity: 0.88; }

        .status-center { text-align: center; padding: 4rem 1rem; color: #7a6840; }
        .spinner { display: inline-block; width: 2rem; height: 2rem; border: 3px solid #d4c9a8; border-top-color: #8B6914; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 0.8rem; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .debug-panel { margin-bottom: 1.5rem; background: #1e1e1e; color: #d4d4d4; border-radius: 8px; font-family: monospace; font-size: 0.82rem; overflow: hidden; }
        .debug-toggle { width: 100%; background: #2d2d2d; color: #ccc; border: none; padding: 0.6rem 1rem; text-align: left; cursor: pointer; font-family: monospace; font-size: 0.82rem; }
        .debug-body { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .debug-body hr { border-color: #444; margin: 0.3rem 0; }
        .debug-row { color: #9cdcfe; }
        .debug-error { color: #f48771; }

        @media (max-width: 640px) { .page-wrapper { padding: 1.2rem 1rem 3rem; } .cards-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="page-wrapper">
        <header className="page-header">
          <h1>Últimos grupos disponibles</h1>
          <p>Grupos de celebración · Última generación</p>
        </header>

        {/* Elimina este componente cuando todo funcione correctamente */}
        <DebugPanel idComunidad={idComunidad} debugInfo={debugInfo} />

        {loading ? (
          <div className="status-center">
            <div className="spinner" />
            <p>Cargando grupos...</p>
          </div>
        ) : (
          <div className="cards-grid">
            {tarjetas.map(({ tipo, label, icono, color }) => (
              <TarjetaGrupos
                key={tipo}
                tipo={tipo}
                label={label}
                grupos={grupos[tipo] ?? []}
                icono={icono}
                color={color}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}