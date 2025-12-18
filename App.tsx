
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Assistant from './pages/Assistant';
import BankAccounts from './pages/BankAccounts';
import Projects from './pages/Projects';
import Board from './pages/Board';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import AccessControl from './pages/AccessControl';
import SystemLogs from './pages/SystemLogs'; 
import Suppliers from './pages/Suppliers';
import DebtManagement from './pages/DebtManagement';
import Login from './pages/Login';
import { AppState, SystemUser } from './types';
import { loadInitialData } from './services/dataService'; 

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const { appState: data, missingTables } = await loadInitialData();
      setAppState(data);
      setDbError(missingTables);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleStateUpdate = (newState: AppState) => {
    setAppState(newState);
  };

  const handleLogin = (user: SystemUser) => {
      setCurrentUser(user);
  };

  const handleLogout = () => {
      setCurrentUser(null);
  };

  if (isLoading) {
      return (
        <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-500">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
             <p className="animate-pulse font-bold">Conectando con la Base de Datos...</p>
        </div>
      );
  }

  if (!appState) return <div className="text-center p-10">Error cargando la aplicación.</div>;

  if (!currentUser) {
      return <Login appState={appState} onLogin={handleLogin} dbError={dbError} />;
  }

  return (
    <Router>
      <Layout currentUser={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard appState={appState} />} />
          <Route path="/members" element={<Members appState={appState} onUpdate={handleStateUpdate} currentUser={currentUser} />} />
          <Route path="/finance" element={<Finance appState={appState} onUpdate={handleStateUpdate} currentUser={currentUser} />} />
          <Route path="/debt" element={<DebtManagement appState={appState} onUpdate={handleStateUpdate} currentUser={currentUser} />} />
          <Route path="/reports" element={<Reports appState={appState} />} />
          <Route path="/bank-accounts" element={<BankAccounts appState={appState} onUpdate={handleStateUpdate} />} />
          <Route path="/projects" element={<Projects appState={appState} onUpdate={handleStateUpdate} />} />
          <Route path="/inventory" element={<Inventory appState={appState} onUpdate={handleStateUpdate} currentUser={currentUser} />} />
          <Route path="/suppliers" element={<Suppliers appState={appState} onUpdate={handleStateUpdate} currentUser={currentUser} />} />
          <Route path="/payroll" element={<Payroll appState={appState} onUpdate={handleStateUpdate} />} />
          <Route path="/board" element={<Board appState={appState} onUpdate={handleStateUpdate} />} />
          <Route path="/assistant" element={<Assistant appState={appState} />} />
          <Route path="/access-control" element={<AccessControl appState={appState} currentUser={currentUser} onUpdate={handleStateUpdate} />} />
          <Route path="/system-logs" element={<SystemLogs appState={appState} currentUser={currentUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
