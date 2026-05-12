import React, { useState, useEffect } from 'react';
import { Project, Chapter, ArtAsset } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Book, ChevronLeft, ChevronRight, Type, Maximize2, Minimize2, ArrowLeft, Layers, Image as ImageIcon } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ReaderModeProps {
  project: Project;
  chapters: Chapter[];
  onBack: () => void;
  key?: string;
}

export function ReaderMode({ project, chapters, onBack }: ReaderModeProps) {
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'text' | 'visual'>(project.type === 'manga' ? 'visual' : 'text');
  const [visualPanels, setVisualPanels] = useState<ArtAsset[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'projects', project.id, 'art'), where('type', '==', 'panel')),
      (snap) => {
        setVisualPanels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtAsset)).sort((a,b) => a.title.localeCompare(b.title)));
      }
    );
    return () => unsub();
  }, [project.id]);

  const currentChapter = chapters[activeChapterIndex];

  const fontSizes = {
    sm: 'text-base',
    base: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  if (chapters.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-editorial-paper">
        <Book className="w-12 h-12 text-editorial-muted mb-4 opacity-20" />
        <h2 className="font-serif text-2xl italic text-editorial-muted">O manuscrito ainda está em branco...</h2>
        <button 
          onClick={onBack}
          className="mt-6 text-[10px] font-black uppercase tracking-widest text-editorial-accent hover:opacity-70 flex items-center gap-2"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar ao Editor
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-editorial-paper overflow-hidden text-editorial-accent selection:bg-editorial-highlight">
      {/* Header de Controle */}
      <div className="h-16 border-b border-editorial-border/50 px-8 flex items-center justify-between bg-white/30 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-black/5 rounded-full transition-all"
            title="Sair da Leitura"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-4 w-px bg-editorial-border" />
          <h2 className="font-serif italic text-lg truncate max-w-[200px] lg:max-w-md">
            {project.title} 
            {project.subtitle && <span className="text-editorial-muted non-italic ml-2 opacity-50 border-l border-editorial-border pl-2">{project.subtitle}</span>}
            <span className="text-editorial-muted non-italic ml-2 opacity-30">&middot; {currentChapter?.title}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Controles de Tipografia */}
          <div className="flex bg-white/50 border border-editorial-border rounded-full p-1 mr-4">
            <button
               onClick={() => setViewMode('text')}
               className={cn(
                 "p-2 rounded-full transition-all",
                 viewMode === 'text' ? "bg-editorial-accent text-white" : "text-editorial-muted hover:text-editorial-accent"
               )}
               title="Modo Texto"
            >
              <Book className="w-4 h-4" />
            </button>
            <button
               onClick={() => setViewMode('visual')}
               className={cn(
                 "p-2 rounded-full transition-all",
                 viewMode === 'visual' ? "bg-editorial-accent text-white" : "text-editorial-muted hover:text-editorial-accent"
               )}
               title="Modo Visual (Storyboard)"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-white/50 border border-editorial-border rounded-full p-1 mr-4">
            {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
              <button
                key={size}
                disabled={viewMode === 'visual'}
                onClick={() => setFontSize(size)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full transition-all text-xs font-bold",
                  fontSize === size ? "bg-editorial-accent text-white" : "text-editorial-muted hover:text-editorial-accent",
                  viewMode === 'visual' && "opacity-20 cursor-not-allowed"
                )}
              >
                A
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsFullWidth(!isFullWidth)}
            className="p-2 text-editorial-muted hover:text-editorial-accent transition-all"
            title={isFullWidth ? "Centralizar Texto" : "Largura Total"}
          >
            {isFullWidth ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Área de Leitura */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className={cn(
          "mx-auto transition-all duration-500 py-24 px-8 lg:px-0",
          isFullWidth ? "max-w-5xl" : "max-w-3xl"
        )}>
          <AnimatePresence mode="wait">
            <motion.article
              key={activeChapterIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative"
            >
              <div className="text-center mb-20">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-editorial-muted mb-4 block">Capítulo {activeChapterIndex + 1}</span>
                <h1 className="text-5xl lg:text-6xl font-serif italic mb-8">{currentChapter.title}</h1>
                <div className="w-24 h-px bg-editorial-border mx-auto mb-8" />
              </div>

              <div className={cn(
                "font-serif leading-[1.8] text-[#333] whitespace-pre-wrap transition-all",
                fontSizes[fontSize]
              )}>
                {viewMode === 'text' ? (
                  currentChapter.content || (
                    <p className="text-editorial-muted italic text-center py-20 opacity-40">Este capítulo não possui conteúdo ainda.</p>
                  )
                ) : (
                  <div className="space-y-12 py-10">
                    {visualPanels.length > 0 ? visualPanels.map((panel, idx) => (
                      <div key={panel.id} className="group flex flex-col gap-4">
                         <div className="relative">
                           <img 
                             src={panel.imageUrl} 
                             alt={panel.title} 
                             className="w-full rounded-[40px] shadow-2xl border border-editorial-border" 
                             referrerPolicy="no-referrer"
                           />
                           <div className="absolute top-6 left-6">
                              <span className="bg-editorial-accent text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg">#{idx + 1} &middot; {panel.title}</span>
                           </div>
                         </div>
                      </div>
                    )) : (
                      <div className="text-center py-32 opacity-20">
                         <ImageIcon className="w-16 h-16 mx-auto mb-4" />
                         <p className="font-serif italic text-2xl">Nenhum painel visual mapeado para este projeto.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navegação entre capítulos no final da leitura */}
              <div className="mt-32 pt-16 border-t border-editorial-border flex items-center justify-between pb-32">
                {activeChapterIndex > 0 ? (
                  <button
                    onClick={() => {
                      setActiveChapterIndex(activeChapterIndex - 1);
                      document.querySelector('.flex-1')?.scrollTo(0, 0);
                    }}
                    className="flex flex-col items-start group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-editorial-muted mb-2 flex items-center gap-2">
                       <ChevronLeft className="w-3 h-3" /> Anterior
                    </span>
                    <span className="font-serif italic text-xl text-editorial-muted group-hover:text-editorial-accent transition-colors">
                      {chapters[activeChapterIndex - 1].title}
                    </span>
                  </button>
                ) : <div />}

                {activeChapterIndex < chapters.length - 1 ? (
                  <button
                    onClick={() => {
                      setActiveChapterIndex(activeChapterIndex + 1);
                      document.querySelector('.flex-1')?.scrollTo(0, 0);
                    }}
                    className="flex flex-col items-end group text-right"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-editorial-muted mb-2 flex items-center gap-2">
                       Próximo <ChevronRight className="w-3 h-3" />
                    </span>
                    <span className="font-serif italic text-xl text-editorial-muted group-hover:text-editorial-accent transition-colors">
                      {chapters[activeChapterIndex + 1].title}
                    </span>
                  </button>
                ) : (
                  <div className="text-center w-full">
                     <Book className="w-8 h-8 text-aura-gold mx-auto mb-4 opacity-30" />
                     <p className="font-serif italic text-editorial-muted">Fim da crônica atual.</p>
                  </div>
                )}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>

      {/* Barra de Progresso / Sumário Flutuante */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-editorial-accent/95 text-white py-3 px-6 rounded-full shadow-2xl backdrop-blur-sm z-30 border border-white/10">
         <button 
           disabled={activeChapterIndex === 0}
           onClick={() => setActiveChapterIndex(activeChapterIndex - 1)}
           className="hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 transition-all"
         >
           <ChevronLeft className="w-5 h-5" />
         </button>
         <div className="flex flex-col items-center min-w-[80px]">
           <span className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-0.5">Capítulo</span>
           <span className="text-xs font-bold tabular-nums">{activeChapterIndex + 1} de {chapters.length}</span>
         </div>
         <button 
           disabled={activeChapterIndex === chapters.length - 1}
           onClick={() => setActiveChapterIndex(activeChapterIndex + 1)}
           className="hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 transition-all"
         >
           <ChevronRight className="w-5 h-5" />
         </button>
      </div>
    </div>
  );
}
