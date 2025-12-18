
import { supabase } from './supabaseClient';
import { AppState, Member, Transaction, InventoryItem, Project, ServiceOrder, PurchaseOrder, MaintenanceLog, BankAccount, BoardMember, Employee, SystemUser, SystemLog, Supplier } from '../types';
import { INITIAL_STATE } from './storageService';

// --- CARGA DE DATOS ---

export const loadInitialData = async (): Promise<{ appState: AppState, missingTables: boolean }> => {
  console.log("Conectando con Supabase para cargar datos...");
  try {
    const results = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('inventory').select('*'),
      supabase.from('maintenance_logs').select('*'),
      supabase.from('bank_accounts').select('*'),
      supabase.from('projects').select('*, tasks:project_tasks(*)'), 
      supabase.from('service_orders').select('*, materials:service_order_materials(*)'),
      supabase.from('purchase_orders').select('*, items:purchase_order_items(*)'),
      supabase.from('board_members').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('system_users').select('*'),
      supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(500),
      supabase.from('suppliers').select('*'),
    ]);

    const missingTableError = results.find(r => 
      r.error && (
        r.error.message.includes('does not exist') || 
        r.error.code === '42P01'
      )
    );

    if (missingTableError) {
      console.warn("Faltan tablas críticas en Supabase.");
      return { appState: INITIAL_STATE, missingTables: true };
    }

    return {
      appState: {
        members: (results[0].data as Member[]) || [],
        transactions: (results[1].data as Transaction[]) || [],
        inventory: (results[2].data as InventoryItem[]) || [],
        maintenanceLogs: (results[3].data as MaintenanceLog[]) || [],
        bankAccounts: (results[4].data as BankAccount[]) || [],
        projects: (results[5].data as Project[]) || [],
        serviceOrders: (results[6].data as ServiceOrder[]) || [],
        purchaseOrders: (results[7].data as PurchaseOrder[]) || [],
        boardMembers: (results[8].data as BoardMember[]) || [],
        employees: (results[9].data as Employee[]) || [],
        systemUsers: (results[10].data as SystemUser[]) || [],
        systemLogs: (results[11].data as SystemLog[]) || [],
        suppliers: (results[12].data as Supplier[]) || [],
      },
      missingTables: false
    };
  } catch (error) {
    console.error("Error crítico de conexión:", error);
    return { appState: INITIAL_STATE, missingTables: false };
  }
};

// --- SERVICIO DE PERSISTENCIA (DB) ---

