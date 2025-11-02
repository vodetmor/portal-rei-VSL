'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Home, Menu, ShieldCheck, Edit, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useEditMode } from '@/context/EditModeContext';
import { useToast } from '@/hooks/use-toast';

export function Nav() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { isEditMode, toggleEditMode, triggerSave } = useEditMode();
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (user && firestore) {
        if (user.email === 'admin@reidavsl.com') {
          setIsAdmin(true);
          return;
        }
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user, firestore]);

  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
    }
  };
  
  const handleEditClick = async () => {
    if (isEditMode) {
      setIsSaving(true);
      try {
        await triggerSave();
        toast({
          title: "Sucesso!",
          description: "Alterações salvas no layout.",
        });
        toggleEditMode(); // Toggles the mode off after saving
      } catch (error) {
        console.error("Failed to save changes:", error);
        toast({
          variant: "destructive",
          title: "Erro ao Salvar",
          description: "Não foi possível salvar as alterações.",
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toggleEditMode(); // Toggles the mode on
    }
  }

  const navLinks = (
    <>
      <Link href="/dashboard" className="text-neutral-200 hover:text-white transition-colors block py-2" onClick={() => setIsSheetOpen(false)}>Início</Link>
      {isAdmin && (
        <>
          <Link href="/admin" className="flex items-center gap-2 text-neutral-200 hover:text-white transition-colors block py-2" onClick={() => setIsSheetOpen(false)}>
            <ShieldCheck className="h-4 w-4" />
            Painel Admin
          </Link>
          <Button variant="outline" size="sm" className="w-full justify-start mt-2" onClick={handleEditClick} disabled={isSaving}>
            {isEditMode ? <Save className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
            {isSaving ? 'Salvando...' : isEditMode ? 'Salvar Alterações' : 'Editar Layout'}
          </Button>
        </>
      )}
    </>
  );

  return (
    <header className={cn(
      "fixed top-0 z-50 w-full transition-colors duration-300",
      isScrolled ? "bg-background/90 backdrop-blur-sm" : "bg-transparent"
    )}>
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-white tracking-wider">REI DA VSL</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
          ) : user ? (
            <>
              {isAdmin && (
                <div className="hidden md:flex items-center gap-2">
                   <Button variant="outline" size="sm" onClick={handleEditClick} disabled={isSaving}>
                      {isEditMode ? <Save className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                      {isSaving ? 'Salvando...' : isEditMode ? 'Salvar Alterações' : 'Editar Layout'}
                  </Button>
                </div>
              )}
              <nav className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/dashboard"><Home className="h-5 w-5" /></Link>
                </Button>
                 {isAdmin && (
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin"><ShieldCheck className="h-5 w-5" /></Link>
                    </Button>
                 )}
              </nav>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                      <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">{user.displayName || 'Usuário'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/dashboard">Dashboard</Link></DropdownMenuItem>
                   {isAdmin && <DropdownMenuItem asChild><Link href="/admin">Painel Admin</Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

               {/* Mobile Menu */}
              <div className="md:hidden">
                 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                      <nav className="flex flex-col gap-4 text-lg font-medium mt-10">
                        {navLinks}
                      </nav>
                  </SheetContent>
                </Sheet>
              </div>

            </>
          ) : (
            <Button asChild>
                <Link href="/login">Começar Agora</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
