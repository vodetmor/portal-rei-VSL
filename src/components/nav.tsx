'use client';
import { useAuth, useUser, useFirestore } from '@/firebase';
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
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LayoutGrid, UserCircle, LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { useLayout } from '@/context/layout-context';


export function Nav() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { layoutData } = useLayout();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on mount
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
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch {
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

  const navLinks = (
    <>
      <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors block py-2 text-lg" onClick={() => setIsSheetOpen(false)}>Início</Link>
      <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors block py-2 text-lg" onClick={() => setIsSheetOpen(false)}>Meus Cursos</Link>
      <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors block py-2 text-lg" onClick={() => setIsSheetOpen(false)}>Perfil</Link>
      {isAdmin && (
        <Link href="/admin" className="text-gray-300 hover:text-white transition-colors block py-2 text-lg" onClick={() => setIsSheetOpen(false)}>
            Painel Admin
        </Link>
      )}
    </>
  );

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 w-full flex justify-between items-center px-4 md:px-8 py-4 z-50 transition-colors duration-300"
        initial={{ backgroundColor: 'rgba(15, 15, 15, 0)' }}
        animate={{ backgroundColor: isScrolled ? 'rgba(15, 15, 15, 0.7)' : 'rgba(15, 15, 15, 0)' }}
        style={{ backdropFilter: isScrolled ? 'blur(10px)' : 'none' }}
      >
        <div className="flex items-center gap-8">
            <Link href="/dashboard" className="relative h-10 w-48">
              {!layoutData.isLoading && (
                  <Image 
                    src={layoutData.defaults.logoUrl} 
                    alt="Portal Rei da VSL Logo"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-contain"
                    priority
                  />
              )}
            </Link>
            <ul className="hidden md:flex space-x-6 text-gray-300 items-center">
                <li><Link href="/dashboard" className="hover:text-white cursor-pointer transition-colors text-sm">Início</Link></li>
                <li><Link href="/dashboard" className="hover:text-white cursor-pointer transition-colors text-sm">Meus Cursos</Link></li>
            </ul>
        </div>
        
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-10 w-24 animate-pulse rounded-md bg-muted/50"></div>
          ) : user ? (
            <>
              <div className="hidden md:flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 transition-opacity hover:opacity-80">
                      <Avatar className="h-9 w-9 border-2 border-transparent group-hover:border-primary">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                        <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-white">{user.displayName || 'Usuário'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/dashboard"><LayoutGrid className="mr-2 h-4 w-4" /><span>Dashboard</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard"><UserCircle className="mr-2 h-4 w-4" /><span>Perfil</span></Link></DropdownMenuItem>
                    {isAdmin && <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /><span>Painel Admin</span></Link></DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-400 focus:bg-red-500/10">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

               {/* Mobile Menu */}
              <div className="md:hidden">
                <button onClick={() => setIsSheetOpen(true)} className="text-white">
                    <Menu className="h-6 w-6" />
                </button>
              </div>
            </>
          ) : (
            <Button asChild variant="destructive" className="bg-primary hover:bg-primary/90">
                <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </motion.nav>

       {/* Mobile Sheet */}
      <AnimatePresence>
      {isSheetOpen && (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] md:hidden"
            onClick={() => setIsSheetOpen(false)}
        >
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed top-0 right-0 h-full w-3/4 max-w-sm bg-background p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-xl font-bold text-primary">Navegar</h2>
                    <button onClick={() => setIsSheetOpen(false)}><X/></button>
                </div>
                <nav className="flex flex-col gap-4">
                    {navLinks}
                    <div className="border-t border-border pt-4 mt-4">
                      {user ? (
                         <Button onClick={handleSignOut} variant="destructive" className="w-full justify-start gap-2">
                           <LogOut className="h-4 w-4"/> Sair
                         </Button>
                      ) : (
                        <Button asChild variant="destructive" className="w-full">
                          <Link href="/login">Login</Link>
                        </Button>
                      )}
                    </div>
                </nav>
            </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