export const db = {
  members: {
    upsert: async (data: Member) => {
        const { error } = await supabase.from('members').upsert(data);
        if (error) throw error;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('members').delete().eq('id', id);
        if (error) throw error;
    }
  },
  transactions: {
    upsert: async (data: Transaction) => {
        console.log("DB: Intentando persistir transacción...", data);
        
        // Limpieza de campos para compatibilidad con SQL
        const cleanData: any = {};
        const optionalFields = ['relatedMemberId', 'relatedBankAccountId', 'transferToAccountId', 'relatedProjectId', 'relatedSupplierId', 'relatedSupplier', 'category'];
        
        Object.keys(data).forEach(key => {
            const val = (data as any)[key];
            if (val !== undefined && val !== null && val !== '') {
                cleanData[key] = val;
            } else if (optionalFields.includes(key)) {
                cleanData[key] = null; // Supabase prefiere null a undefined o vacíos para IDs
            }
        });
        
        const { error } = await supabase.from('transactions').upsert(cleanData);
        if (error) {
            console.error("SUPABASE RECHAZÓ LA TRANSACCIÓN:", error);
            throw error;
        }
        console.log("DB: Transacción guardada con éxito.");
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
    }
  },
  bankAccounts: {
    upsert: async (data: BankAccount) => {
        const { error } = await supabase.from('bank_accounts').upsert(data);
        if (error) throw error;
    }
  },
  inventory: {
    upsert: async (data: InventoryItem) => {
        const { error } = await supabase.from('inventory').upsert(data);
        if (error) throw error;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
    }
  },
  maintenanceLogs: {
    upsert: async (data: MaintenanceLog) => {
        const { error } = await supabase.from('maintenance_logs').upsert(data);
        if (error) throw error;
    }
  },
  projects: {
    upsert: async (data: Project) => {
        const { tasks, ...projectData } = data;
        const { error: projError } = await supabase.from('projects').upsert(projectData);
        if (projError) throw projError;

        if (tasks && tasks.length > 0) {
            const tasksWithId = tasks.map(t => ({ ...t, projectId: data.id }));
            await supabase.from('project_tasks').upsert(tasksWithId);
        }
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
    },
    uploadImage: async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('project-images').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('project-images').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error) {
            console.error('Error en carga de imagen:', error);
            return null;
        }
    }
  },
  serviceOrders: {
    upsert: async (data: ServiceOrder) => {
        const { materials, ...orderData } = data;
        const cleanOrderData = {
            id: orderData.id,
            title: orderData.title,
            description: orderData.description,
            serviceType: orderData.serviceType,
            responsible: orderData.responsible,
            startDate: orderData.startDate,
            deadline: orderData.deadline,
            status: orderData.status,
            estimatedCost: Number(orderData.estimatedCost) || 0,
            actualCost: Number(orderData.actualCost) || 0,
            paymentStatus: orderData.paymentStatus || 'Pending',
            relatedTransactionId: orderData.relatedTransactionId || null
        };

        const { error: orderError } = await supabase.from('service_orders').upsert(cleanOrderData);
        if (orderError) throw orderError;

        await supabase.from('service_order_materials').delete().eq('serviceOrderId', data.id);
        if (materials && materials.length > 0) {
            const materialsWithId = materials.map(m => ({ ...m, serviceOrderId: data.id }));
            await supabase.from('service_order_materials').insert(materialsWithId);
        }
    }
  },
  purchaseOrders: {
    upsert: async (data: PurchaseOrder) => {
        const poPayload = {
            id: data.id,
            supplier: data.supplier,
            supplierId: data.supplierId || null,
            date: data.date,
            status: data.status,
            totalAmount: Number(data.totalAmount),
            paymentStatus: data.paymentStatus || 'Pending',
            relatedTransactionId: data.relatedTransactionId || null
        };

        const { error: poError } = await supabase.from('purchase_orders').upsert(poPayload);
        if (poError) throw poError;

        await supabase.from('purchase_order_items').delete().eq('purchaseOrderId', data.id);
        if (data.items && data.items.length > 0) {
            const itemsPayload = data.items.map(i => ({
                purchaseOrderId: data.id,
                inventoryItemId: i.inventoryItemId || null,
                itemName: i.itemName,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice)
            }));
            await supabase.from('purchase_order_items').insert(itemsPayload);
        }
    },
    delete: async (id: string) => {
        await supabase.from('purchase_order_items').delete().eq('purchaseOrderId', id);
        const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
        if (error) throw error;
    }
  },
  boardMembers: {
    upsert: async (data: BoardMember) => {
        const { error } = await supabase.from('board_members').upsert(data);
        if (error) throw error;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('board_members').delete().eq('id', id);
        if (error) throw error;
    }
  },
  employees: {
    upsert: async (data: Employee) => {
        const { error } = await supabase.from('employees').upsert(data);
        if (error) throw error;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
    }
  },
  systemUsers: {
    upsert: async (data: SystemUser) => {
        const { error } = await supabase.from('system_users').upsert(data);
        if (error) throw error;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('system_users').delete().eq('id', id);
        if (error) throw error;
    }
  },
  suppliers: {
      upsert: async (data: Supplier) => {
          const { error } = await supabase.from('suppliers').upsert(data);
          if (error) throw error;
      },
      delete: async (id: string) => {
          const { error } = await supabase.from('suppliers').delete().eq('id', id);
          if (error) throw error;
      }
  },
  logs: {
    add: async (log: Partial<SystemLog>) => {
        const newLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            ...log
        };
        await supabase.from('system_logs').insert(newLog);
    }
  }
};
