// Ruta: ./app/page.tsx

"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

// ─── Types ─────────────────────────────────────────────────────────────────────
type PersonaGrupo = {
  id_grupo: number;
  personas: string[];
};

type GruposPorTipo = {
  [tipo: string]: PersonaGrupo[];
};

type RelPersonaGrupo = { id_grupo: number; id_persona: string | null };
type PersonaData = { id: string; nombre: string };

// ─── Hook: obtener id_comunidad del usuario autenticado ────────────────────────
function useIdComunidad() {
  const [idComunidad, setIdComunidad] = useState<string | null>(null);
  const [loadingComunidad, setLoadingComunidad] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchComunidad(userId: string) {
      try {
        const { data, error } = await supabase
          .from("personas")
          .select("id_comunidad")
          .eq("auth_user_id", userId)
          .maybeSingle();
        setIdComunidad(data?.id_comunidad ?? null);
      } catch (e) {
        console.error("Error:", e);
        setIdComunidad(null);
      } finally {
        setLoadingComunidad(false);
      }
    }

    // ✅ Leer sesión existente al montar
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const session = data.session;
      if (session?.user) {
        fetchComunidad(session.user.id);
      } else {
        setIdComunidad(null);
        setLoadingComunidad(false);
      }
    });

    // ✅ Escuchar cambios futuros (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (_event === "INITIAL_SESSION") return; // ya lo manejó getSession
        if (session?.user) {
          fetchComunidad(session.user.id);
        } else {
          setIdComunidad(null);
          setLoadingComunidad(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { idComunidad, loadingComunidad };
}

// ─── Hook: cargar grupos ───────────────────────────────────────────────────────
function useUltimosGrupos(idComunidad: string | null) {
  const [grupos, setGrupos] = useState<GruposPorTipo>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idComunidad) { setLoading(false); return; }

    const supabase = getSupabaseBrowserClient();

    async function fetchGrupos() {
      setLoading(true);

      const { data, error } = await supabase
        .from("vista_ultimos_grupos")
        .select("tipo, id_grupo, nombre")
        .eq("id_comunidad", idComunidad)
        .order("id_grupo");

      if (error || !data) { setLoading(false); return; }

      // Agrupar en memoria
      const resultado: GruposPorTipo = {};

      for (const row of data) {
        if (!resultado[row.tipo]) resultado[row.tipo] = [];
        const tipoArr = resultado[row.tipo];
        let grupo = tipoArr.find(g => g.id_grupo === row.id_grupo);
        if (!grupo) {
          grupo = { id_grupo: row.id_grupo, personas: [] };
          tipoArr.push(grupo);
        }
        if (row.nombre) grupo.personas.push(row.nombre);
      }

      setGrupos(resultado);
      setLoading(false);
    }

    fetchGrupos();
  }, [idComunidad]);

  return { grupos, loading };
}

