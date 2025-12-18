
export enum MemberStatus {
  ACTIVE = 'Activo',
  INACTIVE = 'Inactivo',
  PENDING = 'Pendiente'
}

export enum MemberCategory {
  INDIVIDUAL = 'Individual',
  PRINCIPAL = 'Principal (Responsable)',
  DEPENDENT = 'Dependiente'
}

export interface Member {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  familyMembers: number;
  joinDate: string;
  status: MemberStatus;
  category: MemberCategory;
  parentMemberId?: string;
  lastPaymentDate?: string;
  monthlyFee: number;
  photoUrl?: string;
  occupation?: string;
}

export enum TransactionType {
  INCOME = 'Ingreso',
  EXPENSE = 'Egreso',
  TRANSFER = 'Transferencia'
}

export enum TransactionCategory {
  CONTRIBUTION = 'Aporte Mensual',
  DONATION = 'Donación',
  MAINTENANCE = 'Mantenimiento',
  CHEMICALS = 'Químicos',
  UTILITIES = 'Servicios Públicos',
  SALARY = 'Personal',
  OTHER = 'Otros',
  PROJECT = 'Proyecto',
  INTERNAL = 'Movimiento Interno'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  relatedMemberId?: string;
  relatedBankAccountId?: string;
  transferToAccountId?: string;
  relatedProjectId?: string;
  relatedSupplier?: string;
  relatedSupplierId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  minThreshold: number;
  lastRestockDate?: string;
}

export interface MaintenanceLog {
  id: string;
  date: string;
  performedBy: string;
  description: string;
  itemsUsed: { itemId: string; itemName: string; amountUsed: number }[];
  notes?: string;
  phReading?: number;
  chlorineReading?: number;
  alkalinityReading?: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  type: 'Corriente' | 'Ahorro' | 'Efectivo';
  currency: string;
  balance: number;
}

export enum ProjectStatus {
  PLANNED = 'Planificado',
  IN_PROGRESS = 'En Ejecución',
  COMPLETED = 'Completado',
  PAUSED = 'Pausado'
}

export enum ProjectPriority {
  CRITICAL = 'Crítica',
  HIGH = 'Alta',
  MEDIUM = 'Media',
  LOW = 'Baja'
}

export interface ProjectTask {
  id: string;
  name: string;
  assignedTo: string;
  startDate: string;
  endDate?: string;
  estimatedCost: number;
  status: 'Pendiente' | 'En Progreso' | 'Completada';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  budget: number;
  status: ProjectStatus;
  priority: ProjectPriority;
  executionOrder: number;
  progress: number;
  tasks: ProjectTask[];
  beforePhotos?: string[];
  afterPhotos?: string[];
}

export enum ServiceStatus {
  PENDING = 'Pendiente',
  IN_PROGRESS = 'En Proceso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado'
}

export interface ServiceOrder {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  responsible: string;
  startDate: string;
  deadline?: string;
  status: ServiceStatus;
  estimatedCost: number;
  actualCost?: number;
  materials: { inventoryItemId: string; itemName: string; quantity: number }[];
  paymentStatus?: 'Pending' | 'Paid';
  relatedTransactionId?: string;
}

export interface Supplier {
  id: string;
  businessName: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
}

export enum PurchaseStatus {
  DRAFT = 'Borrador',
  ORDERED = 'Solicitado',
  RECEIVED = 'Recibido',
  PAID = 'Pagado',
  CANCELLED = 'Cancelado'
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  supplierId?: string;
  supplierEmail?: string;
  date: string;
  status: PurchaseStatus;
  items: { inventoryItemId?: string; itemName: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  paymentStatus?: 'Pending' | 'Paid';
  relatedTransactionId?: string;
}

export interface AppState {
  members: Member[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  maintenanceLogs: MaintenanceLog[];
  bankAccounts: BankAccount[];
  projects: Project[];
  serviceOrders: ServiceOrder[];
  purchaseOrders: PurchaseOrder[];
  boardMembers: BoardMember[];
  employees: Employee[];
  systemUsers: SystemUser[];
  systemLogs: SystemLog[];
  suppliers: Supplier[];
}

export enum BoardRole {
  PRESIDENT = 'Presidente',
  VICE_PRESIDENT = 'Vicepresidente',
  SECRETARY = 'Secretario',
  TREASURER = 'Tesorero',
  VOCAL = 'Vocal',
  FISCAL = 'Fiscal'
}

export interface BoardMember {
  id: string;
  fullName: string;
  role: BoardRole;
  periodStart: string;
  periodEnd: string;
  email: string;
  phone: string;
  status: 'Activo' | 'Inactivo';
}

export interface Employee {
  id: string;
  fullName: string;
  cedula: string;
  position: string;
  startDate: string;
  baseSalary: number;
  email: string;
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Vacaciones';
  paymentMethod: 'ACH' | 'Cheque';
  accountNumber?: string;
  bank?: string;
}

export enum UserRole {
  ADMIN = 'Administrador',
  EDITOR = 'Editor',
  VIEWER = 'Solo Lectura'
}

export interface SystemUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  lastLogin?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  details: string;
}
