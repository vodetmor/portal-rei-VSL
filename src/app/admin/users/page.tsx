'use client';

import { useEffect, useState, useMemo } from 'react';
import AdminGuard from '@/components/admin/admin-guard';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, orderBy, DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface User extends DocumentData {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

function UserManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      if (!firestore) return;
      setLoading(true);
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, orderBy('email'));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          variant: "destructive",
          title: "Erro de Permissão",
          description: "Você não tem permissão para listar os usuários."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [firestore, toast]);
  
  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  return (
    <div className="container mx-auto px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4 pt-20">
        <div>
            <Button asChild variant="outline" size="sm" className="mb-2">
                <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Painel
                </Link>
            </Button>
            <h1 className="text-3xl font-bold text-white">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">Visualize e gerencie os acessos de todos os usuários da plataforma.</p>
        </div>
         <div className="w-full sm:w-auto">
            <Input 
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-white">{user.displayName || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {user.email === 'admin@reidavsl.com' ? (
                        <Badge variant="destructive">Dono</Badge>
                    ) : (
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role}
                        </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm" disabled={user.email === 'admin@reidavsl.com'}>
                      <Link href={`/admin/users/${user.id}`}>
                        <UserCog className="mr-2 h-4 w-4" />
                        Gerenciar
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
                <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">Nenhum usuário encontrado.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


export default function AdminUsersPage() {
    return (
        <AdminGuard>
            <UserManagementPage />
        </AdminGuard>
    )
}
