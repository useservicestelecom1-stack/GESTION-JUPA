
import React, { useState, useMemo } from 'react';
import { AppState, SystemUser, UserRole, SystemLog } from '../types';
import { Navigate } from 'react-router-dom';
import { ClipboardList, Search, User, Filter, Calendar } from 'lucide-react';

interface SystemLogsProps {
  appState: AppState;
  currentUser: SystemUser | null;
}

const SystemLogs: React.FC<SystemLogsProps> = ({ appState, currentUser }) => {
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return <Navigate to="/" replace />;
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return appState.systemLogs.filter(log => {
      const matchSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchUser = filterUser === 'ALL' || log.userName === filterUser;
      
      return matchSearch && matchUser;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [appState.systemLogs, searchTerm, filterUser]);

  const distinctUsers = useMemo(() => {
      const users = new Set<string>();
      appState.systemLogs.forEach(log => users.add(log.userName));
      return Array.from(users);
  }, [appState.systemLogs]);

  const formatDate = (isoString: string) => {
      try {
        return new Date(isoString).toLocaleString('es-PA');
      } catch (e) {
        return isoString;
      }
  };

  const getActionColor = (action: string) => {
      switch(action.toUpperCase()) {
          case 'LOGIN': return 'text-green-600 bg-green-50';
          case 'CREAR': return 'text-blue-600 bg-blue-50';
          case 'EDITAR': return 'text-amber-600 bg-amber-50';
          case 'ELIMINAR': return 'text-red-600 bg-red-50';
          default: return 'text-slate-600 bg-slate-50';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Bitácora del Sistema</h2>
           <p className="text-slate-500 text-sm">Registro de auditoría de acciones realizadas por usuarios</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="text-slate-400" size={18} />
              <input 
                 type="text" 
                 placeholder="Buscar en detalles..." 
                 className="bg-transparent outline-none w-full text-sm"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Filter className="text-slate-400" size={18} />
              <select 
                  className="bg-transparent outline-none text-sm text-slate-700 min-w-[150px]"
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
              >
                  <option value="ALL">Todos los Usuarios</option>
                  {distinctUsers.map(u => (
                      <option key={u} value={u}>{u}</option>
                  ))}
              </select>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                      <tr>
                          <th className="p-4">Fecha / Hora</th>
                          <th className="p-4">Usuario</th>
                          <th className="p-4">Acción</th>
                          <th className="p-4">Entidad</th>
                          <th className="p-4">Detalles</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 text-sm text-slate-500 whitespace-nowrap flex items-center gap-2">
                                  <Calendar size={14} /> {formatDate(log.timestamp)}
                              </td>
                              <td className="p-4 text-sm font-medium text-slate-700">
                                  <div className="flex items-center gap-2">
                                      <User size={14} className="text-slate-400" />
                                      {log.userName}
                                  </div>
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                                      {log.action}
                                  </span>
                              </td>
                              <td className="p-4 text-sm text-slate-600 font-medium">
                                  {log.entity}
                              </td>
                              <td className="p-4 text-sm text-slate-600 max-w-md truncate" title={log.details}>
                                  {log.details}
                              </td>
                          </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                          <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron registros en la bitácora.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default SystemLogs;
