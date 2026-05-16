import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, User, Bot, Loader2, Trash2, Terminal, Network, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChat({ project, projectFormat }: { project: Project; isGuest?: boolean; projectFormat?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: {
            title: project.title,
            description: project.description,
            format: projectFormat || project.format,
            genre: project.genre
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, tive um problema ao processar seu pensamento. Tente novamente em alguns instantes.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Limpar histórico do Oráculo?')) {
      setMessages([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative">
      {/* Background visual detail */}
      <div className="absolute inset-0 cinematic-grid opacity-[0.03] pointer-events-none" />

      <header className="h-24 px-10 border-b border-white/5 flex items-center justify-between bg-[#080808]/80 backdrop-blur-3xl z-20">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center shadow-neon group cursor-pointer transition-transform hover:scale-110">
            <Sparkles className="w-6 h-6 text-editorial-accent group-hover:rotate-12 transition-transform" />
          </div>
          <div>
            <h2 className="text-sm font-brand uppercase tracking-[0.3em] text-white font-black">ORÁCULO_CORE</h2>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                 <span className="text-[8px] font-mono tracking-[0.2em] text-white/20">Uplink Active</span>
               </div>
               <span className="text-[8px] font-mono tracking-[0.2em] text-editorial-accent/30">LLM.4.STABLE</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-3 rounded-2xl hover:bg-white/[0.03] text-white/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/10 group"
          title="Resetar Terminal"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-10 space-y-10 scroll-smooth relative z-10"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <div className="w-20 h-20 rounded-[2.5rem] border border-white/5 bg-white/[0.01] flex items-center justify-center group">
              <Network className="w-10 h-10 text-white/5 group-hover:text-editorial-accent/30 transition-colors" />
            </div>
            <div className="max-w-md space-y-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/10">Iniciando Diálogo Contextual</p>
              <p className="text-lg font-serif italic text-white/30 leading-relaxed text-balance">
                "O Oráculo aguarda o impulso de seus pensamentos sobre '{project.title}'. Como posso moldar sua realidade hoje?"
              </p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={idx}
              className={cn(
                "flex gap-6 max-w-5xl",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500",
                msg.role === 'user' 
                  ? "bg-white/[0.02] border-white/10 text-white/20" 
                  : "bg-editorial-accent/5 border-editorial-accent/20 text-editorial-accent shadow-neon"
              )}>
                {msg.role === 'user' ? <Terminal className="w-4 h-4" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div className={cn(
                "p-8 rounded-[2rem] text-sm leading-[1.7] relative",
                msg.role === 'user' 
                  ? "bg-white/[0.03] border border-white/5 text-white/70 rounded-tr-none font-sans" 
                  : "bg-editorial-accent/[0.01] border border-white/5 text-white/90 rounded-tl-none font-serif italic text-lg"
              )}>
                {/* Meta details for AI messages */}
                {msg.role === 'assistant' && (
                  <div className="absolute -top-6 left-0 text-[8px] font-mono text-editorial-accent/40 uppercase tracking-widest">
                    Response_Node_0{idx % 9}
                  </div>
                )}
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={cn(line ? "mb-6 last:mb-0" : "h-4")}>{line}</p>
                ))}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-6 mr-auto"
            >
              <div className="w-10 h-10 rounded-2xl glass-panel flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-editorial-accent animate-spin" />
              </div>
              <div className="p-8 rounded-[2rem] bg-white/[0.01] border border-white/5 flex gap-2 items-center">
                <p className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/20 mr-4">Processando Pensamentos</p>
                <span className="w-1.5 h-1.5 rounded-full bg-editorial-accent/40 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-editorial-accent/40 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-editorial-accent/40 animate-pulse [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-10 bg-[#080808]/80 backdrop-blur-3xl border-t border-white/5 relative z-20">
        <form 
          onSubmit={sendMessage}
          className="max-w-5xl mx-auto relative group"
        >
          <div className="absolute -top-12 left-0 right-0 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-3 h-3 text-green-500/50" />
              <span className="text-[8px] font-mono uppercase tracking-widest text-white/20">Secure Channel</span>
            </div>
            <span className="text-[8px] font-mono uppercase tracking-widest text-white/10 italic">Shift + Enter para quebra de linha</span>
          </div>
          
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Invoque o Oráculo..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-[2rem] px-8 py-6 pr-20 text-base text-white placeholder:text-white/10 focus:outline-none focus:border-editorial-accent/30 focus:bg-white/[0.05] transition-all focus:ring-1 focus:ring-editorial-accent/5 backdrop-blur-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-editorial-accent text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-5 disabled:scale-100 disabled:rotate-0 transition-all shadow-neon group"
          >
            <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </form>
        <div className="flex items-center justify-center gap-6 mt-8">
           <div className="w-[100px] h-[1px] bg-gradient-to-r from-transparent to-white/5" />
           <p className="text-[8px] font-mono uppercase tracking-[0.5em] text-white/10">
             Cognição Assistida v4.0.5
           </p>
           <div className="w-[100px] h-[1px] bg-gradient-to-l from-transparent to-white/5" />
        </div>
      </div>
    </div>
  );
}
