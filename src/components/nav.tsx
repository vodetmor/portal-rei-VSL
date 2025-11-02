'use client';
import { useAuth, useUser } from '@/firebase';
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
import { Bell, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Nav() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
    }
  };

  return (
    <header className={cn(
      "fixed top-0 z-50 w-full transition-colors duration-300",
      isScrolled ? "bg-background/90 backdrop-blur-sm" : "bg-transparent"
    )}>
      <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
        <div className="mr-8 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="text-2xl font-bold brand-red tracking-wider">REI DA VSL</span>
          </Link>
          {user && (
             <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                <Link href="/dashboard" className="text-neutral-300 hover:text-white transition-colors">Início</Link>
                {/* Add more links like "Séries", "Filmes" if needed */}
             </nav>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
          ) : user ? (
            <>
              <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white">
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-neutral-300 hover:text-white">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
            
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-md">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                      <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">{user.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/profile">Gerenciar Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" className="bg-brand-red text-white hover:bg-brand-red-dark">
                <Link href="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
