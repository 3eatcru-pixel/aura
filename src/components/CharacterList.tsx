import React, { useState, useEffect } from 'react';
import { Project, Character, Chapter } from '../types';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserPlus, Sparkles, Trash2, Edit3, X, Check, Camera, Image as ImageIcon, Loader2, Brain, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAutoCharacterLore, detectCharacters, deepCharacterDesign } from '../services/aiService';
import { cn } from '../lib/utils';

interface CharacterListProps {
  project: Project;
  chapters?: Chapter[];
  key?: string;
}

export function CharacterList({ project, chapters = [] }: CharacterListProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    role: '', 
    description: '', 
    traits: '', 
    imageUrl: '',
    goals: '',
    fears: '',
    vocalTone: '',
    history: '' 
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [detectedCharacters, setDetectedCharacters] = useState<Partial<Character>[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleDeepDesign = async () => {
    if (!formData.name) return alert("Digite o nome do personagem primeiro.");
    setIsGenerating(true);
    try {
      const fullManuscript = chapters.map(c => `[${c.title}]\n${c.content}`).join('\n\n');
      const storyContext = fullManuscript.slice(-6000) || "";
      const result = await deepCharacterDesign(formData.name, storyContext);
      if (result) {
        setFormData(prev => ({
          ...prev,
          description: result.description || prev.description,
          traits: result.traits || prev.traits,
          goals: result.goals || prev.goals,
          fears: result.fears || prev.fears,
          vocalTone: result.vocalTone || prev.vocalTone,
          history: result.history || prev.history
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', project.id, 'characters'), (snap) => {
      setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
    });
    return () => unsub();
  }, [project.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingId) {
        const oldChar = characters.find(c => c.id === editingId);
        const nameChanged = oldChar && oldChar.name !== formData.name;

        await updateDoc(doc(db, 'projects', project.id, 'characters', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });

        if (nameChanged && oldChar) {
           const confirmRefactor = confirm(`Deseja atualizar todas as ocorrências de "${oldChar.name}" para "${formData.name}" no manuscrito?`);
           if (confirmRefactor) {
             await refactorNameInChapters(oldChar.name, formData.name);
           }
        }
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'projects', project.id, 'characters'), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        setIsAdding(false);
      }
      setFormData({ name: '', role: '', description: '', traits: '', imageUrl: '', goals: '', fears: '', vocalTone: '', history: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const refactorNameInChapters = async (oldName: string, newName: string) => {
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      chapters.forEach(chapter => {
        // Simple case-sensitive replacement. For better results, regex could be used
        // but replaceAll is usually enough for character names.
        if (chapter.content.includes(oldName)) {
          const newContent = chapter.content.split(oldName).join(newName);
          const chapterRef = doc(db, 'projects', project.id, 'chapters', chapter.id);
          batch.update(chapterRef, {
            content: newContent,
            updatedAt: serverTimestamp()
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(`Sincronização Literária Concluída! ${count} capítulo(s) foram atualizados para refletir o novo nome.`);
      }
    } catch (err) {
      console.error("Erro ao refatorar nome:", err);
      alert("Falha na sincronização dos capítulos.");
    }
  };

  const startEdit = (char: Character) => {
    setFormData({
      name: char.name,
      role: char.role || '',
      description: char.description || '',
      traits: char.traits || '',
      imageUrl: char.imageUrl || '',
      goals: char.goals || '',
      fears: char.fears || '',
      vocalTone: char.vocalTone || '',
      history: char.history || ''
    });
    setEditingId(char.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este personagem?")) {
      await deleteDoc(doc(db, 'projects', project.id, 'characters', id));
    }
  };

  const handleSmartLore = async () => {
    if (!formData.name) return alert("Digite o nome do personagem primeiro.");
    setIsGenerating(true);
    try {
      const fullManuscript = chapters.map(c => `[${c.title}]\n${c.content}`).join('\n\n');
      const storyContext = fullManuscript.slice(-6000) || "";
      const result = await generateAutoCharacterLore(formData.name, storyContext);
      setFormData(prev => ({
        ...prev,
        description: result.description,
        traits: result.traits
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDetectCharacters = async () => {
    setIsAiLoading(true);
    try {
      const fullManuscript = chapters.map(c => `[${c.title}]\n${c.content}`).join('\n\n');
      const context = fullManuscript.slice(-10000); // Analysis context
      const existingNamesList = characters.map(c => c.name);
      const detectedNames = await detectCharacters(context, existingNamesList);
      
      const existingNamesSet = new Set(characters.map(c => c.name.toLowerCase()));
      const filtered = detectedNames
        .filter(name => !existingNamesSet.has(name.toLowerCase()))
        .map(name => ({ name, role: 'Novo Personagem', description: '', traits: '', isAutoDetected: true } as Partial<Character>));
        
      setDetectedCharacters(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveDetected = async (char: Partial<Character>) => {
    try {
      await addDoc(collection(db, 'projects', project.id, 'characters'), {
        ...char,
        updatedAt: serverTimestamp(),
      });
      setDetectedCharacters(prev => prev.filter(c => c.name !== char.name));
    } catch (err) {
      console.error(err);
    }
  };

  const saveAllDetected = async () => {
    if (detectedCharacters.length === 0) return;
    setIsAiLoading(true);
    try {
      const batch = writeBatch(db);
      detectedCharacters.forEach(char => {
        const docRef = doc(collection(db, 'projects', project.id, 'characters'));
        batch.set(docRef, {
          ...char,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setDetectedCharacters([]);
      setIsAssistantOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredCharacters = characters.filter(char => 
    char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (char.role && char.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (char.description && char.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (char.traits && char.traits.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-full bg-editorial-bg overflow-hidden">
      <div className="flex-1 p-12 overflow-y-auto space-y-12">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-4xl font-serif font-light text-editorial-accent italic mb-3">Galeria de Personagens</h2>
            <p className="text-editorial-muted font-sans text-sm">Visualize seus protagonistas e coadjuvantes como seres vivos.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
             <div className="relative flex-1 sm:min-w-[300px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-editorial-muted" />
                <input 
                  type="text" 
                  placeholder="Pesquisar personagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-editorial-border rounded-full py-3 pl-10 pr-4 text-[10px] uppercase font-bold tracking-widest outline-none focus:border-editorial-accent transition-all shadow-sm"
                />
             </div>
             <div className="flex items-center gap-4">
               <button
                 onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                 className={cn(
                   "flex items-center gap-2 px-6 py-4 rounded-full transition-all font-bold text-xs uppercase tracking-widest",
                   isAssistantOpen ? "bg-editorial-accent text-white shadow-lg" : "text-editorial-accent border border-editorial-accent hover:bg-editorial-accent hover:text-white"
                 )}
               >
                 <Sparkles className="w-5 h-5" />
                 Visão da Musa
               </button>
               <button
                 onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', role: '', description: '', traits: '', imageUrl: '' }); }}
                 className="flex items-center gap-2 bg-editorial-accent text-white px-10 py-4 rounded-full hover:opacity-90 transition-all shadow-xl shadow-black/10 font-bold text-xs uppercase tracking-widest whitespace-nowrap"
               >
                 <UserPlus className="w-5 h-5" />
                 Registrar
               </button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          <AnimatePresence mode="popLayout">
            {(isAdding || editingId) && (
              <motion.div
                key="form-character"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-10 rounded-[48px] border border-editorial-accent col-span-1 md:col-span-2 shadow-2xl z-20 flex flex-col lg:flex-row gap-10 scrollbar-hide"
              >
              <div className="w-full lg:w-64 space-y-4">
                 <div className="aspect-[3/4] bg-editorial-sidebar rounded-[32px] border-2 border-dashed border-editorial-border flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer transition-all hover:border-editorial-accent">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-4 text-editorial-muted group-hover:text-editorial-accent transition-colors">
                        <ImageIcon className="w-12 h-12 opacity-30" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Sem Retrato</span>
                      </div>
                    )}
                 </div>
                 <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-editorial-muted uppercase tracking-widest px-2">Link da Imagem</label>
                    <input 
                      type="text" 
                      value={formData.imageUrl} 
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-editorial-sidebar border border-editorial-border rounded-xl py-3 px-4 outline-none focus:border-editorial-accent transition-all text-[10px]"
                    />
                    <p className="text-[8px] text-editorial-muted italic px-2">Dica: Use URLs de imagens ou gere no chat.</p>
                 </div>
              </div>

              <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-serif text-editorial-accent italic">{editingId ? 'Refinar Perfil' : 'Gênese de Personagem'}</h3>
                  <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-editorial-muted" />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Nome Completo</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-sm font-serif"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Papel na Trama</label>
                      <input
                        type="text"
                        placeholder="Ex: Protagonista, Mentor..."
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-sm font-serif"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest">Aparência Visual & Essência</label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={handleSmartLore}
                          disabled={isGenerating}
                          className="text-[9px] flex items-center gap-2 font-bold text-editorial-accent hover:italic uppercase tracking-[0.1em] disabled:opacity-50"
                          title="Rascunho rápido baseado no texto"
                        >
                          <Sparkles className="w-3 h-3" /> Lore Rápida
                        </button>
                        <button
                          type="button"
                          onClick={handleDeepDesign}
                          disabled={isGenerating}
                          className="text-[9px] flex items-center gap-2 font-bold text-aura-gold hover:italic uppercase tracking-[0.1em] disabled:opacity-50"
                          title="Design profundo e traços psicológicos"
                        >
                          <Brain className="w-3 h-3" /> Arquiteto de Alma
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-editorial-sidebar border border-editorial-border rounded-2xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-sm leading-relaxed resize-none font-serif"
                      placeholder="Descrição física e presença..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Principais Objetivos</label>
                      <input
                        type="text"
                        value={formData.goals}
                        onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                        className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-xs font-serif italic"
                        placeholder="O que o personagem busca?"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Medos & Traumas</label>
                      <input
                        type="text"
                        value={formData.fears}
                        onChange={(e) => setFormData({ ...formData, fears: e.target.value })}
                        className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-xs font-serif italic"
                        placeholder="O que o personagem teme?"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Tom de Voz & Estilo de Fala</label>
                      <input
                        type="text"
                        value={formData.vocalTone}
                        onChange={(e) => setFormData({ ...formData, vocalTone: e.target.value })}
                        className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-xs font-serif"
                        placeholder="Ex: Sarcástico, formal, sussurrado, agressivo..."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Traços de Alma</label>
                    <input
                      type="text"
                      value={formData.traits}
                      onChange={(e) => setFormData({ ...formData, traits: e.target.value })}
                      className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-sm font-serif"
                      placeholder="Corajoso, Enigmático, Obsessivo..."
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest px-2">Biografia/Background</label>
                    <textarea
                      rows={3}
                      value={formData.history}
                      onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                      className="bg-editorial-sidebar border border-editorial-border rounded-2xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-sm leading-relaxed resize-none font-serif"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full bg-editorial-accent text-white py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-black/10 transition-transform active:scale-[0.98]"
                    >
                      <Check className="w-5 h-5" /> {editingId ? 'Selar Registro' : 'Lembrar Personagem'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredCharacters.map((char) => (
          <motion.div
            key={char.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group bg-white rounded-[48px] border border-editorial-border relative hover:border-editorial-accent transition-all duration-500 overflow-hidden shadow-sm hover:shadow-2xl flex flex-col"
          >
            <div className="aspect-[3/4] bg-editorial-sidebar relative overflow-hidden">
               {char.imageUrl ? (
                 <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" referrerPolicy="no-referrer" />
               ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-6xl font-serif italic text-editorial-accent/20 bg-gradient-to-br from-editorial-sidebar to-white">
                    {char.name.charAt(0)}
                 </div>
               )}
               
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
               
               <div className="absolute bottom-0 left-0 p-8 w-full">
                  <div className="flex justify-between items-end">
                    <div>
                       {char.role && <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">{char.role}</p>}
                       <h3 className="font-serif font-light text-3xl text-white italic leading-tight">{char.name}</h3>
                    </div>
                  </div>
               </div>

               <div className="absolute top-6 right-6 flex gap-2 opacity-100 lg:translate-y-[-20px] lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 transition-all duration-300 z-10">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(char); }} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-editorial-accent transition-all border border-white/20 shadow-lg" title="Editar"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-all border border-white/20 shadow-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
               </div>
            </div>
            
            <div 
              className="p-8 space-y-6 bg-white flex-1 cursor-pointer hover:bg-editorial-sidebar/30 transition-colors"
              onClick={() => startEdit(char)}
            >
              <p className="text-editorial-muted text-sm line-clamp-2 leading-relaxed font-serif italic opacity-80">
                "{char.description || "O passado deste indivíduo ainda é um mistério oculto nas sombras."}"
              </p>

              {(char.goals || char.fears) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-editorial-border/30">
                  {char.goals && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase text-editorial-muted tracking-widest">Objetivo</p>
                      <p className="text-[10px] text-editorial-accent font-serif italic line-clamp-1">{char.goals}</p>
                    </div>
                  )}
                  {char.fears && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase text-editorial-muted tracking-widest">Medo</p>
                      <p className="text-[10px] text-red-500 font-serif italic line-clamp-1">{char.fears}</p>
                    </div>
                  )}
                </div>
              )}

              {char.vocalTone && (
                <div className="pt-2">
                  <p className="text-[8px] font-black uppercase text-editorial-muted tracking-widest">Voz</p>
                  <p className="text-[10px] text-editorial-muted font-serif">{char.vocalTone}</p>
                </div>
              )}

              {char.traits && (
                 <div className="flex flex-wrap gap-2 pt-4 border-t border-editorial-border/30">
                    {char.traits.split(',').map((trait, i) => (
                      <span key={i} className="text-[10px] text-editorial-accent font-bold uppercase tracking-tighter border border-editorial-border px-3 py-1 rounded-full">
                        {trait.trim()}
                      </span>
                    ))}
                 </div>
              )}
            </div>

            {char.isAutoDetected && (
              <div className="absolute top-6 left-6">
                <span className="flex items-center gap-1.5 text-[8px] bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full uppercase font-black tracking-widest border border-white/20">
                  <Sparkles className="w-3 h-3" /> Vision
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>

    <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="w-96 bg-editorial-sidebar border-l border-editorial-border flex flex-col shadow-2xl z-30"
          >
            <div className="p-8 border-b border-editorial-border flex items-center justify-between bg-white">
               <div>
                  <h3 className="font-serif font-bold text-xl italic text-editorial-accent">Visão da Musa</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-editorial-muted">Detecção de Personagens</p>
               </div>
               <button onClick={() => setIsAssistantOpen(false)} className="text-editorial-muted hover:text-editorial-accent transition-colors">
                 <X className="w-5 h-5" />
               </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
               <div className="bg-white rounded-2xl p-6 border border-editorial-border shadow-sm">
                  <p className="text-editorial-muted text-[11px] leading-relaxed mb-6 italic">
                    A Musa irá analisar todo o seu manuscrito em busca de rostos e nomes que surgiram entre as linhas.
                  </p>
                  <button 
                    onClick={handleDetectCharacters}
                    disabled={isAiLoading}
                    className="w-full flex items-center justify-center gap-3 bg-editorial-accent text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {isAiLoading ? "Interpretando Manuscrito..." : "Detectar Personagens"}
                  </button>
               </div>

               {detectedCharacters.length > 0 && (
                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="font-serif font-bold italic text-editorial-accent">Identificados</h4>
                       <button 
                         onClick={saveAllDetected}
                         className="text-[9px] font-black uppercase text-editorial-accent hover:underline"
                       >
                         Importar Todos
                       </button>
                    </div>
                    {detectedCharacters.map((char, idx) => (
                      <motion.div 
                        key={`detected-${char.name}-${idx}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl p-5 border border-editorial-border shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="flex-1">
                           <h5 className="font-serif font-bold text-editorial-accent text-sm italic">{char.name}</h5>
                           <p className="text-[10px] text-editorial-muted line-clamp-1">{char.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => saveDetected(char)}
                             className="text-editorial-accent hover:bg-editorial-accent hover:text-white p-2 rounded-full border border-editorial-accent transition-all"
                           >
                             <Check className="w-3 h-3" />
                           </button>
                           <button 
                             onClick={() => setDetectedCharacters(prev => prev.filter(c => c.name !== char.name))}
                             className="text-editorial-muted hover:text-red-500 p-2 rounded-full border border-editorial-border transition-all"
                           >
                              <X className="w-3 h-3" />
                           </button>
                        </div>
                      </motion.div>
                    ))}
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
