import React, { useState, useMemo } from 'react';
import { AppState, BankAccount, TransactionType } from '../types';
import { CreditCard, Plus, Wallet, X, ArrowUpRight, ArrowDownLeft, History, Calendar, FileText, Search, ArrowRightLeft, Banknote, Pencil } from 'lucide-react';
import { db } from '../services/dataService'; // IMPORT DB

interface BankAccountsProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
}

const BankAccounts: React.FC<BankAccountsProps> = ({ appState, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  
  const [newAccount, setNewAccount] = useState<Partial<BankAccount>>({
    bankName: '',
    accountNumber: '',
    type: 'Corriente',
    currency: 'USD',
    balance: 0
  });

  const totalLiquidity = appState.bankAccounts.reduce((acc, curr) => acc + curr.balance, 0);

  // Get selected account details
  const selectedAccount = useMemo(() => 
    appState.bankAccounts.find(b => b.id === selectedAccountId), 
  [appState.bankAccounts, selectedAccountId]);

  // Filter transactions for the selected account
  // Includes direct income/expense AND transfers (incoming or outgoing)
  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return appState.transactions
      .filter(t => t.relatedBankAccountId === selectedAccountId || t.transferToAccountId === selectedAccountId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appState.transactions, selectedAccountId]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedAccounts = [...appState.bankAccounts];
    let accountToSave: BankAccount;

    if (editingAccountId) {
        // Update existing
        accountToSave = {
            id: editingAccountId,
            bankName: newAccount.bankName!,
            accountNumber: newAccount.accountNumber!,
            type: newAccount.type as any,
            currency: 'USD',
            balance: Number(newAccount.balance)
        };
        updatedAccounts = updatedAccounts.map(acc => acc.id === editingAccountId ? accountToSave : acc);
    } else {
        // Create new
        accountToSave = {
            id: `bk-${Date.now()}`,
            bankName: newAccount.bankName!,
            accountNumber: newAccount.accountNumber!,
            type: newAccount.type as 'Corriente' | 'Ahorro' | 'Efectivo',
            currency: 'USD',
            balance: Number(newAccount.balance)
        };
        updatedAccounts = [...updatedAccounts, accountToSave];
    }

    // 1. Update Local State
    onUpdate({
      ...appState,
      bankAccounts: updatedAccounts
    });

    // 2. Persist to DB
    await db.bankAccounts.upsert(accountToSave);

    setIsModalOpen(false);
    setEditingAccountId(null);
    setNewAccount({ bankName: '', accountNumber: '', type: 'Corriente', currency: 'USD', balance: 0 });
  };

  const handleEditAccount = (e: React.MouseEvent, account: BankAccount) => {
      e.stopPropagation(); // Prevent card selection
      setEditingAccountId(account.id);
      setNewAccount({ ...account });
      setIsModalOpen(true);
  };

  const getTransferLabel = (tx: any) => {
      if (tx.type !== TransactionType.TRANSFER) return null;
      if (tx.relatedBankAccountId === selectedAccountId) {
          // Outgoing
          const dest = appState.bankAccounts.find(b => b.id === tx.transferToAccountId);
          return <span className="block text-xs text-red-400 font-normal">Destino: {dest?.bankName}</span>;
      } else {
          // Incoming
          const origin = appState.bankAccounts.find(b => b.id === tx.relatedBankAccountId);
          return <span className="block text-xs text-green-400 font-normal">Origen: {origin?.bankName}</span>;
      }
  };

  const getTypeBadgeColor = (type: string) => {
      switch (type) {
          case 'Corriente': return 'bg-blue-50 text-blue-700';
          case 'Ahorro': return 'bg-purple-50 text-purple-700';
          case 'Efectivo': return 'bg-emerald-50 text-emerald-700';
          default: return 'bg-slate-50 text-slate-700';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Cuentas Bancarias</h2>
           <p className="text-slate-500 text-sm">Gestión de liquidez y bancos</p>
        </div>
        <button 
          onClick={() => { setEditingAccountId(null); setNewAccount({ bankName: '', accountNumber: '', type: 'Corriente', currency: 'USD', balance: 0 }); setIsModalOpen(true); }}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} /> Nueva Cuenta
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-8 shadow-lg text-white max-w-md">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-full">
                <Wallet className="text-teal-400" />
            </div>
            <span className="text-slate-300 font-medium">Liquidez Total</span>
        </div>
        <div className="text-4xl font-bold tracking-tight">
            ${totalLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="mt-2 text-sm text-slate-400">
            Disponible en {appState.bankAccounts.length} cuentas
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {appState.bankAccounts.map(account => {
             const isSelected = selectedAccountId === account.id;
             return (
             <div 
                key={account.id} 
                onClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all cursor-pointer relative group ${
                    isSelected ? 'ring-2 ring-teal-500 border-teal-500' : 'border-slate-100 hover:border-slate-300'
                }`}
             >
                 {isSelected && (
                     <div className="absolute top-0 right-0 bg-teal-500 text-white px-2 py-0.5 text-[10px] font-bold rounded-bl-lg z-10">
                         SELECCIONADA
                     </div>
                 )}
                 
                 <div className="absolute top-4 right-4 z-20">
                     <button 
                        onClick={(e) => handleEditAccount(e, account)}
                        className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded transition-colors"
                        title="Editar Cuenta / Saldo"
                     >
                         <Pencil size={16} />
                     </button>
                 </div>

                 <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-lg ${isSelected ? 'bg-teal-50' : 'bg-slate-50'}`}>
                            {account.type === 'Efectivo' ? (
                                <Banknote className={isSelected ? 'text-teal-600' : 'text-slate-600'} size={24} />
                            ) : (
                                <CreditCard className={isSelected ? 'text-teal-600' : 'text-slate-600'} size={24} />
                            )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getTypeBadgeColor(account.type)}`}>
                            {account.type}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 pr-6">{account.bankName}</h3>
                    <p className="text-slate-400 text-sm tracking-wider mb-6">
                        {account.type === 'Efectivo' ? 'CAJA MENUDA' : `•••• ${account.accountNumber.slice(-4)}`}
                    </p>
                    
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase font-semibold">Saldo Disponible</span>
                        <span className="text-2xl font-bold text-slate-800">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                 </div>
                 
                 <div className={`px-6 py-3 border-t flex justify-between text-xs transition-colors ${isSelected ? 'bg-teal-50 border-teal-100' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                    <div className="flex items-center gap-1 font-medium">
                        {isSelected ? 'Click para ocultar detalles' : 'Click para ver movimientos'}
                    </div>
                    {isSelected ? <ArrowUpRight size={14} className="text-teal-600"/> : <Search size={14} />}
                 </div>
             </div>
         )})}
      </div>

      {/* Transaction History Section */}
      {selectedAccount && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-teal-600">
                          <History size={20} />
                      </div>
                      <div>
                          <h3 className="font-bold text-slate-800">Historial de Movimientos</h3>
                          <p className="text-xs text-slate-500">{selectedAccount.bankName} - {selectedAccount.accountNumber}</p>
                      </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAccountId(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  >
                      <X size={20} />
                  </button>
              </div>
              
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-semibold">
                          <tr>
                              <th className="p-4">Fecha</th>
                              <th className="p-4">Descripción</th>
                              <th className="p-4">Categoría</th>
                              <th className="p-4 text-center">Tipo</th>
                              <th className="p-4 text-right">Monto</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {accountTransactions.map(tx => {
                              // Determine effective type for this specific account context
                              let displayType = tx.type;
                              let isIncomingTransfer = false;
                              
                              if (tx.type === TransactionType.TRANSFER && tx.transferToAccountId === selectedAccountId) {
                                  isIncomingTransfer = true;
                              }

                              return (
                              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                          <Calendar size={14} className="text-slate-400" />
                                          {tx.date}
                                      </div>
                                  </td>
                                  <td className="p-4 text-sm font-medium text-slate-800">
                                      {tx.description}
                                      {tx.relatedSupplier && <span className="block text-xs text-slate-400 font-normal">Prov: {tx.relatedSupplier}</span>}
                                      {tx.relatedMemberId && <span className="block text-xs text-slate-400 font-normal">Socio Ref: {appState.members.find(m => m.id === tx.relatedMemberId)?.fullName}</span>}
                                      {getTransferLabel(tx)}
                                  </td>
                                  <td className="p-4">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
                                          <FileText size={10} /> {tx.category}
                                      </span>
                                  </td>
                                  <td className="p-4 text-center">
                                      {displayType === TransactionType.INCOME || isIncomingTransfer ? (
                                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${isIncomingTransfer ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-green-700 bg-green-50 border-green-100'}`}>
                                              {isIncomingTransfer ? <ArrowRightLeft size={12} /> : <ArrowDownLeft size={12} />} 
                                              {isIncomingTransfer ? 'Entrada' : 'Ingreso'}
                                          </span>
                                      ) : displayType === TransactionType.EXPENSE || (displayType === TransactionType.TRANSFER && !isIncomingTransfer) ? (
                                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${displayType === TransactionType.TRANSFER ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
                                              {displayType === TransactionType.TRANSFER ? <ArrowRightLeft size={12} /> : <ArrowUpRight size={12} />} 
                                              {displayType === TransactionType.TRANSFER ? 'Salida' : 'Egreso'}
                                          </span>
                                      ) : null}
                                  </td>
                                  <td className={`p-4 text-right font-bold text-sm ${
                                      (displayType === TransactionType.INCOME || isIncomingTransfer) ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                      {(displayType === TransactionType.INCOME || isIncomingTransfer) ? '+' : '-'}${tx.amount.toFixed(2)}
                                  </td>
                              </tr>
                          )})}
                          {accountTransactions.length === 0 && (
                              <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                      No hay movimientos registrados en esta cuenta.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Account Modal (Create / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingAccountId ? 'Editar Cuenta' : 'Registrar Cuenta Bancaria'}</h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Banco / Caja</label>
                <input required type="text" placeholder="Ej: Banco General" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                  value={newAccount.bankName} onChange={e => setNewAccount({...newAccount, bankName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Cuenta (o Ref.)</label>
                <input required type="text" placeholder="****-0000" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                  value={newAccount.accountNumber} onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none"
                        value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}>
                        <option value="Corriente">Corriente</option>
                        <option value="Ahorro">Ahorro</option>
                        <option value="Efectivo">Efectivo (Caja Menuda)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{editingAccountId ? 'Saldo Actual (Ajuste)' : 'Saldo Inicial'}</label>
                    <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                      value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})} />
                  </div>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-lg mt-2">
                {editingAccountId ? 'Guardar Cambios' : 'Crear Cuenta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccounts;
