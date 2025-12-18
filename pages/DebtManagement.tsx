
import React, { useMemo, useState } from 'react';
import { AppState, Member, MemberCategory, MemberStatus, ServiceStatus, PurchaseStatus, Transaction, TransactionType, TransactionCategory, SystemUser } from '../types';
import { TrendingDown, TrendingUp, CheckCircle, Calendar, User, DollarSign, X, CreditCard, FileText, AlertCircle, Loader, Info, ShieldAlert, Terminal, Landmark } from 'lucide-react';
import { db } from '../services/dataService';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface DebtManagementProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: SystemUser | null;
}

const DebtManagement: React.FC<DebtManagementProps> = ({ appState, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
  const [isSaving, setIsSaving] = useState(false);
  
  // Monitor de procesos visual
  const [processStatus, setProcessStatus] = useState<{
      steps: { id: string; label: string; status: 'pending' | 'loading' | 'success' | 'error'; error?: string }[];
      isVisible: boolean;
      isDone: boolean;
  }>({ isVisible: false, isDone: false, steps: [] });

  // Modal de Confirmación para CxC con Formulario
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    debtor: any;
    date: string;
    bankAccountId: string;
  }>({ 
    isOpen: false, 
    debtor: null, 
    date: new Date().toISOString().split('T')[0],
    bankAccountId: ''
  });

  // Estados para el modal de pago (CxP)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentItem, setPaymentItem] = useState<any>(null); 
  const [paymentConfig, setPaymentConfig] = useState({
      date: new Date().toISOString().split('T')[0],
      bankAccountId: '',
      reference: '',
      category: TransactionCategory.MAINTENANCE 
  });

  // --- LOGICA DE MOROSIDAD (CxC - Socios) ---
  const { totalReceivable, debtors } = useMemo(() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();

      const paidByMember: Record<string, number> = {};
      appState.transactions.forEach(t => {
          if (t.type === TransactionType.INCOME && t.category === TransactionCategory.CONTRIBUTION && t.relatedMemberId) {
              paidByMember[t.relatedMemberId] = (paidByMember[t.relatedMemberId] || 0) + (Number(t.amount) || 0);
          }
      });

      const dependentsByParent: Record<string, string[]> = {};
      appState.members.forEach(m => {
          if (m.category === MemberCategory.DEPENDENT && m.parentMemberId) {
              if (!dependentsByParent[m.parentMemberId]) dependentsByParent[m.parentMemberId] = [];
              dependentsByParent[m.parentMemberId].push(m.id);
          }
      });

      let total = 0;
      const list: { member: Member, monthsOwed: number, amountOwed: number, lastPayment: string }[] = [];

      appState.members.forEach(member => {
          if (member.status !== MemberStatus.ACTIVE) return;
          if (member.category === MemberCategory.DEPENDENT) return; 

          const joinDateParts = (member.joinDate || '').split('-');
          if (joinDateParts.length !== 3) return;

          const joinYear = parseInt(joinDateParts[0]);
          const joinMonth = parseInt(joinDateParts[1]) - 1; 
          const joinDay = parseInt(joinDateParts[2]);

          let totalMonthsElapsed = (currentYear - joinYear) * 12 + (currentMonth - joinMonth);
          if (currentDay < joinDay) totalMonthsElapsed--;
          
          const totalBillableCycles = Math.max(1, totalMonthsElapsed + 1);
          let fee = Number(member.monthlyFee) || 0;
          const dependentIds = dependentsByParent[member.id] || [];
          
          if (member.category === MemberCategory.PRINCIPAL) {
              dependentIds.forEach(depId => {
                  const dep = appState.members.find(m => m.id === depId);
                  if (dep && dep.status === MemberStatus.ACTIVE) fee += (Number(dep.monthlyFee) || 0);
              });
          }

          const expectedTotal = totalBillableCycles * fee;
          let paidTotal = paidByMember[member.id] || 0;
          dependentIds.forEach(depId => { paidTotal += (paidByMember[depId] || 0); });

          const balance = paidTotal - expectedTotal; 

          if (balance < -0.01) {
              const amountOwed = Math.abs(balance);
              const monthsOwed = fee > 0 ? (amountOwed / fee) : 0;
              total += amountOwed;
              list.push({
                  member,
                  monthsOwed: parseFloat(monthsOwed.toFixed(1)),
                  amountOwed,
                  lastPayment: member.lastPaymentDate || member.joinDate
              });
          }
      });

      return { totalReceivable: total, debtors: list.sort((a, b) => b.amountOwed - a.amountOwed) };
  }, [appState.members, appState.transactions]);

  const { totalPayable, allDebts } = useMemo(() => {
      let total = 0;
      const pendingServices = appState.serviceOrders.filter(so => 
          so.status !== ServiceStatus.CANCELLED && 
          (so.paymentStatus === 'Pending' || !so.paymentStatus) &&
          (so.status === ServiceStatus.COMPLETED || so.status === ServiceStatus.IN_PROGRESS) 
      );

      const serviceDebt = pendingServices.map(so => ({
          id: so.id, type: 'Servicio', reference: so.title, beneficiary: so.responsible,
          date: so.startDate, amount: Number(so.actualCost || so.estimatedCost), entity: so
      }));

      const pendingPurchases = appState.purchaseOrders.filter(po => 
          po.status !== PurchaseStatus.CANCELLED && po.status !== PurchaseStatus.DRAFT && 
          (po.paymentStatus === 'Pending' || !po.paymentStatus)
      );

      const purchaseDebt = pendingPurchases.map(po => ({
          id: po.id, type: 'Compra', reference: `Orden Compra #${po.id.slice(-4)}`, beneficiary: po.supplier,
          date: po.date, amount: Number(po.totalAmount), entity: po
      }));

      const list = [...serviceDebt, ...purchaseDebt].sort((a,b) => b.amount - a.amount);
      total = list.reduce((sum, item) => sum + item.amount, 0);
      return { totalPayable: total, allDebts: list };
  }, [appState.serviceOrders, appState.purchaseOrders]);

  // --- FORMATEADOR DE ERRORES ---
  const formatErrorMessage = (err: any): string => {
      if (!err) return "Error desconocido";
      const message = err.message || err.error_description || "Fallo en la comunicación con la base de datos";
      const code = err.code || "DB_ERR";
      return `[${code}] ${message}`;
  };

  // --- PROCESO: SALDAR DEUDA (CON MONITOR VISUAL) ---
  const executePayment = async () => {
      const { debtor, date, bankAccountId } = confirmModal;
      if (!debtor || !bankAccountId) return;

      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setIsSaving(true);
      
      const steps: { id: string; label: string; status: 'pending' | 'loading' | 'success' | 'error'; error?: string }[] = [
          { id: 'prep', label: 'Preparación de registros contables', status: 'pending' },
          { id: 'db_tx', label: 'Guardando Ingreso en base de datos', status: 'pending' },
          { id: 'db_mem', label: 'Actualizando historial del socio', status: 'pending' },
          { id: 'db_bank', label: 'Sincronizando saldo bancario', status: 'pending' },
          { id: 'ui', label: 'Refrescando interfaz', status: 'pending' }
      ];

      setProcessStatus({ isVisible: true, isDone: false, steps });

      const updateStep = (id: string, status: 'success' | 'loading' | 'error', error?: string) => {
          setProcessStatus(prev => ({
              ...prev,
              steps: prev.steps.map(s => s.id === id ? { ...s, status, error } : s)
          }));
      };

      try {
          const bankAcc = appState.bankAccounts.find(acc => acc.id === bankAccountId);
          if (!bankAcc) throw new Error("La cuenta bancaria seleccionada ya no existe.");

          updateStep('prep', 'loading');
          const newTx: Transaction = {
              id: `tx-cxc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              date: date,
              description: `SALDAR DEUDA ACUMULADA - Socio: ${debtor.member.fullName}`,
              amount: Number(parseFloat(debtor.amountOwed.toString()).toFixed(2)),
              type: TransactionType.INCOME,
              category: TransactionCategory.CONTRIBUTION,
              relatedMemberId: debtor.member.id,
              relatedBankAccountId: bankAcc.id
          };
          const updatedMember = { ...debtor.member, lastPaymentDate: date };
          const updatedBankAccount = { 
              ...bankAcc, 
              balance: Number(bankAcc.balance) + Number(newTx.amount) 
          };
          updateStep('prep', 'success');

          // PERSISTENCIA (ORDEN CRÍTICO)
          updateStep('db_tx', 'loading');
          await db.transactions.upsert(newTx);
          updateStep('db_tx', 'success');
          
          updateStep('db_mem', 'loading');
          await db.members.upsert(updatedMember);
          updateStep('db_mem', 'success');
          
          updateStep('db_bank', 'loading');
          await db.bankAccounts.upsert(updatedBankAccount);
          updateStep('db_bank', 'success');

          // ACTUALIZACIÓN DE UI
          updateStep('ui', 'loading');
          onUpdate({ 
              ...appState, 
              members: appState.members.map(m => m.id === updatedMember.id ? updatedMember : m),
              transactions: [newTx, ...appState.transactions],
              bankAccounts: appState.bankAccounts.map(acc => acc.id === bankAcc.id ? updatedBankAccount : acc)
          });
          
          if (currentUser) {
              await db.logs.add({
                  userId: currentUser.id, userName: currentUser.fullName,
                  action: 'CREAR', entity: 'Finanzas',
                  details: `Saldó deuda de socio: ${debtor.member.fullName} ($${newTx.amount}) en fecha ${date}`
              });
          }
          updateStep('ui', 'success');
          setProcessStatus(prev => ({ ...prev, isDone: true }));

      } catch (e: any) { 
          const currentStep = steps.find(s => s.status === 'loading') || { id: 'unknown' };
          updateStep(currentStep.id as string, 'error', formatErrorMessage(e));
          setProcessStatus(prev => ({ ...prev, isDone: true }));
      } finally {
          setIsSaving(false);
      }
  };

  const handleOpenConfirm = (d: any) => {
    setConfirmModal({
        isOpen: true,
        debtor: d,
        date: new Date().toISOString().split('T')[0],
        bankAccountId: appState.bankAccounts[0]?.id || ''
    });
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!paymentItem || !paymentConfig.bankAccountId || isSaving) return;

      setIsSaving(true);
      try {
          const amount = Number(paymentItem.amount);
          const bankAcc = appState.bankAccounts.find(a => a.id === paymentConfig.bankAccountId);
          if (!bankAcc) throw new Error("Cuenta bancaria no encontrada");

          const newTx: Transaction = {
              id: `tx-cxp-${Date.now()}`,
              date: paymentConfig.date,
              description: `PAGO CXP ${paymentItem.type}: ${paymentItem.reference}`,
              amount: amount,
              type: TransactionType.EXPENSE,
              category: paymentConfig.category,
              relatedBankAccountId: paymentConfig.bankAccountId,
              relatedSupplier: paymentItem.type === 'Compra' ? paymentItem.beneficiary : undefined,
              relatedSupplierId: paymentItem.type === 'Compra' ? (paymentItem.entity.supplierId || null) : undefined
          };

          const updatedEntity = { ...paymentItem.entity, paymentStatus: 'Paid' as const, relatedTransactionId: newTx.id };
          const updatedBankAccount = { ...bankAcc, balance: Number(bankAcc.balance) - amount };

          await db.transactions.upsert(newTx);
          await db.bankAccounts.upsert(updatedBankAccount);
          if (paymentItem.type === 'Servicio') await db.serviceOrders.upsert(updatedEntity);
          else await db.purchaseOrders.upsert(updatedEntity);

          onUpdate({
              ...appState,
              transactions: [newTx, ...appState.transactions],
              bankAccounts: appState.bankAccounts.map(acc => acc.id === bankAcc.id ? updatedBankAccount : acc),
              serviceOrders: paymentItem.type === 'Servicio' ? appState.serviceOrders.map(o => o.id === paymentItem.id ? updatedEntity : o) : appState.serviceOrders,
              purchaseOrders: paymentItem.type === 'Compra' ? appState.purchaseOrders.map(o => o.id === paymentItem.id ? updatedEntity : o) : appState.purchaseOrders,
          });

          setIsPayModalOpen(false);
      } catch (err: any) { 
          console.error("Error al procesar pago:", err);
      } finally {
          setIsSaving(false);
      }
  };

  const openPaymentModal = (item: any) => {
      setPaymentItem(item);
      setPaymentConfig({
          ...paymentConfig,
          date: new Date().toISOString().split('T')[0],
          bankAccountId: appState.bankAccounts[0]?.id || '',
          reference: item.reference
      });
      setIsPayModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Gestión de Deuda</h2>
          <p className="text-slate-500 text-sm">Control de Cuentas por Cobrar (Socios) y Pagar (Proveedores)</p>
        </div>
      </div>

      {/* Monitor de Proceso Visual */}
      {processStatus.isVisible && (
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black flex items-center gap-2">
                      <Terminal size={20} className="text-teal-400" /> MONITOR DE EJECUCIÓN
                  </h3>
                  {processStatus.isDone && (
                      <button 
                        onClick={() => setProcessStatus({ isVisible: false, isDone: false, steps: [] })}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-slate-600 transition-colors"
                      >
                          Cerrar Monitor
                      </button>
                  )}
              </div>
              
              <div className="space-y-4">
                  {processStatus.steps.map((step, idx) => (
                      <div key={step.id} className="flex flex-col">
                          <div className="flex items-center gap-4">
                            <div className="w-6 flex justify-center">
                                {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-700"></div>}
                                {step.status === 'loading' && <Loader size={16} className="animate-spin text-teal-400" />}
                                {step.status === 'success' && <CheckCircle size={16} className="text-green-500" />}
                                {step.status === 'error' && <ShieldAlert size={16} className="text-red-500" />}
                            </div>
                            <span className={`text-sm font-medium ${step.status === 'error' ? 'text-red-400' : step.status === 'pending' ? 'text-slate-500' : 'text-slate-300'}`}>
                                {step.label}
                            </span>
                          </div>
                          {step.error && (
                              <div className="ml-10 mt-1 p-3 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-300 font-mono">
                                  <p className="font-bold mb-1">¡BLOQUEO DETECTADO!</p>
                                  {step.error}
                                  <p className="mt-2 text-[10px] opacity-60">Sugerencia: Verifique que Supabase tenga todas las columnas requeridas.</p>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Por Cobrar (Socios)</p>
                  <h3 className="text-2xl font-bold text-green-600">${totalReceivable.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600"><TrendingUp size={24} /></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Por Pagar (Gastos)</p>
                  <h3 className="text-2xl font-bold text-red-600">${totalPayable.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-red-50 rounded-full text-red-600"><TrendingDown size={24} /></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-32">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={[{ name: 'Socios', val: totalReceivable }, { name: 'Prov', val: totalPayable }]}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={40} />
                      <Bar dataKey="val" radius={[0, 4, 4, 0]} barSize={20}>
                        <Cell fill="#10b981"/><Cell fill="#ef4444"/>
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
          <button onClick={() => setActiveTab('RECEIVABLES')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'RECEIVABLES' ? 'border-green-500 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>CxC Socios</button>
          <button onClick={() => setActiveTab('PAYABLES')} className={`pb-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'PAYABLES' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>CxP Proveedores</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {activeTab === 'RECEIVABLES' ? (
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                          <tr>
                              <th className="p-4">Socio</th>
                              <th className="p-4">Categoría</th>
                              <th className="p-4">Último Pago</th>
                              <th className="p-4 text-center">Meses Pendientes</th>
                              <th className="p-4 text-right">Monto Deuda</th>
                              <th className="p-4 text-center">Acción</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {debtors.map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4"><div className="font-bold text-slate-800">{d.member.fullName}</div></td>
                                  <td className="p-4 text-sm text-slate-600">{d.member.category}</td>
                                  <td className="p-4 text-sm text-slate-600"><div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" />{d.lastPayment}</div></td>
                                  <td className="p-4 text-center"><span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-xs">{d.monthsOwed.toFixed(1)}</span></td>
                                  <td className="p-4 text-right font-bold text-slate-800">${d.amountOwed.toFixed(2)}</td>
                                  <td className="p-4 text-center">
                                      <button 
                                        disabled={isSaving} 
                                        onClick={() => handleOpenConfirm(d)} 
                                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 mx-auto disabled:opacity-50 shadow-sm"
                                      >
                                          <CheckCircle size={14} /> Saldar Deuda
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {debtors.length === 0 && (<tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay socios con deudas pendientes.</td></tr>)}
                      </tbody>
                  </table>
              </div>
          ) : (
              <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                          <tr>
                              <th className="p-4">Tipo</th>
                              <th className="p-4">Referencia</th>
                              <th className="p-4">Proveedor</th>
                              <th className="p-4">Fecha</th>
                              <th className="p-4 text-right">Monto</th>
                              <th className="p-4 text-center">Acción</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {allDebts.map((item, i) => (
                               <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-4"><span className={`text-xs font-bold px-2 py-1 rounded border ${item.type === 'Compra' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{item.type}</span></td>
                                  <td className="p-4 text-sm font-medium text-slate-800">{item.reference}</td>
                                  <td className="p-4 text-sm text-slate-600">{item.beneficiary}</td>
                                  <td className="p-4 text-sm text-slate-600">{item.date}</td>
                                  <td className="p-4 text-right font-bold text-red-600">${item.amount.toFixed(2)}</td>
                                  <td className="p-4 text-center">
                                      <button disabled={isSaving} onClick={() => openPaymentModal(item)} className="text-xs bg-slate-800 text-white hover:bg-slate-900 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 mx-auto shadow-sm">
                                          <DollarSign size={14} /> Pagar
                                      </button>
                                  </td>
                               </tr>
                          ))}
                          {allDebts.length === 0 && (<tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin facturas por pagar.</td></tr>)}
                      </tbody>
                   </table>
              </div>
          )}
      </div>

      {/* MODAL DE CONFIRMACIÓN PARA SALDAR DEUDA - ACTUALIZADO CON FORMULARIO */}
      {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800">Registrar Cobro</h3>
                      <p className="text-slate-500 text-sm mt-1">Socio: <span className="font-bold text-slate-700">{confirmModal.debtor.member.fullName}</span></p>
                  </div>

                  <div className="bg-green-50 rounded-2xl p-4 border border-green-100 mb-6 text-center">
                      <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Total a Ingresar</span>
                      <p className="text-3xl font-black text-green-700">${confirmModal.debtor.amountOwed.toFixed(2)}</p>
                  </div>

                  <div className="space-y-4 mb-8">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Fecha del Pago</label>
                          <div className="relative">
                              <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                              <input 
                                type="date" 
                                className="w-full border-slate-200 border rounded-xl p-2.5 pl-10 focus:ring-4 focus:ring-teal-50 outline-none transition-all font-bold text-slate-700"
                                value={confirmModal.date}
                                onChange={e => setConfirmModal({...confirmModal, date: e.target.value})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Cuenta de Destino</label>
                          <div className="relative">
                              <Landmark size={16} className="absolute left-3 top-3 text-slate-400" />
                              <select 
                                className="w-full border-slate-200 border rounded-xl p-2.5 pl-10 focus:ring-4 focus:ring-teal-50 outline-none transition-all font-bold text-slate-700 appearance-none bg-white"
                                value={confirmModal.bankAccountId}
                                onChange={e => setConfirmModal({...confirmModal, bankAccountId: e.target.value})}
                              >
                                  <option value="">-- Seleccionar Banco --</option>
                                  {appState.bankAccounts.map(acc => (
                                      <option key={acc.id} value={acc.id}>{acc.bankName} (${acc.balance.toFixed(2)})</option>
                                  ))}
                              </select>
                          </div>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={executePayment}
                        disabled={isSaving || !confirmModal.bankAccountId}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-teal-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isSaving ? <Loader size={20} className="animate-spin" /> : <DollarSign size={20} />}
                          PROCESAR INGRESO AHORA
                      </button>
                      <button 
                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        disabled={isSaving}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl transition-colors"
                      >
                          Cancelar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal para CxP */}
      {isPayModalOpen && paymentItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                  <button onClick={() => setIsPayModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Confirmar Pago de Gasto</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-sm">
                      <p><span className="font-bold">Referencia:</span> {paymentItem.reference}</p>
                      <p className="text-xl font-black text-red-600 mt-2">${paymentItem.amount.toFixed(2)}</p>
                  </div>
                  <form onSubmit={handleProcessPayment} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fecha</label>
                          <input type="date" required className="w-full border p-2 rounded-lg" value={paymentConfig.date} onChange={e => setPaymentConfig({...paymentConfig, date: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Banco / Caja de Origen</label>
                          <select required className="w-full border p-2 rounded-lg" value={paymentConfig.bankAccountId} onChange={e => setPaymentConfig({...paymentConfig, bankAccountId: e.target.value})}>
                              <option value="">-- Seleccionar Banco --</option>
                              {appState.bankAccounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.bankName} (${acc.balance.toFixed(2)})</option>
                              ))}
                          </select>
                      </div>
                      <button type="submit" disabled={isSaving || !paymentConfig.bankAccountId} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                          {isSaving && <Loader size={18} className="animate-spin" />} Registrar Egreso Contable
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default DebtManagement;
