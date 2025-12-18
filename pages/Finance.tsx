
import React, { useState, useMemo } from 'react';
import { AppState, Transaction, TransactionType, TransactionCategory, SystemUser, UserRole } from '../types';
import { PlusCircle, MinusCircle, DollarSign, CreditCard, BarChart as BarChartIcon, Briefcase, Users, Pencil, Zap, Truck, Filter, X, ArrowRightLeft, ArrowRight, TrendingUp, TrendingDown, FileText, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { db } from '../services/dataService'; // IMPORT DB
import { generatePaymentReceipt } from '../services/pdfService';

interface FinanceProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser?: SystemUser | null; // Pass user for logging
}

const Finance: React.FC<FinanceProps> = ({ appState, onUpdate, currentUser }) => {
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [filterMemberId, setFilterMemberId] = useState<string>('');
  const [filterProjectId, setFilterProjectId] = useState<string>('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [newTx, setNewTx] = useState<Partial<Transaction>>({
    type: TransactionType.INCOME,
    category: TransactionCategory.CONTRIBUTION,
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    relatedBankAccountId: appState.bankAccounts[0]?.id || '',
    transferToAccountId: '',
    relatedSupplierId: '', // Use ID for selection
    relatedSupplier: ''    // Use Text for Legacy/Display
  });

  const financialSummary = useMemo(() => {
    const income = appState.transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = appState.transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expense, balance: income - expense };
  }, [appState.transactions]);

  const projectExpensesData = useMemo(() => {
    const data: Record<string, number> = {};
    appState.transactions.forEach(tx => {
      if (tx.type === TransactionType.EXPENSE && tx.relatedProjectId) {
        data[tx.relatedProjectId] = (data[tx.relatedProjectId] || 0) + tx.amount;
      }
    });

    return Object.entries(data).map(([projectId, amount]) => {
      const project = appState.projects.find(p => p.id === projectId);
      return {
        name: project ? project.name : 'Desconocido',
        amount: amount
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [appState.transactions, appState.projects]);

  const filteredTransactions = appState.transactions
    .filter(t => {
      const matchType = filterType === 'ALL' || t.type === filterType;
      const matchMember = filterMemberId === '' || t.relatedMemberId === filterMemberId;
      const matchProject = filterProjectId === '' || t.relatedProjectId === filterProjectId;
      return matchType && matchMember && matchProject;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleEditTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setNewTx({ ...tx });
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
      console.log("Intentando eliminar transacción:", tx);

      if (!isAdmin) {
          alert("Solo los administradores pueden eliminar transacciones.");
          return;
      }

      if (!tx.id) {
          alert("Error: La transacción no tiene un ID válido.");
          return;
      }

      if (window.confirm(`¿Estás seguro de eliminar esta transacción?\n\n"${tx.description}" - $${tx.amount.toFixed(2)}\n\nSe revertirá el saldo de la cuenta bancaria asociada.`)) {
          
          try {
              let updatedAccounts = [...appState.bankAccounts];
              const amount = Number(tx.amount); // Asegurar que sea número
              
              // 1. Revert Balance Impact
              if (tx.type === TransactionType.TRANSFER) {
                  // Revert Transfer: Origin gets money back (+), Dest loses money (-)
                  if (tx.relatedBankAccountId) {
                      updatedAccounts = updatedAccounts.map(acc => 
                          acc.id === tx.relatedBankAccountId 
                          ? { ...acc, balance: Number(acc.balance) + amount } 
                          : acc
                      );
                  }
                  if (tx.transferToAccountId) {
                      updatedAccounts = updatedAccounts.map(acc => 
                          acc.id === tx.transferToAccountId 
                          ? { ...acc, balance: Number(acc.balance) - amount } 
                          : acc
                      );
                  }
              } else {
                  // Revert Income/Expense
                  if (tx.relatedBankAccountId) {
                      updatedAccounts = updatedAccounts.map(acc => {
                          if (acc.id === tx.relatedBankAccountId) {
                              // If it was Income, we subtract balance. If Expense, we add balance back.
                              const revertChange = tx.type === TransactionType.INCOME ? -amount : amount;
                              return { ...acc, balance: Number(acc.balance) + revertChange };
                          }
                          return acc;
                      });
                  }
              }

              // 2. Remove Transaction
              const updatedTransactions = appState.transactions.filter(t => t.id !== tx.id);

              // 3. Update State (Optimistic)
              console.log("Actualizando estado local...");
              onUpdate({
                  ...appState,
                  transactions: updatedTransactions,
                  bankAccounts: updatedAccounts
              });

              // 4. Persist to DB
              console.log("Eliminando de DB...");
              await db.transactions.delete(tx.id);
              
              console.log("Actualizando cuentas en DB...");
              for (const acc of updatedAccounts) {
                  await db.bankAccounts.upsert(acc);
              }

              // 5. Log Action
              if (currentUser) {
                  await db.logs.add({
                      userId: currentUser.id,
                      userName: currentUser.fullName,
                      action: 'ELIMINAR',
                      entity: 'Finanzas',
                      details: `Eliminó transacción: ${tx.description} (${tx.type} $${amount})`
                  });
              }
              
              console.log("Eliminación completada exitosamente.");

          } catch (error) {
              console.error("Error fatal al eliminar:", error);
              alert("Ocurrió un error al intentar eliminar la transacción. Revisa la consola para más detalles.");
          }
      }
  };

  const handleQuickContribution = () => {
    setEditingId(null);
    setNewTx({
      type: TransactionType.INCOME,
      category: TransactionCategory.CONTRIBUTION,
      amount: 0,
      description: 'Aporte Mensual - ',
      date: new Date().toISOString().split('T')[0],
      relatedBankAccountId: appState.bankAccounts[0]?.id || ''
    });
    setIsModalOpen(true);
  };

  const handleQuickOtherExpense = () => {
    setEditingId(null);
    setNewTx({
      type: TransactionType.EXPENSE,
      category: TransactionCategory.OTHER,
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      relatedBankAccountId: appState.bankAccounts[0]?.id || ''
    });
    setIsModalOpen(true);
  };

  const handleTransfer = () => {
    setEditingId(null);
    setNewTx({
      type: TransactionType.TRANSFER,
      category: TransactionCategory.INTERNAL,
      amount: 0,
      description: 'Transferencia interna',
      date: new Date().toISOString().split('T')[0],
      relatedBankAccountId: appState.bankAccounts[0]?.id || '',
      transferToAccountId: appState.bankAccounts.length > 1 ? appState.bankAccounts[1].id : ''
    });
    setIsModalOpen(true);
  }

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    const allowMemberLink = (newTx.type === TransactionType.INCOME && newTx.category === TransactionCategory.CONTRIBUTION) ||
                            (newTx.type === TransactionType.EXPENSE && newTx.category === TransactionCategory.OTHER);

    const allowSupplierLink = newTx.type === TransactionType.EXPENSE;

    if (newTx.type === TransactionType.TRANSFER) {
        if (!newTx.transferToAccountId) {
            alert("Debe seleccionar una cuenta de destino");
            return;
        }
        if (newTx.relatedBankAccountId === newTx.transferToAccountId) {
            alert("La cuenta de origen y destino no pueden ser la misma");
            return;
        }
    }

    let updatedAccounts = [...appState.bankAccounts];
    let updatedTransactions = [...appState.transactions];
    let updatedMembers = [...appState.members]; // Prepare to update members
    let transactionToSave: Transaction;
    let actionLog = 'CREAR';

    // Logic to handle Supplier Name/ID consistency
    let finalSupplierName = newTx.relatedSupplier;
    let finalSupplierId = newTx.relatedSupplierId;

    if (allowSupplierLink) {
         if (newTx.relatedSupplierId) {
             // If ID selected, force Name from List
             const sup = appState.suppliers.find(s => s.id === newTx.relatedSupplierId);
             if (sup) finalSupplierName = sup.businessName;
         } else if (newTx.relatedSupplier) {
             // If Name typed but no ID (Legacy or ad-hoc), clear ID
             finalSupplierId = undefined;
         }
    }

    try {
        if (editingId) {
          if (!isAdmin) return; // Guard clause
          actionLog = 'EDITAR';
          // UPDATE EXISTING
          const originalTx = appState.transactions.find(t => t.id === editingId);
          if (originalTx) {
            
            // Revert original impact
            if (originalTx.type === TransactionType.TRANSFER) {
                 if (originalTx.relatedBankAccountId) {
                     updatedAccounts = updatedAccounts.map(acc => acc.id === originalTx.relatedBankAccountId ? { ...acc, balance: acc.balance + originalTx.amount } : acc);
                 }
                 if (originalTx.transferToAccountId) {
                     updatedAccounts = updatedAccounts.map(acc => acc.id === originalTx.transferToAccountId ? { ...acc, balance: acc.balance - originalTx.amount } : acc);
                 }
            } else {
                 if (originalTx.relatedBankAccountId) {
                    updatedAccounts = updatedAccounts.map(acc => {
                        if (acc.id === originalTx.relatedBankAccountId) {
                            const revertChange = originalTx.type === TransactionType.INCOME ? -Number(originalTx.amount) : Number(originalTx.amount);
                            return { ...acc, balance: acc.balance + revertChange };
                        }
                        return acc;
                    });
                 }
            }

            // Prepare New Tx
            transactionToSave = {
                 ...originalTx,
                 date: newTx.date!,
                 description: newTx.description!,
                 amount: Number(newTx.amount),
                 type: newTx.type!,
                 category: newTx.category!,
                 relatedMemberId: allowMemberLink ? newTx.relatedMemberId : undefined,
                 relatedBankAccountId: newTx.relatedBankAccountId,
                 transferToAccountId: newTx.type === TransactionType.TRANSFER ? newTx.transferToAccountId : undefined,
                 relatedProjectId: newTx.category === TransactionCategory.PROJECT ? newTx.relatedProjectId : undefined,
                 relatedSupplier: allowSupplierLink ? finalSupplierName : undefined,
                 relatedSupplierId: allowSupplierLink ? finalSupplierId : undefined
            };

            // Apply new impact
            const amount = Number(newTx.amount);
            if (newTx.type === TransactionType.TRANSFER) {
                if (newTx.relatedBankAccountId) { // Origin: Subtract
                    updatedAccounts = updatedAccounts.map(acc => acc.id === newTx.relatedBankAccountId ? { ...acc, balance: acc.balance - amount } : acc);
                }
                if (newTx.transferToAccountId) { // Dest: Add
                    updatedAccounts = updatedAccounts.map(acc => acc.id === newTx.transferToAccountId ? { ...acc, balance: acc.balance + amount } : acc);
                }
            } else {
                if (newTx.relatedBankAccountId) {
                    updatedAccounts = updatedAccounts.map(acc => {
                        if (acc.id === newTx.relatedBankAccountId) {
                            const applyChange = newTx.type === TransactionType.INCOME ? amount : -amount;
                            return { ...acc, balance: acc.balance + applyChange };
                        }
                        return acc;
                    });
                }
            }

            updatedTransactions = updatedTransactions.map(t => t.id === editingId ? transactionToSave : t);
          } else { return; }

        } else {
          // CREATE NEW
          transactionToSave = {
            id: `tx-${Date.now()}`,
            date: newTx.date!,
            description: newTx.description!,
            amount: Number(newTx.amount),
            type: newTx.type!,
            category: newTx.category!,
            relatedMemberId: allowMemberLink ? newTx.relatedMemberId : undefined,
            relatedBankAccountId: newTx.relatedBankAccountId,
            transferToAccountId: newTx.type === TransactionType.TRANSFER ? newTx.transferToAccountId : undefined,
            relatedProjectId: newTx.category === TransactionCategory.PROJECT ? newTx.relatedProjectId : undefined,
            relatedSupplier: allowSupplierLink ? finalSupplierName : undefined,
            relatedSupplierId: allowSupplierLink ? finalSupplierId : undefined
          };

          const amount = Number(newTx.amount);

          if (newTx.type === TransactionType.TRANSFER) {
                updatedAccounts = updatedAccounts.map(acc => {
                    if (acc.id === newTx.relatedBankAccountId) return { ...acc, balance: acc.balance - amount };
                    if (acc.id === newTx.transferToAccountId) return { ...acc, balance: acc.balance + amount };
                    return acc;
                });
          } else {
              if (newTx.relatedBankAccountId) {
                  updatedAccounts = updatedAccounts.map(acc => {
                      if (acc.id === newTx.relatedBankAccountId) {
                          const change = newTx.type === TransactionType.INCOME ? amount : -amount;
                          return { ...acc, balance: acc.balance + change };
                      }
                      return acc;
                  });
              }
          }
          updatedTransactions = [transactionToSave, ...updatedTransactions];

          // AUTO-UPDATE MEMBER LAST PAYMENT DATE
          // If this is a Contribution (Ingreso/Aporte) linked to a Member, assume they are paying up to this date.
          if (transactionToSave.type === TransactionType.INCOME && 
              transactionToSave.category === TransactionCategory.CONTRIBUTION && 
              transactionToSave.relatedMemberId) {
              
              updatedMembers = updatedMembers.map(m => {
                  if (m.id === transactionToSave.relatedMemberId) {
                      // Update Last Payment Date to the transaction date
                      // Logic check: Only if transaction date is newer than existing?
                      // For simplicity, we assume new payment = update date.
                      // Ideally we should check if date > current lastPaymentDate
                      if (!m.lastPaymentDate || new Date(transactionToSave.date) > new Date(m.lastPaymentDate)) {
                          const updatedMember = { ...m, lastPaymentDate: transactionToSave.date };
                          db.members.upsert(updatedMember); // Fire and forget update to DB
                          return updatedMember;
                      }
                  }
                  return m;
              });
          }
        }

        // 1. Optimistic UI Update
        onUpdate({
          ...appState,
          transactions: updatedTransactions,
          bankAccounts: updatedAccounts,
          members: updatedMembers // Pass the updated members list
        });

        // 2. DB Update (Persist Transaction + Update Accounts)
        await db.transactions.upsert(transactionToSave);
        // We also need to save the bank account new balances
        for (const acc of updatedAccounts) {
            await db.bankAccounts.upsert(acc);
        }

        // 3. Log Action
        if (currentUser) {
            await db.logs.add({
                userId: currentUser.id,
                userName: currentUser.fullName,
                action: actionLog,
                entity: 'Finanzas',
                details: `${actionLog === 'CREAR' ? 'Registró' : 'Editó'} ${transactionToSave.type}: ${transactionToSave.description} ($${transactionToSave.amount})`
            });
        }
        
        setIsModalOpen(false);
        setEditingId(null);
        setNewTx({
            type: TransactionType.INCOME,
            category: TransactionCategory.CONTRIBUTION,
            amount: 0,
            description: '',
            date: new Date().toISOString().split('T')[0],
            relatedBankAccountId: appState.bankAccounts[0]?.id || '',
            relatedSupplierId: '',
            relatedSupplier: ''
        });

    } catch (error) {
        console.error("Error saving transaction:", error);
        alert("Error al guardar en la base de datos.");
    }
  };

  const getBankName = (id?: string) => {
      const bank = appState.bankAccounts.find(b => b.id === id);
      return bank ? bank.bankName : '-';
  };

  const getProjectName = (id?: string) => {
    const project = appState.projects.find(p => p.id === id);
    return project ? project.name : 'Proyecto';
  };

  const getMemberName = (id?: string) => {
    const member = appState.members.find(m => m.id === id);
    return member ? member.fullName : 'Socio';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Control Financiero</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { setEditingId(null); setNewTx({...newTx, type: TransactionType.INCOME, category: TransactionCategory.CONTRIBUTION}); setIsModalOpen(true); }}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm"
          >
            <PlusCircle size={18} /> Ingreso
          </button>
          <button 
             onClick={() => { setEditingId(null); setNewTx({...newTx, type: TransactionType.EXPENSE, category: TransactionCategory.MAINTENANCE}); setIsModalOpen(true); }}
             className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm"
          >
            <MinusCircle size={18} /> Gasto
          </button>
          <button 
             onClick={handleTransfer}
             className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm"
          >
            <ArrowRightLeft size={18} /> Transferencia
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Ingresos Totales</p>
              <h3 className="text-2xl font-bold text-green-600">${financialSummary.income.toFixed(2)}</h3>
           </div>
           <div className="bg-green-50 p-3 rounded-full text-green-600">
              <TrendingUp size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Gastos Totales</p>
              <h3 className="text-2xl font-bold text-red-600">${financialSummary.expense.toFixed(2)}</h3>
           </div>
           <div className="bg-red-50 p-3 rounded-full text-red-600">
              <TrendingDown size={24} />
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Balance Neto</p>
              <h3 className={`text-2xl font-bold ${financialSummary.balance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                  ${financialSummary.balance.toFixed(2)}
              </h3>
           </div>
           <div className={`p-3 rounded-full ${financialSummary.balance >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'}`}>
              <DollarSign size={24} />
           </div>
        </div>
      </div>

      
      {projectExpensesData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-700">
             <BarChartIcon size={20} className="text-teal-600" />
             <h3 className="text-lg font-bold">Gastos por Proyecto</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectExpensesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `$${val}`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Gasto Total']} 
                />
                <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Transaction List */}
       <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-700">Libro Diario</h3>
            
            <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                <div className="flex items-center gap-1 text-slate-400 mr-2">
                    <Filter size={14} />
                    <span className="text-xs font-medium">Filtrar:</span>
                </div>

                <div className="flex gap-1 border-r border-slate-100 pr-2 mr-1">
                    <button 
                        onClick={() => setFilterType('ALL')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setFilterType(TransactionType.INCOME)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterType === TransactionType.INCOME ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Ingresos
                    </button>
                    <button 
                        onClick={() => setFilterType(TransactionType.EXPENSE)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterType === TransactionType.EXPENSE ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Gastos
                    </button>
                    <button 
                        onClick={() => setFilterType(TransactionType.TRANSFER)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterType === TransactionType.TRANSFER ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Transf.
                    </button>
                </div>

                <select 
                    value={filterMemberId}
                    onChange={(e) => setFilterMemberId(e.target.value)}
                    className="text-xs border-slate-200 rounded-md py-1.5 pl-2 pr-6 bg-slate-50 hover:bg-white border focus:ring-2 focus:ring-teal-500 outline-none"
                    style={{maxWidth: '150px'}}
                >
                    <option value="">Todos los Socios</option>
                    {appState.members.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                </select>

                <select 
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                    className="text-xs border-slate-200 rounded-md py-1.5 pl-2 pr-6 bg-slate-50 hover:bg-white border focus:ring-2 focus:ring-teal-500 outline-none"
                    style={{maxWidth: '150px'}}
                >
                    <option value="">Todos los Proyectos</option>
                    {appState.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                {(filterMemberId || filterProjectId) && (
                    <button 
                        onClick={() => { setFilterMemberId(''); setFilterProjectId(''); }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Limpiar filtros"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <tr>
                    <th className="p-4 font-medium text-sm">Fecha</th>
                    <th className="p-4 font-medium text-sm">Descripción</th>
                    <th className="p-4 font-medium text-sm">Referencia</th>
                    <th className="p-4 font-medium text-sm">Categoría</th>
                    <th className="p-4 font-medium text-sm">Cuenta</th>
                    <th className="p-4 font-medium text-sm text-right">Monto</th>
                    <th className="p-4 font-medium text-sm text-center">Tipo</th>
                    <th className="p-4 font-medium text-sm text-center">Acciones</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-sm text-slate-600 whitespace-nowrap">{tx.date}</td>
                    <td className="p-4 font-medium text-slate-800">
                        {tx.description}
                    </td>
                    <td className="p-4 text-sm">
                        <div className="flex flex-col gap-1 items-start">
                            {tx.relatedMemberId && (
                                <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-100 whitespace-nowrap">
                                    <Users size={10} /> {getMemberName(tx.relatedMemberId)}
                                </span>
                            )}
                            {tx.relatedProjectId && (
                                <span className="flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-teal-100 whitespace-nowrap">
                                    <Briefcase size={10} /> {getProjectName(tx.relatedProjectId)}
                                </span>
                            )}
                            {tx.relatedSupplier && (
                                <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-orange-100 whitespace-nowrap">
                                    <Truck size={10} /> {tx.relatedSupplier}
                                </span>
                            )}
                            {!tx.relatedMemberId && !tx.relatedProjectId && !tx.relatedSupplier && (
                                <span className="text-slate-300 px-2 text-xs">-</span>
                            )}
                        </div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs whitespace-nowrap">{tx.category}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                            <CreditCard size={14} /> {getBankName(tx.relatedBankAccountId)}
                        </div>
                        {tx.type === TransactionType.TRANSFER && tx.transferToAccountId && (
                            <div className="flex items-center gap-1 text-xs text-blue-500 mt-1">
                                <ArrowRight size={10} /> {getBankName(tx.transferToAccountId)}
                            </div>
                        )}
                    </td>
                    <td className={`p-4 text-right font-bold ${
                        tx.type === TransactionType.INCOME ? 'text-green-600' : 
                        tx.type === TransactionType.EXPENSE ? 'text-red-600' : 'text-blue-600'
                    }`}>
                        {tx.type === TransactionType.EXPENSE ? '-' : tx.type === TransactionType.INCOME ? '+' : ''}
                        ${tx.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                        {tx.type === TransactionType.INCOME ? (
                            <span className="inline-block p-1 bg-green-100 text-green-600 rounded-full"><DollarSign size={14} /></span>
                        ) : tx.type === TransactionType.EXPENSE ? (
                            <span className="inline-block p-1 bg-red-100 text-red-600 rounded-full"><MinusCircle size={14} /></span>
                        ) : (
                            <span className="inline-block p-1 bg-blue-100 text-blue-600 rounded-full"><ArrowRightLeft size={14} /></span>
                        )}
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                            {isAdmin && (
                                <>
                                    <button 
                                        onClick={() => handleEditTransaction(tx)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar Transacción"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteTransaction(tx)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar Transacción"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                            {tx.type === TransactionType.INCOME && (
                                <button 
                                    onClick={() => {
                                        const member = tx.relatedMemberId ? appState.members.find(m => m.id === tx.relatedMemberId) : undefined;
                                        const bankName = appState.bankAccounts.find(b => b.id === tx.relatedBankAccountId)?.bankName;
                                        generatePaymentReceipt(tx, member, bankName);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                    title="Descargar Recibo"
                                >
                                    <FileText size={16} />
                                </button>
                            )}
                        </div>
                    </td>
                    </tr>
                ))}
                {filteredTransactions.length === 0 && (
                    <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">No hay movimientos registrados con los filtros actuales.</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl">
             <h3 className="text-xl font-bold text-slate-800 mb-4">
               {editingId ? 'Editar Movimiento' : (
                   newTx.type === TransactionType.INCOME ? 'Registrar Ingreso' : 
                   newTx.type === TransactionType.EXPENSE ? 'Registrar Gasto' : 'Registrar Transferencia'
               )}
             </h3>
             <form onSubmit={handleSaveTransaction} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                   <input required type="date" className="w-full border border-slate-300 rounded-lg p-2" 
                    value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                   <input required type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-lg p-2" 
                    value={newTx.amount} onChange={e => setNewTx({...newTx, amount: Number(e.target.value)})} />
                 </div>
               </div>
               
               {newTx.type === TransactionType.TRANSFER ? (
                   <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                       <div>
                           <label className="block text-xs font-bold text-blue-700 mb-1 uppercase">Origen</label>
                           <select required className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                                value={newTx.relatedBankAccountId} onChange={e => setNewTx({...newTx, relatedBankAccountId: e.target.value})}>
                                <option value="">Seleccionar</option>
                                {appState.bankAccounts.map(b => (
                                    <option key={b.id} value={b.id}>{b.bankName} - ${b.balance}</option>
                                ))}
                            </select>
                       </div>
                       <div className="flex items-center justify-center pt-4">
                           <ArrowRight className="text-blue-400" />
                       </div>
                       <div className="col-start-2">
                           <label className="block text-xs font-bold text-blue-700 mb-1 uppercase">Destino</label>
                           <select required className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                                value={newTx.transferToAccountId} onChange={e => setNewTx({...newTx, transferToAccountId: e.target.value})}>
                                <option value="">Seleccionar</option>
                                {appState.bankAccounts.filter(b => b.id !== newTx.relatedBankAccountId).map(b => (
                                    <option key={b.id} value={b.id}>{b.bankName} - ${b.balance}</option>
                                ))}
                            </select>
                       </div>
                   </div>
               ) : (
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Bancaria Afectada</label>
                      <select required className="w-full border border-slate-300 rounded-lg p-2"
                        value={newTx.relatedBankAccountId} onChange={e => setNewTx({...newTx, relatedBankAccountId: e.target.value})}>
                        <option value="">-- Seleccionar Banco --</option>
                        {appState.bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber} (${b.balance})</option>
                        ))}
                      </select>
                   </div>
               )}

               {newTx.type !== TransactionType.TRANSFER && (
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                      <select required className="w-full border border-slate-300 rounded-lg p-2"
                        value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value as TransactionCategory})}>
                        {Object.values(TransactionCategory).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
               )}

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                 <input required type="text" placeholder="Ej: Pago de cuota mensual..." className="w-full border border-slate-300 rounded-lg p-2" 
                   value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} />
               </div>

               {/* Member Selection */}
               {((newTx.type === TransactionType.INCOME && newTx.category === TransactionCategory.CONTRIBUTION) || 
                 (newTx.type === TransactionType.EXPENSE && newTx.category === TransactionCategory.OTHER)) && (
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Socio (Opcional)</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2"
                      value={newTx.relatedMemberId || ''} onChange={e => setNewTx({...newTx, relatedMemberId: e.target.value})}>
                      <option value="">-- Seleccionar Socio --</option>
                      {appState.members.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                        {newTx.type === TransactionType.INCOME ? 'Se vinculará este aporte al historial del socio y actualizará su fecha de último pago.' : 'Se vinculará este gasto al registro del socio.'}
                    </p>
                 </div>
               )}
               
               {/* Project Selection */}
               {newTx.category === TransactionCategory.PROJECT && (
                 <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                    <label className="block text-sm font-medium text-teal-800 mb-1">Seleccionar Proyecto</label>
                    <select className="w-full border border-teal-200 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                      value={newTx.relatedProjectId || ''} onChange={e => setNewTx({...newTx, relatedProjectId: e.target.value})}>
                      <option value="">-- Sin Asignar --</option>
                      {appState.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-teal-600 mt-1">Este gasto se sumará al presupuesto ejecutado del proyecto.</p>
                 </div>
               )}

               {/* Supplier Selection */}
               {newTx.type === TransactionType.EXPENSE && (
                 <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <label className="block text-sm font-medium text-orange-800 mb-1">Proveedor / Beneficiario</label>
                    
                    {/* Option 1: Select from Supplier List */}
                    <select 
                        className="w-full border border-orange-200 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white mb-2"
                        value={newTx.relatedSupplierId || ''}
                        onChange={e => {
                            const selectedId = e.target.value;
                            if (selectedId) {
                                const sup = appState.suppliers.find(s => s.id === selectedId);
                                setNewTx({...newTx, relatedSupplierId: selectedId, relatedSupplier: sup?.businessName || ''});
                            } else {
                                setNewTx({...newTx, relatedSupplierId: '', relatedSupplier: ''});
                            }
                        }}
                    >
                        <option value="">-- Seleccionar de lista --</option>
                        {appState.suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.businessName} (RUC: {s.ruc})</option>
                        ))}
                    </select>

                    <div className="text-center text-xs text-orange-400 font-bold mb-1">- O -</div>

                    {/* Option 2: Free Text */}
                    <input 
                        type="text"
                        placeholder="Escribir nombre manualmente..."
                        className="w-full border border-orange-200 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                        value={newTx.relatedSupplierId ? '' : newTx.relatedSupplier || ''}
                        onChange={e => setNewTx({...newTx, relatedSupplier: e.target.value, relatedSupplierId: ''})}
                        disabled={!!newTx.relatedSupplierId}
                    />
                    <p className="text-xs text-orange-600 mt-1">Seleccione un proveedor registrado o escriba el nombre si es eventual.</p>
                 </div>
               )}

               <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                 <button type="submit" className={`px-4 py-2 text-white rounded-lg ${
                     newTx.type === TransactionType.INCOME ? 'bg-green-600 hover:bg-green-700' : 
                     newTx.type === TransactionType.EXPENSE ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                 }`}>
                   {editingId ? 'Guardar Cambios' : 'Guardar Movimiento'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
