
import React, { useState, useRef, useMemo } from 'react';
import { AppState, Member, MemberStatus, MemberCategory, TransactionType, TransactionCategory, SystemUser, UserRole } from '../types';
import { Search, Plus, Mail, Phone, User, X, History, Calendar, DollarSign, Calculator, CheckCircle, AlertCircle, Upload, Download, Camera, Trash2, Building, UserMinus, Link as LinkIcon, Pencil, LayoutGrid, LayoutList, Filter, FileText } from 'lucide-react';
import { db } from '../services/dataService';
import { generatePaymentReceipt } from '../services/pdfService';

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
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  
  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const isViewer = currentUser?.role === UserRole.VIEWER;
  
  const [newMember, setNewMember] = useState<Partial<Member>>({
    fullName: '', email: '', phone: '', familyMembers: 1, status: MemberStatus.ACTIVE,
    category: MemberCategory.INDIVIDUAL, monthlyFee: 45, photoUrl: '', parentMemberId: '',
    joinDate: new Date().toISOString().split('T')[0], occupation: ''
  });

  // --- OPTIMIZATION: PRE-CALCULATE DATA TO PREVENT FREEZE ---
  const memberFinancialsMap = useMemo(() => {
    const map: Record<string, any> = {};
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    // 1. Index transactions by memberId
    const txByMember: Record<string, number> = {};
    appState.transactions.forEach(t => {
        if (t.type === TransactionType.INCOME && t.category === TransactionCategory.CONTRIBUTION && t.relatedMemberId) {
            txByMember[t.relatedMemberId] = (txByMember[t.relatedMemberId] || 0) + (Number(t.amount) || 0);
        }
    });

    // 2. Index dependents by parentId
    const dependentsByParent: Record<string, Member[]> = {};
    appState.members.forEach(m => {
        if (m.parentMemberId && m.status === MemberStatus.ACTIVE) {
            if (!dependentsByParent[m.parentMemberId]) dependentsByParent[m.parentMemberId] = [];
            dependentsByParent[m.parentMemberId].push(m);
        }
    });

    // 3. Pre-calculate for each member
    appState.members.forEach(member => {
        const joinDateParts = (member.joinDate || '').split('-');
        let totalBillableCycles = 1;
        let joinDay = 1;

        if (joinDateParts.length === 3) {
            const joinYear = parseInt(joinDateParts[0]);
            const joinMonth = parseInt(joinDateParts[1]) - 1;
            joinDay = parseInt(joinDateParts[2]);
            let totalMonths = (currentYear - joinYear) * 12 + (currentMonth - joinMonth);
            if (currentDay < joinDay) totalMonths--;
            totalBillableCycles = Math.max(1, totalMonths + 1);
        }

        // Calculate Effective Fee
        let effectiveMonthlyFee = Number(member.monthlyFee) || 0;
        const deps = dependentsByParent[member.id] || [];
        if (member.category === MemberCategory.PRINCIPAL) {
            const depFees = deps.reduce((sum, d) => sum + (Number(d.monthlyFee) || 0), 0);
            effectiveMonthlyFee += depFees;
        }

        const expectedTotal = totalBillableCycles * effectiveMonthlyFee;
        
        // Sum paid totals (self + dependents if principal)
        let paidTotal = txByMember[member.id] || 0;
        if (member.category === MemberCategory.PRINCIPAL) {
            deps.forEach(d => {
                paidTotal += (txByMember[d.id] || 0);
            });
        }

        map[member.id] = {
            totalMonthsActive: totalBillableCycles,
            expectedTotal,
            paidTotal,
            balance: paidTotal - expectedTotal,
            effectiveMonthlyFee,
            joinDay,
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
        let memberToSave: Member;
        const action = editingId ? 'UPDATE' : 'CREATE';
        const id = editingId || (appState.members.length + 1 + Date.now()).toString().slice(-6); 

        memberToSave = {
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
            occupation: newMember.occupation
        };

        const updatedList = editingId 
            ? appState.members.map(m => m.id === editingId ? memberToSave : m)
            : [...appState.members, memberToSave];

        onUpdate({ ...appState, members: updatedList });
        await db.members.upsert(memberToSave);
        
        if (currentUser) {
            await db.logs.add({
                userId: currentUser.id,
                userName: currentUser.fullName,
                action: action === 'CREATE' ? 'CREAR' : 'EDITAR',
                entity: 'Miembros',
                details: `${action === 'CREATE' ? 'Creó' : 'Actualizó'} el socio: ${memberToSave.fullName}`
            });
        }

        setIsModalOpen(false);
        setEditingId(null);
    } catch (error) {
        alert("Error al guardar el socio.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Directorio de Socios</h2>
            <p className="text-sm text-slate-500">Gestión de miembros y estados de cuenta optimizados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {!isViewer && (
                <button 
                    onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
                >
                    <Plus size={18} /> Nuevo Socio
                </button>
            )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-3 flex-1 w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <Search className="text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Buscar por nombre o ID..." 
                className="flex-1 outline-none text-slate-700 placeholder-slate-400 bg-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2">
            <select className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="ALL">Todos los Estados</option>
                {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-md ${viewMode === 'GRID' ? 'bg-white shadow text-teal-600' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-md ${viewMode === 'TABLE' ? 'bg-white shadow text-teal-600' : 'text-slate-400'}`}><LayoutList size={18} /></button>
            </div>
        </div>
      </div>

      {viewMode === 'GRID' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
            const financials = memberFinancialsMap[member.id] || {};
            const isPrincipal = member.category === MemberCategory.PRINCIPAL;
            const isDependent = member.category === MemberCategory.DEPENDENT;

            return (
          <div key={member.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
            {isPrincipal && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>}
            {isDependent && <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>}
            
            <div className="flex justify-between items-start mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  {isPrincipal ? <Building size={24} /> : <User size={24} />}
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${member.status === MemberStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {member.status}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 truncate">{member.fullName}</h3>
            <p className="text-xs text-slate-400 mb-4">ID: {member.id} • {member.category}</p>
            
            <div className="space-y-2 text-sm text-slate-600 border-t pt-3">
                <div className="flex justify-between">
                    <span className="text-slate-400">Cuota Total:</span>
                    <span className="font-bold">${(financials.effectiveMonthlyFee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Saldo:</span>
                    <span className={`font-black ${(financials.balance || 0) >= -0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(financials.balance || 0).toFixed(2)}
                    </span>
                </div>
            </div>

            <button onClick={() => setSelectedMember(member)} className="w-full mt-4 py-2 text-slate-600 hover:text-teal-600 bg-slate-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                 <History size={16} /> Ver Estado
            </button>
          </div>
        )})}
      </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                        <tr>
                            <th className="p-4">Socio</th>
                            <th className="p-4">Contacto</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Cuota Total</th>
                            <th className="p-4 text-right">Saldo Actual</th>
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
                                        <p className="font-bold text-slate-800 text-sm">{member.fullName}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">{member.category}</p>
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">
                                        {member.email || '-'}<br/>{member.phone || '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${member.status === MemberStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-medium text-slate-700 text-sm">
                                        ${(financials.effectiveMonthlyFee || 0).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-black text-sm ${bal >= -0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                            {bal >= 0 ? '+' : ''}{bal.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setSelectedMember(member)} className="p-1.5 text-slate-400 hover:text-teal-600 bg-slate-50 rounded"><History size={16} /></button>
                                            {!isViewer && (
                                                <button onClick={() => { setEditingId(member.id); setNewMember(member); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded"><Pencil size={16} /></button>
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

      {/* Selected Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="text-2xl font-bold text-slate-800 mb-6">{selectedMember.fullName}</h3>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-[10px] uppercase text-slate-400 font-bold">Cuota Mensual</p><p className="text-lg font-bold">${(memberFinancialsMap[selectedMember.id]?.effectiveMonthlyFee || 0).toFixed(2)}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400 font-bold">Ciclos</p><p className="text-lg font-bold">{memberFinancialsMap[selectedMember.id]?.totalMonthsActive || 0}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400 font-bold">Total Pagado</p><p className="text-lg font-bold text-teal-600">${(memberFinancialsMap[selectedMember.id]?.paidTotal || 0).toFixed(2)}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400 font-bold">Saldo</p><p className={`text-lg font-bold ${(memberFinancialsMap[selectedMember.id]?.balance || 0) >= -0.01 ? 'text-green-600' : 'text-red-600'}`}>${(memberFinancialsMap[selectedMember.id]?.balance || 0).toFixed(2)}</p></div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-3 text-sm text-slate-500">Fecha</th>
                    <th className="p-3 text-sm text-slate-500">Descripción</th>
                    <th className="p-3 text-sm text-slate-500 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getMemberTransactions(selectedMember.id).map(tx => (
                    <tr key={tx.id}>
                      <td className="p-3 text-sm text-slate-600">{tx.date}</td>
                      <td className="p-3 text-sm text-slate-800">{tx.description}</td>
                      <td className="p-3 text-sm font-bold text-right text-green-600">+${Number(tx.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Member Edit Modal */}
      {isModalOpen && !isViewer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingId ? 'Editar Socio' : 'Registrar Nuevo Socio'}</h3>
            <form onSubmit={handleSaveMember} className="space-y-4">
              <input required className="w-full border border-slate-300 rounded-lg p-2" placeholder="Nombre Completo" value={newMember.fullName} onChange={e => setNewMember({...newMember, fullName: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <select className="border border-slate-300 rounded-lg p-2" value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value as MemberCategory})}>
                      {Object.values(MemberCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="border border-slate-300 rounded-lg p-2" value={newMember.status} onChange={e => setNewMember({...newMember, status: e.target.value as MemberStatus})}>
                      {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2" placeholder="Cuota Mensual" value={newMember.monthlyFee} onChange={e => setNewMember({...newMember, monthlyFee: Number(e.target.value)})} />
              <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 rounded-lg">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
