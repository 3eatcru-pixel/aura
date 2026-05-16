import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Project } from '../types';
import { BookPlus, LayoutGrid, List, Clock, Sparkles, ChevronRight, FileText, Settings, Database, BarChart3, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export function Dashboard({ onSelectProject, onViewAnalytics }: { onSelectProject: (id: string) => void; onViewAnalytics: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, []);

  const createNewProject = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        title: 'Novo Universo',
        ownerId: auth.currentUser.uid,
        format: 'novel',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        stats: { views: 0, favorites: 0 }
      });
      onSelectProject(docRef.id);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto cinematic-grid bg-[#0a0a0a] min-h-screen relative">
      {/* Decorative Gradient */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-editorial-accent/[0.05] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 relative">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 md:mb-24">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-8 md:w-12 h-[1px] bg-editorial-accent/30" />
              <p className="text-[8px] md:text-[10px] font-mono tracking-[0.3em] md:tracking-[0.5em] uppercase text-white/40">Sessão Inaugurada</p>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-brand uppercase tracking-tighter text-white leading-none">
              Seus <span className="text-white/20">Arquivos</span>
            </h1>
            <p className="font-serif italic text-lg md:text-xl text-white/30 tracking-tight">Onde a imaginação encontra a estrutura.</p>
          </div>
          
          <div className="flex items-center justify-between md:justify-start gap-4 md:gap-6">
            <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 backdrop-blur-md">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-2 md:p-2.5 rounded-xl transition-all", viewMode === 'grid' ? "bg-white/5 text-editorial-accent" : "text-white/20 hover:text-white")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn("p-2 md:p-2.5 rounded-xl transition-all", viewMode === 'list' ? "bg-white/5 text-editorial-accent" : "text-white/20 hover:text-white")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={createNewProject}
              className="flex-1 md:flex-none group flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3.5 md:py-4 bg-editorial-accent text-black rounded-full font-black uppercase tracking-widest text-[9px] md:text-[11px] hover:scale-105 active:scale-95 transition-all shadow-neon truncate"
            >
              <BookPlus className="w-4 h-4 group-hover:rotate-12 transition-transform shrink-0" />
              <span className="truncate">Manifestar Novo</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[4/5] rounded-[2rem] md:rounded-[3rem] bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8" 
              : "space-y-4"
          )}>
            <AnimatePresence mode="popLayout">
              {projects.map((project, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={cn(
                    "group cursor-pointer transition-all duration-500",
                    viewMode === 'grid' 
                      ? "rounded-[2rem] md:rounded-[3rem] bg-white/[0.02] border border-white/5 p-6 md:p-10 hover:bg-white/[0.04] hover:border-editorial-accent/20 relative overflow-hidden" 
                      : "rounded-2xl bg-white/[0.02] border-white/5 p-4 md:p-6 flex items-center justify-between hover:bg-white/[0.05]"
                  )}
                >
                  {viewMode === 'grid' ? (
                    <>
                      {/* Decorative Element */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-accent/[0.02] -mr-16 -mt-16 rounded-full group-hover:bg-editorial-accent/5 transition-colors" />
                      
                      <div className="flex items-center justify-between mb-12">
                        <div className="w-14 h-14 rounded-3xl glass-panel flex items-center justify-center text-white/30 group-hover:text-editorial-accent transition-all duration-500 group-hover:scale-110">
                          <FileText className="w-7 h-7" />
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => onViewAnalytics(project.id)}
                            className="p-2.5 rounded-xl hover:bg-white/5 text-white/10 hover:text-white transition-colors"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <div className="p-2.5 rounded-xl hover:bg-white/5 text-white/10 hover:text-white transition-colors">
                            <Settings className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-12 relative">
                        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-editorial-accent/40 mb-3 block">
                          Project Ref: {project.id.slice(0, 8)}
                        </p>
                        <h3 className="text-3xl font-brand uppercase tracking-tighter text-white mb-3 group-hover:translate-x-2 transition-transform duration-500">
                          {project.title}
                        </h3>
                        <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.25em]">
                          {project.format || 'Standard'} • <span className="font-serif italic normal-case tracking-normal opacity-50">Manuscrito em andamento</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-8 border-t border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2 text-white/20">
                             <Clock className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-mono">REC.</span>
                           </div>
                           <div className="flex items-center gap-2 text-white/20">
                             <Database className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-mono uppercase">Node_Sync</span>
                           </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-white/5 group-hover:text-editorial-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl glass-panel flex items-center justify-center text-white/20 group-hover:text-editorial-accent transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-brand uppercase tracking-tight text-white mb-1">{project.title}</h3>
                          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/10">RefID: {project.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] bg-white/5 px-3 py-1.5 rounded-lg">{project.format}</span>
                        <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center group-hover:border-editorial-accent/30 transition-colors">
                          <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-editorial-accent transition-colors" />
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {projects.length === 0 && !loading && (
              <div className="col-span-full py-40 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-[4rem] border border-white/5 bg-white/[0.01]">
                <div className="absolute top-0 left-0 w-full h-full cinematic-grid opacity-20 pointer-events-none" />
                <div className="w-24 h-24 rounded-full bg-editorial-accent/5 flex items-center justify-center mb-10 relative">
                   <div className="absolute inset-0 bg-editorial-accent/20 blur-2xl rounded-full" />
                   <Sparkles className="w-10 h-10 text-editorial-accent relative" />
                </div>
                <h3 className="text-4xl font-brand uppercase tracking-wide text-white mb-6">Tabula Rasa</h3>
                <p className="text-white/30 max-w-sm font-serif italic text-lg mb-12 text-balance leading-relaxed">Seu acervo de possibilidades ainda está vazio. Manifeste seu primeiro universo narrativo.</p>
                <button 
                  onClick={createNewProject}
                  className="px-12 py-5 bg-white text-black rounded-full font-black uppercase tracking-[0.3em] text-[10px] hover:bg-editorial-accent hover:scale-105 active:scale-95 transition-all shadow-neon"
                >
                  Manifestar Universo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
