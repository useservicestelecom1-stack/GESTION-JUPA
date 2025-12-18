
import React, { useState } from 'react';
import { AppState, SystemUser, UserRole } from '../types';
import { Shield, Plus, Lock, User, Trash2, X, AlertTriangle, Eye, Pencil, Check, Minus, Info, Users, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { db } from '../services/dataService';

interface AccessControlProps {
  appState: AppState;
  currentUser: SystemUser | null;
  onUpdate: (newState: AppState) => void;
}

const AccessControl: React.FC<AccessControlProps> = ({ appState, currentUser, onUpdate }) => {
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return <Navigate to="/" replace />;
  }

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newUser, setNewUser] = useState<Partial<SystemUser>>({
    role: UserRole.EDITOR,
    username: '',
    password: '',
    fullName: ''
  });

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const usernameExists = appState.systemUsers.some(u => 
        u.username.toLowerCase() === newUser.username?.toLowerCase() && 
        u.id !== editingId
    );

    if (usernameExists) {
        alert('El nombre de usuario ya existe.');
        return;
    }

    let updatedList = [...appState.systemUsers];
    let userToSave: SystemUser;
    let action = 'CREAR';

    if (editingId) {
        action = 'EDITAR';
        const existingUser = appState.systemUsers.find(u => u.id === editingId);
        userToSave = {
            id: editingId,
            username: newUser.username!,
            password: newUser.password!,
            fullName: newUser.fullName!,
            role: newUser.role as UserRole,
            lastLogin: existingUser?.lastLogin
        };
        updatedList = updatedList.map(u => u.id === editingId ? userToSave : u);
    } else {
        userToSave = {
            id: `usr-${Date.now()}`,
            username: newUser.username!,
            password: newUser.password!,
            fullName: newUser.fullName!,
            role: newUser.role as UserRole
        };
        updatedList = [...updatedList, userToSave];
    }

    try {
        onUpdate({ ...appState, systemUsers: updatedList });
        await db.systemUsers.upsert(userToSave);
        
        await db.logs.add({
            userId: currentUser.id,
            userName: currentUser.fullName,
            action: action,
            entity: 'Usuarios',
            details: `${action === 'CREAR' ? 'Creó' : 'Editó'} usuario: ${userToSave.username} (${userToSave.role})`
        });

        setIsModalOpen(false);
        setEditingId(null);
        setNewUser({ role: UserRole.EDITOR, username: '', password: '', fullName: '' });
    } catch (err) {
        alert("Error al guardar el usuario. Verifique la conexión a la base de datos.");
    }
  };

  const handleDeleteUser = async (id: string) => {
      if (id === currentUser.id) {
          alert("No puedes eliminar tu propio usuario mientras estás en sesión.");
          return;
      }
      if (window.confirm('¿Eliminar este usuario permanentemente? Esta acción es irreversible.')) {
          const userToDelete = appState.systemUsers.find(u => u.id === id);
          onUpdate({ ...appState, systemUsers: appState.systemUsers.filter(u => u.id !== id) });
          await db.systemUsers.delete(id);
          
          await db.logs.add({
              userId: currentUser.id,
              userName: currentUser.fullName,
              action: 'ELIMINAR',
              entity: 'Usuarios',
              details: `Eliminó usuario: ${userToDelete?.username || id}`
          });
      }
  };

  const permissionMap = [
      { feature: 'Ver Reportes y Finanzas', admin: true, editor: true, viewer: true },
      { feature: 'Registrar Cuotas y Gastos', admin: true, editor: true, viewer: false },
      { feature: 'Gestionar Inventario', admin: true, editor: true, viewer: false },
      { feature: 'Eliminar Registros (Socios/Pagos)', admin: true, editor: false, viewer: false },
      { feature: 'Administrar Usuarios del Sistema', admin: true, editor: false, viewer: false },
      { feature: 'Configurar Bancos y Proyectos', admin: true, editor: false, viewer: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
             <Shield className="text-indigo-600" size={32} /> Gestión de Usuarios
           </h2>
           <p className="text-slate-500 text-sm">Control centralizado de accesos y niveles de privilegio</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setNewUser({ role: UserRole.EDITOR, username: '', password: '', fullName: '' }); setIsModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 active:scale-95 font-bold"
        >
          <Plus size={20} /> Crear Nuevo Acceso
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {appState.systemUsers.map(user => (
                <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${
                            user.role === UserRole.ADMIN ? 'bg-indigo-600' : 
                            user.role === UserRole.EDITOR ? 'bg-teal-500' : 'bg-slate-400'
                        }`}>
                            {user.fullName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-800 truncate text-lg">{user.fullName}</h3>
                            <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                        <span className={`px-3 py-1 text-[10px] rounded-full font-black uppercase tracking-widest ${
                            user.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' : 
                            user.role === UserRole.EDITOR ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {user.role}
                        </span>
                        
                        <div className="flex gap-1">
                            <button 
                                onClick={() => { setEditingId(user.id); setNewUser({...user}); setIsModalOpen(true); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                <Pencil size={18} />
                            </button>
                            {user.id !== currentUser.id && (
                                <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit sticky top-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Info size={20} className="text-indigo-600" /> Matriz de Permisos
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-50 uppercase">
                        <tr>
                            <th className="pb-2 font-black">Función</th>
                            <th className="pb-2 text-center">ADM</th>
                            <th className="pb-2 text-center">EDI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {permissionMap.map((p, i) => (
                            <tr key={i}>
                                <td className="py-3 text-slate-600 font-medium leading-tight">{p.feature}</td>
                                <td className="py-3 text-center">{p.admin ? <Check className="mx-auto text-green-500" size={14} /> : <Minus className="mx-auto text-slate-200" size={14} />}</td>
                                <td className="py-3 text-center">{p.editor ? <Check className="mx-auto text-green-500" size={14} /> : <Minus className="mx-auto text-slate-200" size={14} />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={18} />
                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                    Los cambios de rol afectan de inmediato la visibilidad de los botones de <strong>Eliminar</strong>.
                </p>
            </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X size={24} /></button>
                <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-800">{editingId ? 'Editar Perfil' : 'Nuevo Usuario'}</h3>
                    <p className="text-slate-400 text-sm">Define las credenciales para el sistema.</p>
                </div>
                
                <form onSubmit={handleSaveUser} className="space-y-5">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Nombre Completo</label>
                        <div className="relative">
                            <User size={18} className="absolute top-3.5 left-4 text-slate-400" />
                            <input required className="w-full border-slate-200 border rounded-2xl p-3.5 pl-12 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all" 
                                value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} placeholder="Ej: Juan Pérez" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Identificador (Username)</label>
                        <input required className="w-full border-slate-200 border rounded-2xl p-3.5 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all" 
                            value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="ej: jperez" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Contraseña</label>
                        <div className="relative">
                            <Lock size={18} className="absolute top-3.5 left-4 text-slate-400" />
                            <input 
                                required 
                                type={showPassword ? "text" : "password"} 
                                className="w-full border-slate-200 border rounded-2xl p-3.5 pl-12 pr-12 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all" 
                                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-3.5 right-4 text-slate-400 hover:text-slate-800">
                                <Eye size={18} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Nivel de Acceso</label>
                        <select className="w-full border-slate-200 border rounded-2xl p-3.5 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all appearance-none" 
                            value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                            <option value={UserRole.ADMIN}>Administrador (Control Total)</option>
                            <option value={UserRole.EDITOR}>Editor (Operativo)</option>
                            <option value={UserRole.VIEWER}>Solo Lectura (Visualizador)</option>
                        </select>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl mt-4 shadow-xl transition-all">
                        {editingId ? 'ACTUALIZAR USUARIO' : 'CREAR ACCESO'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AccessControl;
