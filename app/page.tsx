"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import styles from "./page.module.css";

// ─── Types ─────────────────────────────────────────────────────────────────────
type PersonaGrupo = {
  id_grupo: number;
  personas: string[];
};

type GruposPorTipo = {
  [tipo: string]: PersonaGrupo[];
};

// ─── Hook: obtener id_comunidad del usuario autenticado ────────────────────────
function useIdComunidad() {
  const [idComunidad, setIdComunidad] = useState<string | null>(null);
  const [loadingComunidad, setLoadingComunidad] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchComunidad(userId: string) {
      try {
        const { data } = await supabase
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

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const session = data.session;
      if (session?.user) {
        fetchComunidad(session.user.id);
      } else {
        setIdComunidad(null);
        setLoadingComunidad(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (_event === "INITIAL_SESSION") return;
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
  label, grupos, icono, color,
}: {
  label: string; grupos: PersonaGrupo[]; icono: string; color: string;
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
      <div className={`card-body ${styles.cardBodyScroll}`}>
        {grupos.length === 0 ? (
          <p className="empty-msg">No hay grupos disponibles</p>
        ) : (
          grupos.map((g) => (
            <div key={g.id_grupo} className={styles.grupo}>
              <div className={styles.grupoHeader} style={{ color }}>Grupo {g.id_grupo}</div>
              <table className={styles.grupoTable}>
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
          className="btn-copiar"
          style={{ backgroundColor: copiado ? "var(--color-success)" : color }}
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
    { tipo: "peticion",   label: "Petición",   icono: "🙏", color: "var(--color-peticion)"   },
    { tipo: "salmo",      label: "Salmo",       icono: "📖", color: "var(--color-salmo)"      },
    { tipo: "eucaristia", label: "Eucaristía",  icono: "✝️", color: "var(--color-eucaristia)" },
  ];

  const isLoading = loadingComunidad || loading;

  return (
    <div className={styles.pageWrapper}>
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
        <div className={styles.cardsGrid}>
          {tarjetas.map(({ tipo, label, icono, color }) => (
            <TarjetaGrupos
              key={tipo}
              label={label}
              grupos={grupos[tipo] ?? []}
              icono={icono}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}