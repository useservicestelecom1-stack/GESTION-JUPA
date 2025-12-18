
import React, { useState } from 'react';
import { AppState, Project, ProjectStatus, ProjectTask, ProjectPriority } from '../types';
import { Briefcase, Plus, Calendar, DollarSign, X, CheckCircle, Clock, PauseCircle, Pencil, Trash2, ListTodo, User, PieChart, AlertTriangle, Image as ImageIcon, Upload, Loader, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { db } from '../services/dataService';

interface ProjectsProps {
  appState: AppState;
  onUpdate: (newState: AppState) => void;
}

const Projects: React.FC<ProjectsProps> = ({ appState, onUpdate }) => {
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Selection States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProjectForTasks, setSelectedProjectForTasks] = useState<Project | null>(null);

  // Forms States
  const initialProjectState: Partial<Project> = {
    name: '', description: '', status: ProjectStatus.PLANNED, budget: 0, progress: 0,
    startDate: new Date().toISOString().split('T')[0], endDate: '', tasks: [],
    beforePhotos: [], afterPhotos: [],
    priority: ProjectPriority.MEDIUM, executionOrder: 99
  };

  const [currentProject, setCurrentProject] = useState<Partial<Project>>(initialProjectState);
  const [isUploading, setIsUploading] = useState(false);

  const initialTaskState: Partial<ProjectTask> = {
    name: '', assignedTo: '', startDate: new Date().toISOString().split('T')[0], estimatedCost: 0, status: 'Pendiente'
  };
  const [currentTask, setCurrentTask] = useState<Partial<ProjectTask>>(initialTaskState);

  // --- PROJECT HANDLERS ---

  const openNewProjectModal = () => {
    setEditingId(null);
    setCurrentProject(initialProjectState);
    setIsModalOpen(true);
  };

  const openEditProjectModal = (project: Project) => {
    setEditingId(project.id);
    setCurrentProject({ 
        ...project,
        beforePhotos: project.beforePhotos || [],
        afterPhotos: project.afterPhotos || [],
        priority: project.priority || ProjectPriority.MEDIUM,
        executionOrder: project.executionOrder || 99
    });
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
      const updatedProjects = appState.projects.filter(p => p.id !== id);
      onUpdate({ ...appState, projects: updatedProjects });
      await db.projects.delete(id);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    let updatedProjects = [...appState.projects];
    let projectToSave: Project;

    if (editingId) {
        const existing = appState.projects.find(p => p.id === editingId);
        projectToSave = {
            ...existing!,
            ...currentProject as Project,
            id: editingId,
        };
        updatedProjects = updatedProjects.map(p => p.id === editingId ? projectToSave : p);
    } else {
      projectToSave = {
        id: `pj-${Date.now()}`,
        name: currentProject.name!,
        description: currentProject.description!,
        status: currentProject.status as ProjectStatus,
        budget: Number(currentProject.budget),
        progress: Number(currentProject.progress),
        startDate: currentProject.startDate!,
        endDate: currentProject.endDate,
        tasks: [],
        beforePhotos: currentProject.beforePhotos || [],
        afterPhotos: currentProject.afterPhotos || [],
        priority: currentProject.priority || ProjectPriority.MEDIUM,
        executionOrder: Number(currentProject.executionOrder) || 99
      };
      updatedProjects = [...updatedProjects, projectToSave];
    }
    
    onUpdate({ ...appState, projects: updatedProjects });
    await db.projects.upsert(projectToSave);

    setIsModalOpen(false);
    setCurrentProject(initialProjectState);
    setEditingId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'BEFORE' | 'AFTER') => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = await db.projects.uploadImage(file);
          if (url) {
              uploadedUrls.push(url);
          } else {
              alert(`Error al subir la imagen ${file.name}`);
          }
      }

      if (uploadedUrls.length > 0) {
          if (type === 'BEFORE') {
              setCurrentProject(prev => ({
                  ...prev,
                  beforePhotos: [...(prev.beforePhotos || []), ...uploadedUrls]
              }));
          } else {
              setCurrentProject(prev => ({
                  ...prev,
                  afterPhotos: [...(prev.afterPhotos || []), ...uploadedUrls]
              }));
          }
      }

      setIsUploading(false);
      // Reset input value to allow re-uploading same file if needed
      e.target.value = '';
  };

  const removeImage = (index: number, type: 'BEFORE' | 'AFTER') => {
      if (type === 'BEFORE') {
          const newPhotos = [...(currentProject.beforePhotos || [])];
          newPhotos.splice(index, 1);
          setCurrentProject({ ...currentProject, beforePhotos: newPhotos });
      } else {
          const newPhotos = [...(currentProject.afterPhotos || [])];
          newPhotos.splice(index, 1);
          setCurrentProject({ ...currentProject, afterPhotos: newPhotos });
      }
  };

  // --- TASK HANDLERS ---

  const openTaskModal = (project: Project) => {
    setSelectedProjectForTasks(project);
    setCurrentTask(initialTaskState);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForTasks) return;

    const task: ProjectTask = {
      id: currentTask.id || `tsk-${Date.now()}`,
      name: currentTask.name!,
      assignedTo: currentTask.assignedTo!,
      startDate: currentTask.startDate!,
      endDate: currentTask.endDate,
      estimatedCost: Number(currentTask.estimatedCost),
      status: currentTask.status as any
    };

    let updatedTasks = selectedProjectForTasks.tasks || [];
    if (currentTask.id) {
       updatedTasks = updatedTasks.map(t => t.id === currentTask.id ? task : t);
    } else {
       updatedTasks = [...updatedTasks, task];
    }

    // Update project in global state
    const updatedProject = { ...selectedProjectForTasks, tasks: updatedTasks };
    const updatedProjects = appState.projects.map(p => p.id === selectedProjectForTasks.id ? updatedProject : p);
    
    onUpdate({ ...appState, projects: updatedProjects });
    await db.projects.upsert(updatedProject);
    
    setSelectedProjectForTasks(updatedProject); // Update local modal state
    setCurrentTask(initialTaskState);
  };

  const handleEditTask = (task: ProjectTask) => {
    setCurrentTask({...task});
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProjectForTasks) return;
    if (window.confirm('¿Eliminar esta tarea?')) {
        const updatedTasks = selectedProjectForTasks.tasks.filter(t => t.id !== taskId);
        const updatedProject = { ...selectedProjectForTasks, tasks: updatedTasks };
        const updatedProjects = appState.projects.map(p => p.id === selectedProjectForTasks.id ? updatedProject : p);
        
        onUpdate({ ...appState, projects: updatedProjects });
        await db.projects.upsert(updatedProject);
        setSelectedProjectForTasks(updatedProject);
    }
  };


  // --- HELPERS ---

  const getStatusColor = (status: ProjectStatus) => {
    switch(status) {
        case ProjectStatus.COMPLETED: return 'bg-green-100 text-green-700';
        case ProjectStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700';
        case ProjectStatus.PAUSED: return 'bg-amber-100 text-amber-700';
        default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: ProjectStatus) => {
      switch(status) {
          case ProjectStatus.COMPLETED: return <CheckCircle size={16} />;
          case ProjectStatus.IN_PROGRESS: return <Clock size={16} />;
          case ProjectStatus.PAUSED: return <PauseCircle size={16} />;
          default: return <Calendar size={16} />;
      }
  };

  const getPriorityColor = (priority: ProjectPriority) => {
      switch(priority) {
          case ProjectPriority.CRITICAL: return 'bg-red-600 text-white';
          case ProjectPriority.HIGH: return 'bg-orange-500 text-white';
          case ProjectPriority.MEDIUM: return 'bg-blue-500 text-white';
          case ProjectPriority.LOW: return 'bg-slate-500 text-white';
          default: return 'bg-slate-400 text-white';
      }
  };

  // Helper to render the budget bar
  const renderBudgetBar = (project: Project) => {
      const totalCommitted = (project.tasks || []).reduce((acc, t) => acc + t.estimatedCost, 0);
      const remaining = project.budget - totalCommitted;
      const percentage = project.budget > 0 ? (totalCommitted / project.budget) * 100 : 0;
      const isOverBudget = remaining < 0;

      return (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
               <div className="flex justify-between items-end mb-2">
                   <div className="flex items-center gap-2">
                       <div className="p-1.5 bg-white rounded-md shadow-sm text-teal-600">
                           <PieChart size={18} />
                       </div>
                       <div>
                           <p className="text-xs text-slate-500 uppercase font-bold">Presupuesto Comprometido</p>
                           <p className="text-sm font-medium text-slate-700">
                               ${totalCommitted.toLocaleString()} <span className="text-xs text-slate-400">/ ${project.budget.toLocaleString()}</span>
                           </p>
                       </div>
                   </div>
                   <div className="text-right">
                       <p className="text-xs text-slate-500 uppercase font-bold">{isOverBudget ? 'Excedente' : 'Disponible'}</p>
                       <p className={`text-lg font-bold ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                           {isOverBudget ? '+' : ''}${Math.abs(remaining).toLocaleString()}
                       </p>
                   </div>
               </div>
               
               <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                   <div 
                       className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-teal-500'}`}
                       style={{ width: `${Math.min(percentage, 100)}%` }}
                   ></div>
               </div>
               <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
                   <span>0%</span>
                   <span>50%</span>
                   <span>100%</span>
               </div>
          </div>
      );
  };

  // Sort projects: Primary by Execution Order (Asc), Secondary by Priority (Critical first)
  const sortedProjects = [...appState.projects].sort((a, b) => {
      const orderA = a.executionOrder || 999;
      const orderB = b.executionOrder || 999;
      if (orderA !== orderB) return orderA - orderB;
      
      // If order is same, sort by Priority
      const priorityVal = {
          [ProjectPriority.CRITICAL]: 4,
          [ProjectPriority.HIGH]: 3,
          [ProjectPriority.MEDIUM]: 2,
          [ProjectPriority.LOW]: 1
      };
      return (priorityVal[b.priority || ProjectPriority.MEDIUM] || 0) - (priorityVal[a.priority || ProjectPriority.MEDIUM] || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">Proyectos en Ejecución</h2>
           <p className="text-slate-500 text-sm">Visualización de planes para el Patronato Usuarios Piscina Albrook</p>
        </div>
        <button 
          onClick={openNewProjectModal}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} /> Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map(project => {
              const totalEstimated = (project.tasks || []).reduce((sum, t) => sum + t.estimatedCost, 0);
              const budgetUsagePct = project.budget > 0 ? (totalEstimated / project.budget) * 100 : 0;
              const isOver = totalEstimated > project.budget;
              const hasPhotos = (project.beforePhotos?.length || 0) > 0 || (project.afterPhotos?.length || 0) > 0;

              return (
                <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow group relative">
                    {/* Execution Order Badge */}
                    <div className="absolute top-0 right-0 z-10">
                        <div className="bg-slate-800 text-white text-[10px] px-3 py-1 rounded-bl-xl rounded-tr-xl font-bold shadow-md">
                            ORDEN: #{project.executionOrder || 99}
                        </div>
                    </div>

                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-3 pr-16"> {/* pr-16 to avoid overlapping badge */}
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(project.status)}`}>
                                {getStatusIcon(project.status)} {project.status}
                            </span>
                        </div>
                        
                        <div className="mb-2">
                            <div className="flex flex-col gap-1 items-start">
                                <h3 className="text-lg font-bold text-slate-800 leading-tight">{project.name}</h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getPriorityColor(project.priority || ProjectPriority.MEDIUM)}`}>
                                    {project.priority || 'Media'}
                                </span>
                            </div>
                            <div className="text-slate-400 text-xs mt-2">Inicio: {project.startDate}</div>
                        </div>

                        <p className="text-slate-600 text-sm mb-4 line-clamp-3">{project.description}</p>
                        
                        {/* Progress Bar (Work) */}
                        <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-medium">Avance de Obra</span>
                                <span className="font-bold text-teal-600">{project.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }}></div>
                            </div>
                        </div>
                        
                        {/* Photo Indicators */}
                        {hasPhotos && (
                            <div className="flex gap-2 mb-4">
                                {project.beforePhotos && project.beforePhotos.length > 0 && (
                                    <div className="relative group/photo">
                                        <img src={project.beforePhotos[0]} alt="Antes" className="w-16 h-12 object-cover rounded border border-slate-200" />
                                        <span className="absolute bottom-0 left-0 bg-black/60 text-white text-[8px] px-1 w-full text-center">ANTES</span>
                                    </div>
                                )}
                                {project.afterPhotos && project.afterPhotos.length > 0 && (
                                    <div className="relative group/photo">
                                        <img src={project.afterPhotos[0]} alt="Después" className="w-16 h-12 object-cover rounded border border-slate-200" />
                                        <span className="absolute bottom-0 left-0 bg-green-900/60 text-white text-[8px] px-1 w-full text-center">DESPUÉS</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <button 
                            onClick={() => openTaskModal(project)}
                            className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-slate-200"
                        >
                            <ListTodo size={16} /> Gestionar Tareas ({project.tasks?.length || 0})
                        </button>
                    </div>

                    {/* Budget / Cost Summary Footer */}
                    <div className="bg-slate-50 p-4 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <div className="flex items-center gap-1 text-slate-600">
                                <DollarSign size={16} className="text-slate-400" />
                                <span>Presupuesto</span>
                            </div>
                            <div className="text-right">
                                <span className={`font-bold ${isOver ? 'text-red-600' : 'text-slate-700'}`}>
                                    ${totalEstimated.toLocaleString()}
                                </span>
                                <span className="text-slate-400 text-xs"> / ${project.budget.toLocaleString()}</span>
                            </div>
                        </div>
                        {/* Mini Budget Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(budgetUsagePct, 100)}%` }}
                            ></div>
                        </div>
                         <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => openEditProjectModal(project)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Editar Proyecto"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteProject(project.id)}
                                    className="text-slate-400 hover:text-red-600 transition-colors"
                                    title="Eliminar Proyecto"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <span>{budgetUsagePct.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
              );
          })}
          {appState.projects.length === 0 && (
             <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                 No hay proyectos registrados actualmente.
             </div>
          )}
      </div>

      {/* Main Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {editingId ? 'Editar Proyecto' : 'Crear Plan / Proyecto'}
            </h3>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Proyecto</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                  value={currentProject.name} onChange={e => setCurrentProject({...currentProject, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                      <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                          value={currentProject.priority} onChange={e => setCurrentProject({...currentProject, priority: e.target.value as ProjectPriority})}>
                          {Object.values(ProjectPriority).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orden Ejecución</label>
                      <input 
                          type="number" 
                          min="1" 
                          placeholder="#"
                          className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                          value={currentProject.executionOrder} 
                          onChange={e => setCurrentProject({...currentProject, executionOrder: Number(e.target.value)})} 
                      />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea required rows={3} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                  value={currentProject.description} onChange={e => setCurrentProject({...currentProject, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Presupuesto ($)</label>
                    <input 
                      required 
                      type="number" 
                      min="0" 
                      step="0.01"
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                      value={currentProject.budget} 
                      onChange={e => setCurrentProject({...currentProject, budget: Number(e.target.value)})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                    <select className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none"
                        value={currentProject.status} onChange={e => setCurrentProject({...currentProject, status: e.target.value as ProjectStatus})}>
                        {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
                    <input required type="date" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                      value={currentProject.startDate} onChange={e => setCurrentProject({...currentProject, startDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin (Est.)</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                      value={currentProject.endDate || ''} onChange={e => setCurrentProject({...currentProject, endDate: e.target.value})} />
                  </div>
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Progreso Actual (%)</label>
                <div className="flex items-center gap-4">
                    <input type="range" min="0" max="100" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                      value={currentProject.progress} onChange={e => setCurrentProject({...currentProject, progress: Number(e.target.value)})} />
                    <span className="font-bold w-12 text-right">{currentProject.progress}%</span>
                </div>
              </div>

              {/* IMAGE UPLOAD SECTION */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <ImageIcon size={18} className="text-teal-600" /> Registro Fotográfico
                  </h4>
                  
                  {/* BEFORE PHOTOS */}
                  <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fotos del Antes</label>
                      <div className="flex gap-2 flex-wrap mb-2">
                          {(currentProject.beforePhotos || []).map((photo, idx) => (
                              <div key={idx} className="relative group">
                                  <img src={photo} alt="Before" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                                  <button type="button" onClick={() => removeImage(idx, 'BEFORE')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X size={12} />
                                  </button>
                              </div>
                          ))}
                          <label className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {isUploading ? <Loader size={20} className="text-teal-600 animate-spin" /> : <Upload size={20} className="text-slate-400" />}
                              <span className="text-[10px] text-slate-500">{isUploading ? '...' : 'Subir'}</span>
                              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'BEFORE')} disabled={isUploading} />
                          </label>
                      </div>
                  </div>

                  {/* AFTER PHOTOS */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fotos del Después / Avance</label>
                      <div className="flex gap-2 flex-wrap mb-2">
                          {(currentProject.afterPhotos || []).map((photo, idx) => (
                              <div key={idx} className="relative group">
                                  <img src={photo} alt="After" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                                  <button type="button" onClick={() => removeImage(idx, 'AFTER')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X size={12} />
                                  </button>
                              </div>
                          ))}
                          <label className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {isUploading ? <Loader size={20} className="text-teal-600 animate-spin" /> : <Upload size={20} className="text-slate-400" />}
                              <span className="text-[10px] text-slate-500">{isUploading ? '...' : 'Subir'}</span>
                              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'AFTER')} disabled={isUploading} />
                          </label>
                      </div>
                  </div>
              </div>

              <button type="submit" disabled={isUploading} className={`w-full text-white font-bold py-2 rounded-lg mt-2 ${isUploading ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}>
                {isUploading ? 'Subiendo imágenes...' : (editingId ? 'Guardar Cambios' : 'Crear Proyecto')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tasks Management Modal */}
      {isTaskModalOpen && selectedProjectForTasks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>
                
                <div className="mb-6 flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Briefcase className="text-teal-600" /> {selectedProjectForTasks.name}
                    </h3>
                    <p className="text-slate-500 text-sm">Cronograma y Tareas</p>
                    
                    {/* Visual Budget Tracker (Detailed for Modal) */}
                    {renderBudgetBar(selectedProjectForTasks)}
                </div>

                <div className="flex-1 overflow-y-auto mb-4 pr-2">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                            <tr>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Tarea</th>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Responsable</th>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Cronograma</th>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Costo Est.</th>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Estado</th>
                                <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(selectedProjectForTasks.tasks || []).map(task => (
                                <tr key={task.id} className="hover:bg-slate-50 group">
                                    <td className="p-3 text-sm font-medium text-slate-800">{task.name}</td>
                                    <td className="p-3 text-sm text-slate-600 flex items-center gap-1">
                                        <User size={14} className="text-slate-400" /> {task.assignedTo}
                                    </td>
                                    <td className="p-3 text-xs text-slate-500">
                                        <div>{task.startDate}</div>
                                        <div className="text-slate-400">{task.endDate}</div>
                                    </td>
                                    <td className="p-3 text-sm font-mono text-slate-700">${task.estimatedCost.toFixed(2)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            task.status === 'Completada' ? 'bg-green-100 text-green-700' : 
                                            task.status === 'En Progreso' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {task.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handleEditTask(task)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(selectedProjectForTasks.tasks || []).length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay tareas definidas.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Task Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex-shrink-0">
                    <h4 className="text-sm font-bold text-slate-700 mb-2">{currentTask.id ? 'Editar Tarea' : 'Agregar Nueva Tarea'}</h4>
                    <form onSubmit={handleSaveTask} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="col-span-1 md:col-span-2">
                                <input required placeholder="Nombre de la tarea" className="w-full border p-2 rounded text-sm" 
                                    value={currentTask.name} onChange={e => setCurrentTask({...currentTask, name: e.target.value})} />
                            </div>
                            <div>
                                <input required placeholder="Responsable" className="w-full border p-2 rounded text-sm" 
                                    value={currentTask.assignedTo} onChange={e => setCurrentTask({...currentTask, assignedTo: e.target.value})} />
                            </div>
                            <div>
                                <select className="w-full border p-2 rounded text-sm" value={currentTask.status} onChange={e => setCurrentTask({...currentTask, status: e.target.value as any})}>
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="En Progreso">En Progreso</option>
                                    <option value="Completada">Completada</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                             <div>
                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Inicio</label>
                                <input required type="date" className="w-full border p-2 rounded text-sm" 
                                    value={currentTask.startDate} onChange={e => setCurrentTask({...currentTask, startDate: e.target.value})} />
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Fin</label>
                                <input type="date" className="w-full border p-2 rounded text-sm" 
                                    value={currentTask.endDate || ''} onChange={e => setCurrentTask({...currentTask, endDate: e.target.value})} />
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Costo ($)</label>
                                <input type="number" step="0.01" className="w-full border p-2 rounded text-sm" 
                                    value={currentTask.estimatedCost} onChange={e => setCurrentTask({...currentTask, estimatedCost: Number(e.target.value)})} />
                             </div>
                             <div className="flex items-end">
                                <button className="w-full bg-slate-800 text-white p-2 rounded text-sm hover:bg-slate-700 transition-colors">
                                    {currentTask.id ? 'Actualizar' : 'Agregar Tarea'}
                                </button>
                                {currentTask.id && (
                                    <button type="button" onClick={() => setCurrentTask(initialTaskState)} className="ml-2 text-slate-500 p-2 text-sm hover:bg-slate-200 rounded">Cancelar</button>
                                )}
                             </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
