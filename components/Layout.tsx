
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PiggyBank, Droplets, Bot, Menu, X, Landmark, Briefcase, Gavel, Contact, FileBarChart, Shield, LogOut, UserCircle, ClipboardList, Truck, CircleDollarSign, UserCog } from 'lucide-react';
import { SystemUser, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: SystemUser | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Panel Principal', icon: <LayoutDashboard size={20} /> },
    { path: '/members', label: 'Socios', icon: <Users size={20} /> },
    { path: '/finance', label: 'Finanzas', icon: <PiggyBank size={20} /> },
    { path: '/debt', label: 'Ctas. por Cobrar/Pagar', icon: <CircleDollarSign size={20} /> },
    { path: '/reports', label: 'Estado de Resultados', icon: <FileBarChart size={20} /> },
    { path: '/bank-accounts', label: 'Cuentas / Bancos', icon: <Landmark size={20} /> },
    { path: '/projects', label: 'Proyectos', icon: <Briefcase size={20} /> },
    { path: '/inventory', label: 'Mantenimiento', icon: <Droplets size={20} /> },
    { path: '/suppliers', label: 'Proveedores', icon: <Truck size={20} /> }, 
    { path: '/payroll', label: 'Planilla / RRHH', icon: <Contact size={20} /> },
    { path: '/board', label: 'Junta Directiva', icon: <Gavel size={20} /> },
    { path: '/assistant', label: 'Asistente IA', icon: <Bot size={20} /> },
  ];

  const adminItems = [
     { path: '/access-control', label: 'Gestión de Usuarios', icon: <UserCog size={20} /> },
     { path: '/system-logs', label: 'Bitácora de Sistema', icon: <ClipboardList size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-teal-400">Piscina Albrook</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-tighter">Junta Usuarios Piscina Albrook</p>
        </div>
        
        <div className="px-4 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
           <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center font-bold text-xs">
                  {currentUser?.fullName.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold truncate">{currentUser?.fullName}</span>
                  <span className="text-[10px] text-teal-400 uppercase tracking-wide">{currentUser?.role}</span>
              </div>
           </div>
           <button onClick={onLogout} title="Cerrar Sesión" className="text-slate-400 hover:text-red-400 transition-colors ml-1">
               <LogOut size={16} />
           </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {currentUser?.role === UserRole.ADMIN && (
             <>
                <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase mt-4">Configuración</div>
                {adminItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                    </Link>
                    );
                })}
             </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 text-center uppercase font-black">Sistema Junta de Usuarios</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white shadow-md z-20">
          <div className="flex flex-col">
              <span className="font-bold text-lg text-teal-400">Piscina Albrook</span>
              <span className="text-[10px] text-slate-400 uppercase">Junta de Usuarios</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onLogout} className="text-slate-400">
                <LogOut size={20} />
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-slate-800 z-10 shadow-lg border-b border-slate-700 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="flex flex-col p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
                     location.pathname === item.path ? 'bg-teal-600 text-white' : 'text-slate-300'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
              {currentUser?.role === UserRole.ADMIN && adminItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
                     location.pathname === item.path ? 'bg-indigo-600 text-white' : 'text-slate-300'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
