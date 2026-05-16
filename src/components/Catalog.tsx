import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PublishedWork } from '../types';
import { BookOpen, Star, User, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export function Catalog({ onSelectWork }: { onSelectWork: (id: string) => void }) {
  const [works, setWorks] = useState<PublishedWork[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'published_works'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setWorks(snap.docs.map(d => ({ id: d.id, ...d.data() } as PublishedWork)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'published_works');
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8 cinematic-grid bg-[#080808]">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-editorial-accent" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Acervo Global / Descoberta</h2>
          </div>
          <h1 className="text-4xl font-brand uppercase tracking-tight text-white mb-4">Catálogo de Universos</h1>
          <p className="text-white/50 max-w-2xl font-light leading-relaxed">
            Explore histórias originais, mangás e mundos construídos pela comunidade AURA.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {works.map((work) => (
            <motion.div
              layoutId={work.id}
              key={work.id}
              onClick={() => onSelectWork(work.id)}
              className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all"
            >
              <div className="aspect-[3/4] rounded-xl bg-white/5 mb-5 overflow-hidden relative">
                {work.coverImage ? (
                  <img src={work.coverImage} referrerPolicy="no-referrer" alt={work.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <BookOpen className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[9px] font-black uppercase tracking-widest border border-white/10">
                  {work.genre}
                </div>
              </div>
              
              <h3 className="text-lg font-brand uppercase tracking-tight text-white mb-2 group-hover:text-editorial-accent transition-colors truncate">
                {work.title}
              </h3>
              
              <div className="flex items-center gap-4 text-[10px] text-white/40 uppercase font-black tracking-widest">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  {work.authorName}
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-editorial-accent" />
                  {work.stats.favorites}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                 <span className="text-[9px] font-black text-white/30 tracking-widest uppercase">
                   {work.stats.chaptersCount} Capítulos
                 </span>
                 <button className="text-[9px] font-black uppercase tracking-[0.2em] text-editorial-accent opacity-0 group-hover:opacity-100 transition-opacity">
                   Ler agora →
                 </button>
              </div>
            </motion.div>
          ))}
          
          {works.length === 0 && (
            <div className="col-span-full border border-dashed border-white/10 rounded-3xl p-20 flex flex-col items-center justify-center opacity-30">
               <BookOpen className="w-12 h-12 mb-6" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Nenhuma obra publicada no catálogo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
