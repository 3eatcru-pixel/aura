import React, { useState, useEffect } from 'react';
import { Project, Lore, LoreVersion, Chapter } from '../types';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, Search, Filter, Plus, Trash2, Edit2, Globe, ScrollText, Notebook, Sparkles, Brain, Check, X, Loader2, Zap, Users, Clock, History, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { processLoreDraft, architectLore } from '../services/aiService';

interface LoreManagerProps {
  project: Project;
  chapters?: Chapter[];
  key?: string;
  initialAssistantOpen?: boolean;
}

export function LoreManager({ project, chapters = [], initialAssistantOpen = false }: LoreManagerProps) {
  const [lores, setLores] = useState<Lore[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(initialAssistantOpen);
  const [architectType, setArchitectType] = useState<'location' | 'event' | 'system' | 'atmosphere' | 'faction' | 'timeline' | 'draft'>('draft');
  const [draftText, setDraftText] = useState('');
  const [assistantResults, setAssistantResults] = useState<{ title: string, content: string, category: Lore['category'] }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: 'lore' as Lore['category'], properties: '' });
  const [versions, setVersions] = useState<LoreVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', project.id, 'lore'), (snap) => {
      setLores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lore)));
    });
    return () => unsub();
  }, [project.id]);

  useEffect(() => {
    if (!editingId) {
      setVersions([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'projects', project.id, 'lore', editingId, 'versions'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => {
        setVersions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoreVersion)));
      }
    );
    return () => unsub();
  }, [project.id, editingId]);

  const handleSaveVersion = async () => {
    if (!editingId || !formData.content) return;
    try {
      await addDoc(collection(db, 'projects', project.id, 'lore', editingId, 'versions'), {
        content: formData.content,
        createdAt: serverTimestamp(),
        note: `Backup em ${new Date().toLocaleDateString()}`
      });
      alert("Versão salva com sucesso!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreVersion = (version: LoreVersion) => {
    if (confirm("Deseja restaurar esta versão? O conteúdo atual será substituído.")) {
      setFormData(prev => ({ ...prev, content: version.content }));
      setShowVersions(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'projects', project.id, 'lore', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'projects', project.id, 'lore'), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        setIsAdding(false);
      }
      setFormData({ title: '', content: '', category: 'lore', properties: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssist = async () => {
    if (!draftText.trim()) return;
    setIsAiLoading(true);
    try {
      if (architectType === 'draft') {
        const results = await processLoreDraft(draftText);
        setAssistantResults(results as any);
      } else {
        const result = await architectLore(architectType as any, draftText, project.title);
        if (result) {
          setAssistantResults([result as any]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExtractFromManuscript = async () => {
    if (chapters.length === 0) return;
    setIsAiLoading(true);
    try {
      // Concatenate all chapters for context
      const fullManuscript = chapters.map(c => `[${c.title}]\n${c.content}`).join('\n\n');
      // Use the last 6000 chars to avoid token limits but get enough history
      const contextToExtract = fullManuscript.slice(-8000);
      
      const results = await processLoreDraft(`POR FAVOR, EXTRAIA LORE DO MANUSCRITO ABAIXO:\n\n${contextToExtract}`);
      setAssistantResults(results as any);
      setArchitectType('draft');
      setDraftText("Extraído do Manuscrito");
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveFromAssistant = async (item: { title: string, content: string, category: Lore['category'] }) => {
    try {
      const existing = lores.find(l => l.title.toLowerCase().trim() === item.title.toLowerCase().trim());
      
      if (existing) {
        await updateDoc(doc(db, 'projects', project.id, 'lore', existing.id), {
          content: existing.content + "\n\n" + item.content,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'projects', project.id, 'lore'), {
          ...item,
          updatedAt: serverTimestamp(),
        });
      }
      setAssistantResults(prev => prev.filter(p => p.title !== item.title));
    } catch (err) {
      console.error(err);
    }
  };

  const saveAllFromAssistant = async () => {
    if (assistantResults.length === 0) return;
    setIsAiLoading(true);
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      assistantResults.forEach(item => {
        const existing = lores.find(l => l.title.toLowerCase().trim() === item.title.toLowerCase().trim());
        
        if (existing) {
          const docRef = doc(db, 'projects', project.id, 'lore', existing.id);
          batch.update(docRef, {
            content: existing.content + "\n\n" + item.content,
            updatedAt: serverTimestamp(),
          });
        } else {
          const docRef = doc(collection(db, 'projects', project.id, 'lore'));
          batch.set(docRef, {
            ...item,
            updatedAt: serverTimestamp(),
          });
        }
      });
      
      await batch.commit();
      setAssistantResults([]);
      setIsAssistantOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const categories = [
    { id: 'all', label: 'Compêndio', icon: BookOpen },
    { id: 'world', label: 'Atlas/Mundo', icon: Globe },
    { id: 'lore', label: 'Mitos/História', icon: ScrollText },
    { id: 'faction', label: 'Facções & Povos', icon: Users },
    { id: 'timeline', label: 'Timeline & Eras', icon: Clock },
    { id: 'rpg', label: 'Gerador de Regras', icon: Brain },
    { id: 'item', label: 'Itens & Objetos', icon: Zap },
    { id: 'magic', label: 'Sistemas Árcanos', icon: Sparkles },
    { id: 'note', label: 'Notas Rápidas', icon: Notebook },
  ];

  const filteredLores = lores.filter(l => {
    const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         l.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-full bg-editorial-bg">
      <div className="w-80 border-r border-editorial-border flex flex-col shrink-0 bg-editorial-sidebar overflow-hidden">
        <div className="p-8 border-b border-editorial-border bg-editorial-sidebar">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-serif font-bold text-editorial-accent italic">Mundo & Notas</h3>
            <button 
              onClick={() => { setIsAssistantOpen(!isAssistantOpen); setEditingId(null); setIsAdding(false); }}
              className={cn(
                "p-2 rounded-lg transition-all",
                isAssistantOpen ? "bg-editorial-accent text-white shadow-lg" : "text-editorial-muted hover:bg-white/50"
              )}
            >
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative mb-6">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-editorial-muted" />
            <input 
              type="text" 
              placeholder="Buscar lore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/50 border border-editorial-border rounded-xl py-2 pl-10 pr-4 text-[10px] uppercase font-bold tracking-widest outline-none focus:border-editorial-accent transition-all"
            />
          </div>

          <div className="space-y-1.5">
            {categories.map((cat) => (
              <button
                key={`cat-sidebar-${cat.id}`}
                onClick={() => { setSelectedCategory(cat.id); setIsAssistantOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest",
                  selectedCategory === cat.id && !isAssistantOpen ? "bg-editorial-accent text-white shadow-lg shadow-black/10" : "text-editorial-muted hover:bg-white/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </div>
                {cat.id !== 'all' && (
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-bold",
                    selectedCategory === cat.id ? "bg-white/20 text-white" : "bg-editorial-paper text-editorial-muted border border-editorial-border"
                  )}>
                    {lores.filter(l => l.category === cat.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#EFEDE6]/50">
          {filteredLores.map((l) => (
            <button
              key={l.id}
              onClick={() => { setEditingId(l.id); setFormData(l); setIsAdding(false); setIsAssistantOpen(false); }}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all group shadow-sm",
                editingId === l.id && !isAssistantOpen ? "border-editorial-accent bg-white" : "border-editorial-border bg-white/60 hover:bg-white"
              )}
            >
              <p className="font-serif font-bold text-sm text-editorial-accent line-clamp-1 mb-1 italic">{l.title}</p>
              <p className="text-[9px] text-editorial-muted font-bold uppercase tracking-widest">{l.category}</p>
            </button>
          ))}
          <button
             onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ title: '', content: '', category: 'lore', properties: '' }); setIsAssistantOpen(false); }}
             className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-editorial-border text-editorial-muted hover:text-editorial-accent hover:border-editorial-accent transition-all text-[10px] font-bold uppercase tracking-widest bg-white/30"
          >
            <Plus className="w-4 h-4" /> Nova Entrada
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {isAssistantOpen ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col p-16 overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-editorial-accent/10 rounded-2xl flex items-center justify-center">
                   <Brain className="w-8 h-8 text-editorial-accent" />
                </div>
                <div className="flex-1">
                   <h2 className="text-4xl font-serif font-bold text-editorial-accent italic">Scribe Architect</h2>
                   <p className="text-editorial-muted font-bold tracking-widest uppercase text-[10px]">Criação e Organização de Universo</p>
                </div>
                {chapters.length > 0 && (
                   <button 
                     onClick={handleExtractFromManuscript}
                     disabled={isAiLoading}
                     className="flex items-center gap-2 bg-editorial-sidebar text-editorial-accent border border-editorial-border px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white transition-all shadow-sm"
                   >
                     <Sparkles className="w-3.5 h-3.5" /> Extrair do Manuscrito
                   </button>
                )}
              </div>

              <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-none">
                {[
                  { id: 'draft', label: 'Rascunho Rápido', icon: Sparkles },
                  { id: 'location', label: 'Mundo & Atlas', icon: Globe },
                  { id: 'faction', label: 'Facções & Povos', icon: Users },
                  { id: 'timeline', label: 'Timeline & História', icon: Clock },
                  { id: 'system', label: 'RPG & Regras', icon: Brain },
                  { id: 'atmosphere', label: 'Clima & Cenas', icon: Notebook },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setArchitectType(type.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all shrink-0",
                      architectType === type.id 
                        ? "bg-editorial-accent text-white border-editorial-accent shadow-lg" 
                        : "bg-white text-editorial-muted border-editorial-border hover:border-editorial-accent hover:text-editorial-accent"
                    )}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>

              <div className="bg-editorial-sidebar border border-editorial-border rounded-3xl p-8 mb-12 shadow-sm">
                 <p className="text-editorial-muted text-sm mb-6 leading-relaxed">
                   {architectType === 'draft' 
                     ? "Cole idéias soltas e o Scribe irá organizar no compêndio." 
                     : `Descreva o que imagina para este ${architectType} e o Scribe irá arquitetar os detalhes para você.`}
                 </p>
                 <textarea
                   value={draftText}
                   onChange={(e) => setDraftText(e.target.value)}
                   placeholder="Ex: O Reino de Eldoria fica nas montanhas. O povo adora o Sol. Existe um mineral chamado Solarium que brilha no escuro..."
                   className="w-full h-48 bg-white/50 border border-editorial-border rounded-2xl p-6 font-serif text-lg outline-none focus:border-editorial-accent transition-all resize-none mb-6"
                 />
                 <button 
                   onClick={handleAssist}
                   disabled={isAiLoading || !draftText.trim()}
                   className="w-full bg-editorial-accent text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                 >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAiLoading ? "Analisando Tecido da Realidade..." : "Processar Rascunho"}
                 </button>
              </div>

              {assistantResults.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-serif font-bold text-2xl text-editorial-accent italic">Sugestões Identificadas</h3>
                    <button 
                      onClick={saveAllFromAssistant}
                      className="text-[10px] font-black uppercase tracking-widest text-editorial-accent hover:underline"
                    >
                      Importar Todos
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {assistantResults.map((res, idx) => (
                      <motion.div 
                        key={`assistant-${res.title}-${idx}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-editorial-border rounded-3xl p-8 shadow-sm flex flex-col"
                      >
                         <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-editorial-sidebar rounded-full border border-editorial-border text-editorial-accent">
                               {res.category}
                            </span>
                            <div className="flex items-center gap-1">
                               {lores.some(l => l.title.toLowerCase().trim() === res.title.toLowerCase().trim()) && (
                                 <span className="text-[8px] font-bold text-aura-gold uppercase border border-aura-gold px-2 py-0.5 rounded-full mr-1">
                                   Existente
                                 </span>
                               )}
                               <button 
                                 onClick={() => saveFromAssistant(res)}
                                 className="text-editorial-accent hover:bg-editorial-accent hover:text-white p-2 rounded-full transition-all border border-editorial-accent"
                                 title={lores.some(l => l.title.toLowerCase().trim() === res.title.toLowerCase().trim()) ? "Atualizar Lore Existente" : "Adicionar ao Compêndio"}
                               >
                                  {lores.some(l => l.title.toLowerCase().trim() === res.title.toLowerCase().trim()) ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                               </button>
                               <button 
                                 onClick={() => setAssistantResults(prev => prev.filter(p => p.title !== res.title))}
                                 className="text-editorial-muted hover:text-red-500 p-2 rounded-full transition-all border border-editorial-border"
                                 title="Descartar"
                               >
                                  <X className="w-4 h-4" />
                               </button>
                            </div>
                         </div>
                         <h4 className="font-serif font-bold text-xl italic text-editorial-accent mb-3">{res.title}</h4>
                         <p className="text-editorial-muted text-sm line-clamp-4 leading-relaxed mb-4">{res.content}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (isAdding || editingId) ? (
          <motion.form 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit} 
            className="flex-1 flex flex-col p-16"
          >
            <div className="flex items-center justify-between mb-12">
               <div className="flex items-center gap-3">
                  {categories.filter(c => c.id !== 'all').map(c => (
                    <button
                      key={`cat-architect-${c.id}`}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: c.id as any })}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all",
                        formData.category === c.id ? "bg-editorial-accent text-white border-editorial-accent" : "bg-white text-editorial-muted border-editorial-border hover:bg-editorial-sidebar"
                      )}
                    >
                      <c.icon className="w-3.5 h-3.5" /> {c.label}
                    </button>
                  ))}
               </div>
               <div className="flex gap-4">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => setShowVersions(!showVersions)}
                      className={cn(
                        "p-3 rounded-full border transition-all",
                        showVersions ? "bg-editorial-accent text-white border-editorial-accent" : "text-editorial-muted border-editorial-border hover:bg-editorial-sidebar"
                      )}
                      title="Histórico de Versões"
                    >
                      <History className="w-5 h-5" />
                    </button>
                  )}
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleSaveVersion}
                      className="p-3 text-editorial-muted hover:bg-editorial-sidebar rounded-full border border-editorial-border transition-all"
                      title="Salvar Versão"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (editingId && confirm("Apagar este registro irremediavelmente?")) {
                        await deleteDoc(doc(db, 'projects', project.id, 'lore', editingId));
                        setEditingId(null);
                        setFormData({ title: '', content: '', category: 'lore', properties: '' });
                      }
                    }}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-full border border-transparent hover:border-red-100 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    className="bg-editorial-accent text-white px-10 py-3 rounded-full font-bold text-xs uppercase tracking-widest shadow-xl shadow-black/10"
                  >
                    Registrar no Compêndio
                  </button>
               </div>
            </div>

            <input
              required
              type="text"
              placeholder="Título da entrada..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="text-6xl font-serif font-light text-editorial-accent border-none outline-none focus:ring-0 p-0 mb-4 placeholder:opacity-10 italic"
            />

            {['rpg', 'item', 'magic'].includes(formData.category) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-8 p-4 bg-editorial-sidebar rounded-2xl border border-editorial-border border-dashed"
              >
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-aura-gold mb-2 block">
                  {formData.category === 'rpg' ? 'Regras do Sistema' : 'Propriedades (Opcional)'}
                </label>
                <input
                  type="text"
                  placeholder={formData.category === 'rpg' ? "Ex: CD 15 | Dano: 2d10 Fogo | Custo: 10 Mana" : "Ex: Peso: 2kg | Valor: 50gp"}
                  value={formData.properties || ''}
                  onChange={(e) => setFormData({ ...formData, properties: e.target.value })}
                  className="w-full bg-white border border-editorial-border rounded-xl py-3 px-4 outline-none focus:border-aura-gold transition-all font-mono text-xs text-editorial-accent"
                />
                <p className="mt-2 text-[8px] text-editorial-muted italic">Mantenha vazio se preferir apenas descrição narrativa no modo Novel.</p>
              </motion.div>
            )}
            
            {formData.category === 'timeline' ? (
              <div className="flex-1 overflow-y-auto space-y-8 py-8">
                <div className="border-l-2 border-editorial-accent/20 ml-4 space-y-12">
                   {formData.content.split('\n\n').map((event, idx) => (
                     <div key={idx} className="relative pl-12 group">
                        <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-editorial-accent border-4 border-white shadow-sm ring-4 ring-editorial-accent/10"></div>
                        <div className="bg-editorial-sidebar border border-editorial-border rounded-3xl p-8 hover:border-editorial-accent transition-all group-hover:shadow-xl group-hover:-translate-y-1">
                           <textarea
                             value={event}
                             onChange={(e) => {
                               const chunks = formData.content.split('\n\n');
                               chunks[idx] = e.target.value;
                               setFormData({ ...formData, content: chunks.join('\n\n') });
                             }}
                             className="w-full bg-transparent border-none outline-none focus:ring-0 font-serif text-lg leading-relaxed resize-none p-0"
                             placeholder="Descreva o evento histórico..."
                             rows={event.split('\n').length}
                           />
                           <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[8px] font-black uppercase tracking-widest text-editorial-muted">Momento #{idx + 1}</span>
                              <button 
                                onClick={() => {
                                  const chunks = formData.content.split('\n\n');
                                  chunks.splice(idx, 1);
                                  setFormData({ ...formData, content: chunks.join('\n\n') });
                                }}
                                className="text-red-500 hover:scale-110 transition-transform"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                     </div>
                   ))}
                   <button 
                     onClick={() => setFormData({ ...formData, content: formData.content + (formData.content ? '\n\n' : '') + '[NOVO EVENTO]' })}
                     className="ml-12 flex items-center gap-2 text-editorial-accent font-bold text-[10px] uppercase tracking-widest hover:italic transition-all p-4 rounded-xl hover:bg-editorial-sidebar"
                     type="button"
                   >
                     <Plus className="w-4 h-4" /> Adicionar Ponto de Inflexão
                   </button>
                </div>
              </div>
            ) : (
              <textarea
                required
                placeholder="Inicie o registro histórico, geográfico ou filosófico..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="flex-1 resize-none border-none outline-none focus:ring-0 p-0 font-serif text-xl leading-relaxed text-[#4A4640] selection:bg-editorial-highlight"
              />
            )}

            <AnimatePresence>
              {showVersions && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="fixed right-0 top-0 bottom-0 w-80 bg-editorial-sidebar border-l border-editorial-border shadow-2xl z-50 flex flex-col"
                >
                  <div className="p-8 border-b border-editorial-border flex items-center justify-between">
                    <h4 className="font-serif font-bold text-xl italic">Versões</h4>
                    <button onClick={() => setShowVersions(false)} className="text-editorial-muted hover:text-editorial-accent">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {versions.length === 0 ? (
                      <p className="text-center text-editorial-muted text-xs font-bold uppercase tracking-widest mt-10 opacity-50">Nenhuma versão salva</p>
                    ) : (
                      versions.map((v) => (
                        <div key={v.id} className="bg-white border border-editorial-border rounded-xl p-4 shadow-sm hover:border-editorial-accent transition-all cursor-pointer group" onClick={() => handleRestoreVersion(v)}>
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[8px] font-black uppercase tracking-widest text-aura-gold">Snapshot</span>
                             <span className="text-[8px] text-editorial-muted">{v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString() : 'Recent'}</span>
                          </div>
                          <p className="text-[10px] text-editorial-accent line-clamp-3 mb-2 leading-relaxed opacity-70">
                            {v.content}
                          </p>
                          <div className="flex items-center gap-1 text-[8px] font-bold text-editorial-muted group-hover:text-editorial-accent">
                            <History className="w-2.5 h-2.5" /> Restaurar
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-24">
             <div className="w-32 h-32 bg-editorial-sidebar rounded-full flex items-center justify-center mb-10 border border-editorial-border/50 shadow-inner">
                <ScrollText className="w-12 h-12 text-editorial-muted opacity-30" />
             </div>
             <h3 className="text-3xl font-serif font-bold text-editorial-accent italic mb-3">Biblioteca de Alexandria</h3>
             <p className="text-editorial-muted max-w-sm text-sm leading-relaxed">Selecione uma entrada lateral ou crie uma nova nota para expandir a fundação do seu universo literário.</p>
          </div>
        )}
      </div>
    </div>
  );
}
