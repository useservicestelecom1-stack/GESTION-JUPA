
import { AppState, MemberStatus, MemberCategory, TransactionType, TransactionCategory, ProjectStatus, ServiceStatus, PurchaseStatus, BoardRole, UserRole, ProjectPriority } from '../types';

const STORAGE_KEY = 'albrook_pool_db_v3';

export const INITIAL_STATE: AppState = {
  members: [
    { 
      id: '1', 
      fullName: 'Juan Pérez', 
      email: 'juan@example.com', 
      phone: '6600-1122', 
      familyMembers: 4, 
      joinDate: '2023-01-15', 
      status: MemberStatus.ACTIVE, 
      category: MemberCategory.INDIVIDUAL,
      lastPaymentDate: '2023-10-01', 
      monthlyFee: 45.00,
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      occupation: 'Ingeniero Civil'
    },
    { 
      id: '2', 
      fullName: 'Maria Rodriguez', 
      email: 'maria@example.com', 
      phone: '6555-9988', 
      familyMembers: 2, 
      joinDate: '2023-03-10', 
      status: MemberStatus.ACTIVE, 
      category: MemberCategory.INDIVIDUAL,
      lastPaymentDate: '2023-09-28', 
      monthlyFee: 35.00,
      occupation: 'Arquitecta'
    },
    { 
      id: '3', 
      fullName: 'Carlos Torres', 
      email: 'carlos@example.com', 
      phone: '6123-4567', 
      familyMembers: 1, 
      joinDate: '2023-06-20', 
      status: MemberStatus.INACTIVE, 
      category: MemberCategory.INDIVIDUAL,
      monthlyFee: 30.00,
      occupation: 'Jubilado'
    },
    {
      id: '4', 
      fullName: 'Club de Natación Delfines',
      email: 'admin@delfines.com',
      phone: '2233-4455',
      familyMembers: 0,
      joinDate: '2023-08-01',
      status: MemberStatus.ACTIVE, 
      category: MemberCategory.PRINCIPAL,
      monthlyFee: 0,
    },
    {
      id: '5',
      fullName: 'Alumno: Luisito Rey',
      email: 'luis.rey@gmail.com',
      phone: '6000-0001',
      familyMembers: 1,
      joinDate: '2023-08-05',
      status: MemberStatus.ACTIVE, 
      category: MemberCategory.DEPENDENT,
      parentMemberId: '4',
      monthlyFee: 25.00
    },
    {
      id: '6',
      fullName: 'Alumno: Ana Paula',
      email: 'ana.p@gmail.com',
      phone: '6000-0002',
      familyMembers: 1,
      joinDate: '2023-08-05',
      status: MemberStatus.ACTIVE, 
      category: MemberCategory.DEPENDENT,
      parentMemberId: '4',
      monthlyFee: 25.00
    }
  ],
  transactions: [
    { id: 't1', date: '2023-10-01', description: 'Aporte Octubre - Juan Pérez', amount: 45.00, type: TransactionType.INCOME, category: TransactionCategory.CONTRIBUTION, relatedMemberId: '1', relatedBankAccountId: 'bk1' },
    { id: 't2', date: '2023-10-02', description: 'Compra Cloro Granulado', amount: 120.50, type: TransactionType.EXPENSE, category: TransactionCategory.CHEMICALS, relatedBankAccountId: 'bk1' },
    { id: 't3', date: '2023-10-05', description: 'Pago Jardinero', amount: 80.00, type: TransactionType.EXPENSE, category: TransactionCategory.MAINTENANCE, relatedBankAccountId: 'bk1' },
    { id: 't4', date: '2023-11-02', description: 'Madera tratada para Deck', amount: 450.00, type: TransactionType.EXPENSE, category: TransactionCategory.PROJECT, relatedBankAccountId: 'bk1', relatedProjectId: 'pj1' }
  ],
  inventory: [
    { id: 'inv1', name: 'Cloro Granulado 65%', unit: 'lb', quantity: 50, unitCost: 3.50, minThreshold: 10, lastRestockDate: '2023-10-02' },
    { id: 'inv2', name: 'Incrementador Alcalinidad', unit: 'lb', quantity: 150, unitCost: 1.25, minThreshold: 50, lastRestockDate: '2023-09-15' },
    { id: 'inv3', name: 'Clarificador', unit: 'litros', quantity: 8, unitCost: 8.75, minThreshold: 2, lastRestockDate: '2023-08-20' },
    { id: 'inv4', name: 'Ácido Seco (pH-)', unit: 'lb', quantity: 100, unitCost: 2.15, minThreshold: 20, lastRestockDate: '2023-06-01' }
  ],
  maintenanceLogs: [],
  bankAccounts: [
    { id: 'bk1', bankName: 'Banco General', accountNumber: '****-1234', type: 'Corriente', currency: 'USD', balance: 2090.50 },
    { id: 'bk2', bankName: 'Banistmo', accountNumber: '****-9876', type: 'Ahorro', currency: 'USD', balance: 5000.00 }
  ],
  projects: [],
  serviceOrders: [],
  purchaseOrders: [],
  boardMembers: [],
  employees: [],
  systemUsers: [
    { id: 'usr1', username: 'admin', password: '123', fullName: 'Administrador Principal', role: UserRole.ADMIN },
    { id: 'usr2', username: 'operador', password: '123', fullName: 'Operador Estándar', role: UserRole.EDITOR },
    { id: 'usr3', username: 'invitado', password: '123', fullName: 'Visualizador Invitado', role: UserRole.VIEWER },
  ],
  systemLogs: [],
  suppliers: []
};

export const getAppState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
    return INITIAL_STATE;
  }
  const parsed = JSON.parse(stored);
  if (!parsed.systemUsers) parsed.systemUsers = INITIAL_STATE.systemUsers;
  if (!parsed.systemLogs) parsed.systemLogs = INITIAL_STATE.systemLogs;
  if (!parsed.suppliers) parsed.suppliers = INITIAL_STATE.suppliers;
  
  return parsed;
};

export const saveAppState = (state: AppState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
