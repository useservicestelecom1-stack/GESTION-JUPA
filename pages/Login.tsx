
import React, { useState } from 'react';
import { AppState, SystemUser } from '../types';
import { Lock, User, Loader, Database, Copy, Check, Terminal, X, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { db } from '../services/dataService'; 

interface LoginProps {
  appState: AppState;
  onLogin: (user: SystemUser) => void;
  dbError?: boolean;
}

const SQL_SCRIPT = `-- =============================================================================
-- SCRIPT DE REPARACIÓN DEFINITIVO V5 - PISCINA ALBROOK
-- Ejecutar en el SQL Editor de Supabase para desbloquear el registro de finanzas
-- =============================================================================

-- 1. REPARAR TABLA TRANSACTIONS
DO $$ 
BEGIN
    -- Crear columna category si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='category') THEN
        ALTER TABLE transactions ADD COLUMN category TEXT;
    END IF;

    -- Forzar columna type a TEXT (esto elimina errores de tipo ENUM)
    -- Se usa USING para convertir los datos existentes de forma segura
    ALTER TABLE transactions ALTER COLUMN type TYPE TEXT USING type::text;

    -- Asegurar columnas de relación para CxC y CxP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='relatedMemberId') THEN
        ALTER TABLE transactions ADD COLUMN "relatedMemberId" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='relatedBankAccountId') THEN
        ALTER TABLE transactions ADD COLUMN "relatedBankAccountId" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='relatedSupplierId') THEN
        ALTER TABLE transactions ADD COLUMN "relatedSupplierId" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='relatedSupplier') THEN
        ALTER TABLE transactions ADD COLUMN "relatedSupplier" TEXT;
    END IF;
END $$;

-- 2. REPARAR TABLAS DE ÓRDENES (Garantizar compatibilidad CxP)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='paymentStatus') THEN
        ALTER TABLE service_orders ADD COLUMN "paymentStatus" TEXT DEFAULT 'Pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='paymentStatus') THEN
        ALTER TABLE purchase_orders ADD COLUMN "paymentStatus" TEXT DEFAULT 'Pending';
    END IF;
END $$;

-- 3. ACTUALIZAR ESQUEMA API
NOTIFY pgrst, 'reload schema';
`;

const Login: React.FC<LoginProps> = ({ appState, onLogin, dbError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    try {
      if (!dbError) {
          const { data, error: dbError } = await supabase
            .from('system_users')
            .select('*')
            .ilike('username', username)
            .eq('password', password)
            .single();

          if (data && !dbError) {
            const user = data as SystemUser;
            onLogin(user);
            setIsAuthenticating(false);
            db.logs.add({ userId: user.id, userName: user.fullName, action: 'LOGIN', entity: 'Auth', details: 'Inicio de sesión exitoso' });
            return;
          }
      }

      const localUser = appState.systemUsers.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );

      if (localUser) {
        onLogin(localUser);
      } else {
        setError('Credenciales incorrectas');
      }

    } catch (err) {
      console.error("Login error:", err);
      setError('Ocurrió un error al intentar iniciar sesión.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(SQL_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {showSql && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                             <Terminal size={24} />
                          </div>
                          <div>
                             <h3 className="font-black text-slate-800">Reparar Tabla de Transacciones</h3>
                             <p className="text-xs text-slate-500">Asegura que 'type' sea TEXT y que exista 'category'.</p>
                          </div>
                      </div>
                      <button onClick={() => setShowSql(false)} className="bg-slate-200 hover:bg-slate-300 p-2 rounded-full transition-colors"><X size={20} /></button>
                  </div>
                  <div className="flex-1 bg-slate-950 overflow-auto p-6 font-mono text-sm leading-relaxed text-emerald-400">
                      <pre>{SQL_SCRIPT}</pre>
                  </div>
                  <div className="p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
                      <p className="text-xs text-slate-500 max-w-md">Copie este script y ejecútelo en el <strong>SQL Editor</strong> de su panel de Supabase para arreglar el error del botón de pago.</p>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={copyToClipboard}
                            className={`flex-1 md:flex-none px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-900 shadow-lg'}`}
                        >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                            {copied ? 'Copiado al Portapapeles' : 'Copiar Script SQL'}
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 relative overflow-hidden">
        <div className="text-center mb-10 relative z-10">
          <div className="w-20 h-20 bg-teal-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
             <Database size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">Piscina Albrook</h1>
          <p className="text-slate-500 font-medium">Gestión Administrativa</p>
        </div>
        
        {dbError && (
            <div className="mb-8 bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 text-left relative z-10">
                <div className="flex items-center gap-3 text-amber-800 font-black mb-2">
                    <AlertCircle size={22} /> Esquema Desactualizado
                </div>
                <p className="text-sm text-amber-700 mb-4 leading-snug">
                    Faltan columnas críticas en Supabase para registrar pagos y saldar deudas.
                </p>
                <button 
                    onClick={() => setShowSql(true)}
                    className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 border border-amber-300"
                >
                    <Terminal size={18} /> Ver Solución Técnica
                </button>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold text-center border border-red-200">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest pl-1">Usuario</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-600 transition-colors">
                <User size={20} />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-teal-50 focus:border-teal-500 outline-none transition-all text-slate-800 font-medium"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isAuthenticating}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest pl-1">Clave</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-600 transition-colors">
                <Lock size={20} />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-teal-50 focus:border-teal-500 outline-none transition-all text-slate-800 font-medium"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isAuthenticating}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className={`w-full flex justify-center py-4 px-4 rounded-2xl shadow-xl text-lg font-black text-white transition-all transform hover:-translate-y-1 active:scale-95 ${
              isAuthenticating ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'
            }`}
          >
            {isAuthenticating ? (
              <span className="flex items-center gap-2">
                <Loader className="animate-spin" size={20} /> Entrando...
              </span>
            ) : (
              'Entrar al Sistema'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center relative z-10">
             <button onClick={() => setShowSql(true)} className="text-[11px] font-bold text-slate-400 hover:text-teal-600 uppercase tracking-widest transition-colors">Configurar Base de Datos</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
