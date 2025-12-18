
import React, { useState, useMemo } from 'react';
import { AppState, TransactionType, TransactionCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Download, TrendingDown, TrendingUp, Minus, DollarSign } from 'lucide-react';
import { generateIncomeStatementPDF } from '../services/pdfService';

interface ReportsProps {
  appState: AppState;
}

const Reports: React.FC<ReportsProps> = ({ appState }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL'); // 0-11 or 'ALL'

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // --- DATA PROCESSING ---

  const filteredTransactions = useMemo(() => {
    return appState.transactions.filter(t => {
      // Adjust for timezone offset issues if date string is YYYY-MM-DD
      // Simpler approach: split string to avoid timezone shifts on Date() parsing
      const [y, m] = t.date.split('-').map(Number);
      
      const matchYear = y === selectedYear;
      const matchMonth = selectedMonth === 'ALL' || (m - 1) === selectedMonth;
      
      return matchYear && matchMonth;
    });
  }, [appState.transactions, selectedYear, selectedMonth]);

  // Grouping Logic
  const reportData = useMemo<{
    income: number;
    expense: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    projectExpenses: Record<string, number>;
    totalOperatingExpense: number;
    totalProjectExpense: number;
    netResult: number;
  }>(() => {
    let income = 0;
    let expense = 0;
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};
    const projectExpenses: Record<string, number> = {}; // Track project specific separately

    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        income += t.amount;
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        expense += t.amount;
        // Separate Project expenses for better P&L visualization
        if (t.category === TransactionCategory.PROJECT) {
             const projName = t.relatedProjectId 
                ? (appState.projects.find(p => p.id === t.relatedProjectId)?.name || 'Proyecto General')
                : 'Proyectos Varios';
             projectExpenses[projName] = (projectExpenses[projName] || 0) + t.amount;
        } else {
             expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        }
      }
      // Explicitly ignore TRANSFER type in P&L
    });

    const totalOperatingExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
    const totalProjectExpense = Object.values(projectExpenses).reduce((a, b) => a + b, 0);
    const totalExpense = totalOperatingExpense + totalProjectExpense;

    return {
      income,
      expense,
      incomeByCategory,
      expenseByCategory,
      projectExpenses,
      totalOperatingExpense,
      totalProjectExpense,
      netResult: income - totalExpense
    };
  }, [filteredTransactions, appState.projects]);

  // Chart Data
  const chartData = useMemo(() => {
    // If 'ALL' months selected, show Monthly breakdown
    if (selectedMonth === 'ALL') {
        const data = Array(12).fill(0).map((_, i) => ({
            name: months[i].substring(0, 3),
            Ingresos: 0,
            Gastos: 0
        }));

        appState.transactions.forEach(t => {
            const [y, m] = t.date.split('-').map(Number);
            if (y === selectedYear) {
                if (t.type === TransactionType.INCOME) {
                    data[m-1].Ingresos += t.amount;
                } else if (t.type === TransactionType.EXPENSE) {
                    data[m-1].Gastos += t.amount;
                }
            }
        });
        return data;
    } else {
        // If specific month selected, show Category breakdown (Top 5)
        // Or grouped by Day/Week? Let's do simple Income vs Expense total for that month single bar, 
        // OR better: Operating vs Project expenses breakdown.
        
        // Let's stick to a simple visual for the month: Comparison by Type
        return [
            { name: 'Operativo', Ingresos: reportData.income, Gastos: reportData.totalOperatingExpense },
            { name: 'Proyectos', Ingresos: 0, Gastos: reportData.totalProjectExpense },
            { name: 'Total', Ingresos: reportData.income, Gastos: reportData.expense }
        ];
    }
  }, [appState.transactions, selectedYear, selectedMonth, reportData]);


  // --- RENDER HELPERS ---

  const formatCurrency = (val: any) => Number(val).toLocaleString('es-PA', { style: 'currency', currency: 'USD' });

  const handleDownloadPDF = () => {
      const periodName = selectedMonth === 'ALL' ? `Anual ${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`;
      generateIncomeStatementPDF(reportData, periodName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Estado de Resultados</h2>
          <p className="text-slate-500 text-sm">Informe financiero integral del Patronato</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 border-r pr-2 border-slate-200">
                <Calendar size={18} className="text-slate-400" />
                <select 
                    className="outline-none text-slate-700 bg-transparent font-medium"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                    {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
            <select 
                className="outline-none text-slate-700 bg-transparent font-medium"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            >
                <option value="ALL">Todo el Año</option>
                {months.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                ))}
            </select>
        </div>
      </div>

      {/* High Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
             <div>
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Ingresos Totales</p>
                <h3 className="text-2xl font-bold text-green-600">{formatCurrency(reportData.income)}</h3>
             </div>
             <div className="p-3 bg-green-50 rounded-full text-green-600">
                 <TrendingUp size={24} />
             </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
             <div>
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Egresos Totales</p>
                <h3 className="text-2xl font-bold text-red-600">{formatCurrency(reportData.expense)}</h3>
             </div>
             <div className="p-3 bg-red-50 rounded-full text-red-600">
                 <TrendingDown size={24} />
             </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
             <div>
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Resultado Neto</p>
                <h3 className={`text-2xl font-bold ${reportData.netResult >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.netResult)}
                </h3>
             </div>
             <div className={`p-3 rounded-full ${reportData.netResult >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'}`}>
                 <DollarSign size={24} />
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* INCOME STATEMENT TABLE */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">Estado de Resultados {selectedMonth === 'ALL' ? `Anual ${selectedYear}` : `- ${months[selectedMonth as number]} ${selectedYear}`}</h3>
                  <button 
                    onClick={handleDownloadPDF}
                    className="text-slate-400 hover:text-teal-600 flex items-center gap-1 text-sm font-medium transition-colors" 
                    title="Descargar PDF"
                  >
                      <Download size={18} /> Descargar PDF
                  </button>
              </div>
              <div className="p-6">
                  {/* REVENUE SECTION */}
                  <div className="mb-6">
                      <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 border-b pb-1">Ingresos</h4>
                      <div className="space-y-2">
                          {Object.entries(reportData.incomeByCategory).map(([cat, amount]) => (
                              <div key={cat} className="flex justify-between text-sm text-slate-600">
                                  <span>{cat}</span>
                                  <span>{formatCurrency(amount)}</span>
                              </div>
                          ))}
                          {Object.keys(reportData.incomeByCategory).length === 0 && (
                              <div className="text-sm text-slate-400 italic">Sin ingresos registrados en este período.</div>
                          )}
                      </div>
                      <div className="flex justify-between font-bold text-slate-800 mt-2 pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded">
                          <span>Total Ingresos</span>
                          <span>{formatCurrency(reportData.income)}</span>
                      </div>
                  </div>

                  {/* OPERATING EXPENSES SECTION */}
                  <div className="mb-6">
                      <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 border-b pb-1">Gastos Operativos</h4>
                      <div className="space-y-2">
                          {Object.entries(reportData.expenseByCategory).map(([cat, amount]) => (
                              <div key={cat} className="flex justify-between text-sm text-slate-600">
                                  <span>{cat}</span>
                                  <span>{formatCurrency(amount)}</span>
                              </div>
                          ))}
                          {Object.keys(reportData.expenseByCategory).length === 0 && (
                              <div className="text-sm text-slate-400 italic">Sin gastos operativos registrados.</div>
                          )}
                      </div>
                      <div className="flex justify-between font-medium text-slate-700 mt-2 pt-2 border-t border-slate-100 px-2">
                          <span>Total Gastos Operativos</span>
                          <span>{formatCurrency(reportData.totalOperatingExpense)}</span>
                      </div>
                  </div>

                  {/* OPERATING SURPLUS */}
                  <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between font-bold text-slate-700">
                      <span>Excedente Operativo (EBITDA)</span>
                      <span className={(reportData.income - reportData.totalOperatingExpense) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(reportData.income - reportData.totalOperatingExpense)}
                      </span>
                  </div>

                  {/* PROJECT EXPENSES SECTION */}
                  <div className="mb-6">
                      <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 border-b pb-1">Inversión y Proyectos</h4>
                      <div className="space-y-2">
                          {Object.entries(reportData.projectExpenses).map(([proj, amount]) => (
                              <div key={proj} className="flex justify-between text-sm text-slate-600">
                                  <span>{proj}</span>
                                  <span>{formatCurrency(amount)}</span>
                              </div>
                          ))}
                          {Object.keys(reportData.projectExpenses).length === 0 && (
                              <div className="text-sm text-slate-400 italic">Sin gastos de inversión en este período.</div>
                          )}
                      </div>
                      <div className="flex justify-between font-medium text-slate-700 mt-2 pt-2 border-t border-slate-100 px-2">
                          <span>Total Inversión</span>
                          <span>{formatCurrency(reportData.totalProjectExpense)}</span>
                      </div>
                  </div>

                  {/* FINAL RESULT */}
                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-md">
                      <div>
                          <p className="text-sm text-slate-400 uppercase font-bold">Resultado del Ejercicio</p>
                          <p className="text-xs text-slate-500">Superávit / Déficit Neto</p>
                      </div>
                      <div className="text-2xl font-bold">
                          {formatCurrency(reportData.netResult)}
                      </div>
                  </div>
              </div>
          </div>

          {/* VISUALS & ANALYTICS */}
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Tendencia {selectedMonth === 'ALL' ? 'Anual' : 'Mensual'}</h4>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{fontSize: 10}} />
                          <YAxis tick={{fontSize: 10}} />
                          <RechartsTooltip 
                              contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                              formatter={(val: any) => formatCurrency(Number(val))}
                          />
                          <Legend wrapperStyle={{fontSize: '12px'}} />
                          <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>

              {/* Quick Ratios */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Indicadores Clave</h4>
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Margen Operativo</span>
                              <span className="font-bold">{reportData.income > 0 ? (((reportData.income - reportData.totalOperatingExpense) / reportData.income) * 100).toFixed(1) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(Math.max(0, ((reportData.income - reportData.totalOperatingExpense) / reportData.income) * 100), 100)}%` }}></div>
                          </div>
                      </div>
                      
                      <div>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Peso de Proyectos (sobre Gasto Total)</span>
                              <span className="font-bold">{reportData.expense > 0 ? ((reportData.totalProjectExpense / reportData.expense) * 100).toFixed(1) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(Math.max(0, (reportData.totalProjectExpense / reportData.expense) * 100), 100)}%` }}></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Reports;
