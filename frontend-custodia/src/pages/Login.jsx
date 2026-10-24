import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const motivo = localStorage.getItem('logout_reason');
    if (motivo) { setError(motivo); localStorage.removeItem('logout_reason'); }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(correo, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.mensaje);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Esfera de partículas sutil en el fondo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] particle-sphere pointer-events-none z-0 opacity-50"></div>

      <div className="w-full max-w-[460px] z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-platinum font-medium text-[24px] tracking-wide flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-aurora opacity-80"></div>
            CUSTODIA
          </div>
          <span className="text-silver-mist text-[12px] font-medium uppercase tracking-[0.15em]">
            Terminal de Acceso
          </span>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-[#fde9ff] text-[14px] px-4 py-3 rounded-[6px]">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-silver-mist text-[12px] uppercase tracking-[0.12em]">
                Identificación
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="bg-liquid-deep border border-slate-deep rounded-[6px] px-4 py-3 text-platinum text-[16px] focus:outline-none focus:border-[#cbfffc] transition-colors"
                placeholder="usuario@custodia.com"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-silver-mist text-[12px] uppercase tracking-[0.12em]">
                Credencial de Seguridad
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-liquid-deep border border-slate-deep rounded-[6px] px-4 py-3 text-platinum text-[16px] focus:outline-none focus:border-[#cbfffc] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={loading}>
              {loading ? 'AUTENTICANDO...' : 'INICIAR SESIÓN'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}