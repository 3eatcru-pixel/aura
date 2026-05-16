import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, User, Star, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Chapter } from '../types';
import { cn } from '../lib/utils';

interface ReaderModeProps {
  project: Project;
  chapters: Chapter[];
  onBack: () => void;
  projectFormat?: string | null;
}

export function ReaderMode({ project, chapters, onBack, projectFormat }: ReaderModeProps) {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const currentChapter = chapters[activeChapterIndex];

  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      <header className="px-4 md:px-8 py-3 md:py-4 border-b border-white/5 flex items-center justify-between bg-[#080808]/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3 md:gap-6 truncate">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="truncate">
            <h2 className="text-[10px] md:text-xs font-brand uppercase tracking-[0.2em] text-white truncate max-w-[150px] md:max-w-none">{project.title}</h2>
            <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-editorial-accent truncate">Leitura / {projectFormat || 'Volume'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
           <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all">
             <Star className="w-3 h-3" />
             Favoritar
           </button>
           <button className="sm:hidden p-2 rounded-full bg-white/5 border border-white/10 text-white/40">
             <Star className="w-3.5 h-3.5" />
           </button>
           <button className="p-2 md:p-2.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all">
             <Share2 className="w-3.5 h-3.5" />
           </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto cinematic-grid pt-8 md:pt-12 pb-24">
        <div className="max-w-2xl mx-auto px-5 md:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentChapter?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <header className="mb-10 md:mb-16 text-center">
                 <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-editorial-accent mb-3 md:mb-4">
                   Capítulo {activeChapterIndex + 1}
                 </p>
                 <h1 className="text-3xl md:text-5xl font-brand uppercase tracking-tight text-white mb-6 md:mb-8">
                   {currentChapter?.title || 'Sem Título'}
                 </h1>
                 <div className="w-12 md:w-16 h-px bg-white/10 mx-auto" />
              </header>

              <article className="prose prose-invert prose-base md:prose-lg max-w-none">
                 {currentChapter?.content ? (
                   currentChapter.content.split('\n\n').map((paragraph, idx) => (
                     <p key={idx} className="text-white/80 leading-[1.8] text-base md:text-lg font-light mb-6 md:mb-8 first-letter:text-3xl md:first-letter:text-4xl first-letter:font-brand first-letter:mr-2 md:first-letter:mr-3 first-letter:float-left first-letter:text-editorial-accent">
                       {paragraph}
                     </p>
                   ))
                 ) : (
                   <div className="h-64 flex flex-col items-center justify-center opacity-20 italic text-sm">
                      <BookOpen className="w-12 h-12 mb-4" />
                      <p>Este capítulo ainda não possui conteúdo.</p>
                   </div>
                 )}
              </article>

              <footer className="mt-16 md:mt-24 pt-8 md:pt-12 border-t border-white/5 flex flex-col items-center gap-6 md:gap-8">
                 <div className="flex items-center gap-3">
                    <div className="w-8 md:w-10 h-8 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                       <User className="w-4 md:w-5 h-4 md:h-5" />
                    </div>
                    <div>
                       <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40">Escrito por</p>
                       <p className="text-[11px] md:text-xs font-brand uppercase tracking-tight text-white">{project.authorName || 'Autor'}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 md:gap-4 w-full justify-center">
                    <button 
                      disabled={activeChapterIndex === 0}
                      onClick={() => setActiveChapterIndex(p => p - 1)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white disabled:opacity-10 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    <button 
                      disabled={activeChapterIndex === chapters.length - 1}
                      onClick={() => setActiveChapterIndex(p => p + 1)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 md:px-8 py-3 rounded-xl bg-editorial-accent text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:scale-105 active:scale-95 disabled:opacity-10 transition-all shadow-neon"
                    >
                      Próximo
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
              </footer>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 md:absolute md:bottom-8 md:left-8 md:right-auto flex items-center justify-center md:justify-start gap-4 text-[7px] md:text-[9px] font-black uppercase tracking-[0.3em] text-white/20 bg-black/50 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-t border-white/5 md:border-none z-30">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-editorial-accent animate-pulse" />
            Progresso: {Math.round(((activeChapterIndex + 1) / chapters.length) * 100)}%
         </div>
         <div className="w-px h-3 bg-white/10" />
         <span>Cap. {activeChapterIndex + 1} / {chapters.length}</span>
      </div>
    </div>
  );
}
