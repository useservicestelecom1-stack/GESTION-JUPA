
import React, { useMemo } from 'react';
import { AppState, TransactionType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface DashboardProps {
  appState: AppState;
}

const Dashboard: React.FC<DashboardProps> = ({ appState }) => {
  // Calculations
  const totalMembers = appState.members.length;
  const activeMembers = appState.members.filter(m => m.status === 'Activo').length;
  
  const totalIncome = appState.transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = appState.transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalIncome - totalExpenses;

  const lowStockItems = appState.inventory.filter(i => i.quantity <= i.minThreshold);

  // Chart Data Preparation
  const expensesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    appState.transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    return Object.keys(categories).map(key => ({ name: key, value: categories[key] }));
  }, [appState.transactions]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-slate-800">Panel de Control</h2>
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">Balance Actual</p>
            <h3 className={`text-2xl font-bold ${balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
              ${balance.toFixed(2)}
            </h3>
          </div>
          <div className="bg-teal-50 p-3 rounded-full text-teal-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">Socios Activos</p>
            <h3 className="text-2xl font-bold text-slate-800">{activeMembers} <span className="text-sm text-slate-400 font-normal">/ {totalMembers}</span></h3>
          </div>
          <div className="bg-blue-50 p-3 rounded-full text-blue-600">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">Ingresos Totales</p>
            <h3 className="text-2xl font-bold text-slate-800">${totalIncome.toFixed(2)}</h3>
          </div>
          <div className="bg-green-50 p-3 rounded-full text-green-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">Gastos Totales</p>
            <h3 className="text-2xl font-bold text-slate-800">${totalExpenses.toFixed(2)}</h3>
          </div>
          <div className="bg-red-50 p-3 rounded-full text-red-600">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Distribución de Gastos</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
             </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
             {expensesByCategory.map((entry, index) => (
               <div key={index} className="flex items-center text-xs text-slate-600">
                 <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                 {entry.name}
               </div>
             ))}
          </div>
        </div>

        {/* Alerts & Inventory Status */}
        <div className="space-y-6">
           {/* Alerts */}
           {lowStockItems.length > 0 && (
             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-amber-800 mb-2">
                  <AlertTriangle size={20} />
                  <h4 className="font-bold">Alertas de Inventario</h4>
                </div>
                <ul className="space-y-2">
                  {lowStockItems.map(item => (
                    <li key={item.id} className="text-sm text-amber-700 flex justify-between">
                      <span>{item.name}</span>
                      <span className="font-bold">{item.quantity} {item.unit} (Mín: {item.minThreshold})</span>
                    </li>
                  ))}
                </ul>
             </div>
           )}

           {/* Recent Maintenance */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-700 mb-4">Últimas Acciones de Mantenimiento</h3>
              <div className="space-y-4">
                {appState.maintenanceLogs.slice(0, 3).map(log => (
                  <div key={log.id} className="border-l-4 border-teal-500 pl-4 py-1">
                    <p className="text-sm font-semibold text-slate-800">{log.description}</p>
                    <p className="text-xs text-slate-500">{log.date} - por {log.performedBy}</p>
                  </div>
                ))}
                {appState.maintenanceLogs.length === 0 && <p className="text-slate-400 text-sm">No hay registros recientes.</p>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
