import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Project } from '../types';
import { LogOut, User as UserIcon } from 'lucide-react';
import { formatDate } from '../lib/utils';

interface NavbarProps {
  user: User;
  activeProject: Project | null;
}

export function Navbar({ user, activeProject }: NavbarProps) {
  return (
    <header className="h-20 px-10 border-b border-editorial-border bg-editorial-bg/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 bg-aura-gold rounded-full flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform">
            <span className="text-white font-serif font-black text-xs">A</span>
          </div>
          <span className="font-serif text-lg font-black tracking-tighter text-editorial-accent">AURA</span>
        </div>
        
        <div className="h-8 w-[1px] bg-editorial-border mx-2" />
        
        {activeProject ? (
          <div>
            <h1 className="font-serif text-2xl font-light italic text-editorial-accent">{activeProject.title}</h1>
            <p className="text-[10px] uppercase tracking-widest text-editorial-muted mt-0.5">
              Editando agora • Última alteração {activeProject.updatedAt ? formatDate(activeProject.updatedAt.toDate()) : 'agora'}
            </p>
          </div>
        ) : (
          <h1 className="font-serif text-2xl font-light italic text-editorial-accent">Mural do Arquiteto</h1>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button className="text-xs font-semibold px-4 py-2 rounded-full border border-editorial-border hover:bg-white transition-colors">
            Versão Atual
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-editorial-accent">{user.displayName}</p>
              <p className="text-[10px] text-editorial-muted">{user.email}</p>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-9 h-9 rounded-full ring-1 ring-editorial-border shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-editorial-sidebar border border-editorial-border flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-editorial-muted" />
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => auth.signOut()}
          className="p-2 text-editorial-muted hover:text-red-500 transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
