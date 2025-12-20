
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Member, MemberStatus, MemberCategory, TransactionType, TransactionCategory, SystemUser, UserRole } from '../types';
import { Search, Plus, Mail, Phone, User, X, History, Calendar, DollarSign, Calculator, CheckCircle, AlertCircle, Upload, Download, Camera, Trash2, Building, UserMinus, Link as LinkIcon, Pencil, LayoutGrid, LayoutList, Filter, FileText, Briefcase, Users as UsersIcon } from 'lucide-react';
import { db } from '../services/dataService';

interface MembersProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: SystemUser | null;
}

const Members: React.FC<MembersProps> = ({ appState, onUpdate, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [filterStatus, setFilterStatus] = useState<MemberStatus | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<MemberCategory | 'ALL'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const isViewer = currentUser?.role === UserRole.VIEWER;
  
  const [newMember, setNewMember] = useState<Partial<Member>>({
    fullName: '', 
    email: '', 
    phone: '', 
    familyMembers: 1, 
    status: MemberStatus.ACTIVE,
    category: MemberCategory.INDIVIDUAL, 
    monthlyFee: 45, 
    photoUrl: '', 
    parentMemberId: '',
    joinDate: new Date().toISOString().split('T')[0], 
    occupation: ''
  });

  // --- OPTIMIZATION: PRE-CALCULATE DATA ---
  const memberFinancialsMap = useMemo(() => {
    const map: Record<string, any> = {};
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const txByMember: Record<string, number> = {};
    appState.transactions.forEach(t => {
        if (t.type === TransactionType.INCOME && t.category === TransactionCategory.CONTRIBUTION && t.relatedMemberId) {
            txByMember[t.relatedMemberId] = (txByMember[t.relatedMemberId] || 0) + (Number(t.amount) || 0);
        }
    });

    const dependentsByParent: Record<string, Member[]> = {};
    appState.members.forEach(m => {
        if (m.parentMemberId && m.status === MemberStatus.ACTIVE) {
            if (!dependentsByParent[m.parentMemberId]) dependentsByParent[m.parentMemberId] = [];
            dependentsByParent[m.parentMemberId].push(m);
        }
    });

    appState.members.forEach(member => {
        const joinDateParts = (member.joinDate || '').split('-');
        let totalBillableCycles = 1;
        if (joinDateParts.length === 3) {
            const joinYear = parseInt(joinDateParts[0]);
            const joinMonth = parseInt(joinDateParts[1]) - 1;
            const joinDay = parseInt(joinDateParts[2]);
            let totalMonths = (currentYear - joinYear) * 12 + (currentMonth - joinMonth);
            if (currentDay < joinDay) totalMonths--;
            totalBillableCycles = Math.max(1, totalMonths + 1);
        }

        let effectiveMonthlyFee = Number(member.monthlyFee) || 0;
        const deps = dependentsByParent[member.id] || [];
        if (member.category === MemberCategory.PRINCIPAL) {
            const depFees = deps.reduce((sum, d) => sum + (Number(d.monthlyFee) || 0), 0);
            effectiveMonthlyFee += depFees;
        }

        const expectedTotal = totalBillableCycles * effectiveMonthlyFee;
        let paidTotal = txByMember[member.id] || 0;
        if (member.category === MemberCategory.PRINCIPAL) {
            deps.forEach(d => { paidTotal += (txByMember[d.id] || 0); });
        }

        map[member.id] = {
            totalMonthsActive: totalBillableCycles,
            expectedTotal,
            paidTotal,
            balance: paidTotal - expectedTotal,
            effectiveMonthlyFee,
            dependents: deps
        };
    });

    return map;
  }, [appState.members, appState.transactions]);

  const filteredMembers = useMemo(() => {
    return appState.members.filter(m => {
        const matchesSearch = (m.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || m.id.includes(searchTerm);
        const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
        const matchesCategory = filterCategory === 'ALL' || m.category === filterCategory;
        return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [appState.members, searchTerm, filterStatus, filterCategory]);

  const getMemberTransactions = (memberId: string) => {
    return appState.transactions
      .filter(t => t.relatedMemberId === memberId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return; 
    if (!newMember.fullName) return;

    try {
        const id = editingId || `M-${Date.now().toString().slice(-6)}`; 
        const memberToSave: Member = {
            id,
            fullName: newMember.fullName!,
            email: newMember.email || '',
            phone: newMember.phone || '',
            familyMembers: Number(newMember.familyMembers) || 1,
            status: newMember.status as MemberStatus,
            category: newMember.category as MemberCategory,
            joinDate: newMember.joinDate || new Date().toISOString().split('T')[0],
            monthlyFee: Number(newMember.monthlyFee) || 0,
            photoUrl: newMember.photoUrl,
            parentMemberId: newMember.category === MemberCategory.DEPENDENT ? newMember.parentMemberId : undefined,
            occupation: newMember.occupation || ''
        };

        const updatedList = editingId 
            ? appState.members.map(m => m.id === editingId ? memberToSave : m)
            : [memberToSave, ...appState.members];

        onUpdate({ ...appState, members: updatedList });
        await db.members.upsert(memberToSave);
        
        if (currentUser) {
            await db.logs.add({
                userId: currentUser.id,
                userName: currentUser.fullName,
                action: editingId ? 'EDITAR' : 'CREAR',
                entity: 'Socios',
                details: `${editingId ? 'Actualizó' : 'Creó'} socio: ${memberToSave.fullName}`
            });
        }

        setIsModalOpen(false);
        setEditingId(null);
    } catch (error) {
        alert("Error al guardar en base de datos.");
    }
  };

  const principalMembers = useMemo(() => 
    appState.members.filter(m => m.category === MemberCategory.PRINCIPAL), 
  [appState.members]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Directorio de Socios</h2>
            <p className="text-sm text-slate-500">Gestión de membresías y perfiles de la Junta.</p>
        </div>
        {!isViewer && (
            <button 
                onClick={() => { 
                    setEditingId(null); 
                    setNewMember({
                        fullName: '', email: '', phone: '', familyMembers: 1, 
                        status: MemberStatus.ACTIVE, category: MemberCategory.INDIVIDUAL, 
                        monthlyFee: 45, joinDate: new Date().toISOString().split('T')[0], occupation: ''
                    });
                    setIsModalOpen(true); 
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all font-bold"
            >
                <Plus size={20} /> Registrar Nuevo Socio
            </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-3 flex-1 w-full bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <Search className="text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Buscar por nombre, ID o email..." 
                className="flex-1 outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2">
            <select className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none font-medium text-slate-600" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="ALL">Todos los Estados</option>
                {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400'}`}><LayoutGrid size={20} /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400'}`}><LayoutList size={20} /></button>
            </div>
        </div>
      </div>

      {viewMode === 'GRID' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map(member => {
            const financials = memberFinancialsMap[member.id] || {};
            const isPrincipal = member.category === MemberCategory.PRINCIPAL;
            const isDependent = member.category === MemberCategory.DEPENDENT;

            return (
          <div key={member.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 hover:shadow-md transition-all relative overflow-hidden group">
            {isPrincipal && <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>}
            {isDependent && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>}
            
            <div className="flex justify-between items-start mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isPrincipal ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>
                  {isPrincipal ? <Building size={28} /> : <User size={28} />}
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${member.status === MemberStatus.ACTIVE ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  {member.status}
              </span>
            </div>
            
            <h3 className="text-xl font-black text-slate-800 truncate mb-1">{member.fullName}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter mb-4">ID: {member.id} • {member.category}</p>
            
            <div className="space-y-3 text-sm text-slate-600 border-t border-slate-50 pt-4">
                <div className="flex items-center gap-2 text-slate-500">
                    <Briefcase size={14} className="text-slate-300" />
                    <span className="truncate">{member.occupation || 'No especificada'}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo</span>
                    <span className={`font-black text-lg ${(financials.balance || 0) >= -0.01 ? 'text-teal-600' : 'text-red-600'}`}>
                        ${(financials.balance || 0).toFixed(2)}
                    </span>
                </div>
            </div>

            <div className="flex gap-2 mt-5">
                <button onClick={() => setSelectedMember(member)} className="flex-1 py-3 text-teal-600 hover:bg-teal-50 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-teal-100 flex items-center justify-center gap-2">
                    <History size={16} /> Historial
                </button>
                {!isViewer && (
                    <button onClick={() => { setEditingId(member.id); setNewMember(member); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-100 transition-all">
                        <Pencil size={18} />
                    </button>
                )}
            </div>
          </div>
        )})}
      </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="p-4">Socio / Categoría</th>
                            <th className="p-4">Contacto / Profesión</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Cuota</th>
                            <th className="p-4 text-right">Saldo</th>
                            <th className="p-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map(member => {
                            const financials = memberFinancialsMap[member.id] || {};
                            const bal = financials.balance || 0;
                            return (
                                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-black text-slate-800 text-sm">{member.fullName}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{member.category}</p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs text-slate-600 font-medium">{member.email || '-'}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">{member.occupation || 'Sin profesión'}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${member.status === MemberStatus.ACTIVE ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-700 text-sm">
                                        ${(financials.effectiveMonthlyFee || 0).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-black text-sm ${bal >= -0.01 ? 'text-teal-600' : 'text-red-600'}`}>
                                            ${bal.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setSelectedMember(member)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><History size={18} /></button>
                                            {!isViewer && (
                                                <button onClick={() => { setEditingId(member.id); setNewMember(member); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={18} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* DETALLES DE SOCIO */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button onClick={() => setSelectedMember(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            
            <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                    <User size={32} />
                </div>
                <div>
                    <h3 className="text-3xl font-black text-slate-800">{selectedMember.fullName}</h3>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{selectedMember.category}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[9px] uppercase text-slate-400 font-black mb-1">Cuota Mensual</p><p className="text-xl font-black text-slate-700">${(memberFinancialsMap[selectedMember.id]?.effectiveMonthlyFee || 0).toFixed(2)}</p></div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[9px] uppercase text-slate-400 font-black mb-1">Ciclos Fact.</p><p className="text-xl font-black text-slate-700">{memberFinancialsMap[selectedMember.id]?.totalMonthsActive || 0}</p></div>
                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 text-center"><p className="text-[9px] uppercase text-teal-600 font-black mb-1">Total Pagado</p><p className="text-xl font-black text-teal-700">${(memberFinancialsMap[selectedMember.id]?.paidTotal || 0).toFixed(2)}</p></div>
                <div className={`${(memberFinancialsMap[selectedMember.id]?.balance || 0) >= -0.01 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} p-4 rounded-2xl border text-center`}><p className={`text-[9px] uppercase font-black mb-1 ${(memberFinancialsMap[selectedMember.id]?.balance || 0) >= -0.01 ? 'text-green-600' : 'text-red-600'}`}>Saldo Actual</p><p className={`text-xl font-black ${(memberFinancialsMap[selectedMember.id]?.balance || 0) >= -0.01 ? 'text-green-700' : 'text-red-700'}`}>${(memberFinancialsMap[selectedMember.id]?.balance || 0).toFixed(2)}</p></div>
            </div>

            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><History size={14} /> Transacciones Recientes</h4>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 text-right">Aporte ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getMemberTransactions(selectedMember.id).map(tx => (
                    <tr key={tx.id} className="text-sm">
                      <td className="p-3 text-slate-500 font-medium whitespace-nowrap">{tx.date}</td>
                      <td className="p-3 text-slate-700 font-bold">{tx.description}</td>
                      <td className="p-3 text-right text-teal-600 font-black">+${Number(tx.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {getMemberTransactions(selectedMember.id).length === 0 && (
                      <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">No se han registrado aportes para este socio.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO DE SOCIO - COMPLETO V5 */}
      {isModalOpen && !isViewer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl relative overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-300">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 p-2 bg-slate-50 rounded-full"><X size={24} /></button>
            
            <div className="mb-8">
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{editingId ? 'Editar Socio' : 'Nuevo Registro de Socio'}</h3>
                <p className="text-slate-400 text-sm">Ingrese todos los datos requeridos para la ficha oficial.</p>
            </div>
            
            <form onSubmit={handleSaveMember} className="space-y-8">
              {/* SECCIÓN 1: DATOS PERSONALES */}
              <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Información Personal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Nombre Completo</label>
                          <input required className="w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-2xl focus:bg-white focus:border-teal-500 outline-none transition-all font-bold text-slate-700" 
                            placeholder="Ej: Juan Antonio Pérez" value={newMember.fullName} onChange={e => setNewMember({...newMember, fullName: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Profesión / Ocupación</label>
                          <div className="relative">
                            <Briefcase className="absolute left-4 top-4 text-slate-300" size={18} />
                            <input className="w-full border-2 border-slate-100 bg-slate-50 p-4 pl-12 rounded-2xl focus:bg-white focus:border-teal-500 outline-none transition-all font-bold text-slate-700" 
                                placeholder="Ej: Abogado, Estudiante..." value={newMember.occupation} onChange={e => setNewMember({...newMember, occupation: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Email Principal</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-4 text-slate-300" size={18} />
                            <input type="email" className="w-full border-2 border-slate-100 bg-slate-50 p-4 pl-12 rounded-2xl focus:bg-white focus:border-teal-500 outline-none transition-all font-bold text-slate-700" 
                                placeholder="usuario@ejemplo.com" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Teléfono Móvil</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-4 text-slate-300" size={18} />
                            <input className="w-full border-2 border-slate-100 bg-slate-50 p-4 pl-12 rounded-2xl focus:bg-white focus:border-teal-500 outline-none transition-all font-bold text-slate-700" 
                                placeholder="6XXX-XXXX" value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} />
                          </div>
                      </div>
                  </div>
              </div>

              {/* SECCIÓN 2: CONFIGURACIÓN DE MEMBRESÍA */}
              <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} /> Membresía y Categoría</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Categoría</label>
                          <select className="w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 appearance-none outline-none" 
                            value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value as MemberCategory})}>
                              {Object.values(MemberCategory).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Estado Inicial</label>
                          <select className="w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 appearance-none outline-none" 
                            value={newMember.status} onChange={e => setNewMember({...newMember, status: e.target.value as MemberStatus})}>
                              {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Fecha Ingreso</label>
                          <input type="date" required className="w-full border-2 border-slate-100 bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none" 
                            value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} />
                      </div>
                  </div>

                  {/* Lógica para vincular dependiente a socio principal */}
                  {newMember.category === MemberCategory.DEPENDENT && (
                      <div className="p-5 bg-amber-50 rounded-2xl border-2 border-amber-100 animate-in slide-in-from-top-2">
                          <label className="block text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2"><LinkIcon size={14}/> Vincular con Socio Responsable</label>
                          <select required className="w-full border-2 border-amber-200 bg-white p-3.5 rounded-xl font-bold text-slate-700 outline-none"
                            value={newMember.parentMemberId} onChange={e => setNewMember({...newMember, parentMemberId: e.target.value})}>
                              <option value="">-- Seleccionar Socio Principal --</option>
                              {principalMembers.map(m => <option key={m.id} value={m.id}>{m.fullName} (ID: {m.id})</option>)}
                          </select>
                          <p className="text-[10px] text-amber-500 font-bold mt-2 italic">Este socio aparecerá bajo la tutela del socio principal en los estados de cuenta.</p>
                      </div>
                  )}
              </div>

              {/* SECCIÓN 3: FINANZAS Y FAMILIA */}
              <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2"><DollarSign size={14} /> Cuotas y Familia</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 text-center tracking-widest">Cuota Mensual Pactada ($)</label>
                          <div className="flex items-center gap-4">
                              <DollarSign className="text-teal-500" size={32} />
                              <input type="number" step="0.01" className="w-full bg-transparent border-b-2 border-teal-500 p-2 text-3xl font-black text-slate-800 outline-none" 
                                value={newMember.monthlyFee} onChange={e => setNewMember({...newMember, monthlyFee: Number(e.target.value)})} />
                          </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 text-center tracking-widest">Núcleo Familiar (Personas)</label>
                          <div className="flex items-center gap-4">
                              <UsersIcon className="text-indigo-500" size={32} />
                              <input type="number" className="w-full bg-transparent border-b-2 border-indigo-500 p-2 text-3xl font-black text-slate-800 outline-none" 
                                value={newMember.familyMembers} onChange={e => setNewMember({...newMember, familyMembers: Number(e.target.value)})} />
                          </div>
                      </div>
                  </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-teal-100 hover:bg-teal-700 transform active:scale-95 transition-all">
                      {editingId ? 'Actualizar Ficha Socio' : 'Confirmar Registro Oficial'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
