
import React, { useState } from 'react';
import { AppState, Supplier, SystemUser } from '../types';
import { Truck, Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Building, User } from 'lucide-react';
import { db } from '../services/dataService';

interface SuppliersProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: SystemUser | null;
}

const Suppliers: React.FC<SuppliersProps> = ({ appState, onUpdate, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
      businessName: '',
      ruc: '',
      address: '',
      phone: '',
      email: '',
      contactName: ''
  });

  const resetForm = () => {
      setNewSupplier({ businessName: '', ruc: '', address: '', phone: '', email: '', contactName: '' });
      setEditingId(null);
  };

  const handleEdit = (supplier: Supplier) => {
      setEditingId(supplier.id);
      setNewSupplier({ ...supplier });
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if (window.confirm('¿Eliminar este proveedor?')) {
          const updatedList = appState.suppliers.filter(s => s.id !== id);
          onUpdate({ ...appState, suppliers: updatedList });
          await db.suppliers.delete(id);
          
          if (currentUser) {
              await db.logs.add({
                  userId: currentUser.id,
                  userName: currentUser.fullName,
                  action: 'ELIMINAR',
                  entity: 'Proveedores',
                  details: `Eliminó proveedor ID: ${id}`
              });
          }
      }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      
      let updatedList = [...appState.suppliers];
      let supplierToSave: Supplier;
      let action = 'CREAR';

      if (editingId) {
          action = 'EDITAR';
          supplierToSave = {
              id: editingId,
              businessName: newSupplier.businessName!,
              ruc: newSupplier.ruc!,
              address: newSupplier.address || '',
              phone: newSupplier.phone || '',
              email: newSupplier.email || '',
              contactName: newSupplier.contactName || ''
          };
          updatedList = updatedList.map(s => s.id === editingId ? supplierToSave : s);
      } else {
          supplierToSave = {
              id: `sup-${Date.now()}`,
              businessName: newSupplier.businessName!,
              ruc: newSupplier.ruc!,
              address: newSupplier.address || '',
              phone: newSupplier.phone || '',
              email: newSupplier.email || '',
              contactName: newSupplier.contactName || ''
          };
          updatedList = [...updatedList, supplierToSave];
      }

      onUpdate({ ...appState, suppliers: updatedList });
      await db.suppliers.upsert(supplierToSave);

      if (currentUser) {
          await db.logs.add({
              userId: currentUser.id,
              userName: currentUser.fullName,
              action: action,
              entity: 'Proveedores',
              details: `${action === 'CREAR' ? 'Creó' : 'Editó'} proveedor: ${supplierToSave.businessName}`
          });
      }

      setIsModalOpen(false);
      resetForm();
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Proveedores</h2>
           <p className="text-slate-500 text-sm">Directorio comercial para facturación y compras</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} /> Nuevo Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appState.suppliers.map(sup => (
              <div key={sup.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-md transition-shadow relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(sup)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Pencil size={16}/></button>
                      <button onClick={() => handleDelete(sup.id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={16}/></button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                      <div className="bg-orange-50 p-3 rounded-full text-orange-600">
                          <Building size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-slate-800 leading-tight">{sup.businessName}</h3>
                          <p className="text-xs text-slate-400 font-mono">RUC: {sup.ruc}</p>
                      </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span>{sup.contactName || 'Sin contacto'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          <span>{sup.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" />
                          <a href={`mailto:${sup.email}`} className="hover:text-teal-600 truncate">{sup.email || '-'}</a>
                      </div>
                      <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          <span className="truncate">{sup.address || '-'}</span>
                      </div>
                  </div>
              </div>
          ))}
          {appState.suppliers.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  No hay proveedores registrados.
              </div>
          )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingId ? 'Editar Proveedor' : 'Registrar Proveedor'}</h3>
            
            <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Razón Social / Nombre</label>
                  <input required className="w-full border p-2 rounded-lg" value={newSupplier.businessName} onChange={e => setNewSupplier({...newSupplier, businessName: e.target.value})} />
               </div>
               <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">RUC / Identificación Fiscal</label>
                  <input required className="w-full border p-2 rounded-lg" value={newSupplier.ruc} onChange={e => setNewSupplier({...newSupplier, ruc: e.target.value})} />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono</label>
                    <input className="w-full border p-2 rounded-lg" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                    <input type="email" className="w-full border p-2 rounded-lg" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
                  </div>
               </div>

               <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Dirección Física</label>
                  <input className="w-full border p-2 rounded-lg" value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
               </div>

               <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Nombre de Contacto</label>
                  <input className="w-full border p-2 rounded-lg" value={newSupplier.contactName} onChange={e => setNewSupplier({...newSupplier, contactName: e.target.value})} />
               </div>

               <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 rounded-lg mt-2 hover:bg-slate-900">
                  Guardar Proveedor
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
