import React, { useState, useEffect } from 'react';
import { Project, ArtAsset } from '../types';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Image as ImageIcon, Plus, Trash2, Layout, Maximize2, X, Layers, Filter, Grid2X2, List, Sparkles, ChevronLeft, ChevronRight, Wand2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getPanelSuggestions, refinePanelDescription, generateStoryboardFromText, getAiImageAsset } from '../services/aiService';
import { ImageEditor } from './ImageEditor';

interface VisualManagerProps {
  project: Project;
  characters?: any[];
  onSwitchToDirector?: () => void;
  mode?: 'gallery' | 'storyboard';
  key?: string;
}

export function VisualManager({ project, characters = [], onSwitchToDirector, mode = 'gallery' }: VisualManagerProps) {
  const [assets, setAssets] = useState<ArtAsset[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ArtAsset | null>(null);
  const [filter, setFilter] = useState<ArtAsset['type'] | 'all'>(mode === 'storyboard' ? 'panel' : 'all');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'storyboard'>(mode === 'storyboard' ? 'storyboard' : 'grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ title: string, description: string, pageNumber?: number }[]>([]);
  const [editingAsset, setEditingAsset] = useState<ArtAsset | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  
  const [formData, setFormData] = useState({ 
    title: '', 
    imageUrl: '', 
    description: '', 
    type: mode === 'storyboard' ? 'panel' : 'concept' as ArtAsset['type'],
    pageNumber: mode === 'storyboard' ? 1 : undefined as number | undefined
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'projects', project.id, 'art'), orderBy('createdAt', 'desc')), 
      (snap) => {
        setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtAsset)));
      }
    );
    return () => unsub();
  }, [project.id]);

  const filteredAssets = assets.filter(a => {
    const typeMatch = filter === 'all' || a.type === filter;
    const pageMatch = mode === 'storyboard' ? (a.pageNumber === currentPage) : true;
    return typeMatch && pageMatch;
  }).sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return (a.pageNumber || 0) - (b.pageNumber || 0);
    return a.title.localeCompare(b.title);
  });

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    try {
      const loreText = `Contexto: ${project.description}. Tipo: ${project.type}.`;
      const suggestions = await getPanelSuggestions(loreText, assets.slice(-5));
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const addSuggestionAsPanel = (suggestion: { title: string, description: string, pageNumber?: number }) => {
    setFormData({
      title: suggestion.title,
      description: suggestion.description,
      imageUrl: '',
      type: 'panel',
      pageNumber: suggestion.pageNumber || currentPage
    });
    setIsAdding(true);
    setAiSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleGenerateFromScript = async () => {
    // This requires the manuscript content. 
    // We can try to get it from the chapters in the DB or pass it via props.
    // Let's check for chapters in the DB for this project.
    setIsGeneratingStoryboard(true);
    try {
      // Small trick: directly fetch chapters
      const chaptersSnap = await getDocs(query(collection(db, 'projects', project.id, 'chapters'), orderBy('order', 'asc')));
      const manuscript = chaptersSnap.docs.map(d => d.data().content).join('\n\n');
      
      const loreText = `Projeto: ${project.title}. Descrição: ${project.description}. Tipo: ${project.type}.`;
      const suggestions = await generateStoryboardFromText(loreText, manuscript);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
      alert("Falha ao analisar o manuscrito. Certifique-se de que há capítulos escritos.");
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleApplyEdit = async (dataUrl: string) => {
    if (!editingAsset) return;
    try {
      await updateDoc(doc(db, 'projects', project.id, 'art', editingAsset.id), {
        imageUrl: dataUrl,
        updatedAt: serverTimestamp(),
      });
      setEditingAsset(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (asset: ArtAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(asset.id);
    setFormData({
      title: asset.title,
      imageUrl: asset.imageUrl,
      description: asset.description || '',
      type: asset.type,
      pageNumber: asset.pageNumber
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.imageUrl) return;

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'projects', project.id, 'art', isEditing), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'projects', project.id, 'art'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      
      setFormData({ 
        title: '', 
        imageUrl: '', 
        description: '', 
        type: mode === 'storyboard' ? 'panel' : 'concept',
        pageNumber: mode === 'storyboard' ? currentPage : undefined
      });
      setIsAdding(false);
      setIsEditing(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm("Remover este ativo visual permanentemente?")) {
      await deleteDoc(doc(db, 'projects', project.id, 'art', id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-editorial-bg overflow-hidden">
      {/* Header Unificado */}
      <div className="px-12 py-6 border-b border-editorial-border bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-editorial-accent/10 rounded-xl flex items-center justify-center">
                {mode === 'storyboard' ? <Layers className="w-5 h-5 text-editorial-accent" /> : <ImageIcon className="w-5 h-5 text-editorial-accent" />}
             </div>
             <div>
                <h2 className="text-2xl font-serif font-light text-editorial-accent italic leading-tight">
                  {mode === 'storyboard' ? 'Storyboard & Fluxo' : 'Atelier & Referências'}
                </h2>
                <p className="text-editorial-muted font-sans text-[8px] uppercase font-black tracking-widest opacity-50">
                  {mode === 'storyboard' ? 'Visualização sequencial da narrativa' : 'Repositório de inspiração visual'}
                </p>
             </div>
          </div>

          <div className="h-8 w-px bg-editorial-border mx-2" />

          {/* Paginação do Storyboard */}
          {mode === 'storyboard' && (
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                 className="p-1.5 hover:bg-editorial-sidebar rounded-full transition-all"
               >
                 <ChevronLeft className="w-5 h-5 text-editorial-muted" />
               </button>
               <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-editorial-muted">Pag.</span>
                  <span className="text-sm font-serif italic font-bold text-editorial-accent">{currentPage}</span>
               </div>
               <button 
                 onClick={() => setCurrentPage(currentPage + 1)}
                 className="p-1.5 hover:bg-editorial-sidebar rounded-full transition-all"
               >
                 <ChevronRight className="w-5 h-5 text-editorial-muted" />
               </button>
            </div>
          )}

          <div className="h-8 w-px bg-editorial-border mx-2" />

          {/* Filtros */}
          <div className="flex bg-editorial-sidebar rounded-full p-1 border border-editorial-border">
            {[
              { id: 'all', label: 'Tudo', hidden: mode === 'storyboard' },
              { id: 'concept', label: 'Conceito' },
              { id: 'panel', label: 'Painéis' },
              { id: 'background', label: 'Cenários' },
            ].filter(f => !f.hidden).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={cn(
                  "px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-[0.15em] transition-all",
                  filter === f.id ? "bg-white text-editorial-accent shadow-sm border border-editorial-border" : "text-editorial-muted hover:text-editorial-accent"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
           {mode === 'storyboard' && (
             <div className="flex gap-2">
               <button
                 onClick={handleAiSuggest}
                 disabled={isAiLoading}
                 className="p-3 bg-white border border-editorial-border rounded-full hover:border-editorial-accent transition-all shadow-sm text-editorial-accent"
                 title="Sugerir Próximos Painéis (Loop IA)"
               >
                 <Sparkles className={cn("w-5 h-5", isAiLoading && "animate-pulse")} />
               </button>
               <button
                 onClick={handleGenerateFromScript}
                 disabled={isGeneratingStoryboard}
                 className="flex items-center gap-2 bg-white border border-editorial-border px-4 py-2 rounded-full hover:border-editorial-accent transition-all shadow-sm text-editorial-accent font-bold text-[9px] uppercase tracking-widest"
                 title="Transformar Manuscrito em Storyboard"
               >
                 <Wand2 className={cn("w-4 h-4", isGeneratingStoryboard && "animate-spin")} />
                 {isGeneratingStoryboard ? "Analisando..." : "Gerar do Texto"}
               </button>
             </div>
           )}
           {/* Alternar Layout se não estiver no modo fixo Storyboard */}
           {mode !== 'storyboard' && (
             <div className="flex bg-editorial-sidebar rounded-lg p-1 border border-editorial-border mr-4">
                <button 
                  onClick={() => setLayoutMode('grid')}
                  className={cn("p-1.5 rounded", layoutMode === 'grid' ? "bg-white shadow-sm" : "opacity-40")}
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setLayoutMode('storyboard')}
                  className={cn("p-1.5 rounded", layoutMode === 'storyboard' ? "bg-white shadow-sm" : "opacity-40")}
                >
                  <List className="w-4 h-4" />
                </button>
             </div>
           )}

           <button
             onClick={() => setIsAdding(true)}
             className="flex items-center gap-2 bg-editorial-accent text-white px-8 py-2.5 rounded-full hover:opacity-90 transition-all shadow-xl shadow-black/10 font-bold text-xs uppercase tracking-widest"
           >
             <Plus className="w-4 h-4" /> Registrar
           </button>
        </div>
      </div>

      {/* Grid de Ativos */}
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        <AnimatePresence>
          {aiSuggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12 bg-editorial-accent/5 border border-editorial-accent/20 rounded-[48px] p-10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 text-black/5 pointer-events-none">
                <Sparkles className="w-48 h-48" />
              </div>
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <Sparkles className="w-6 h-6 text-editorial-accent" />
                   <h3 className="text-2xl font-serif italic text-editorial-accent">Sugestões de Fluxo Narrativo</h3>
                 </div>
                 <button onClick={() => setAiSuggestions([])} className="text-editorial-muted hover:text-editorial-accent"><X className="w-6 h-6" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {aiSuggestions.map((s, idx) => (
                   <motion.div 
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/80 backdrop-blur-md border border-editorial-border rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl transition-all"
                   >
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black tracking-widest text-editorial-accent uppercase">Sugestão #{idx+1}</span>
                         <span className="font-serif italic font-bold">{s.title}</span>
                      </div>
                      <p className="text-xs text-editorial-muted font-sans leading-relaxed flex-1 line-clamp-4 italic">"{s.description}"</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => addSuggestionAsPanel(s)}
                          className="flex-1 py-2 bg-editorial-sidebar text-editorial-accent rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 border border-editorial-border"
                        >
                           <Plus className="w-3 h-3" /> Roteiro
                        </button>
                        <button 
                          onClick={() => {
                            const imageUrl = getAiImageAsset(`manga style, cinematic, ${s.description}`);
                            setFormData({
                              title: s.title,
                              description: s.description,
                              imageUrl: imageUrl,
                              type: 'panel',
                              pageNumber: s.pageNumber || currentPage
                            });
                            setIsAdding(true);
                            setAiSuggestions(prev => prev.filter(item => item !== s));
                          }}
                          className="flex-1 py-2 bg-editorial-accent text-white rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
                        >
                           <Sparkles className="w-3 h-3" /> Gerar Arte
                        </button>
                      </div>
                   </motion.div>
                 ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "grid gap-8",
          layoutMode === 'grid' 
            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" 
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          <AnimatePresence mode="popLayout">
            {(isAdding || isEditing) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "bg-white p-8 rounded-[40px] border-2 border-dashed border-editorial-accent shadow-2xl flex flex-col gap-6",
                  layoutMode === 'grid' ? "aspect-square" : "aspect-[3/4]"
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-serif text-lg font-bold italic">{isEditing ? 'Editar Ativo' : 'Novo Ativo'}</h3>
                  <button onClick={() => { setIsAdding(false); setIsEditing(null); }}><X className="w-5 h-5 text-editorial-muted" /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Título/ID do Ativo"
                    className="bg-editorial-sidebar border border-editorial-border rounded-xl py-3 px-4 outline-none focus:border-editorial-accent transition-all text-xs"
                  />
                  
                  {mode === 'storyboard' && (
                    <div className="flex items-center gap-2">
                       <label className="text-[9px] font-black uppercase tracking-widest text-editorial-muted">Página:</label>
                       <input
                        type="number"
                        min="1"
                        value={formData.pageNumber || currentPage}
                        onChange={(e) => setFormData({ ...formData, pageNumber: parseInt(e.target.value) })}
                        className="w-20 bg-editorial-sidebar border border-editorial-border rounded-xl py-2 px-3 outline-none text-xs font-serif"
                      />
                    </div>
                  )}

                  {mode !== 'storyboard' && (
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as ArtAsset['type'] })}
                      className="bg-editorial-sidebar border border-editorial-border rounded-xl py-3 px-4 outline-none text-[9px] font-bold uppercase tracking-widest"
                    >
                      <option value="concept">Arte Conceitual</option>
                      <option value="panel">Painel / Scena</option>
                      <option value="background">Cenario / Background</option>
                    </select>
                  )}

                    <div className="flex gap-2">
                       <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setFormData({ ...formData, imageUrl: ev.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="p-3 bg-editorial-sidebar border border-editorial-border rounded-xl hover:border-editorial-accent transition-all text-editorial-muted"
                        title="Enviar imagem local"
                      >
                         <Plus className="w-4 h-4" />
                      </button>
                      <input
                        required
                        type="text"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="URL da Imagem ou Arquivo Enviado"
                        className="flex-1 bg-editorial-sidebar border border-editorial-border rounded-xl py-3 px-4 outline-none focus:border-editorial-accent transition-all text-[10px] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!formData.description && !formData.title) {
                            alert("Preencha o título ou descrição para gerar a arte.");
                            return;
                          }
                          const style = project.type === 'manga' ? 'manga style, black and white, ink drawing' : 'cinematic movie storyboard, realistic';
                          const imageUrl = getAiImageAsset(`${style}, ${formData.title}: ${formData.description}`);
                          setFormData({ ...formData, imageUrl });
                        }}
                        className="p-3 bg-editorial-accent text-white rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center"
                        title="Gerar Arte com IA"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                    </div>

                  <div className="relative group">
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Breve descrição ou roteiro do painel..."
                      className="w-full bg-editorial-sidebar border border-editorial-border rounded-xl py-3 px-4 outline-none focus:border-editorial-accent transition-all text-xs font-serif resize-none h-24"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const instruction = prompt("Como deseja refinar esta descrição?");
                        if (!instruction) return;
                        setIsAiLoading(true);
                        const refined = await refinePanelDescription(project.description || '', formData.description, instruction);
                        setFormData({ ...formData, description: refined });
                        setIsAiLoading(false);
                      }}
                      className="absolute bottom-2 right-2 p-2 bg-white/80 backdrop-blur-md rounded-lg shadow-sm border border-editorial-border hover:text-editorial-accent opacity-0 group-hover:opacity-100 transition-all"
                      title="Refinar com IA"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="flex-1" />
                  <button
                    type="submit"
                    className="w-full bg-editorial-accent text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg transition-all"
                  >
                    Confirmar Registro
                  </button>
                </form>
              </motion.div>
            )}

            {filteredAssets.map((asset) => (
              <motion.div
                layout
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative"
              >
                <div 
                  className={cn(
                    "bg-white rounded-[32px] overflow-hidden border border-editorial-border hover:border-editorial-accent transition-all duration-500 shadow-sm hover:shadow-2xl cursor-pointer relative",
                    layoutMode === 'grid' ? "aspect-square" : "aspect-[3/4]"
                  )}
                  onClick={() => setSelectedAsset(asset)}
                >
                  <img 
                    src={asset.imageUrl} 
                    alt={asset.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-editorial-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-8 h-8 text-white opacity-60" />
                  </div>
                  
                  {/* Etiqueta ID */}
                  <div className="absolute top-4 left-4">
                    <span className="text-[8px] font-black uppercase tracking-widest bg-white/90 backdrop-blur-md text-editorial-accent px-3 py-1 rounded-full shadow-sm border border-white/20">
                      {asset.title}
                    </span>
                  </div>

                  {/* Badges de Tipo (Somente se no Tudo) */}
                  {filter === 'all' && (
                    <div className="absolute bottom-4 left-4">
                       <span className="text-[7px] font-black uppercase tracking-[0.2em] bg-editorial-accent text-white px-2 py-0.5 rounded shadow-sm opacity-80">
                         {asset.type}
                       </span>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); }}
                      className="p-2 bg-blue-500/90 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                      title="Editar Imagem/Adicionar Balões"
                    >
                      <Layers className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => handleStartEdit(asset, e)}
                      className="p-2 bg-editorial-accent/90 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(asset.id, e)}
                      className="p-2 bg-red-500/90 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredAssets.length === 0 && !isAdding && !isEditing && (
            <div className="col-span-full py-32 text-center border-2 border-dashed border-editorial-border rounded-[64px] opacity-20">
               <ImageIcon className="w-16 h-16 mx-auto mb-4" />
               <p className="font-serif italic text-2xl">O atelier aguarda o primeiro esboço...</p>
               <p className="text-[10px] font-black uppercase tracking-widest mt-2">{filter === 'all' ? 'Adicione imagens, painéis ou cenários' : `Nenhum ${filter} encontrado`}</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Editor Overlay */}
      <AnimatePresence>
        {editingAsset && (
          <ImageEditor 
            imageUrl={editingAsset.imageUrl}
            onClose={() => setEditingAsset(null)}
            onSave={handleApplyEdit}
          />
        )}
      </AnimatePresence>

      {/* Lightbox Minimalista */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-editorial-accent/95 backdrop-blur-2xl flex items-center justify-center p-12"
            onClick={() => setSelectedAsset(null)}
          >
            <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-8" onClick={e => e.stopPropagation()}>
               <div className="flex-1 w-full flex items-center justify-center bg-white/5 rounded-[64px] p-8 relative overflow-hidden group/lb">
                  <img 
                    src={selectedAsset.imageUrl} 
                    alt={selectedAsset.title} 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-[1.02]" 
                    referrerPolicy="no-referrer" 
                  />
                  <button onClick={() => setSelectedAsset(null)} className="absolute top-10 right-10 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"><X className="w-6 h-6" /></button>
               </div>
               <div className="text-center text-white space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">{selectedAsset.type}</span>
                  <h3 className="font-serif text-4xl italic">{selectedAsset.title}</h3>
                  {selectedAsset.description && <p className="max-w-xl mx-auto text-sm opacity-80 font-sans">{selectedAsset.description}</p>}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
