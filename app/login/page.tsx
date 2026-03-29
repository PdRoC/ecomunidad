"use client";

import { useSearchParams } from "next/navigation";
import { loginWithGoogle } from "@/app/actions/auth";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const errorMsg = searchParams.get("error");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Lato', sans-serif;
          background: #f5f0e8;
          color: #2c2416;
          min-height: 100vh;
        }

        .login-wrapper {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(139,105,20,0.06) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(92,74,30,0.05) 0%, transparent 50%),
            #f5f0e8;
        }

        .login-card {
          background: #fffdf7;
          border: 1px solid #e0d8c0;
          border-radius: 12px;
          box-shadow:
            0 4px 24px rgba(60,40,10,0.10),
            0 1px 0 rgba(255,255,255,0.8) inset;
          width: 100%;
          max-width: 380px;
          overflow: hidden;
        }

        .login-header {
          background: linear-gradient(135deg, #3a2c14 0%, #5C4A1E 100%);
          padding: 2.5rem 2rem 2rem;
          text-align: center;
          position: relative;
        }
        .login-header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, #8B6914, #d4a843, #8B6914, transparent);
        }

        .login-cross {
          font-size: 2.2rem;
          margin-bottom: 0.75rem;
          display: block;
        }

        .login-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #f5f0e8;
        }

        .login-subtitle {
          margin-top: 0.35rem;
          font-size: 0.78rem;
          color: #c4b080;
          font-weight: 300;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .login-body {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.2rem;
        }

        .login-desc {
          font-size: 0.88rem;
          color: #7a6840;
          text-align: center;
          line-height: 1.6;
        }

        .error-box {
          width: 100%;
          background: #fdf0f0;
          border: 1px solid #e8c0c0;
          border-left: 3px solid #c0392b;
          border-radius: 6px;
          padding: 0.7rem 0.9rem;
          font-size: 0.85rem;
          color: #8b2020;
        }

        .btn-google {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1.25rem;
          background: #fffdf7;
          border: 1px solid #d4c9a8;
          border-radius: 6px;
          font-family: 'Lato', sans-serif;
          font-size: 0.92rem;
          font-weight: 700;
          color: #3a2c14;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
          box-shadow: 0 1px 4px rgba(60,40,10,0.08);
        }
        .btn-google:hover {
          background: #faf6ec;
          border-color: #8B6914;
          box-shadow: 0 2px 8px rgba(139,105,20,0.15);
        }

        .google-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .login-footer {
          padding: 1rem 2rem 1.5rem;
          text-align: center;
          border-top: 1px solid #ede5cc;
        }
        .login-footer p {
          font-size: 0.78rem;
          color: #9a8860;
          font-weight: 300;
          letter-spacing: 0.04em;
        }

        @media (max-width: 440px) {
          .login-wrapper { padding: 1rem; }
          .login-header { padding: 2rem 1.5rem 1.5rem; }
          .login-body { padding: 1.5rem; }
        }
      `}</style>

      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <span className="login-cross">✝</span>
            <h1 className="login-title">Comunidad de Fe</h1>
            <p className="login-subtitle">Gestión de celebraciones</p>
          </div>

          <div className="login-body">
            {errorMsg && (
              <div className="error-box">{errorMsg}</div>
            )}

            <p className="login-desc">
              Accede con tu cuenta de Google para ver los grupos de tu comunidad.
            </p>

            <form action={loginWithGoogle} style={{ width: "100%" }}>
              <button type="submit" className="btn-google">
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>
            </form>
          </div>

          <div className="login-footer">
            <p>Acceso restringido a miembros de la comunidad</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}