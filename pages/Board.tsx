
import React, { useState } from 'react';
import { AppState, BoardMember, BoardRole } from '../types';
import { Gavel, User, Mail, Phone, Calendar, Plus, Edit, Trash2, X } from 'lucide-react';
import { db } from '../services/dataService'; // Import DB Service

interface BoardProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
}

const Board: React.FC<BoardProps> = ({ appState, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<BoardMember>>({
    role: BoardRole.VOCAL,
    status: 'Activo',
    periodStart: new Date().getFullYear() + '-01-01',
    periodEnd: new Date().getFullYear() + 1 + '-12-31'
  });

  const handleEdit = (member: BoardMember) => {
    setEditingMember(member);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar este miembro de la Junta Directiva?')) {
      // 1. Optimistic Update
      onUpdate({
        ...appState,
        boardMembers: appState.boardMembers.filter(m => m.id !== id)
      });
      // 2. DB Update
      await db.boardMembers.delete(id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newMemberData: BoardMember = {
      id: editingMember.id || `bm-${Date.now()}`,
      fullName: editingMember.fullName!,
      role: editingMember.role as BoardRole,
      email: editingMember.email!,
      phone: editingMember.phone!,
      periodStart: editingMember.periodStart!,
      periodEnd: editingMember.periodEnd!,
      status: editingMember.status as 'Activo' | 'Inactivo'
    };

    let updatedList = appState.boardMembers;
    if (editingMember.id) {
      updatedList = updatedList.map(m => m.id === editingMember.id ? newMemberData : m);
    } else {
      updatedList = [...updatedList, newMemberData];
    }

    // 1. Optimistic Update
    onUpdate({ ...appState, boardMembers: updatedList });
    
    // 2. DB Update
    await db.boardMembers.upsert(newMemberData);

    setIsModalOpen(false);
    setEditingMember({ 
        role: BoardRole.VOCAL, status: 'Activo', 
        periodStart: new Date().getFullYear() + '-01-01',
        periodEnd: new Date().getFullYear() + 1 + '-12-31'
    });
  };

  const getRoleBadgeColor = (role: BoardRole) => {
    switch (role) {
      case BoardRole.PRESIDENT: return 'bg-purple-100 text-purple-700 border-purple-200';
      case BoardRole.VICE_PRESIDENT: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case BoardRole.TREASURER: return 'bg-green-100 text-green-700 border-green-200';
      case BoardRole.SECRETARY: return 'bg-blue-100 text-blue-700 border-blue-200';
      case BoardRole.FISCAL: return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Junta Directiva</h2>
           <p className="text-slate-500 text-sm">Gestión de autoridades del Patronato Usuarios Piscina Albrook</p>
        </div>
        <button 
          onClick={() => { setEditingMember({ role: BoardRole.VOCAL, status: 'Activo', periodStart: new Date().getFullYear() + '-01-01', periodEnd: new Date().getFullYear() + 1 + '-12-31' }); setIsModalOpen(true); }}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} /> Registrar Miembro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appState.boardMembers.map(member => (
          <div key={member.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => handleEdit(member)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Edit size={16}/></button>
               <button onClick={() => handleDelete(member.id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={16}/></button>
            </div>

            <div className="flex flex-col items-center text-center mb-4">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                  <User size={32} />
               </div>
               <h3 className="text-lg font-bold text-slate-800">{member.fullName}</h3>
               <span className={`px-3 py-1 rounded-full text-xs font-bold border mt-1 ${getRoleBadgeColor(member.role)}`}>
                 {member.role}
               </span>
            </div>
            
            <div className="space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-4">
               <div className="flex items-center gap-3">
                  <Mail size={16} className="text-slate-400" />
                  <a href={`mailto:${member.email}`} className="hover:text-teal-600 truncate">{member.email}</a>
               </div>
               <div className="flex items-center gap-3">
                  <Phone size={16} className="text-slate-400" />
                  <span>{member.phone}</span>
               </div>
               <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-slate-400" />
                  <span>Período: {member.periodStart.slice(0,4)} - {member.periodEnd.slice(0,4)}</span>
               </div>
            </div>
          </div>
        ))}
        {appState.boardMembers.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No hay miembros registrados en la Junta Directiva.
            </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingMember.id ? 'Editar Miembro' : 'Nuevo Miembro Junta Directiva'}</h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-700 block mb-1">Nombre Completo</label>
                    <input required className="w-full border border-slate-300 rounded-lg p-2" value={editingMember.fullName || ''} onChange={e => setEditingMember({...editingMember, fullName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Cargo</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2" value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value as BoardRole})}>
                       {Object.values(BoardRole).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Estado</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2" value={editingMember.status} onChange={e => setEditingMember({...editingMember, status: e.target.value as any})}>
                       <option value="Activo">Activo</option>
                       <option value="Inactivo">Inactivo</option>
                    </select>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                    <input type="email" required className="w-full border border-slate-300 rounded-lg p-2" value={editingMember.email || ''} onChange={e => setEditingMember({...editingMember, email: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono</label>
                    <input required className="w-full border border-slate-300 rounded-lg p-2" value={editingMember.phone || ''} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} />
                 </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Vigencia del Cargo</label>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Inicio</label>
                          <input type="date" required className="w-full border border-slate-300 rounded p-1.5 text-sm" value={editingMember.periodStart} onChange={e => setEditingMember({...editingMember, periodStart: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Fin</label>
                          <input type="date" required className="w-full border border-slate-300 rounded p-1.5 text-sm" value={editingMember.periodEnd} onChange={e => setEditingMember({...editingMember, periodEnd: e.target.value})} />
                      </div>
                  </div>
              </div>

              <div className="flex justify-end pt-2">
                 <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-medium">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Board;
