import React, { useState, useEffect } from 'react';
import { Project, Universe } from '../types';
import { Plus, Github, Search, Book, Clock, ChevronRight, Globe, Layers, Layout, BookOpen, Cloud, RefreshCw, CheckCircle2, Trash2, Dices, Sparkles, Wand2, X, Users, Zap, Shield } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, cn } from '../lib/utils';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  key?: string;
}

export function Dashboard({ projects, onSelectProject }: DashboardProps) {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingUniverse, setIsCreatingUniverse] = useState(false);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState<string | 'solo'>('solo');
  
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<Project['type']>('novel');
  const [universeIdForNewProject, setUniverseIdForNewProject] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'projects' | 'community'>('projects');

  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'universes'), where('ownerId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setUniverses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Universe)));
    });

    checkDriveStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
        setIsDriveConnected(true);
        setSyncMessage({ text: 'Google Drive conectado!', type: 'success' });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      unsub();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const checkDriveStatus = async () => {
    try {
      const resp = await fetch('/api/auth/google/status');
      const data = await resp.json();
      setIsDriveConnected(data.connected);
    } catch (err) {
      console.error('Error checking drive status:', err);
    }
  };

  const handleConnectDrive = async () => {
    try {
      const resp = await fetch('/api/auth/google/url');
      const { url } = await resp.json();
      window.open(url, 'google_drive_auth', 'width=600,height=700');
    } catch (err) {
      console.error('Error connecting drive:', err);
    }
  };

  const handleSyncDrive = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const resp = await fetch('/api/sync/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects, universes }),
      });
      const data = await resp.json();
      if (data.success) {
        setSyncMessage({ text: 'Backup realizado com sucesso no Drive!', type: 'success' });
      } else {
        setSyncMessage({ text: data.error || 'Erro ao sincronizar', type: 'error' });
      }
    } catch (err) {
      setSyncMessage({ text: 'Erro de conexão com o servidor', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'projects'), {
        title: newTitle,
        type: newType,
        universeId: universeIdForNewProject || null,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        currentContent: '',
        description: '',
      });
      setNewTitle('');
      setIsCreatingProject(false);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleCreateUniverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'universes'), {
        title: newTitle,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        description: '',
      });
      setNewTitle('');
      setIsCreatingUniverse(false);
    } catch (error) {
      console.error("Error creating universe:", error);
    }
  };

  const handleDeleteUniverse = async (universeId: string, title: string) => {
    if (!confirm(`Deseja realmente apagar o universo "${title}"? Os projetos vinculados não serão apagados, mas ficarão orfãos (Solo Stories).`)) return;
    try {
      // Desvincula projetos antes de deletar o universo
      const batch = writeBatch(db);
      const universeProjects = projects.filter(p => p.universeId === universeId);
      
      universeProjects.forEach(p => {
        batch.update(doc(db, 'projects', p.id), { 
          universeId: null,
          updatedAt: serverTimestamp() 
        });
      });
      await batch.commit();

      await deleteDoc(doc(db, 'universes', universeId));
      if (selectedUniverseId === universeId) setSelectedUniverseId('solo');
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUniverse = selectedUniverseId === 'solo' 
      ? !p.universeId 
      : p.universeId === selectedUniverseId;
    return matchesSearch && matchesUniverse;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto custom-scrollbar bg-editorial-bg"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-12 py-12 space-y-12">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-br from-editorial-sidebar to-editorial-bg p-12 md:p-20 border border-white/5 shadow-2xl">
           <div className="absolute top-0 right-0 w-2/3 h-full overflow-hidden pointer-events-none opacity-20">
              <div className="absolute inset-0 bg-gradient-to-l from-editorial-bg to-transparent z-10" />
              <motion.div 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="w-[800px] h-[800px] border border-editorial-accent/30 rounded-full flex items-center justify-center -mr-40 mt-[-200px]"
              >
                 <div className="w-[600px] h-[600px] border border-editorial-accent/20 rounded-full" />
                 <div className="w-[400px] h-[400px] border border-editorial-accent/10 rounded-full" />
              </motion.div>
           </div>
           
           <div className="relative z-20 flex flex-col items-start gap-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10"
              >
                <Sparkles className="w-4 h-4 text-editorial-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-editorial-accent">Ateliê Ativado</span>
              </motion.div>

              <div className="max-w-2xl">
                <h1 className="text-5xl md:text-7xl font-brand leading-none mb-6 text-[#EAEAEA]">
                  {auth.currentUser?.displayName?.split(' ')[0]}, O QUE VAMOS <span className="text-editorial-accent shadow-neon">ETERNIZAR</span> HOJE?
                </h1>
                <p className="text-editorial-muted font-sans text-sm md:text-base leading-relaxed max-w-lg mb-10">
                  Sua arquitetura de mundos e crônicas está resguardada. A realidade é apenas um rascunho para sua próxima obra.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => { setIsCreatingProject(true); setIsCreatingUniverse(false); setNewTitle(''); }}
                  className="group flex items-center gap-3 bg-editorial-accent text-white px-10 py-5 rounded-2xl hover:scale-105 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest shadow-[0_0_30px_rgba(124,58,237,0.3)]"
                >
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-180 duration-500" />
                  Iniciar Nova Obra
                </button>
                <button
                  onClick={() => { setIsCreatingUniverse(true); setIsCreatingProject(false); setNewTitle(''); }}
                  className="flex items-center gap-3 bg-white/5 backdrop-blur-md text-[#EAEAEA] border border-white/10 px-8 py-5 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                  <Globe className="w-5 h-5 text-editorial-accent" />
                  Arquitetar Universo
                </button>
              </div>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Area */}
          <div className="w-full md:w-64 space-y-10 shrink-0">
            <div className="space-y-4">
              <h3 className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.4em] px-4">Codex Mundi</h3>
              <div className="space-y-2">
                <button
                  onClick={() => { setSelectedUniverseId('solo'); setActiveView('projects'); }}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl text-[11px] font-bold transition-all flex items-center justify-between group relative",
                    (selectedUniverseId === 'solo' && activeView === 'projects') ? "bg-white/10 text-white shadow-neon border border-white/20" : "text-editorial-muted hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className={cn("w-4 h-4", (selectedUniverseId === 'solo' && activeView === 'projects') && "text-editorial-accent")} />
                    Solo Stories
                  </div>
                  <span className="opacity-40 text-[9px] font-black">{projects.filter(p => !p.universeId).length}</span>
                  {(selectedUniverseId === 'solo' && activeView === 'projects') && <motion.div layoutId="u-active" className="absolute left-[-2px] w-1 h-6 bg-editorial-accent rounded-full" />}
                </button>
              
                {universes.map(u => (
                  <div key={u.id} className="relative group/univ">
                    <button
                      onClick={() => { setSelectedUniverseId(u.id); setActiveView('projects'); }}
                      className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl text-[11px] font-bold transition-all flex items-center justify-between group relative",
                        (selectedUniverseId === u.id && activeView === 'projects') ? "bg-white/10 text-white shadow-neon border border-white/20" : "text-editorial-muted hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Globe className={cn("w-4 h-4", (selectedUniverseId === u.id && activeView === 'projects') && "text-editorial-accent")} />
                        <span className="truncate pr-4">{u.title}</span>
                      </div>
                      <span className="opacity-40 text-[9px] font-black">{projects.filter(p => p.universeId === u.id).length}</span>
                      {(selectedUniverseId === u.id && activeView === 'projects') && <motion.div layoutId="u-active" className="absolute left-[-2px] w-1 h-6 bg-editorial-accent rounded-full" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteUniverse(u.id, u.title); }}
                      className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/univ:opacity-100 p-2 text-red-500/50 hover:text-red-500 transition-all z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.4em] px-4">Conexão Coletiva</h3>
               <button
                  onClick={() => setActiveView('community')}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl text-[11px] font-bold transition-all flex items-center justify-between group relative",
                    activeView === 'community' ? "bg-editorial-accent text-white shadow-neon border border-editorial-accent/20" : "text-editorial-muted hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Users className={cn("w-4 h-4", activeView === 'community' ? "text-white" : "text-editorial-accent")} />
                    Matriz Coletiva
                  </div>
                  <span className="opacity-40 text-[9px] font-black uppercase tracking-widest">Nexus</span>
                  {activeView === 'community' && <motion.div layoutId="u-active" className="absolute left-[-2px] w-1 h-6 bg-white rounded-full" />}
                </button>
            </div>

            <div className="space-y-4">
               <h3 className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.4em] px-4 flex items-center gap-2">
                 Sincronia <Cloud className="w-3 h-3" />
               </h3>
               <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                     <div className={cn("w-2 h-2 rounded-full", isDriveConnected ? "bg-green-500 shadow-[0_0_8px_green]" : "bg-red-500 shadow-[0_0_8px_red]")} />
                     <span className="text-[9px] font-black text-editorial-muted uppercase tracking-wider">
                        {isDriveConnected ? "Cloud Connect" : "Desconectado"}
                     </span>
                  </div>

                  {!isDriveConnected ? (
                    <button 
                      onClick={handleConnectDrive}
                      className="w-full flex items-center justify-center gap-2 bg-editorial-accent/10 text-editorial-accent py-4 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-editorial-accent hover:text-white transition-all border border-editorial-accent/20"
                    >
                      Abilitar Nuvem
                    </button>
                  ) : (
                    <button 
                      onClick={handleSyncDrive}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2 bg-editorial-accent text-white py-4 rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-neon"
                    >
                      {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sync Agora
                    </button>
                  )}
               </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 space-y-8">
            {activeView === 'projects' ? (
              <>
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-editorial-muted w-4 h-4 group-focus-within:text-editorial-accent transition-colors" />
                  <input
                    type="text"
                    placeholder="PROCURAR NOS REGISTROS DO DESTINO..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-[32px] py-6 pl-14 pr-6 focus:outline-none focus:border-editorial-accent focus:bg-white/10 transition-all shadow-xl font-sans text-[10px] uppercase tracking-[0.2em] text-[#EAEAEA] placeholder:text-white/20"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
                  <AnimatePresence mode="popLayout">
                    {(isCreatingProject || isCreatingUniverse) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="lg:col-span-2 bg-white/5 p-12 rounded-[48px] border border-editorial-accent/30 backdrop-blur-xl shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8">
                          <button onClick={() => { setIsCreatingProject(false); setIsCreatingUniverse(false); }} className="text-white/20 hover:text-white transition-colors">
                            <X className="w-8 h-8" />
                          </button>
                        </div>

                        <h3 className="font-brand text-4xl text-[#EAEAEA] mb-12 tracking-widest">
                          {isCreatingUniverse ? "FORJAR NOVO MUNDO" : "CRÔNICA DE UM NOVO DESTINO"}
                        </h3>
                        
                        <form onSubmit={isCreatingUniverse ? handleCreateUniverse : handleCreateProject} className="space-y-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="flex flex-col gap-3">
                              <label className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.3em] px-2">Identidade / Título</label>
                              <input
                                autoFocus
                                required
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="DIRETRIZ DA OBRA..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 outline-none focus:border-editorial-accent focus:bg-white/10 transition-all font-brand text-2xl tracking-widest text-white placeholder:text-white/10"
                              />
                            </div>
                            
                            {isCreatingProject && (
                              <div className="flex flex-col gap-3">
                                <label className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.3em] px-2">Natureza da Matriz</label>
                                <select
                                  value={newType}
                                  onChange={(e) => setNewType(e.target.value as Project['type'])}
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 outline-none focus:border-editorial-accent focus:bg-white/10 appearance-none font-black text-[10px] uppercase tracking-widest text-[#EAEAEA] cursor-pointer"
                                >
                                  <option value="novel" className="bg-editorial-sidebar">Romance / Novela</option>
                                  <option value="manga" className="bg-editorial-sidebar">Mangá / Manhua</option>
                                  <option value="comic" className="bg-editorial-sidebar">Comic / Quadrinho</option>
                                  <option value="script" className="bg-editorial-sidebar">Roteiro / Script</option>
                                  <option value="rpg" className="bg-editorial-sidebar">RPG / Aventura</option>
                                  <option value="lore" className="bg-editorial-sidebar">Lore / Enciclopédia</option>
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-6">
                            <button
                              type="submit"
                              className="bg-editorial-accent text-white px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-neon hover:scale-105 active:scale-95 transition-all"
                            >
                              Codificar {isCreatingUniverse ? "Mundo" : "História"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsCreatingProject(false); setIsCreatingUniverse(false); }}
                              className="bg-white/5 text-white/40 px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                            >
                              Abortar
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {filteredProjects.map((project) => (
                      <motion.div
                        key={project.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -10, scale: 1.02 }}
                        onClick={() => onSelectProject(project)}
                        className="group bg-white/5 p-12 rounded-[56px] border border-white/10 hover:border-editorial-accent transition-all cursor-pointer shadow-xl relative overflow-hidden flex flex-col h-full bg-gradient-to-b hover:from-white/10 hover:to-white/5 transition-all duration-500 shadow-2xl shadow-black/40"
                      >
                        <div className="absolute top-0 right-0 p-8 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-editorial-accent bg-editorial-accent/10 px-3 py-1.5 rounded-full border border-editorial-accent/20">{project.type}</span>
                        </div>

                        <div className="flex justify-between items-start mb-12">
                          <div className={cn(
                            "w-16 h-16 rounded-[24px] flex items-center justify-center border border-white/10 bg-white/5 transition-all duration-500 group-hover:shadow-neon group-hover:bg-editorial-accent",
                          )}>
                            {project.type === 'rpg' ? (
                              <Dices className="w-8 h-8 text-neutral-400 group-hover:text-white" />
                            ) : project.type === 'lore' ? (
                              <BookOpen className="w-8 h-8 text-neutral-400 group-hover:text-white" />
                            ) : project.type === 'manga' || project.type === 'comic' ? (
                              <Layout className="w-8 h-8 text-neutral-400 group-hover:text-white" />
                            ) : (
                              <Book className="w-8 h-8 text-neutral-400 group-hover:text-white" />
                            )}
                          </div>
                        </div>
                        
                        <h3 className="text-4xl font-brand text-[#EAEAEA] mb-2 tracking-widest group-hover:text-editorial-accent transition-colors">
                          {project.title}
                        </h3>
                        
                        <p className="text-editorial-muted text-xs mb-10 line-clamp-3 leading-relaxed font-sans uppercase tracking-[0.1em] opacity-60 flex-1 border-l-2 border-white/5 pl-6">
                          {project.description || "Descrição ainda não manifestada na estrutura deste setor."}
                        </p>
                        
                        <div className="flex items-center justify-between pt-8 border-t border-white/5">
                          <div className="flex items-center gap-3 text-[9px] text-editorial-muted font-black uppercase tracking-[0.2em]">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_green]" />
                            {formatDate(project.updatedAt?.toDate())}
                          </div>
                          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:bg-editorial-accent/20 group-hover:border-editorial-accent transition-all">
                            <ChevronRight className="w-5 h-5 text-editorial-muted group-hover:text-editorial-accent transition-all" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {filteredProjects.length === 0 && !isCreatingProject && !isCreatingUniverse && (
                    <div className="lg:col-span-2 text-center py-40 border-2 border-dashed border-white/10 rounded-[64px] bg-white/2">
                      <Wand2 className="w-20 h-20 text-editorial-accent/20 mx-auto mb-10" />
                      <p className="text-white/20 font-brand text-4xl tracking-widest mb-4">ESPACIO VAZIO</p>
                      <p className="text-editorial-muted text-sm font-sans mb-12 uppercase tracking-[0.2em]">Crie seu primeiro projeto para ativar o sistema.</p>
                      <button 
                        onClick={() => setIsCreatingProject(true)}
                        className="bg-editorial-accent/10 text-editorial-accent border border-editorial-accent/30 px-12 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-editorial-accent hover:text-white transition-all shadow-neon"
                      >
                        Manifestar Obra
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                 <div className="p-12 rounded-[56px] bg-gradient-to-br from-editorial-accent/10 to-transparent border border-editorial-accent/20">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="p-3 bg-editorial-accent rounded-2xl shadow-neon">
                          <Users className="w-6 h-6 text-white" />
                       </div>
                       <div>
                          <h2 className="text-4xl font-brand text-white tracking-widest">Matriz Coletiva</h2>
                          <p className="text-editorial-muted text-[10px] font-black uppercase tracking-[0.3em]">Sincronização de Consciências Narrativas</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 text-editorial-accent mb-2">
                             <Zap className="w-4 h-4" />
                             <span className="text-[9px] font-black uppercase tracking-widest">Tendências Realistas</span>
                          </div>
                          <p className="text-xl font-brand text-white mb-2 tracking-wide">Cyberpunk Noir</p>
                          <p className="text-[10px] text-editorial-muted uppercase tracking-wider">+124 Autores Ativos</p>
                       </div>
                       <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 text-editorial-accent mb-2">
                             <Shield className="w-4 h-4" />
                             <span className="text-[9px] font-black uppercase tracking-widest">Canon Ativo</span>
                          </div>
                          <p className="text-xl font-brand text-white mb-2 tracking-wide">Era dos Espelhos</p>
                          <p className="text-[10px] text-editorial-muted uppercase tracking-wider">3.2k Regras Consolidadas</p>
                       </div>
                       <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 text-editorial-accent mb-2">
                             <Sparkles className="w-4 h-4" />
                             <span className="text-[9px] font-black uppercase tracking-widest">IA Audit</span>
                          </div>
                          <p className="text-xl font-brand text-white mb-2 tracking-wide">Flow Emocional</p>
                          <p className="text-[10px] text-editorial-muted uppercase tracking-wider">98% Satisfação de Leitura</p>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-6">
                    <RefreshCw className="w-12 h-12 text-editorial-accent animate-spin-slow" />
                    <div className="text-center">
                       <p className="text-xl font-brand text-white tracking-widest mb-2">CALIBRANDO NEXUS...</p>
                       <p className="text-[9px] font-black uppercase tracking-widest">Aguardando autorização da matriz para exibir arquivos públicos.</p>
                    </div>
                 </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
