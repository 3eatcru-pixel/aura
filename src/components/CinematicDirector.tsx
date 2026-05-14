import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, Camera, Layout, Layers, Wand2, Sparkles, 
  ChevronRight, X, ChevronLeft, Maximize2, Minimize2, 
  Type as FontIcon, Image as ImageIcon, Video, Palette,
  Activity, Film, Settings2, Download, Save, Users, RefreshCw,
  Clapperboard, Music, MousePointer2, Hand, ZoomIn, ZoomOut
} from 'lucide-react';
import { Project, CinematicNode, Character } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { runCinematicDirector, getAiImageAsset } from '../services/aiService';

interface CinematicDirectorProps {
  project: Project;
  characters: Character[];
  onClose?: () => void;
}

// Extensão de tipos para o Fabric Canvas para evitar erros de TS no panning
interface ExtendedCanvas extends fabric.Canvas {
  isDragging?: boolean;
  lastPosX?: number;
  lastPosY?: number;
}

export function CinematicDirector({ project, characters, onClose }: CinematicDirectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<ExtendedCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingNodes = useRef<Set<string>>(new Set());

  const [nodes, setNodes] = useState<CinematicNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<CinematicNode | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'panel' | 'text'>('select');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Auto-play preview
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPreviewMode && nodes.length > 0) {
      interval = setInterval(() => {
        setPreviewIndex(prev => (prev + 1) % nodes.length);
      }, 3000); // 3 seconds per panel
    }
    return () => clearInterval(interval);
  }, [isPreviewMode, nodes]);
  useEffect(() => {
    if (!canvasRef.current) return;

    const container = containerRef.current;
    fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
      width: container?.clientWidth || 800,
      height: container?.clientHeight || 600,
      backgroundColor: '#0a0a0a',
      allowTouchScrolling: true,
      stopContextMenu: true
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (!fabricCanvas.current || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      fabricCanvas.current.setDimensions({ width, height });
      fabricCanvas.current.renderAll();
    });

    if (container) resizeObserver.observe(container);

    const canvas = fabricCanvas.current;

    // Handle selection
    canvas.on('selection:created', (e) => {
      const activeObject = e.selected?.[0];
      if (activeObject && activeObject.data?.id) {
        const node = nodes.find(n => n.id === activeObject.data.id);
        if (node) setSelectedNode(node);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedNode(null);
    });

    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (obj && obj.data?.id) {
        handleUpdateNode(obj.data.id, {
          x: obj.left || 0,
          y: obj.top || 0,
          width: (obj.width || 0) * (obj.scaleX || 1),
          height: (obj.height || 0) * (obj.scaleY || 1)
        });
      }
    });

    // Cleanup
    return () => {
      canvas.dispose();
      resizeObserver.disconnect();
    };
  }, []); // Inicializa apenas uma vez no mount

  // Aplicar Zoom ao Centro do Canvas
  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas || !containerRef.current) return;

    // Zoom centralizado para melhor UX de storyboard
    const center = canvas.getCenter();
    canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);
    canvas.renderAll();
  }, [zoom]);

  // Handle Tool Changes without Re-creating Canvas
  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    canvas.defaultCursor = activeTool === 'hand' ? 'grab' : 'default';
    canvas.selection = activeTool === 'select';
    
    // Garante que objetos não interfiram no Panning quando a ferramenta mão estiver ativa
    canvas.forEachObject(obj => {
      obj.selectable = activeTool === 'select';
      obj.evented = activeTool === 'select' || activeTool === 'panel' || activeTool === 'text';
    });
    canvas.requestRenderAll();

    // Panning (Hand Tool) Logic
    const handleMouseDown = (opt: fabric.IEvent) => {
      const evt = opt.e as MouseEvent;
      if (activeTool === 'hand') {
        canvas.isDragging = true;
        canvas.selection = false;
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
      }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (canvas.isDragging) {
        const e = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        
        // Ajusta o movimento baseado no zoom para manter proporção 1:1 com o mouse
        vpt![4] += (e.clientX - canvas.lastPosX!);
        vpt![5] += (e.clientY - canvas.lastPosY!);
        canvas.requestRenderAll();
        canvas.lastPosX = e.clientX;
        canvas.lastPosY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      canvas.setViewportTransform(canvas.viewportTransform!);
      canvas.isDragging = false;
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [activeTool]);

  // Sync Nodes from Firebase
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'projects', project.id, 'cinematic'), orderBy('createdAt', 'asc')),
      (snap) => {
        const loadedNodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CinematicNode));
        setNodes(loadedNodes);
        renderNodes(loadedNodes);
      }
    );
    return () => unsub();
  }, [project.id]);

  const renderNodes = (nodesToRender: CinematicNode[]) => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    const existingObjects = canvas.getObjects().filter(obj => obj.data?.id);
    const nodeIdsToRender = new Set(nodesToRender.map(n => n.id));

    // 1. Remover objetos que não existem mais no banco
    existingObjects.forEach(obj => {
      if (obj.data?.id && !nodeIdsToRender.has(obj.data.id)) {
        canvas.remove(obj);
      }
    });

    // 2. Atualizar ou Criar
    nodesToRender.forEach(node => {
      const existingObj = existingObjects.find(obj => obj.data?.id === node.id);

      // Verifica se o objeto existe E se o tipo permanece o mesmo (Ex: Painel não virou Texto)
      if (existingObj && existingObj.data?.type === node.type) {
        // Atualiza posição se mudou externamente (ex: por outro usuário ou IA)
        if (!canvas.getActiveObject() || (canvas.getActiveObject()?.data?.id !== node.id)) {
          if (existingObj.left !== node.x || existingObj.top !== node.y) {
            existingObj.set({ left: node.x, top: node.y });
            existingObj.setCoords();
          }

          // Atualizar texto se mudou (para IText)
          if (node.type === 'text' && existingObj instanceof fabric.IText) {
            if (existingObj.text !== node.content.balloonText) {
              existingObj.set({ text: node.content.balloonText || '' });
            }
          }
        }
      } else {
        // Se o tipo mudou ou não existe, remove o antigo e marca para recriação
        if (existingObj) canvas.remove(existingObj);
        
        if (!loadingNodes.current.has(node.id)) {
          loadingNodes.current.add(node.id);
          // Novo objeto
          if (node.type === 'panel') renderPanelToCanvas(node);
          else if (node.type === 'text') renderTextToCanvas(node);
        }
      }
    });

    canvas.requestRenderAll();
  };

  const renderPanelToCanvas = (node: CinematicNode) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    // Main frame group
    const frame = new fabric.Rect({
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
      fill: node.content.imageUrl ? 'transparent' : '#1a1a1a',
      stroke: '#333',
      strokeWidth: 2,
      rx: 16,
      ry: 16,
      data: { id: node.id, type: 'panel' }
    });

    if (node.content.imageUrl) {
      fabric.Image.fromURL(node.content.imageUrl, (img, isError) => {
        // Validação de sanidade: o nó ainda existe na lista atual de nós?
        // Isso evita adicionar imagens de nós que foram deletados durante o download.
        const nodeStillExists = nodes.some(n => n.id === node.id);

        if (isError || !img || !canvas || !nodeStillExists) {
          loadingNodes.current.delete(node.id);
          // Se houver erro, renderiza o frame vazio para não quebrar o layout
          if (isError && canvas && nodeStillExists) canvas.add(frame);
          return;
        }

        if (canvas.getObjects().find(o => o.data?.id === node.id)) {
           loadingNodes.current.delete(node.id);
           return;
        }

        img.set({
          left: node.x,
          top: node.y,
          selectable: false,
          data: { id: node.id, type: 'panel' }
        });
        
        // Clip image to frame
        const scale = Math.max(node.width / (img.width || 1), node.height / (img.height || 1));
        img.scale(scale);
        
        const group = new fabric.Group([frame, img], {
          left: node.x,
          top: node.y,
          data: { id: node.id, type: 'panel' }
        });
        
        canvas.add(group);
        canvas.sendToBack(group);
        loadingNodes.current.delete(node.id);
      }, { crossOrigin: 'anonymous' });
    } else {
      canvas.add(frame);
      loadingNodes.current.delete(node.id);
    }
  };

  const renderTextToCanvas = (node: CinematicNode) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    const text = new fabric.IText(node.content.balloonText || 'TEXTO', {
      left: node.x,
      top: node.y,
      fontSize: 20,
      fontFamily: 'Inter',
      fill: 'white',
      data: { id: node.id, type: 'text' }
    });
    loadingNodes.current.delete(node.id);

    canvas.add(text);
  };

  const handleAddText = async () => {
    const newNode: Partial<CinematicNode> = {
      type: 'text',
      x: 200 + nodes.length * 20,
      y: 200,
      content: {
        balloonText: 'NOVO DIÁLOGO',
      },
      order: nodes.length,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'projects', project.id, 'cinematic'), newNode);
      setActiveTool('select');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPanel = async () => {
    const newNode: Partial<CinematicNode> = {
      type: 'panel',
      x: 100 + nodes.length * 50,
      y: 100,
      width: 400,
      height: 300,
      content: {
        description: 'Nova Cena',
        cameraAngle: 'Eye Level',
        shotType: 'Medium Shot'
      },
      order: nodes.length,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'projects', project.id, 'cinematic'), newNode);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNode = async (id: string, updates: Partial<CinematicNode> | any) => {
    try {
      await updateDoc(doc(db, 'projects', project.id, 'cinematic', id), updates);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDirectorSuggest = async () => {
    if (!selectedNode || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const suggestion = await runCinematicDirector(
        selectedNode.content.description || '',
        project.description || '',
        selectedNode.content.mood || 'neutral'
      );

      if (suggestion) {
        handleUpdateNode(selectedNode.id, {
          content: {
            ...selectedNode.content,
            ...suggestion
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateArtwork = async () => {
    if (!selectedNode) return;
    const style = project.type === 'manga' ? 'manga style, black and white ink, cinematic' : 'cinematic movie shot, realistic';
    const prompt = `${style}, ${selectedNode.content.cameraAngle}, ${selectedNode.content.shotType}, ${selectedNode.content.description}`;
    const imageUrl = await getAiImageAsset(prompt);
    
    handleUpdateNode(selectedNode.id, {
      content: {
        ...selectedNode.content,
        imageUrl
      }
    });
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (confirm("Deletar este elemento do storyboard?")) {
      await deleteDoc(doc(db, 'projects', project.id, 'cinematic', selectedNode.id));
      setSelectedNode(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-[#EAEAEA] overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/10 px-8 flex items-center justify-between bg-[#0f0f0f] z-50">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-editorial-accent rounded-xl flex items-center justify-center shadow-neon">
                 <Clapperboard className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-sm font-black uppercase tracking-[0.2em]">{project.title}</h2>
                 <p className="text-[9px] font-bold text-editorial-accent uppercase tracking-widest">Mesa de Direção Cinematográfica</p>
              </div>
           </div>
           
           <div className="h-8 w-px bg-white/10" />
           
           <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setActiveTool('select')}
                className={cn("p-2 rounded-xl transition-all", activeTool === 'select' ? "bg-editorial-accent text-white" : "text-white/40 hover:bg-white/5")}
              >
                <MousePointer2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTool('hand')}
                className={cn("p-2 rounded-xl transition-all", activeTool === 'hand' ? "bg-editorial-accent text-white" : "text-white/40 hover:bg-white/5")}
              >
                <Hand className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button 
                onClick={handleAddPanel}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest text-white/60 hover:bg-white/5")}
              >
                <Layout className="w-4 h-4" /> Add Cena
              </button>
              <button 
                onClick={handleAddText}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest text-white/60 hover:bg-white/5")}
              >
                <FontIcon className="w-4 h-4" /> Add Texto
              </button>
           </div>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsPreviewMode(!isPreviewMode)}
             className={cn(
               "flex items-center gap-2 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
               isPreviewMode ? "bg-editorial-accent text-white shadow-neon" : "bg-white/5 border border-white/10 text-white/40 hover:bg-white/10"
             )}
           >
              {isPreviewMode ? <Video className="w-4 h-4 animate-pulse" /> : <Film className="w-4 h-4" />}
              {isPreviewMode ? "Finalizando Preview" : "Cinematic Preview"}
           </button>
           <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-white/5">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}><ZoomOut className="w-4 h-4 text-white/40" /></button>
              <span className="text-[10px] font-black w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}><ZoomIn className="w-4 h-4 text-white/40" /></button>
           </div>
           <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
              Exportar Storyboard
           </button>
           <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden" ref={containerRef}>
        {/* Left Toolbar */}
        <div className="w-20 border-r border-white/5 flex flex-col items-center py-8 gap-8 bg-[#0a0a0a] z-40">
           <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-editorial-accent transition-all group relative">
              <Camera className="w-5 h-5" />
              <span className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-3 py-1 rounded text-[8px] uppercase tracking-widest whitespace-nowrap z-50">Câmera Presets</span>
           </button>
           <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-editorial-accent transition-all group relative">
              <Users className="w-5 h-5" />
              <span className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-3 py-1 rounded text-[8px] uppercase tracking-widest whitespace-nowrap z-50">Biblioteca de Poses</span>
           </button>
           <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-editorial-accent transition-all group relative">
              <ImageIcon className="w-5 h-5" />
              <span className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-3 py-1 rounded text-[8px] uppercase tracking-widest whitespace-nowrap z-50">Assets & Fundo</span>
           </button>
           <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-editorial-accent transition-all group relative">
              <Palette className="w-5 h-5" />
              <span className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-3 py-1 rounded text-[8px] uppercase tracking-widest whitespace-nowrap z-50">Atmosfera</span>
           </button>
           <div className="flex-1" />
           <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-editorial-accent/10 text-editorial-accent border border-editorial-accent/20 transition-all group relative">
              <Activity className="w-5 h-5" />
              <span className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-3 py-1 rounded text-[8px] uppercase tracking-widest whitespace-nowrap z-50">Emotion Flow Audit</span>
           </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-auto bg-[#080808] custom-scrollbar" id="canvas-container">
           <canvas ref={canvasRef} className="cursor-crosshair" />
        </div>

        {/* Right Panel (Inspector) */}
        <AnimatePresence>
          {showRightPanel && (
            <motion.div 
              initial={{ x: 350 }} 
              animate={{ x: 0 }} 
              exit={{ x: 350 }}
              className="w-80 border-l border-white/5 bg-[#0d0d0d] flex flex-col z-40 shadow-2xl"
            >
               <div className="p-8 border-b border-white/5">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EAEAEA]">Diretriz de Cena</h3>
                     <button onClick={() => setShowRightPanel(false)}><ChevronRight className="w-5 h-5 text-white/20" /></button>
                  </div>
                  
                  {selectedNode && selectedNode.type === 'panel' ? (
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <label className="text-[8px] font-black uppercase tracking-widest text-editorial-accent">Ação e Roteiro</label>
                          <textarea 
                            value={selectedNode.content.description}
                            onChange={(e) => handleUpdateNode(selectedNode.id, { content: { ...selectedNode.content, description: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-[11px] font-sans h-32 outline-none focus:border-editorial-accent transition-all resize-none"
                            placeholder="Descreva a ação deste painel..."
                          />
                       </div>

                       <div className="p-4 bg-editorial-accent/5 rounded-[24px] border border-editorial-accent/20 space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 text-editorial-accent">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Diretor IA</span>
                             </div>
                             <button 
                               onClick={handleDirectorSuggest}
                               disabled={isAiLoading}
                               className="p-2 hover:bg-editorial-accent/10 rounded-full transition-all"
                             >
                                <RefreshCw className={cn("w-4 h-4 text-editorial-accent", isAiLoading && "animate-spin")} />
                             </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                             <div className="space-y-1">
                                <p className="text-[7px] font-black uppercase tracking-widest opacity-40">Ângulo de Câmera</p>
                                <p className="text-[10px] font-bold text-white/80">{selectedNode.content.cameraAngle}</p>
                             </div>
                             <div className="space-y-1">
                                <p className="text-[7px] font-black uppercase tracking-widest opacity-40">Tipo de Shot</p>
                                <p className="text-[10px] font-bold text-white/80">{selectedNode.content.shotType}</p>
                             </div>
                          </div>
                          <button 
                            onClick={handleGenerateArtwork}
                            className="w-full py-3 bg-editorial-accent text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-neon hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                             <Wand2 className="w-4 h-4" /> Manifestar Arte Final
                          </button>
                       </div>

                       <div className="space-y-4">
                          <label className="text-[8px] font-black uppercase tracking-widest text-[#EAEAEA]/40">Atmosfera & Emoção</label>
                          <div className="flex flex-wrap gap-2">
                             {['Melancolia', 'Caos', 'Medo', 'Paz', 'Tensão', 'Ação', 'Épico'].map(mood => (
                               <button 
                                 key={mood}
                                 onClick={() => handleUpdateNode(selectedNode.id, { content: { ...selectedNode.content, mood } })}
                                 className={cn(
                                   "px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all",
                                   selectedNode.content.mood === mood ? "bg-white text-black border-white" : "text-white/40 border-white/10 hover:border-editorial-accent"
                                 )}
                               >
                                 {mood}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-4">
                          <label className="text-[8px] font-black uppercase tracking-widest text-[#EAEAEA]/40">Personagens Persistentes</label>
                          <div className="flex flex-wrap gap-2">
                             {characters.map(char => (
                               <button 
                                 key={char.id}
                                 onClick={() => {
                                   const current = selectedNode.content.persistentCharacterIds || [];
                                   const next = current.includes(char.id) 
                                     ? current.filter(id => id !== char.id)
                                     : [...current, char.id];
                                   handleUpdateNode(selectedNode.id, { content: { ...selectedNode.content, persistentCharacterIds: next } });
                                 }}
                                 className={cn(
                                   "px-3 py-1.5 rounded-xl text-[8px] font-bold border transition-all flex items-center gap-2",
                                   (selectedNode.content.persistentCharacterIds || []).includes(char.id) 
                                     ? "bg-editorial-accent/20 border-editorial-accent text-white" 
                                     : "text-white/40 border-white/10 hover:bg-white/5"
                                 )}
                               >
                                 <div className="w-4 h-4 rounded-full bg-white/10 overflow-hidden">
                                    {char.imageUrl && <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />}
                                 </div>
                                 {char.name}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                          <button 
                            onClick={handleDeleteNode}
                            className="text-[9px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 flex items-center gap-2 transition-all"
                          >
                             <Trash2 className="w-3.5 h-3.5" /> Deletar Cena
                          </button>
                          <div className="text-[9px] font-black text-white/10 uppercase tracking-widest">ID: {selectedNode.id.slice(0, 8)}</div>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20 text-center gap-4">
                       <Layout className="w-12 h-12" />
                       <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma Cena Selecionada</p>
                         <p className="text-[8px] font-medium leading-relaxed max-w-[150px]">Clique em um painel no canvas para ajustar a direção cinematográfica.</p>
                       </div>
                    </div>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-editorial-accent mb-6">Camadas do Storyboard</h4>
                  <div className="space-y-3">
                     {nodes.map(node => (
                       <div 
                         key={node.id} 
                         onClick={() => setSelectedNode(node)}
                         className={cn(
                           "p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group",
                           selectedNode?.id === node.id ? "bg-white/10 border border-white/10" : "bg-white/2 border border-transparent hover:bg-white/5"
                         )}
                       >
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-[10px] font-black text-editorial-accent">
                                {node.order + 1}
                             </div>
                             <div className="space-y-0.5">
                                <p className="text-[10px] font-bold text-white/80">{node.content.description?.slice(0, 20)}...</p>
                                <p className="text-[7px] font-black text-white/20 uppercase tracking-widest">{node.content.shotType}</p>
                             </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'projects', project.id, 'cinematic', node.id)); }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                          >
                             <X className="w-3.5 h-3.5" />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Tooltips or HUD info could go here */}
      </div>

      {/* Cinematic Preview Overlay */}
      <AnimatePresence>
        {isPreviewMode && nodes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-20"
          >
             <div className="absolute top-10 right-10 z-[210] flex items-center gap-4">
                <div className="flex flex-col items-end">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-editorial-accent">Frame {previewIndex + 1} / {nodes.length}</p>
                   <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Sincronia Editorial</p>
                </div>
                <button 
                  onClick={() => setIsPreviewMode(false)}
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-red-500 transition-all"
                >
                   <X className="w-6 h-6" />
                </button>
             </div>

             <div className="max-w-6xl w-full aspect-video relative rounded-[48px] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] border border-white/5">
                <AnimatePresence mode="wait">
                   <motion.div
                     key={nodes[previewIndex].id}
                     initial={{ opacity: 0, scale: 1.1 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     transition={{ duration: 1.5, ease: "easeOut" }}
                     className="absolute inset-0"
                   >
                      <img 
                        src={nodes[previewIndex].content.imageUrl || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop'} 
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      
                      <div className="absolute bottom-20 left-20 right-20 space-y-6">
                         <div className="flex items-center gap-4">
                            <span className="px-4 py-1 bg-editorial-accent text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-neon">
                               {nodes[previewIndex].content.shotType}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 italic">
                               {nodes[previewIndex].content.cameraAngle}
                            </span>
                         </div>
                         <h3 className="text-5xl font-brand tracking-[0.1em] text-white leading-tight max-w-4xl">
                            {nodes[previewIndex].content.description}
                         </h3>
                      </div>
                   </motion.div>
                </AnimatePresence>
             </div>

             {/* Sound Layer Simulation HUD */}
             <div className="absolute bottom-10 left-10 flex items-center gap-6 opacity-40">
                <Music className="w-6 h-6 text-editorial-accent animate-pulse" />
                <div className="h-4 w-48 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                     className="h-full bg-editorial-accent" 
                     animate={{ width: ["20%", "60%", "40%", "80%", "30%"] }} 
                     transition={{ repeat: Infinity, duration: 2 }} 
                   />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest">Ambient Audio Active</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