// ─── Utilidad: copiar ──────────────────────────────────────────────────────────
function buildTextoPlano(label: string, grupos: PersonaGrupo[]): string {
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
    navigator.clipboard.writeText(buildTextoPlano(label, grupos)).then(() => {
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
              <div className="grupo-header" style={{ color }}>Grupo {g.id_grupo}</div>
              <table className="grupo-table">
                <tbody>
                  {g.personas.map((nombre, i) => (
                    <tr key={i}><td>{nombre}</td></tr>
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

// ─── Página ────────────────────────────────────────────────────────────────────
export default function IndexPage() {
  const { idComunidad, loadingComunidad } = useIdComunidad();
  const { grupos, loading } = useUltimosGrupos(idComunidad);

  const tarjetas = [
    { tipo: "peticion",   label: "Petición",   icono: "🙏", color: "#8B6914" },
    { tipo: "salmo",      label: "Salmo",       icono: "📖", color: "#5C4A1E" },
    { tipo: "eucaristia", label: "Eucaristía",  icono: "✝️", color: "#A0522D" },
  ];

  const isLoading = loadingComunidad || loading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Lato', sans-serif; background: #f5f0e8; color: #2c2416; min-height: 100vh; }

        .page-wrapper {
          width: 100%;
          padding: 2rem 2rem 4rem;
        }

        .page-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #d4c9a8;
          position: relative;
        }
        .page-header::after {
          content: '✦';
          position: absolute;
          bottom: -0.65rem; left: 50%;
          transform: translateX(-50%);
          background: #f5f0e8;
          padding: 0 0.5rem;
          color: #8B6914;
        }
        .page-header h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.5rem, 3vw, 2.2rem);
          font-weight: 700;
          color: #3a2c14;
        }
        .page-header p {
          margin-top: 0.4rem;
          font-size: 0.9rem;
          color: #7a6840;
          font-weight: 300;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 900px) {
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 560px) {
          .page-wrapper { padding: 1.2rem 1rem 3rem; }
          .cards-grid { grid-template-columns: 1fr; }
        }

        .card {
          background: #fffdf7;
          border: 1px solid #e0d8c0;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 12px rgba(60,40,10,0.06);
          transition: box-shadow 0.2s;
        }
        .card:hover { box-shadow: 0 6px 24px rgba(60,40,10,0.13); }

        .card-header {
          padding: 1rem 1.25rem;
          background: #faf6ec;
          border-bottom: 1px solid #e8e0c8;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .card-icon { font-size: 1.2rem; }
        .card-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.15rem;
          font-weight: 600;
          color: #3a2c14;
        }

        .card-body {
          padding: 1.25rem;
          flex: 1;
          overflow-y: auto;
          max-height: 60vh;
        }

        .card-footer {
          padding: 0.85rem 1.25rem;
          background: #faf6ec;
          border-top: 1px solid #e8e0c8;
          display: flex;
          justify-content: flex-end;
        }

        .grupo { margin-bottom: 1.1rem; }
        .grupo-header {
          font-family: 'Playfair Display', serif;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.3rem;
        }
        .grupo-table { width: 100%; border-collapse: collapse; }
        .grupo-table td {
          padding: 0.35rem 0.6rem;
          font-size: 0.92rem;
          color: #3a2c14;
          border-bottom: 1px solid #ede5cc;
        }
        .grupo-table tr:last-child td { border-bottom: none; }
        .grupo-table tr:hover td { background: #f5eedc; }

        .empty-msg {
          font-size: 0.88rem;
          color: #9a8860;
          font-style: italic;
          text-align: center;
          padding: 1rem 0;
        }

        .no-comunidad {
          text-align: center;
          padding: 4rem 1rem;
          color: #7a6840;
          font-size: 0.95rem;
          line-height: 1.7;
        }
        .no-comunidad strong {
          display: block;
          font-family: 'Playfair Display', serif;
          font-size: 1.1rem;
          color: #3a2c14;
          margin-bottom: 0.4rem;
        }

        .btn-copiar {
          color: #fff;
          border: none;
          padding: 0.45rem 1.1rem;
          border-radius: 5px;
          font-family: 'Lato', sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, background-color 0.3s;
        }
        .btn-copiar:hover { opacity: 0.88; }

        .status-center { text-align: center; padding: 4rem 1rem; color: #7a6840; }
        .spinner {
          display: inline-block;
          width: 2rem; height: 2rem;
          border: 3px solid #d4c9a8;
          border-top-color: #8B6914;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 0.8rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-wrapper">
        <header className="page-header">
          <h1>Últimos grupos disponibles</h1>
          <p>Grupos de celebración · Última generación</p>
        </header>

        {isLoading ? (
          <div className="status-center">
            <div className="spinner" />
            <p>Cargando grupos...</p>
          </div>
        ) : !idComunidad ? (
          <div className="no-comunidad">
            <strong>Sin comunidad asignada</strong>
            Tu cuenta no está vinculada a ninguna comunidad.<br />
            Contacta con el administrador para que te añadan.
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