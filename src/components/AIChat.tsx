import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage } from '../types';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Send, Bot, User, Sparkles, Wand2, Lightbulb, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatBotResponse } from '../services/aiService';
import { cn, formatDate } from '../lib/utils';

interface AIChatProps {
  project: Project;
  currentContent?: string;
  key?: string;
}

export function AIChat({ project, currentContent }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeExpert, setActiveExpert] = useState<'Musa' | 'Editor' | 'Revisor'>('Musa');
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 1. Add user message to Firestore
      await addDoc(collection(db, 'projects', project.id, 'chat'), {
        role: 'user',
        text: userText,
        createdAt: serverTimestamp(),
      });

      // 2. Get full context for AI
      const contextText = currentContent || project.currentContent || "";
      const projectContext = `
        Título: ${project.title}
        Descrição: ${project.description || "N/A"}
        Natureza/Gênero: ${project.type || "N/A"}
        Papel do Assistente: Você está atuando como ${activeExpert}.
        Conteúdo Atual do Capítulo: ${contextText.slice(-4000) || "Início da história"}
      `;

      // 3. Get AI Response
      const responseText = await chatBotResponse([...messages, { role: 'user', text: userText } as any], projectContext);

      // 4. Add AI message to Firestore
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

  const suggestPrompt = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex h-full bg-editorial-bg">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 border-b border-editorial-border flex justify-between items-center bg-[#EFEDE6]">
          <div className="flex items-center gap-6">
             <div className="flex bg-white rounded-full p-1 border border-editorial-border">
                {['Musa', 'Editor', 'Revisor'].map((expert) => (
                   <button
                     key={expert}
                     onClick={() => setActiveExpert(expert as any)}
                     className={cn(
                       "px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                       activeExpert === expert ? "bg-editorial-accent text-white shadow-md" : "text-editorial-muted hover:bg-gray-50"
                     )}
                   >
                      {expert}
                   </button>
                ))}
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-tighter font-black text-editorial-accent">
                   {activeExpert === 'Musa' && "Inspiração e Criatividade"}
                   {activeExpert === 'Editor' && "Estilo e Estrutura"}
                   {activeExpert === 'Revisor' && "Consistência e Fatos"}
                </span>
                <span className="text-[8px] text-editorial-muted uppercase font-bold">Assistente Ativo</span>
             </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-12 space-y-6 scrollbar-hide">
          {messages.length === 0 && (
            <div className="text-center py-20 max-w-lg mx-auto">
               <div className="w-24 h-24 bg-white rounded-[32px] border border-editorial-border shadow-sm flex items-center justify-center mx-auto mb-10">
                  <Bot className="w-10 h-10 text-editorial-accent" />
               </div>
               <h3 className="text-3xl font-serif font-bold text-editorial-accent mb-3 italic">Consultar a Musa</h3>
               <p className="text-editorial-muted mb-12 leading-relaxed text-sm">Desbloqueie sua criatividade com assistência contextual baseada no seu tomo atual.</p>
               
               <div className="grid grid-cols-1 gap-4">
                  <button onClick={() => suggestPrompt("Dê-me 3 ideias de reviravoltas para a minha história.")} className="text-left p-6 bg-white rounded-3xl border border-editorial-border hover:border-editorial-accent transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest group-hover:text-editorial-accent transition-colors">Ideias de reviravoltas</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-editorial-border group-hover:text-editorial-accent" />
                  </button>
                  <button onClick={() => suggestPrompt("Ajude-me a descrever melhor o herói.")} className="text-left p-6 bg-white rounded-3xl border border-editorial-border hover:border-editorial-accent transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      <User className="w-5 h-5 text-blue-500" />
                      <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest group-hover:text-editorial-accent transition-colors">Desenvolvimento de personagem</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-editorial-border group-hover:text-editorial-accent" />
                  </button>
                  <button onClick={() => suggestPrompt("Como posso expandir a lore desse mundo?")} className="text-left p-6 bg-white rounded-3xl border border-editorial-border hover:border-editorial-accent transition-all flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      <Wand2 className="w-5 h-5 text-purple-500" />
                      <span className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest group-hover:text-editorial-accent transition-colors">Expansão de Lore</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-editorial-border group-hover:text-editorial-accent" />
                  </button>
               </div>
            </div>
          )}

          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex gap-4 max-w-2xl animate-in fade-in slide-in-from-bottom-2",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                m.role === 'user' ? "bg-editorial-accent text-white border-editorial-accent" : "bg-white text-editorial-accent border-editorial-border"
              )}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "p-6 rounded-[28px] text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                m.role === 'user' ? "bg-editorial-accent text-white rounded-tr-none" : "bg-white text-editorial-accent rounded-tl-none border border-editorial-border"
              )}>
                {m.text}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex gap-4 max-w-2xl">
              <div className="w-10 h-10 rounded-2xl bg-white border border-editorial-border flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-editorial-accent animate-pulse" />
              </div>
              <div className="p-6 bg-white rounded-[28px] rounded-tl-none border border-editorial-border flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-editorial-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-editorial-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-editorial-accent rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-[#EFEDE6] border-t border-editorial-border">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative group">
            <input
              type="text"
              placeholder="Invoque sua musa..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-white border border-editorial-border rounded-full py-5 pl-8 pr-20 focus:outline-none focus:border-editorial-accent shadow-inner transition-all font-sans text-sm"
            />
            <button
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 bg-editorial-accent text-white p-3 rounded-full hover:scale-105 transition-transform disabled:opacity-50 shadow-xl shadow-black/10"
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
          <div className="flex mt-6 gap-3 justify-center">
            {['Reviravoltas', 'Ambiente', 'Personagem'].map(tip => (
              <button 
                key={tip}
                onClick={() => setInput(`Dê-me ideias de ${tip} para o capítulo atual.`)}
                className="px-4 py-1.5 bg-white text-[9px] text-editorial-muted font-bold rounded-full uppercase tracking-widest hover:bg-editorial-accent hover:text-white transition-all border border-editorial-border/40 shadow-sm"
              >
                {tip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
