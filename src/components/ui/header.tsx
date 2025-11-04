
'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser, useAuth, useFirestore } from '@/firebase';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LayoutGrid, UserCircle, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useLayout } from '@/context/layout-context';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { useScroll } from './use-scroll';


export function Header() {
	const { user, loading } = useUser();
	const auth = useAuth();
	const firestore = useFirestore();
	const { layoutData } = useLayout();
	const [isAdmin, setIsAdmin] = React.useState(false);
	const scrolled = useScroll(50);
    const pathname = usePathname();

	const links = [
		{
			label: 'Meus Cursos',
			href: '/dashboard',
		},
		{
			label: 'Perfil',
			href: '/profile',
		},
	];
  
	React.useEffect(() => {
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

    const isLessonPage = /^\/courses\/[^/]+\/[^/]+/.test(pathname);
	
	return (
		<header
			className={cn(
				'left-0 right-0 z-[100] transition-all ease-out duration-300',
                isLessonPage 
                    ? 'static h-20 bg-background/80 border-b border-border' 
                    : scrolled 
                        ? 'fixed top-0 h-16 bg-background/80 border-b border-border backdrop-blur-md'
                        : 'fixed top-0 h-20 bg-transparent border-b border-transparent'
			)}
		>
			<nav
				className={cn(
					'flex h-full w-full items-center justify-between px-4 max-w-5xl mx-auto transition-all duration-300'
				)}
			>
				<Link href="/dashboard" className="relative h-10 w-40">
					<Image 
						src={layoutData.defaults.logoUrl}
						alt="Rei da VSL Logo"
						fill
						className="object-contain"
						priority
					/>
        		</Link>
				<div className="hidden items-center gap-2 md:flex">
				{loading ? (
					<div className="h-10 w-24 animate-pulse rounded-md bg-muted/50"></div>
				) : user ? (
					<>
						{links.map((link, i) => (
							<Link key={i} className={buttonVariants({ variant: 'ghost' })} href={link.href}>
								{link.label}
							</Link>
						))}

						{isAdmin && (
							<Button asChild variant="outline" size="sm">
								<Link href="/admin">
									<ShieldCheck className="mr-2 h-4 w-4" />
									Painel Admin
								</Link>
							</Button>
						)}
						
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
								<DropdownMenuItem asChild><Link href="/profile"><UserCircle className="mr-2 h-4 w-4" /><span>Perfil</span></Link></DropdownMenuItem>
								{isAdmin && (
									<>
									<DropdownMenuSeparator />
									<DropdownMenuLabel>Admin</DropdownMenuLabel>
									<DropdownMenuItem asChild><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /><span>Painel Geral</span></Link></DropdownMenuItem>
									<DropdownMenuItem asChild><Link href="/admin/users"><Users className="mr-2 h-4 w-4" /><span>Usuários</span></Link></DropdownMenuItem>
									</>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-400 focus:bg-red-500/10">
									<LogOut className="mr-2 h-4 w-4" />
									<span>Sair</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<>
						<Button asChild variant="outline">
							<Link href="/login">Entrar</Link>
						</Button>
						<Button asChild>
							<Link href="/register">Cadastre-se</Link>
						</Button>
					</>
				)}
				</div>
				<div className="md:hidden">
				{ user && (
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
							{links.map((link) => (
								<DropdownMenuItem key={link.href} asChild><Link href={link.href}>{link.label}</Link></DropdownMenuItem>
							))}
							{isAdmin && (
								<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Admin</DropdownMenuLabel>
								<DropdownMenuItem asChild><Link href="/admin">Painel Geral</Link></DropdownMenuItem>
								<DropdownMenuItem asChild><Link href="/admin/users">Usuários</Link></DropdownMenuItem>
								</>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-400 focus:bg-red-500/10">
								Sair
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				{!user && !loading && (
					<Button asChild size="sm">
						<Link href="/login">Entrar</Link>
					</Button>
				)}
				</div>
			</nav>
		</header>
	);
}
