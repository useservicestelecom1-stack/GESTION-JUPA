
import React, { useState, useMemo } from 'react';
import { AppState, InventoryItem, PurchaseOrder, PurchaseStatus, SystemUser, UserRole, Transaction, TransactionType, TransactionCategory, MaintenanceLog } from '../types';
import { Archive, Plus, ClipboardList, ShoppingCart, CheckCircle, Clock, AlertCircle, Trash2, Pencil, X, DollarSign, Loader, List, Search, PackagePlus, ChevronDown, ChevronUp, User, Send, PackageCheck, CreditCard, Terminal, ShieldAlert, Package, Calendar, Beaker, TestTube, Save, Settings2, Info, Target, Truck, Minus, ArrowRight } from 'lucide-react';
import { db } from '../services/dataService';

interface InventoryProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: SystemUser | null;
}

const Inventory: React.FC<InventoryProps> = ({ appState, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'CHEMICAL_CONTROL' | 'PURCHASE_ORDERS' | 'CATALOG' | 'STOCK'>('CHEMICAL_CONTROL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canManage = isAdmin || currentUser?.role === UserRole.EDITOR;
  
  // Modales y Estados de UI
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [receiveConfirmModal, setReceiveConfirmModal] = useState<{ 
    isOpen: boolean; order: PurchaseOrder | null; receptionDate: string;
  }>({ 
    isOpen: false, order: null, receptionDate: new Date().toISOString().split('T')[0]
  });

  // --- ESTADOS CALCULADORA QUÍMICA ---
  const POOL_VOLUME_GAL = 610000;
  const POOL_VOLUME_M3 = 2309.1; 
  
  const [readings, setReadings] = useState({ 
    ph: 7.8, 
    chlorine: 1.0, 
    alkalinity: 80,
    targetPh: 7.4, 
    targetChlorine: 3.0,
    targetAlkalinity: 100
  });

  const [chemConfig, setChemConfig] = useState({ 
    chlorinePurity: 65,
    phDownPurity: 93,
    alkalinityPurity: 100
  });

  const [productMapping, setProductMapping] = useState({
      chlorineItemId: appState.inventory.find(i => i.name.toLowerCase().includes('cloro'))?.id || '',
      phDownItemId: appState.inventory.find(i => i.name.toLowerCase().includes('ácido') || i.name.toLowerCase().includes('ph-'))?.id || '',
      alkalinityItemId: appState.inventory.find(i => i.name.toLowerCase().includes('alcalinidad') || i.name.toLowerCase().includes('bicarbonato'))?.id || ''
  });

  // --- ESTADOS DESCARGA MANUAL ---
  const [manualUsageItems, setManualUsageItems] = useState<{ itemId: string; amount: number }[]>([]);
  const [currentManualItem, setCurrentManualItem] = useState({ itemId: '', amount: 0 });

  const dosages = useMemo(() => {
      const factorVol10k = POOL_VOLUME_GAL / 10000;
      const chlorineDiff = Math.max(0, readings.targetChlorine - readings.chlorine);
      const baseClLbsPerPpm = 2 / 16; 
      const chlorineNeededLbs = chlorineDiff * baseClLbsPerPpm * factorVol10k * (65 / chemConfig.chlorinePurity);
      const phDownDiff = Math.max(0, readings.ph - readings.targetPh);
      const basePhDownLbsPer02 = 1.0; 
      const phDownNeededLbs = (phDownDiff / 0.2) * basePhDownLbsPer02 * factorVol10k * (93 / chemConfig.phDownPurity);
      const alkDiff = Math.max(0, readings.targetAlkalinity - readings.alkalinity);
      const factorAlkM3 = POOL_VOLUME_M3 / 50;
      const alkNeededLbs = (alkDiff / 10) * factorAlkM3 * 2.20462 * (100 / chemConfig.alkalinityPurity);

      return {
          chlorine: parseFloat(chlorineNeededLbs.toFixed(2)),
          phDown: parseFloat(phDownNeededLbs.toFixed(2)),
          alkalinity: parseFloat(alkNeededLbs.toFixed(2))
      };
  }, [readings, chemConfig]);

  const [processStatus, setProcessStatus] = useState<{
      steps: { id: string; label: string; status: 'pending' | 'loading' | 'success' | 'error'; error?: string }[];
      isVisible: boolean;
      isDone: boolean;
  }>({ isVisible: false, isDone: false, steps: [] });

  const updateStep = (id: string, status: any, error?: string) => {
      setProcessStatus(prev => ({ ...prev, steps: prev.steps.map(s => s.id === id ? { ...s, status, error } : s) }));
  };

  const handleApplyMaintenance = async (isManual: boolean = false) => {
      if (!canManage) return;
      setIsSaving(true);
      const steps = [
          { id: 'check', label: 'Validando stock disponible (lb)', status: 'pending' },
          { id: 'deduct', label: 'Actualizando inventario físico', status: 'pending' },
          { id: 'log', label: 'Registrando en bitácora operativa', status: 'pending' }
      ];
      setProcessStatus({ isVisible: true, isDone: false, steps: steps as any });

      try {
          updateStep('check', 'loading');
          
          let itemsToProcess: { id: string; amount: number; label: string }[] = [];
          
          if (isManual) {
              if (manualUsageItems.length === 0) throw new Error("Debe añadir al menos un insumo a la lista manual.");
              itemsToProcess = manualUsageItems.map(item => {
                  const inv = appState.inventory.find(i => i.id === item.itemId);
                  return { id: item.itemId, amount: item.amount, label: inv?.name || 'Producto' };
              });
          } else {
              itemsToProcess = [
                  { id: productMapping.chlorineItemId, amount: dosages.chlorine, label: 'Cloro' },
                  { id: productMapping.phDownItemId, amount: dosages.phDown, label: 'Reductor pH' },
                  { id: productMapping.alkalinityItemId, amount: dosages.alkalinity, label: 'Alcalinidad' }
              ].filter(item => item.amount > 0);
              
              if (itemsToProcess.length === 0) throw new Error("No hay químicos por aplicar según los niveles actuales.");
          }

          for (const check of itemsToProcess) {
              const invItem = appState.inventory.find(i => i.id === check.id);
              if (!invItem) throw new Error(`El producto ${check.label} no está vinculado correctamente.`);
              if (invItem.quantity < check.amount) throw new Error(`Stock insuficiente de ${invItem.name}. Requerido: ${check.amount} lb.`);
          }
          updateStep('check', 'success');

          updateStep('deduct', 'loading');
          const currentInv = [...appState.inventory];
          const itemsUsedLog = [];
          for (const itemOp of itemsToProcess) {
              const idx = currentInv.findIndex(i => i.id === itemOp.id);
              const updated = { ...currentInv[idx], quantity: Number((currentInv[idx].quantity - itemOp.amount).toFixed(2)) };
              await db.inventory.upsert(updated);
              currentInv[idx] = updated;
              itemsUsedLog.push({ itemId: itemOp.id, itemName: updated.name, amountUsed: itemOp.amount });
          }
          updateStep('deduct', 'success');

          updateStep('log', 'loading');
          const newLog: MaintenanceLog = {
              id: `mnt-${Date.now()}`, date: new Date().toISOString().split('T')[0],
              performedBy: currentUser?.fullName || 'Operador',
              description: isManual ? `Descarga Manual de Insumos` : `Ajuste Químico Sugerido (610k gal)`,
              itemsUsed: itemsUsedLog, 
              phReading: readings.ph, chlorineReading: readings.chlorine, alkalinityReading: readings.alkalinity,
              notes: isManual ? 'Despacho manual de productos para mantenimiento correctivo.' : `pH: ${readings.ph} -> ${readings.targetPh}. Sugerencia aplicada.`
          };
          await db.maintenanceLogs.upsert(newLog);
          onUpdate({ ...appState, inventory: currentInv, maintenanceLogs: [newLog, ...appState.maintenanceLogs] });
          updateStep('log', 'success');
          
          if (isManual) setManualUsageItems([]);
          setProcessStatus(prev => ({ ...prev, isDone: true }));
      } catch (e: any) {
          updateStep('check', 'error', e.message);
          setProcessStatus(prev => ({ ...prev, isDone: true }));
      } finally { setIsSaving(false); }
  };

  const getProductStock = (itemId: string) => {
      const item = appState.inventory.find(i => i.id === itemId);
      return item ? `${item.quantity} ${item.unit}` : '0 lb';
  };

  // --- GESTIÓN DE COMPRAS ---
  const [newPurchase, setNewPurchase] = useState<Partial<PurchaseOrder>>({ supplierId: '', date: new Date().toISOString().split('T')[0], items: [], totalAmount: 0 });
  const [pItem, setPItem] = useState({ id: '', name: '', qty: 1, price: 0 });
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: '', unit: 'lb', quantity: 0, unitCost: 0, minThreshold: 5 });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const filteredInventory = useMemo(() => appState.inventory.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())), [appState.inventory, searchTerm]);

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Operaciones de Agua</h2>
            <p className="text-slate-500 text-sm">Gestión química integral para 610,000 galones.</p>
         </div>
         {canManage && (
            <div className="flex gap-2">
                <button onClick={() => { setEditingItemId(null); setNewItem({name: '', unit: 'lb', quantity: 0, unitCost: 0, minThreshold: 5}); setShowItemModal(true); }} className="bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-slate-50 transition-all"><PackagePlus size={20} /> Nuevo Insumo</button>
                <button onClick={() => { setNewPurchase({supplierId: '', date: new Date().toISOString().split('T')[0], items: []}); setShowPurchaseModal(true); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black shadow-lg hover:bg-black transition-all transform hover:scale-105 active:scale-95"><ShoppingCart size={20} /> GESTIONAR COMPRA</button>
            </div>
         )}
       </div>

       {processStatus.isVisible && (
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-slate-700 mb-6">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black flex items-center gap-2 text-teal-400"><Terminal size={22} /> MONITOR DE PROCESO</h3>
                  {processStatus.isDone && (<button onClick={() => setProcessStatus({isVisible: false, isDone: false, steps: []})} className="text-[10px] bg-slate-800 px-4 py-1.5 rounded-full font-black uppercase border border-slate-600">Cerrar</button>)}
              </div>
              <div className="space-y-4">
                  {processStatus.steps.map(step => (
                      <div key={step.id} className="flex flex-col">
                          <div className="flex items-center gap-4">
                            <div className="w-6 flex justify-center">
                                {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-700"></div>}
                                {step.status === 'loading' && <Loader size={16} className="animate-spin text-teal-400" />}
                                {step.status === 'success' && <CheckCircle size={16} className="text-green-500" />}
                                {step.status === 'error' && <ShieldAlert size={16} className="text-red-500" />}
                            </div>
                            <span className={`text-sm font-medium ${step.status === 'error' ? 'text-red-400' : 'text-slate-300'}`}>{step.label}</span>
                          </div>
                          {step.error && (<div className="ml-10 mt-1 p-3 bg-red-900/30 border border-red-800 rounded-xl text-xs text-red-300 font-mono">{step.error}</div>)}
                      </div>
                  ))}
              </div>
          </div>
       )}

       <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200">
         <button onClick={() => setActiveTab('CHEMICAL_CONTROL')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${activeTab === 'CHEMICAL_CONTROL' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600'}`}><Beaker size={18} /> Control Químico</button>
         <button onClick={() => setActiveTab('PURCHASE_ORDERS')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${activeTab === 'PURCHASE_ORDERS' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600'}`}><ShoppingCart size={18} /> Historial Compras</button>
         <button onClick={() => setActiveTab('STOCK')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${activeTab === 'STOCK' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600'}`}><Archive size={18} /> Stock Físico</button>
         <button onClick={() => setActiveTab('CATALOG')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${activeTab === 'CATALOG' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600'}`}><List size={18} /> Catálogo</button>
       </div>

       {activeTab === 'CHEMICAL_CONTROL' && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
               <div className="lg:col-span-1 space-y-6">
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-widest"><Target className="text-teal-600" size={20}/> Análisis de Agua</h3>
                        <div className="space-y-6">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nivel pH</label>
                                <div className="flex gap-2 items-center">
                                    <input type="number" step="0.1" className="w-1/2 border-slate-200 border-2 p-2 rounded-lg font-black text-orange-700" value={readings.ph} onChange={e => setReadings({...readings, ph: parseFloat(e.target.value)})} />
                                    <span className="text-slate-300">→</span>
                                    <input type="number" step="0.1" className="w-1/2 border-orange-200 border-2 p-2 rounded-lg font-black text-orange-600 bg-orange-50" value={readings.targetPh} onChange={e => setReadings({...readings, targetPh: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Cloro Libre (PPM)</label>
                                <div className="flex gap-2 items-center">
                                    <input type="number" step="0.1" className="w-1/2 border-slate-200 border-2 p-2 rounded-lg font-black text-teal-700" value={readings.chlorine} onChange={e => setReadings({...readings, chlorine: parseFloat(e.target.value)})} />
                                    <span className="text-slate-300">→</span>
                                    <input type="number" step="0.1" className="w-1/2 border-teal-200 border-2 p-2 rounded-lg font-black text-teal-600 bg-teal-50" value={readings.targetChlorine} onChange={e => setReadings({...readings, targetChlorine: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Alcalinidad (PPM)</label>
                                <div className="flex gap-2 items-center">
                                    <input type="number" step="1" className="w-1/2 border-slate-200 border-2 p-2 rounded-lg font-black text-blue-700" value={readings.alkalinity} onChange={e => setReadings({...readings, alkalinity: parseFloat(e.target.value)})} />
                                    <span className="text-slate-300">→</span>
                                    <input type="number" step="1" className="w-1/2 border-blue-200 border-2 p-2 rounded-lg font-black text-blue-600 bg-blue-50" value={readings.targetAlkalinity} onChange={e => setReadings({...readings, targetAlkalinity: parseFloat(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                   </div>
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-widest"><Settings2 className="text-blue-600" size={20}/> Config. Pureza</h3>
                        <div className="space-y-4">
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cloro Activo (%)</label><input type="number" className="w-full border p-2 rounded-lg font-bold text-xs" value={chemConfig.chlorinePurity} onChange={e => setChemConfig({...chemConfig, chlorinePurity: Number(e.target.value)})} /></div>
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Reductor/Ácido (%)</label><input type="number" className="w-full border p-2 rounded-lg font-bold text-xs" value={chemConfig.phDownPurity} onChange={e => setChemConfig({...chemConfig, phDownPurity: Number(e.target.value)})} /></div>
                            <div className="pt-4 border-t">
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Producto Almacén (pH-)</label>
                                <select className="w-full border p-2 rounded-lg text-xs font-bold bg-slate-50" value={productMapping.phDownItemId} onChange={e => setProductMapping({...productMapping, phDownItemId: e.target.value})}>
                                    <option value="">-- No mapeado --</option>
                                    {appState.inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <p className="text-[9px] text-teal-600 font-bold mt-1 text-right">Stock: {getProductStock(productMapping.phDownItemId)}</p>
                            </div>
                        </div>
                   </div>
               </div>

               <div className="lg:col-span-3 space-y-6">
                   {/* MODULO 1: CALCULO AUTOMATICO */}
                   <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-5"><Beaker size={150} /></div>
                       <div className="relative z-10">
                           <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                                <h3 className="text-teal-400 font-black tracking-widest text-sm uppercase">Cálculo de Dosificación Automático</h3>
                                <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 uppercase">
                                    <Info size={14}/> Basado en lecturas y metas
                                </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className={`p-6 rounded-3xl border-2 transition-all ${dosages.phDown > 0 ? 'bg-orange-600/10 border-orange-500/30' : 'bg-slate-800/20 border-white/5 opacity-50'}`}>
                                    <span className="text-[10px] text-orange-300 font-black uppercase tracking-widest">Reductor pH (Ácido)</span>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <span className="text-5xl font-black text-white">{dosages.phDown}</span>
                                        <span className="text-xl font-bold text-orange-500">lb</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-2">Baja {Math.max(0, readings.ph - readings.targetPh).toFixed(2)} unidades</p>
                                </div>
                                <div className={`p-6 rounded-3xl border-2 transition-all ${dosages.chlorine > 0 ? 'bg-teal-600/10 border-teal-500/30' : 'bg-slate-800/20 border-white/5 opacity-50'}`}>
                                    <span className="text-[10px] text-teal-300 font-black uppercase tracking-widest">Sugerencia Cloro</span>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <span className="text-5xl font-black text-white">{dosages.chlorine}</span>
                                        <span className="text-xl font-bold text-teal-500">lb</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-2">Sube {Math.max(0, readings.targetChlorine - readings.chlorine).toFixed(1)} PPM</p>
                                </div>
                                <div className={`p-6 rounded-3xl border-2 transition-all ${dosages.alkalinity > 0 ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-800/20 border-white/5 opacity-50'}`}>
                                    <span className="text-[10px] text-blue-300 font-black uppercase tracking-widest">Alcalinidad</span>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <span className="text-5xl font-black text-white">{dosages.alkalinity}</span>
                                        <span className="text-xl font-bold text-blue-500">lb</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-2">Sube {Math.max(0, readings.targetAlkalinity - readings.alkalinity)} PPM</p>
                                </div>
                           </div>
                           <div className="flex justify-end">
                               <button onClick={() => handleApplyMaintenance(false)} disabled={isSaving || (dosages.chlorine === 0 && dosages.phDown === 0 && dosages.alkalinity === 0)} className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-12 py-5 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm">
                                   <Save size={24} /> Aplicar Sugerencia Automática
                               </button>
                           </div>
                       </div>
                   </div>

                   {/* MODULO 2: DESCARGA MANUAL DE INSUMOS */}
                   <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-4">
                            <div>
                                <h3 className="text-slate-800 font-black tracking-widest text-sm uppercase flex items-center gap-2">
                                    <Minus className="text-red-500" size={20} /> Descarga Manual de Insumos
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Uso correctivo o mantenimiento adicional</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <div className="md:col-span-6">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Seleccionar Insumo del Inventario</label>
                                <select 
                                    className="w-full border-2 border-white bg-white p-3.5 rounded-2xl font-bold text-slate-700 shadow-sm outline-none"
                                    value={currentManualItem.itemId}
                                    onChange={e => setCurrentManualItem({ ...currentManualItem, itemId: e.target.value })}
                                >
                                    <option value="">-- Seleccionar producto --</option>
                                    {appState.inventory.map(i => (
                                        <option key={i.id} value={i.id}>{i.name} (Disp: {i.quantity} lb)</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Cantidad a Retirar (lb)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full border-2 border-white bg-white p-3.5 rounded-2xl font-black text-slate-700 shadow-sm outline-none"
                                    value={currentManualItem.amount}
                                    onChange={e => setCurrentManualItem({ ...currentManualItem, amount: Number(e.target.value) })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button 
                                    onClick={() => {
                                        if (!currentManualItem.itemId || currentManualItem.amount <= 0) return;
                                        setManualUsageItems([...manualUsageItems, currentManualItem]);
                                        setCurrentManualItem({ itemId: '', amount: 0 });
                                    }}
                                    className="w-full bg-slate-800 text-white p-4 rounded-2xl font-black hover:bg-black transition-all shadow-lg active:scale-95"
                                >
                                    Añadir
                                </button>
                            </div>
                        </div>

                        {manualUsageItems.length > 0 && (
                            <div className="space-y-3 mb-8">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Lista de Despacho</h4>
                                {manualUsageItems.map((item, idx) => {
                                    const inv = appState.inventory.find(i => i.id === item.itemId);
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm">{inv?.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Inventario Físico</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-red-600">-{item.amount} <span className="text-xs">lb</span></p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Consumo Manual</p>
                                                </div>
                                                <button 
                                                    onClick={() => setManualUsageItems(manualUsageItems.filter((_, i) => i !== idx))}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-end pt-4">
                                    <button 
                                        onClick={() => handleApplyMaintenance(true)}
                                        disabled={isSaving}
                                        className="bg-red-600 hover:bg-red-700 text-white font-black px-10 py-5 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm"
                                    >
                                        <ArrowRight size={24} /> Procesar Salida de Almacén
                                    </button>
                                </div>
                            </div>
                        )}
                   </div>

                   {/* HISTORIAL */}
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-5 bg-slate-50 border-b font-black text-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
                                <ClipboardList size={20} className="text-teal-600"/> Historial Operativo
                            </div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase"><tr><th className="p-4">Fecha</th><th className="p-4">Tipo Procedimiento</th><th className="p-4">Insumos Despachados</th><th className="p-4">Operador</th></tr></thead><tbody className="divide-y divide-slate-100">{appState.maintenanceLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-600">{log.date}</td><td className="p-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border ${log.description.includes('Manual') ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>{log.description}</span></td><td className="p-4"><div className="flex flex-wrap gap-1">{log.itemsUsed.map((it, idx) => (<span key={idx} className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter">{it.itemName}: {it.amountUsed} lb</span>))}</div></td><td className="p-4 text-slate-600 font-black text-xs">{log.performedBy}</td></tr>))}</tbody></table></div>
                    </div>
               </div>
           </div>
       )}

       {activeTab === 'PURCHASE_ORDERS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                    <tr><th className="p-4">Fecha Solicitud</th><th className="p-4">Proveedor</th><th className="p-4">Estado</th><th className="p-4 text-right">Monto</th><th className="p-4 text-center">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {appState.purchaseOrders.map(po => (
                        <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-700">{po.date}</td>
                            <td className="p-4 font-medium text-slate-700">{po.supplier}</td>
                            <td className="p-4"><span className={`px-2 py-1 text-[10px] rounded-full font-bold border uppercase ${po.status === PurchaseStatus.RECEIVED ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{po.status}</span></td>
                            <td className="p-4 text-right font-bold text-teal-700">${po.totalAmount.toFixed(2)}</td>
                            <td className="p-4 text-center">
                                {po.status === PurchaseStatus.ORDERED && (
                                    <button onClick={() => setReceiveConfirmModal({isOpen: true, order: po, receptionDate: new Date().toISOString().split('T')[0]})} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Confirmar Recepción"><PackageCheck size={18} /></button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       )}

       {activeTab === 'STOCK' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {appState.inventory.map(item => (
                <div key={item.id} className={`bg-white p-6 rounded-[2rem] shadow-sm border relative transition-all hover:scale-[1.02] ${item.quantity <= item.minThreshold ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100'}`}>
                    {item.quantity <= item.minThreshold && (<div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] px-3 py-1 font-black rounded-bl-xl uppercase tracking-tighter">Stock Bajo</div>)}
                    <h3 className="font-black text-slate-400 text-[10px] uppercase mb-3">{item.name}</h3>
                    <div className={`text-4xl font-black mb-4 ${item.quantity <= item.minThreshold ? 'text-red-600' : 'text-slate-800'}`}>{item.quantity} <span className="text-sm text-slate-400 font-normal">lb</span></div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-4 border-t border-slate-50">
                        <span className="flex items-center gap-1"><Clock size={12}/> {item.lastRestockDate || 'N/A'}</span>
                        <span className="font-bold">Min: {item.minThreshold} lb</span>
                    </div>
                </div>
            ))}
         </div>
       )}

       {activeTab === 'CATALOG' && (
         <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 flex justify-between bg-slate-50 border-b border-slate-100 items-center">
                <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 w-96 shadow-sm"><Search className="text-slate-400" size={18} /><input type="text" placeholder="Buscar por nombre..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px]">
                    <tr><th className="p-4">Nombre Insumo</th><th className="p-4">Unidad</th><th className="p-4 text-right">Costo lb</th><th className="p-4 text-center">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{item.name}</td>
                            <td className="p-4 text-slate-500">{item.unit}</td>
                            <td className="p-4 text-right font-bold text-teal-700">${item.unitCost?.toFixed(2)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-1">
                                    <button onClick={() => { setEditingItemId(item.id); setNewItem(item); setShowItemModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={18}/></button>
                                    {isAdmin && <button onClick={async () => { if(confirm("¿Eliminar este insumo definitivamente?")) { await db.inventory.delete(item.id); onUpdate({...appState, inventory: appState.inventory.filter(i => i.id !== item.id)}); } }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
       )}

       {/* MODAL GENERAR COMPRA */}
       {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-8">
                    <div><h3 className="text-3xl font-black text-slate-800 flex items-center gap-3"><ShoppingCart className="text-teal-600" size={36} /> Nueva Adquisición</h3></div>
                    <button onClick={() => setShowPurchaseModal(false)} className="text-slate-300 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if ((newPurchase.items || []).length === 0) return;
                    setIsSaving(true);
                    try {
                        const total = (newPurchase.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                        const supplier = appState.suppliers.find(s => s.id === newPurchase.supplierId);
                        const order: PurchaseOrder = {
                          id: `po-${Date.now()}`, supplier: supplier?.businessName || 'Proveedor',
                          supplierId: newPurchase.supplierId, date: newPurchase.date!,
                          status: PurchaseStatus.ORDERED, items: newPurchase.items || [],
                          totalAmount: total, paymentStatus: 'Pending'
                        };
                        await db.purchaseOrders.upsert(order);
                        onUpdate({ ...appState, purchaseOrders: [order, ...appState.purchaseOrders] });
                        setShowPurchaseModal(false);
                    } catch (e) { alert("Error al guardar pedido"); } finally { setIsSaving(false); }
                }} className="space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Proveedor</label><select className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 font-black text-slate-700" value={newPurchase.supplierId} onChange={e => setNewPurchase({...newPurchase, supplierId: e.target.value})}><option value="">-- Seleccionar Proveedor --</option>{appState.suppliers.map(s => <option key={s.id} value={s.id}>{s.businessName}</option>)}</select></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Fecha Solicitud</label><input required type="date" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-slate-700" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})} /></div>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                        <div className="grid grid-cols-12 gap-4 items-end mb-6">
                             <div className="col-span-12 md:col-span-4"><label className="block text-[9px] font-black text-slate-400 mb-1">Insumo Almacén</label><select className="w-full border p-3.5 rounded-xl text-sm font-bold bg-white" value={pItem.id} onChange={e => { if(e.target.value) { const i = appState.inventory.find(x => x.id === e.target.value); if(i) setPItem({id: i.id, name: i.name, qty: 1, price: i.unitCost || 0}); } else setPItem({id: '', name: '', qty: 1, price: 0}) }}><option value="">-- Seleccionar --</option>{appState.inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                             <div className="col-span-12 md:col-span-4"><label className="block text-[9px] font-black text-slate-400 mb-1">Manual (Ej: Cubeta 50lb)</label><input placeholder="Descripción..." className="w-full border p-3.5 rounded-xl text-sm font-bold bg-white outline-none" value={pItem.name} onChange={e => setPItem({...pItem, name: e.target.value})} /></div>
                             <div className="col-span-4 md:col-span-2"><label className="block text-[9px] font-black text-slate-400 mb-1">Cant (lb)</label><input type="number" className="w-full border p-3.5 rounded-xl text-sm font-black bg-white" value={pItem.qty} onChange={e => setPItem({...pItem, qty: Number(e.target.value)})} /></div>
                             <div className="col-span-4 md:col-span-2"><label className="block text-[9px] font-black text-slate-400 mb-1">$/lb</label><input type="number" step="0.01" className="w-full border p-3.5 rounded-xl text-sm font-black bg-white" value={pItem.price} onChange={e => setPItem({...pItem, price: Number(e.target.value)})} /></div>
                             <div className="col-span-12 mt-2"><button type="button" onClick={() => { if(!pItem.name || pItem.qty <= 0) return; setNewPurchase({ ...newPurchase, items: [...(newPurchase.items || []), { inventoryItemId: pItem.id || undefined, itemName: pItem.name, quantity: pItem.qty, unitPrice: pItem.price }] }); setPItem({id:'', name:'', qty: 1, price: 0}); }} className="w-full bg-teal-600 text-white p-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-teal-700 transition-all"><Plus size={18} /> AÑADIR A LA LISTA</button></div>
                        </div>
                        <div className="space-y-2">
                            {(newPurchase.items || []).map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                    <div className="flex flex-col"><span className="font-bold text-slate-800 text-sm">{it.itemName}</span><span className="text-[10px] text-slate-400 uppercase font-black">Cant: {it.quantity} • lb: ${it.unitPrice.toFixed(2)}</span></div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-teal-700 text-sm">${(it.quantity * it.unitPrice).toFixed(2)}</span>
                                        <button type="button" onClick={() => { const ni = [...(newPurchase.items || [])]; ni.splice(idx, 1); setNewPurchase({...newPurchase, items: ni}); }} className="text-red-300 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                     <div className="flex justify-between items-center bg-slate-900 p-8 rounded-[2rem] text-white">
                        <div><span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Inversión Total</span><p className="text-4xl font-black text-teal-400">${(newPurchase.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0).toFixed(2)}</p></div>
                        <button type="submit" disabled={isSaving || (newPurchase.items || []).length === 0} className="bg-teal-500 text-slate-900 px-10 py-4 rounded-2xl font-black hover:bg-teal-400 transition-all shadow-xl shadow-teal-500/20">{isSaving ? <Loader size={24} className="animate-spin" /> : 'CONFIRMAR PEDIDO'}</button>
                     </div>
                </form>
            </div>
        </div>
       )}

       {/* MODAL RECEPCIÓN PEDIDO */}
       {receiveConfirmModal.isOpen && receiveConfirmModal.order && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl">
                  <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><PackageCheck size={40} /></div>
                      <h3 className="text-3xl font-black text-slate-800">Recibir Mercancía</h3>
                      <p className="text-slate-500 text-sm mt-2">Ingresando productos de <span className="font-bold text-slate-900">{receiveConfirmModal.order.supplier}</span></p>
                  </div>
                  <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 mb-8">
                      <label className="block text-[10px] font-black text-orange-400 uppercase mb-2 text-center tracking-widest">Fecha Real de Entrada</label>
                      <input type="date" className="w-full border-orange-200 border-2 rounded-xl p-4 font-black text-slate-800 outline-none" value={receiveConfirmModal.receptionDate} onChange={e => setReceiveConfirmModal({...receiveConfirmModal, receptionDate: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-3">
                      <button onClick={async () => {
                          const { order, receptionDate } = receiveConfirmModal;
                          if (!order) return;
                          setIsSaving(true);
                          try {
                              const currentInventory = [...appState.inventory];
                              for (const poItem of order.items) {
                                  if (poItem.inventoryItemId) {
                                      const invIndex = currentInventory.findIndex(i => i.id === poItem.inventoryItemId);
                                      if (invIndex >= 0) {
                                          const item = currentInventory[invIndex];
                                          const updatedItem = { ...item, quantity: item.quantity + poItem.quantity, unitCost: poItem.unitPrice, lastRestockDate: receptionDate };
                                          await db.inventory.upsert(updatedItem);
                                          currentInventory[invIndex] = updatedItem;
                                      }
                                  }
                              }
                              const updatedOrder = { ...order, status: PurchaseStatus.RECEIVED };
                              await db.purchaseOrders.upsert(updatedOrder);
                              onUpdate({ ...appState, inventory: currentInventory, purchaseOrders: appState.purchaseOrders.map(p => p.id === order.id ? updatedOrder : p) });
                              setReceiveConfirmModal({ ...receiveConfirmModal, isOpen: false, order: null });
                          } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
                      }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest active:scale-95">ACTUALIZAR EXISTENCIAS</button>
                      <button onClick={() => setReceiveConfirmModal({ ...receiveConfirmModal, isOpen: false, order: null })} className="w-full bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl">Volver</button>
                  </div>
              </div>
          </div>
       )}

       {showItemModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 backdrop-blur-md">
             <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
                 <h3 className="text-3xl font-black mb-8 text-slate-800 tracking-tight">{editingItemId ? 'Editar Ficha' : 'Nuevo Insumo'}</h3>
                 <form onSubmit={async (e) => {
                     e.preventDefault();
                     setIsSaving(true);
                     try {
                         const item = { ...newItem, id: editingItemId || `inv-${Date.now()}`, quantity: Number(newItem.quantity), unitCost: Number(newItem.unitCost), minThreshold: Number(newItem.minThreshold) } as InventoryItem;
                         await db.inventory.upsert(item);
                         onUpdate({ ...appState, inventory: editingItemId ? appState.inventory.map(i => i.id === editingItemId ? item : i) : [...appState.inventory, item] });
                         setShowItemModal(false);
                     } catch (e) { alert("Error al guardar"); } finally { setIsSaving(false); }
                 }} className="space-y-6">
                     <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nombre Comercial</label><input required className="w-full border-slate-200 border-2 p-4 rounded-2xl font-bold text-slate-700" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Ej: Cloro Granulado 65%" /></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Unidad</label><input required readOnly className="w-full border-slate-200 border-2 p-4 rounded-2xl font-bold bg-slate-100" value="lb" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Existencia (lb)</label><input required type="number" step="0.01" className="w-full border-slate-200 border-2 p-4 rounded-2xl font-black text-teal-700" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Costo Promedio ($)</label><input type="number" step="0.01" className="w-full border-slate-200 border-2 p-4 rounded-2xl font-bold" value={newItem.unitCost} onChange={e => setNewItem({...newItem, unitCost: Number(e.target.value)})} /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Umbral Min.</label><input required type="number" className="w-full border-slate-200 border-2 p-4 rounded-2xl font-black text-red-500" value={newItem.minThreshold} onChange={e => setNewItem({...newItem, minThreshold: Number(e.target.value)})} /></div>
                     </div>
                     <button type="submit" disabled={isSaving} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95">{isSaving ? <Loader size={24} className="animate-spin mx-auto" /> : 'GUARDAR CAMBIOS'}</button>
                     <button type="button" onClick={() => setShowItemModal(false)} className="w-full text-slate-400 p-2 text-xs font-black uppercase tracking-widest">Cancelar</button>
                 </form>
             </div>
         </div>
       )}
    </div>
  );
};

export default Inventory;
