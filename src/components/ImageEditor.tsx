import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { X, Save, Type, Square, MessageSquare, Palette, Brush, Eraser, Trash2, Download, MousePointer2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export function ImageEditor({ imageUrl, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'brush' | 'text' | 'rect' | 'bubble'>('select');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f8f9fa',
    });
    fabricCanvasRef.current = canvas;

    fabric.Image.fromURL(imageUrl, (img) => {
      // Scale image to fit canvas
      const scale = Math.min(
        canvas.width! / img.width!,
        canvas.height! / img.height!
      );
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (canvas.width! - img.width! * scale) / 2,
        top: (canvas.height! - img.height! * scale) / 2,
        selectable: false,
      });
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
    }, { crossOrigin: 'anonymous' });

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === 'brush';
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
    }

    // Event listeners for tool-specific behavior
    canvas.off('mouse:down');
    if (activeTool === 'text') {
      canvas.on('mouse:down', (opt) => {
        if (opt.target) return;
        const pointer = canvas.getPointer(opt.e);
        const text = new fabric.IText('Texto...', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'serif',
          fontSize: 32,
          fill: color,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        setActiveTool('select');
      });
    } else if (activeTool === 'rect') {
      canvas.on('mouse:down', (opt) => {
        if (opt.target) return;
        const pointer = canvas.getPointer(opt.e);
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 4,
          width: 100,
          height: 100,
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        setActiveTool('select');
      });
    } else if (activeTool === 'bubble') {
       canvas.on('mouse:down', (opt) => {
        if (opt.target) return;
        const pointer = canvas.getPointer(opt.e);
        // Create an Ellipsoid but for Manga/Speech bubbles we might want a group
        const ellipse = new fabric.Ellipse({
          rx: 60, ry: 40,
          fill: '#fff',
          stroke: '#000',
          strokeWidth: 2,
          left: pointer.x,
          top: pointer.y,
        });
        const triangle = new fabric.Triangle({
          width: 20, height: 20,
          fill: '#fff',
          stroke: '#000',
          strokeWidth: 2,
          left: pointer.x + 40,
          top: pointer.y + 70,
          angle: 150,
        });
        const group = new fabric.Group([ellipse, triangle], {
          left: pointer.x,
          top: pointer.y,
        });
        canvas.add(group);
        canvas.setActiveObject(group);
        setActiveTool('select');
      });
    }
  }, [activeTool, color, brushSize]);

  const handleSave = () => {
    if (!fabricCanvasRef.current) return;
    const dataUrl = fabricCanvasRef.current.toDataURL({
      format: 'png',
      quality: 1,
    });
    onSave(dataUrl);
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    canvas.discardActiveObject();
    canvas.remove(...activeObjects);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex flex-col p-8"
    >
      <div className="flex items-center justify-between mb-6 text-white">
        <div className="flex items-center gap-4">
          <Clapperboard className="w-8 h-8 text-editorial-accent" />
          <h2 className="text-2xl font-serif italic">Estúdio de Edição Visual</h2>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-editorial-accent text-white px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Save className="w-4 h-4" /> Aplicar Mudanças
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Toolbar */}
        <div className="w-20 bg-white/5 rounded-3xl p-4 flex flex-col gap-4 items-center border border-white/10">
          <ToolButton icon={MousePointer2} active={activeTool === 'select'} onClick={() => setActiveTool('select')} label="Mover" />
          <ToolButton icon={Brush} active={activeTool === 'brush'} onClick={() => setActiveTool('brush')} label="Pincel" />
          <ToolButton icon={Type} active={activeTool === 'text'} onClick={() => setActiveTool('text')} label="Texto" />
          <ToolButton icon={Square} active={activeTool === 'rect'} onClick={() => setActiveTool('rect')} label="Painel" />
          <ToolButton icon={MessageSquare} active={activeTool === 'bubble'} onClick={() => setActiveTool('bubble')} label="Balão" />
          
          <div className="h-px w-full bg-white/10 my-2" />
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
          />
          <div className="flex flex-col items-center gap-2 mt-auto">
            <ToolButton icon={Trash2} active={false} onClick={deleteSelected} label="Remover" className="text-red-400" />
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-white/5 rounded-[40px] border border-white/10 flex items-center justify-center overflow-hidden p-8 shadow-2xl">
          <div className="bg-white rounded-lg shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Properties / Info */}
        <div className="w-64 bg-white/5 rounded-3xl p-8 border border-white/10 flex flex-col gap-8">
           <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Configuração da Ferramenta</h4>
              {activeTool === 'brush' && (
                <div className="space-y-4">
                  <label className="text-xs text-white/60">Tamanho: {brushSize}px</label>
                  <input 
                    type="range" min="1" max="50" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                    className="w-full"
                  />
                </div>
              )}
              {activeTool === 'select' && (
                <p className="text-xs text-white/40 italic">Selecione e arraste elementos no palco.</p>
              )}
           </div>

           <div className="mt-auto">
              <div className="p-4 bg-editorial-accent/10 rounded-2xl border border-editorial-accent/20">
                <p className="text-[10px] leading-relaxed text-editorial-accent font-sans">
                  <strong>DICA:</strong> Use as ferramentas de painel e balão para estruturar seu storyboard rapidamente. Use o pincel para rascunhos.
                </p>
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function ToolButton({ icon: Icon, active, onClick, label, className }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl transition-all relative group flex items-center justify-center",
        active ? "bg-editorial-accent text-white shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5",
        className
      )}
    >
      <Icon className="w-6 h-6" />
      <span className="absolute left-full ml-4 px-2 py-1 bg-black text-[8px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

import { Clapperboard } from 'lucide-react';
