import React, { useState } from 'react';
import { AppState, Employee } from '../types';
import { Contact, Plus, User, FileText, CreditCard, Calendar, Calculator, X, Pencil, Trash2, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';

interface PayrollProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
}

const Payroll: React.FC<PayrollProps> = ({ appState, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'CALCULATOR'>('EMPLOYEES');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({
      status: 'Activo',
      baseSalary: 0,
      paymentMethod: 'ACH'
  });

  // Calculator State
  const [calcSalary, setCalcSalary] = useState<number>(0);
  const [selectedEmpForCalc, setSelectedEmpForCalc] = useState<string>('');
  const [riskClass, setRiskClass] = useState<number>(2.10); // Default to Class II

  // --- PANAMA PAYROLL CONSTANTS ---
  const SS_EMPLOYEE = 0.0975;
  const SE_EMPLOYEE = 0.0125;
  const SS_EMPLOYER = 0.1225;
  const SE_EMPLOYER = 0.0150;
  // RIESGOS_PROFESIONALES varies by class, handled by state
  const XIII_MES_PROVISION = 0.0833; // 1/12
  const VACATION_PROVISION = 0.0909; // 1 month per 11 months
  const SENIORITY_PREMIUM_PROVISION = 0.0192; // 1 week per year (approx 1.923%)

  // --- HANDLERS ---
  const handleEditEmployee = (emp: Employee) => {
      setCurrentEmployee({...emp});
      setIsModalOpen(true);
  };

  const handleDeleteEmployee = (id: string) => {
      if(window.confirm('¿Eliminar registro de empleado?')) {
          onUpdate({...appState, employees: appState.employees.filter(e => e.id !== id)});
      }
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
      e.preventDefault();
      const emp: Employee = {
          id: currentEmployee.id || `emp-${Date.now()}`,
          fullName: currentEmployee.fullName!,
          cedula: currentEmployee.cedula!,
          position: currentEmployee.position!,
          startDate: currentEmployee.startDate!,
          baseSalary: Number(currentEmployee.baseSalary),
          email: currentEmployee.email || '',
          phone: currentEmployee.phone || '',
          status: currentEmployee.status as any,
          paymentMethod: currentEmployee.paymentMethod as any,
          bank: currentEmployee.bank,
          accountNumber: currentEmployee.accountNumber
      };

      let updatedList = appState.employees;
      if (currentEmployee.id) {
          updatedList = updatedList.map(e => e.id === currentEmployee.id ? emp : e);
      } else {
          updatedList = [...updatedList, emp];
      }
      onUpdate({...appState, employees: updatedList});
      setIsModalOpen(false);
      setCurrentEmployee({ status: 'Activo', baseSalary: 0, paymentMethod: 'ACH' });
  };

  const handleCalcSelectEmployee = (id: string) => {
      setSelectedEmpForCalc(id);
      const emp = appState.employees.find(e => e.id === id);
      if (emp) setCalcSalary(emp.baseSalary);
  };

  // --- CALCULATOR RENDER ---
  const renderCalculator = () => {
      const deductionSS = calcSalary * SS_EMPLOYEE;
      const deductionSE = calcSalary * SE_EMPLOYEE;
      const totalDeductions = deductionSS + deductionSE;
      const netPay = calcSalary - totalDeductions;

      const employerSS = calcSalary * SS_EMPLOYER;
      const employerSE = calcSalary * SE_EMPLOYER;
      const employerRP = calcSalary * (riskClass / 100);
      const totalEmployerTaxes = employerSS + employerSE + employerRP;

      const provXIII = calcSalary * XIII_MES_PROVISION;
      const provVacation = calcSalary * VACATION_PROVISION;
      const provSeniority = calcSalary * SENIORITY_PREMIUM_PROVISION;
      const totalProvisions = provXIII + provVacation + provSeniority;

      const totalMonthlyCost = calcSalary + totalEmployerTaxes + totalProvisions;
      
      const annualLiability = totalProvisions * 12;

      return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
             {/* Controls */}
             <div className="lg:col-span-1 space-y-4">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                         <Calculator size={20} className="text-teal-600" /> Parámetros
                     </h3>
                     <div className="space-y-4">
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Cargar Empleado Existente</label>
                             <select className="w-full border p-2 rounded-lg" value={selectedEmpForCalc} onChange={e => handleCalcSelectEmployee(e.target.value)}>
                                 <option value="">-- Cálculo Manual --</option>
                                 {appState.employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Salario Mensual Base ($)</label>
                             <input type="number" step="0.01" className="w-full border p-2 rounded-lg font-bold text-lg text-slate-800" value={calcSalary} onChange={e => setCalcSalary(Number(e.target.value))} />
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Clase de Riesgo Profesional</label>
                             <select className="w-full border p-2 rounded-lg bg-slate-50" value={riskClass} onChange={e => setRiskClass(Number(e.target.value))}>
                                 <option value="0.98">Clase I - Administrativo (0.98%)</option>
                                 <option value="2.10">Clase II - Mantenimiento (2.10%)</option>
                                 <option value="5.67">Clase III - Alto Riesgo (5.67%)</option>
                             </select>
                         </div>
                         <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                             <p className="font-bold mb-1">Tasas Vigentes (CSS Panamá):</p>
                             <ul className="list-disc list-inside space-y-0.5">
                                 <li>SS Empleado: 9.75%</li>
                                 <li>SE Empleado: 1.25%</li>
                                 <li>SS Patrono: 12.25%</li>
                                 <li>SE Patrono: 1.50%</li>
                                 <li>Riesgos Prof: {riskClass.toFixed(2)}%</li>
                             </ul>
                         </div>
                     </div>
                 </div>
             </div>

             {/* Results */}
             <div className="lg:col-span-2 space-y-6">
                 {/* Employee Side */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                     <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">A. Desglose para el Empleado</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                         <div className="p-3 bg-slate-50 rounded-lg">
                             <p className="text-xs text-slate-500 uppercase">Salario Bruto</p>
                             <p className="font-bold text-lg">${calcSalary.toFixed(2)}</p>
                         </div>
                         <div className="p-3 bg-red-50 rounded-lg">
                             <p className="text-xs text-red-600 uppercase">S. Social (-)</p>
                             <p className="font-bold text-lg text-red-700">${deductionSS.toFixed(2)}</p>
                         </div>
                         <div className="p-3 bg-red-50 rounded-lg">
                             <p className="text-xs text-red-600 uppercase">S. Educativo (-)</p>
                             <p className="font-bold text-lg text-red-700">${deductionSE.toFixed(2)}</p>
                         </div>
                         <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                             <p className="text-xs text-green-700 uppercase font-bold">Salario Neto</p>
                             <p className="font-bold text-xl text-green-700">${netPay.toFixed(2)}</p>
                         </div>
                     </div>
                 </div>

                 {/* Employer Side */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                     <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <DollarSign size={20} className="text-amber-600" /> B. Costo Real para la Asociación
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <h4 className="text-sm font-bold text-slate-600 mb-2">Cuotas Patronales (Pago Mensual)</h4>
                             <ul className="space-y-2 text-sm">
                                 <li className="flex justify-between"><span>Seguro Social (12.25%)</span> <span className="font-mono">${employerSS.toFixed(2)}</span></li>
                                 <li className="flex justify-between"><span>Seguro Educativo (1.50%)</span> <span className="font-mono">${employerSE.toFixed(2)}</span></li>
                                 <li className="flex justify-between"><span>Riesgos Prof. ({riskClass.toFixed(2)}%)</span> <span className="font-mono">${employerRP.toFixed(2)}</span></li>
                                 <li className="flex justify-between pt-2 border-t font-bold text-slate-700"><span>Subtotal Cuotas</span> <span>${totalEmployerTaxes.toFixed(2)}</span></li>
                             </ul>
                         </div>
                         <div>
                             <h4 className="text-sm font-bold text-slate-600 mb-2">Provisiones (Reservas de Ley)</h4>
                             <ul className="space-y-2 text-sm text-slate-500">
                                 <li className="flex justify-between">
                                     <span title="Un mes de salario por año">XIII Mes (8.33%)</span> 
                                     <span className="font-mono text-slate-700 font-medium">${provXIII.toFixed(2)}</span>
                                 </li>
                                 <li className="flex justify-between">
                                     <span title="30 días por cada 11 meses laborados">Vacaciones (9.09%)</span> 
                                     <span className="font-mono text-slate-700 font-medium">${provVacation.toFixed(2)}</span>
                                 </li>
                                 <li className="flex justify-between">
                                     <span title="Una semana de salario por año laborado">Prima Antigüedad (1.92%)</span> 
                                     <span className="font-mono text-slate-700 font-medium">${provSeniority.toFixed(2)}</span>
                                 </li>
                                 <li className="flex justify-between pt-2 border-t font-bold text-slate-700">
                                     <span>Subtotal Reservas</span> 
                                     <span className="text-amber-600">${totalProvisions.toFixed(2)}</span>
                                 </li>
                             </ul>
                         </div>
                     </div>

                     <div className="mt-6 flex flex-col md:flex-row gap-4">
                         <div className="flex-1 bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
                             <div>
                                <p className="text-sm text-slate-400">Costo Mensual Total</p>
                                <p className="text-[10px] text-slate-500 uppercase">Salario + Cuotas + Reservas</p>
                             </div>
                             <div className="text-2xl font-bold">
                                 ${totalMonthlyCost.toFixed(2)}
                             </div>
                         </div>
                         
                         <div className="flex-1 bg-teal-50 border border-teal-100 p-4 rounded-xl flex justify-between items-center">
                             <div>
                                <p className="text-sm text-teal-800 font-bold flex items-center gap-1"><TrendingUp size={14}/> Pasivo Laboral Anual</p>
                                <p className="text-[10px] text-teal-600">Acumulado Prestaciones (1 año)</p>
                             </div>
                             <div className="text-xl font-bold text-teal-700">
                                 ~${annualLiability.toFixed(2)}
                             </div>
                         </div>
                     </div>
                     
                     <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <p>Los cálculos son estimados basados en el Código de Trabajo de Panamá. La Prima de Antigüedad es un derecho adquirido en contratos indefinidos al finalizar la relación laboral. Las vacaciones corresponden a 30 días de descanso remunerado por cada 11 meses de trabajo continuo.</p>
                     </div>
                 </div>
             </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Planilla y RRHH</h2>
           <p className="text-slate-500 text-sm">Gestión de personal contratado y cálculo de prestaciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 pb-1">
          <button 
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-4 py-2 font-medium text-sm transition-colors rounded-t-lg ${activeTab === 'EMPLOYEES' ? 'bg-white border-x border-t border-slate-200 text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <div className="flex items-center gap-2"><Contact size={16}/> Empleados</div>
          </button>
          <button 
            onClick={() => setActiveTab('CALCULATOR')}
            className={`px-4 py-2 font-medium text-sm transition-colors rounded-t-lg ${activeTab === 'CALCULATOR' ? 'bg-white border-x border-t border-slate-200 text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <div className="flex items-center gap-2"><Calculator size={16}/> Calculadora Cargas Sociales</div>
          </button>
      </div>

      {activeTab === 'EMPLOYEES' && (
          <div className="space-y-4">
              <div className="flex justify-end">
                <button 
                    onClick={() => { setCurrentEmployee({ status: 'Activo', baseSalary: 0, paymentMethod: 'ACH' }); setIsModalOpen(true); }}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Plus size={20} /> Nuevo Empleado
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appState.employees.map(emp => (
                      <div key={emp.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                  <div className="bg-teal-50 p-2 rounded-full text-teal-600">
                                      <User size={24} />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-800">{emp.fullName}</h3>
                                      <p className="text-xs text-slate-500 font-medium">{emp.position}</p>
                                  </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${emp.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {emp.status}
                              </span>
                          </div>
                          
                          <div className="flex-1 space-y-2 text-sm text-slate-600 mt-2">
                              <div className="grid grid-cols-2 gap-2">
                                  <p><span className="text-slate-400">Cédula:</span> {emp.cedula}</p>
                                  <p><span className="text-slate-400">Inicio:</span> {emp.startDate}</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                                  <p className="flex justify-between"><span>Salario Base:</span> <span className="font-bold text-slate-800">${emp.baseSalary.toFixed(2)}</span></p>
                                  <p className="flex justify-between text-xs mt-1"><span>Método Pago:</span> <span>{emp.paymentMethod}</span></p>
                                  {emp.paymentMethod === 'ACH' && <p className="text-[10px] text-slate-400 text-right">{emp.bank} ••• {emp.accountNumber?.slice(-4)}</p>}
                              </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                              <button onClick={() => handleEditEmployee(emp)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                              <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
                  {appState.employees.length === 0 && (
                      <div className="col-span-full text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                          No hay empleados registrados.
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'CALCULATOR' && renderCalculator()}

      {/* Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{currentEmployee.id ? 'Editar Empleado' : 'Registrar Empleado'}</h3>
            
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Nombre Completo</label>
                    <input required className="w-full border p-2 rounded" value={currentEmployee.fullName || ''} onChange={e => setCurrentEmployee({...currentEmployee, fullName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Cédula</label>
                    <input required className="w-full border p-2 rounded" value={currentEmployee.cedula || ''} onChange={e => setCurrentEmployee({...currentEmployee, cedula: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Cargo / Puesto</label>
                    <input required className="w-full border p-2 rounded" value={currentEmployee.position || ''} onChange={e => setCurrentEmployee({...currentEmployee, position: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Salario Base Mensual ($)</label>
                    <input required type="number" step="0.01" className="w-full border p-2 rounded font-bold" value={currentEmployee.baseSalary} onChange={e => setCurrentEmployee({...currentEmployee, baseSalary: Number(e.target.value)})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Fecha Inicio Labores</label>
                    <input required type="date" className="w-full border p-2 rounded" value={currentEmployee.startDate || ''} onChange={e => setCurrentEmployee({...currentEmployee, startDate: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Estado</label>
                    <select className="w-full border p-2 rounded" value={currentEmployee.status} onChange={e => setCurrentEmployee({...currentEmployee, status: e.target.value as any})}>
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="Vacaciones">Vacaciones</option>
                    </select>
                 </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-600 mb-2 uppercase">Datos de Pago</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Método</label>
                          <select className="w-full border p-2 rounded text-sm bg-white" value={currentEmployee.paymentMethod} onChange={e => setCurrentEmployee({...currentEmployee, paymentMethod: e.target.value as any})}>
                              <option value="ACH">ACH (Transferencia)</option>
                              <option value="Cheque">Cheque</option>
                          </select>
                      </div>
                      {currentEmployee.paymentMethod === 'ACH' && (
                          <>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Banco</label>
                                <input className="w-full border p-2 rounded text-sm bg-white" value={currentEmployee.bank || ''} onChange={e => setCurrentEmployee({...currentEmployee, bank: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">No. Cuenta</label>
                                <input className="w-full border p-2 rounded text-sm bg-white" value={currentEmployee.accountNumber || ''} onChange={e => setCurrentEmployee({...currentEmployee, accountNumber: e.target.value})} />
                            </div>
                          </>
                      )}
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Email (Opcional)</label>
                    <input type="email" className="w-full border p-2 rounded" value={currentEmployee.email || ''} onChange={e => setCurrentEmployee({...currentEmployee, email: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono</label>
                    <input className="w-full border p-2 rounded" value={currentEmployee.phone || ''} onChange={e => setCurrentEmployee({...currentEmployee, phone: e.target.value})} />
                 </div>
              </div>

              <div className="flex justify-end pt-2">
                 <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-medium">Guardar Datos</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;