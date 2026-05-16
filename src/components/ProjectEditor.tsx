import React, { useState, useEffect } from 'react';
import { 
  Plus, Save, Trash2, ChevronRight, FileText, User, 
  Database, Image as ImageIcon, Maximize2, Minimize2, 
  Sparkles, History, Send, BookOpen, UserCircle, Map,
  Cpu, Target, Wind, Activity, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Chapter, Character, LoreEntry } from '../types';
import { db, auth } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  serverTimestamp, query, orderBy, onSnapshot 
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ProjectEditorProps {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  loreEntries: LoreEntry[];
  activeChapterId: string | null;
  setActiveChapterId: (id: string | null) => void;
  isZenMode: boolean;
  setIsZenMode: (zen: boolean) => void;
  activeTab: 'editor' | 'characters' | 'lore' | 'storyboard';
  isGuest: boolean;
}

export function ProjectEditor({
  project, chapters, characters, loreEntries, activeChapterId, setActiveChapterId,
  isZenMode, setIsZenMode, activeTab, isGuest
}: ProjectEditorProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLocalSidebarOpen, setIsLocalSidebarOpen] = useState(false);
  const activeChapter = chapters.find(c => c.id === activeChapterId);

  useEffect(() => {
    if (activeChapter) {
      setContent(activeChapter.content || '');
    }
  }, [activeChapterId, chapters]);

  const saveChapterContent = async () => {
    if (!activeChapterId || isGuest) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id, 'chapters', activeChapterId), {
        content: content,
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'projects', project.id), {
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving chapter:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addChapter = async () => {
    if (isGuest) return;
    try {
      const newChapter = {
        title: `Capítulo ${chapters.length + 1}`,
        order: chapters.length,
        content: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'projects', project.id, 'chapters'), newChapter);
      setActiveChapterId(docRef.id);
    } catch (error) {
      console.error("Error adding chapter:", error);
    }
  };

  const addCharacter = async () => {
    if (isGuest) return;
    try {
      await addDoc(collection(db, 'projects', project.id, 'characters'), {
        name: 'Novo Personagem',
        role: 'Protagonista',
        description: '',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding character:", error);
    }
  };

  const addLoreEntry = async () => {
    if (isGuest) return;
    try {
      await addDoc(collection(db, 'projects', project.id, 'lore'), {
        title: 'Novo Termo',
        category: 'Mundo',
        content: '',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding lore entry:", error);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#080808] relative">
      {/* Local Navigation Sidebar - Mobile Toggle Backdrop */}
      <AnimatePresence>
        {isLocalSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLocalSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Local Navigation Sidebar */}
      <AnimatePresence mode="popLayout">
        {(!isZenMode || (isZenMode && isLocalSidebarOpen)) && (
          <motion.aside 
            initial={{ x: -288 }}
            animate={{ x: isLocalSidebarOpen || !isZenMode ? 0 : -288 }}
            exit={{ x: -288 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "w-72 border-r border-white/5 flex flex-col bg-[#050505] relative z-50 md:z-30 h-full",
              "fixed md:relative inset-y-0 left-0 transform md:translate-x-0 transition-transform duration-300 md:transition-none",
              isLocalSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
          >
            <div className="p-6 md:p-8 border-b border-white/5 space-y-4 md:space-y-6">
              <div className="flex items-center justify-between md:block">
                <div className="space-y-1">
                  <p className="text-[7px] md:text-[8px] font-mono uppercase tracking-[0.4em] text-editorial-accent/30">Target System</p>
                  <h2 className="text-lg md:text-xl font-brand uppercase tracking-tighter text-white truncate max-w-[180px] md:max-w-full">{project.title}</h2>
                </div>
                <button 
                  onClick={() => setIsLocalSidebarOpen(false)}
                  className="md:hidden p-2 rounded-lg bg-white/5 text-white/40"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
              
              {activeTab === 'editor' && (
                <button 
                  onClick={addChapter}
                  className="w-full flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <span>Acrescentar Capítulo</span>
                  <Plus className="w-3.5 h-3.5 text-editorial-accent" />
                </button>
              )}
              {activeTab === 'characters' && (
                <button 
                  onClick={addCharacter}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 transition-all group"
                >
                  Novo Personagem
                  <UserCircle className="w-3.5 h-3.5 text-editorial-accent" />
                </button>
              )}
              {activeTab === 'lore' && (
                <button 
                  onClick={addLoreEntry}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 transition-all group"
                >
                  Novo Termo
                  <BookOpen className="w-3.5 h-3.5 text-editorial-accent" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
              {activeTab === 'editor' && chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => setActiveChapterId(chapter.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group text-left relative",
                    activeChapterId === chapter.id 
                      ? "bg-editorial-accent/5 border border-editorial-accent/20 text-editorial-accent" 
                      : "text-white/20 hover:bg-white/[0.02] hover:text-white border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[8px] font-mono opacity-30">{String(chapter.order + 1).padStart(2, '0')}</span>
                    <span className="text-[11px] font-bold uppercase tracking-tight truncate">{chapter.title}</span>
                  </div>
                  {activeChapterId === chapter.id && (
                    <motion.div 
                      layoutId="sidebar-active-indicator"
                      className="w-1 h-1 rounded-full bg-editorial-accent shadow-neon" 
                    />
                  )}
                </button>
              ))}

              {activeTab === 'characters' && characters.map((char) => (
                <div key={char.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 group hover:bg-white/[0.04] transition-all relative">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3 text-red-500/40 hover:text-red-500 cursor-pointer" />
                  </div>
                  <input 
                    type="text"
                    defaultValue={char.name}
                    className="bg-transparent border-none text-xs font-bold uppercase tracking-tight text-white w-full focus:outline-none"
                    onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'characters', char.id), { name: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-[1px] bg-editorial-accent/50" />
                    <input 
                      type="text"
                      defaultValue={char.role}
                      placeholder="Role..."
                      className="bg-transparent border-none text-[8px] font-mono uppercase tracking-widest text-white/20 w-full focus:outline-none"
                      onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'characters', char.id), { role: e.target.value })}
                    />
                  </div>
                </div>
              ))}

              {activeTab === 'lore' && loreEntries.map((lore) => (
                <div key={lore.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 group hover:bg-white/[0.04] transition-all">
                  <input 
                    type="text"
                    defaultValue={lore.title}
                    className="bg-transparent border-none text-xs font-bold uppercase tracking-tight text-white w-full focus:outline-none"
                    onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'lore', lore.id), { title: e.target.value })}
                  />
                  <div className="flex justify-start">
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-editorial-accent/60 bg-editorial-accent/10 px-2 py-0.5 rounded-full border border-editorial-accent/10">
                      {lore.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-white/5">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-[8px] font-mono tracking-[0.2em] text-white/20">System Load</span>
                  <span className="text-[8px] font-mono text-editorial-accent/40">2.4%</span>
               </div>
               <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                  <div className="h-full bg-editorial-accent/20 w-1/3 rounded-full" />
               </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col relative bg-[#0a0a0a] min-w-0">
        <header className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-10 bg-[#080808]/50 backdrop-blur-3xl z-40 relative overflow-hidden">
          {/* Subtle line background */}
          <div className="absolute inset-0 cinematic-grid opacity-10 pointer-events-none" />

          <div className="flex items-center gap-3 md:gap-8 relative">
            <button 
              onClick={() => setIsLocalSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-white/5 text-editorial-accent border border-editorial-accent/20"
            >
              <List className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col">
               <div className="flex items-center gap-2 mb-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-editorial-accent animate-pulse shadow-neon" />
                 <span className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.2em] md:tracking-[0.4em] text-editorial-accent truncate max-w-[120px] md:max-w-none">Ativo</span>
               </div>
               <p className="text-[7px] md:text-[8px] font-mono uppercase tracking-[0.1em] md:tracking-[0.2em] text-white/20 truncate">
                 {activeTab === 'editor' ? 'Manuscrito' : activeTab === 'characters' ? 'Biográfico' : 'Lore'}
               </p>
            </div>
            
            {isSaving && (
              <div className="flex items-center gap-2 text-white/10 md:text-white/20">
                <span className="text-[7px] md:text-[8px] font-mono uppercase tracking-[0.2em]">Salvando...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-6 relative">
            <div className="hidden sm:flex items-center gap-3 pr-6 border-r border-white/5">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-mono text-white/20">CPU_TEMP</span>
                <span className="text-[8px] font-mono text-editorial-accent/60">42°C</span>
              </div>
              <Activity className="w-4 h-4 text-editorial-accent/20" />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {activeTab === 'editor' && (
                <>
                  <button 
                    onClick={saveChapterContent}
                    className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/10 text-white/20 hover:text-editorial-accent transition-all active:scale-95"
                    title="Salvar"
                  >
                    <Save className="w-3.5 md:w-4 h-3.5 md:h-4" />
                  </button>
                  <button 
                    onClick={() => setIsZenMode(!isZenMode)}
                    className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/10 text-white/20 hover:text-editorial-accent transition-all active:scale-95"
                    title={isZenMode ? "Sair" : "Imersivo"}
                  >
                    {isZenMode ? <Minimize2 className="w-3.5 md:w-4 h-3.5 md:h-4" /> : <Maximize2 className="w-3.5 md:w-4 h-3.5 md:h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
           <AnimatePresence mode="wait">
              {activeTab === 'editor' ? (
                <motion.div 
                  key="editor"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex-1 p-6 sm:p-12 md:p-32 overflow-y-auto cinematic-grid relative">
                    <div className="max-w-3xl mx-auto space-y-12 md:space-y-20 relative">
                       <div className="space-y-4">
                         <div className="flex items-center gap-4">
                           <span className="w-8 h-[1px] bg-editorial-accent/20" />
                           <p className="text-[8px] md:text-[9px] font-mono uppercase tracking-[0.4em] md:tracking-[0.5em] text-editorial-accent/40">Ínclito Capítulo</p>
                         </div>
                         <input 
                           type="text"
                           value={activeChapter?.title || ''}
                           placeholder="Título..."
                           className="w-full bg-transparent border-none text-4xl md:text-6xl font-brand uppercase tracking-tighter text-white placeholder:text-white/5 focus:outline-none leading-none"
                           onChange={(e) => {
                               if (!activeChapterId || isGuest) return;
                               updateDoc(doc(db, 'projects', project.id, 'chapters', activeChapterId), { title: e.target.value });
                           }}
                         />
                       </div>
                       
                       <div className="relative">
                         <div className="hidden md:block absolute -left-12 top-0 h-full w-[1px] bg-gradient-to-b from-editorial-accent/10 via-transparent to-transparent" />
                         <textarea
                           value={content}
                           onChange={(e) => setContent(e.target.value)}
                           onBlur={saveChapterContent}
                           placeholder="Sua história começa aqui..."
                           className="w-full h-[70vh] bg-transparent border-none resize-none text-lg md:text-xl leading-[1.8] text-white/70 placeholder:text-white/5 focus:outline-none font-serif font-light md:first-letter:text-4xl"
                         />
                       </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'characters' ? (
                <motion.div 
                  key="characters"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full p-6 md:p-20 overflow-y-auto cinematic-grid"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 max-w-6xl mx-auto">
                    {characters.map(char => (
                      <div key={char.id} className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-white/[0.02] border border-white/5 space-y-6 md:space-y-8 relative overflow-hidden group">
                        <div className="absolute bottom-0 right-0 w-32 h-32 md:w-40 md:h-40 bg-editorial-accent/[0.01] -mr-16 -mb-16 md:-mr-20 md:-mb-20 rounded-full group-hover:bg-editorial-accent/5 transition-colors duration-700" />
                        
                        <div className="flex items-center gap-4 md:gap-8 relative">
                           <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] glass-panel flex items-center justify-center text-white/20 group-hover:text-editorial-accent transition-all duration-500 scale-90 group-hover:scale-100">
                             <User className="w-6 md:w-10 h-6 md:h-10" />
                           </div>
                           <div className="flex-1 space-y-1 md:space-y-2">
                              <input 
                                type="text"
                                defaultValue={char.name}
                                className="w-full bg-transparent border-none text-xl md:text-3xl font-brand uppercase tracking-tighter text-white focus:outline-none"
                                onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'characters', char.id), { name: e.target.value })}
                              />
                              <div className="flex items-center gap-2">
                                <Wind className="w-3 h-3 text-editorial-accent/30 shrink-0" />
                                <input 
                                  type="text"
                                  defaultValue={char.role}
                                  className="w-full bg-transparent border-none text-[8px] md:text-[10px] font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-editorial-accent/50 focus:outline-none truncate"
                                  onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'characters', char.id), { role: e.target.value })}
                                />
                              </div>
                           </div>
                        </div>
                        
                        <div className="space-y-3 md:space-y-4 relative">
                          <p className="text-[7px] md:text-[8px] font-mono uppercase tracking-[0.2em] text-white/10">Dossiê</p>
                          <textarea 
                            defaultValue={char.description}
                            placeholder="Biografia..."
                            className="w-full h-32 md:h-40 bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 text-xs md:text-sm leading-relaxed text-white/50 focus:outline-none focus:border-editorial-accent/20 transition-all resize-none font-serif italic"
                            onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'characters', char.id), { description: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={addCharacter}
                      className="border-2 border-dashed border-white/5 rounded-[2rem] md:rounded-[3rem] p-10 md:p-16 flex flex-col items-center justify-center text-white/5 hover:text-editorial-accent hover:border-editorial-accent/10 hover:bg-white/[0.01] transition-all group relative overflow-hidden"
                    >
                       <Plus className="w-8 md:w-12 h-8 md:h-12 mb-4 md:mb-6 group-hover:scale-110 transition-transform relative" />
                       <span className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.4em] md:tracking-[0.5em] relative">Manifestar Avatar</span>
                    </button>
                  </div>
                </motion.div>
              ) : activeTab === 'lore' ? (
                <motion.div 
                  key="lore"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full p-6 md:p-20 overflow-y-auto cinematic-grid"
                >
                  <div className="space-y-6 md:space-y-12 max-w-4xl mx-auto">
                    {loreEntries.map(entry => (
                      <div key={entry.id} className="p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] bg-white/[0.02] border border-white/10 space-y-4 md:space-y-6 relative group">
                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-4 md:gap-6">
                              <div className="w-1 h-6 md:h-8 bg-editorial-accent/30 rounded-full shrink-0" />
                              <input 
                                type="text"
                                defaultValue={entry.title}
                                className="bg-transparent border-none text-xl md:text-2xl font-brand uppercase tracking-tighter text-white focus:outline-none w-full md:min-w-[300px]"
                                onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'lore', entry.id), { title: e.target.value })}
                              />
                            </div>
                            <select 
                              defaultValue={entry.category}
                              className="bg-white/5 border border-white/10 rounded-xl text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-white/40 px-3 md:px-4 py-1.5 md:py-2 focus:outline-none cursor-pointer hover:bg-white/10 transition-colors w-fit"
                              onChange={(e) => updateDoc(doc(db, 'projects', project.id, 'lore', entry.id), { category: e.target.value })}
                            >
                               <option value="Mundo">Mundo</option>
                               <option value="História">História</option>
                               <option value="Magia">Arcanismo</option>
                               <option value="Cultura">Cultura</option>
                            </select>
                         </div>
                         <textarea 
                           defaultValue={entry.content}
                           placeholder="Descrição..."
                           className="w-full h-24 md:h-32 bg-transparent border-none text-sm md:text-base leading-relaxed text-white/40 focus:outline-none font-serif italic relative z-10 px-0 md:px-8"
                           onBlur={(e) => updateDoc(doc(db, 'projects', project.id, 'lore', entry.id), { content: e.target.value })}
                         />
                      </div>
                    ))}
                    <button 
                      onClick={addLoreEntry}
                      className="w-full border-2 border-dashed border-white/5 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 flex items-center justify-center gap-4 md:gap-6 text-white/5 hover:text-editorial-accent hover:border-editorial-accent/10 transition-all group"
                    >
                       <Plus className="w-5 md:w-6 h-5 md:h-6 group-hover:rotate-90 transition-transform" />
                       <span className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.4em] md:tracking-[0.5em]">Tecer Novo Conceito</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-8">
                    <Cpu className="w-16 h-16 mx-auto opacity-5 animate-pulse" />
                    <p className="text-[10px] font-mono uppercase tracking-[0.6em] text-white/10">Fralda do Sistema em Construção</p>
                  </div>
                </div>
              )}
           </AnimatePresence>
        </main>

        <footer className="h-10 md:h-12 border-t border-white/5 flex items-center justify-between px-4 md:px-10 bg-[#050505] text-[8px] md:text-[10px] font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/20">
           <div className="flex gap-4 md:gap-10 truncate">
              {activeTab === 'editor' ? (
                <>
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-white/10 hidden sm:inline">WORDS:</span>
                    <span className="text-editorial-accent/60">{content.trim().split(/\s+/).filter(x => x).length}</span>
                  </div>
                </>
              ) : activeTab === 'characters' ? (
                <span className="truncate">Avatares: {characters.length}</span>
              ) : (
                <span className="truncate">Lore: {loreEntries.length}</span>
              )}
           </div>
           
           <div className="flex items-center gap-3 md:gap-8">
              <div className="hidden sm:flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-editorial-accent/30" />
                <span>FOCO: 98%</span>
              </div>
              <div className="hidden sm:block h-4 w-[1px] bg-white/5" />
              <span className="text-editorial-accent/40 font-black truncate">ORÁCULO_ENGINE</span>
           </div>
        </footer>
      </div>
    </div>
  );
}
