import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage, Character, Note } from '../types';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, limit, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, Bot, User, Sparkles, Wand2, Lightbulb, ChevronRight, X, MessageSquare, StickyNote, Activity, Target, ShieldCheck, RefreshCw, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatBotResponse, improveWriting } from '../services/aiService';
import { cn, formatDate } from '../lib/utils';

interface AssistantPanelProps {
  project: Project;
  currentContent: string;
  onReplaceContent: (newContent: string) => void;
  characters: Character[];
}

export function AssistantPanel({ project, currentContent, onReplaceContent, characters }: AssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'assistant' | 'notes'>('assistant');
  
  // Refinement States
  const [tone, setTone] = useState('Sombrio');
  const [rhythm, setRhythm] = useState('Lento');
  const [emotion, setEmotion] = useState('Medo');
  
  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  // Notes States
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'projects', project.id, 'chat'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    });
    return () => unsub();
  }, [project.id]);

  useEffect(() => {
    const q = query(
      collection(db, 'projects', project.id, 'notes'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    });
    return () => unsub();
  }, [project.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      await addDoc(collection(db, 'projects', project.id, 'chat'), {
        role: 'user',
        text: userText,
        createdAt: serverTimestamp(),
      });

      const projectContext = `
        Título: ${project.title}
        Descrição: ${project.description || "N/A"}
        Natureza/Gênero: ${project.type || "N/A"}
        Conteúdo Atual da Página: ${currentContent.slice(-4000) || "Início da história"}
      `;

      const history = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        text: m.text
      }));

      const responseText = await chatBotResponse([...history, { role: 'user', text: userText }], projectContext);

      await addDoc(collection(db, 'projects', project.id, 'chat'), {
        role: 'assistant',
        text: responseText,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveWriting = async () => {
    if (isImproving || !currentContent.trim()) return;
    
    // Get selected text or current paragraph
    // For simplicity, we improve the whole context or a significant chunk
    // In a real app, we'd get the current selection
    
    setIsImproving(true);
    try {
      const context = `Projeto: ${project.title}. Descrição: ${project.description}`;
      const improved = await improveWriting(currentContent, context, tone, rhythm, emotion);
      
      if (improved && improved !== currentContent) {
        onReplaceContent(improved);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsImproving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    try {
      await addDoc(collection(db, 'projects', project.id, 'notes'), {
        content: noteInput.trim(),
        createdAt: serverTimestamp(),
      });
      setNoteInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteDoc(doc(db, 'projects', project.id, 'notes', id));
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border-l border-white/5 shadow-2xl">
      {/* Tabs */}
      <div className="flex border-b border-white/5 p-2 gap-2">
        <button
          onClick={() => setActiveTab('assistant')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'assistant' ? "bg-white/5 text-editorial-accent shadow-neon-small" : "text-white/20 hover:text-white/40"
          )}
        >
          <Sparkles className="w-4 h-4" /> Assistente IA
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'notes' ? "bg-white/5 text-editorial-accent shadow-neon-small" : "text-white/20 hover:text-white/40"
          )}
        >
          <StickyNote className="w-4 h-4" /> Anotações <span className="bg-editorial-accent/20 text-editorial-accent px-1.5 rounded-md ml-1">{notes.length}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'assistant' ? (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pb-32"
            >
              {/* Chat History Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between text-white/20">
                    <span className="text-[8px] font-black uppercase tracking-widest">Diálogo com a Musa</span>
                    <MessageSquare className="w-3.5 h-3.5" />
                 </div>
                 
                 <div className="space-y-4 max-h-[300px] overflow-y-auto px-2 custom-scrollbar-thin">
                    {messages.length === 0 ? (
                      <div className="p-10 border border-white/5 bg-white/[0.01] rounded-[32px] text-center space-y-3">
                         <Bot className="w-8 h-8 text-white/10 mx-auto" />
                         <p className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-relaxed">
                            Aguardando seu comando para <span className="text-editorial-accent">tecer o destino</span>
                         </p>
                      </div>
                    ) : (
                      messages.map((m, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={m.id || i} 
                          className={cn(
                            "flex flex-col gap-2 max-w-[85%] p-4 rounded-2xl text-[10px] leading-relaxed",
                            m.role === 'user' ? "ml-auto bg-editorial-accent/10 border border-editorial-accent/20 text-white/80" : "mr-auto bg-white/5 border border-white/10 text-white/60"
                          )}
                        >
                           {m.text}
                        </motion.div>
                      ))
                    )}
                 </div>
              </div>

               {/* Sugestões Inteligentes - Compact Mode */}
               <section className="space-y-6 bg-white/2 p-8 rounded-[40px] border border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-accent/5 blur-3xl group-hover:bg-editorial-accent/10 transition-all" />
                 
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-editorial-accent">
                       <Sparkles className="w-4 h-4 shadow-neon-small" />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Alquimia Narrativa</h3>
                    </div>
                    <Wand2 className="w-3.5 h-3.5 text-white/10" />
                 </div>
 
                 <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Tom da Prosa</span>
                          <span className="text-[9px] font-bold text-editorial-accent uppercase tracking-tighter">{tone}</span>
                       </div>
                       <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {['Sombrio', 'Lírico', 'Épico', 'Visceral', 'Célebre'].map(t => (
                            <button
                              key={t}
                              onClick={() => setTone(t)}
                              className={cn(
                                "whitespace-nowrap px-5 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-tighter transition-all border",
                                tone === t ? "bg-editorial-accent text-white border-editorial-accent shadow-neon-small" : "bg-white/5 border-white/10 text-white/20 hover:border-white/30"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Ritmo da Narrativa</span>
                          <span className="text-[9px] font-bold text-editorial-accent uppercase tracking-tighter">{rhythm}</span>
                       </div>
                       <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {['Lento', 'Constante', 'Acelerado', 'Caótico'].map(r => (
                            <button
                              key={r}
                              onClick={() => setRhythm(r)}
                              className={cn(
                                "whitespace-nowrap px-5 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-tighter transition-all border",
                                rhythm === r ? "bg-editorial-accent text-white border-editorial-accent shadow-neon-small" : "bg-white/5 border-white/10 text-white/20 hover:border-white/30"
                              )}
                            >
                              {r}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Emoção Predominante</span>
                          <span className="text-[9px] font-bold text-editorial-accent uppercase tracking-tighter">{emotion}</span>
                       </div>
                       <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {['Medo', 'Alegria', 'Tristeza', 'Raiva', 'Surpresa', 'Nojo', 'Calma'].map(e => (
                            <button
                              key={e}
                              onClick={() => setEmotion(e)}
                              className={cn(
                                "whitespace-nowrap px-5 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-tighter transition-all border",
                                emotion === e ? "bg-editorial-accent text-white border-editorial-accent shadow-neon-small" : "bg-white/5 border-white/10 text-white/20 hover:border-white/30"
                              )}
                            >
                              {e}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />
 
                    <button
                      onClick={handleImproveWriting}
                      disabled={isImproving || !currentContent.trim()}
                      className="w-full bg-editorial-accent text-white py-5 rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-neon hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isImproving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                      {isImproving ? "TEcendo Matriz..." : "MANIFESTAR REFINAMENTO"}
                    </button>
                 </div>
               </section>

              {/* Personagens no Radar */}
              <section className="space-y-4">
                 <div className="flex items-center justify-between text-white/20">
                    <h3 className="text-[9px] font-black uppercase tracking-widest">Atores em Foco</h3>
                    <Target className="w-4 h-4" />
                 </div>
                 <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    {characters.map(char => (
                      <div key={char.id} className="shrink-0 flex flex-col items-center gap-2 group cursor-pointer">
                         <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden group-hover:border-editorial-accent transition-all p-1">
                            <div className="w-full h-full rounded-xl overflow-hidden bg-editorial-accent/10 flex items-center justify-center">
                               {char.imageUrl ? <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-white/10" />}
                            </div>
                         </div>
                         <span className="text-[8px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white transition-colors truncate max-w-[64px]">{char.name}</span>
                      </div>
                    ))}
                    <button className="shrink-0 w-16 h-16 rounded-2xl bg-white/2 border border-dashed border-white/10 flex items-center justify-center text-white/10 hover:text-white/30 hover:border-white/30 transition-all">
                       <ShieldCheck className="w-6 h-6" />
                    </button>
                 </div>
              </section>

              {/* Linha do Tempo de Sessão */}
              <section className="space-y-6 pt-4">
                 <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-white/40">Log de Sincronia</h3>
                    <div className="flex items-center gap-2 text-[8px] font-bold text-green-500/60 uppercase">
                       <CheckCircle2 className="w-3 h-3" /> Conexão Estável
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-4 group">
                       <div className="w-1.5 h-1.5 rounded-full bg-editorial-accent shadow-neon-small group-hover:scale-150 transition-all" />
                       <div className="flex-1 flex justify-between items-center text-[9px] font-black">
                          <span className="text-white/60">Nova Seção Sincronizada</span>
                          <span className="text-white/10 uppercase tracking-tighter">HÁ 2 MIN</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 group opacity-40">
                       <div className="w-1.5 h-1.5 rounded-full bg-white/20 transition-all" />
                       <div className="flex-1 flex justify-between items-center text-[9px] font-black">
                          <span className="text-white/60">Manifestação de 154 Glifos</span>
                          <span className="text-white/10 uppercase tracking-tighter">HÁ 5 MIN</span>
                       </div>
                    </div>
                 </div>
              </section>
            </motion.div>
          ) : (

            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
               <form onSubmit={handleAddNote} className="relative group">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Nova anotação cronológica..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-sans h-24 outline-none focus:border-editorial-accent transition-all resize-none text-white/80"
                  />
                  <button 
                    type="submit"
                    disabled={!noteInput.trim()}
                    className="absolute bottom-3 right-3 p-2 bg-editorial-accent text-white rounded-xl shadow-neon-small disabled:opacity-20"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
               </form>

               <div className="space-y-4">
                  {notes.length === 0 ? (
                    <div className="py-20 text-center opacity-20">
                       <StickyNote className="w-12 h-12 mx-auto mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma nota registrada</p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all space-y-3">
                         <div className="flex justify-between items-start">
                            <span className="text-[8px] font-black text-editorial-accent/40 uppercase tracking-widest">
                               {note.createdAt ? formatDate(note.createdAt.toDate()) : 'Recent'}
                            </span>
                            <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500/40 hover:text-red-500 transition-all">
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                         <p className="text-[10px] text-white/60 leading-relaxed font-sans">{note.content}</p>
                      </div>
                    ))
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area at Bottom */}
      <div className="p-6 border-t border-white/5 bg-[#0a0a0a]">
        <div className="flex flex-col gap-4">
           {/* Chat messages preview toggle or mini view could go here */}
           <div className="relative group">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Invoque sua musa..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-12 outline-none text-[10px] font-black uppercase tracking-widest text-white focus:border-editorial-accent transition-all"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-editorial-accent transition-colors"
              >
                 <Send className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
