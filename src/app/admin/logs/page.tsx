
'use client';

import { useEffect, useState, useMemo } from 'react';
import AdminGuard from '@/components/admin/admin-guard';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, query, orderBy, DocumentData, Timestamp } from 'firebase/firestore';
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
import { ArrowLeft, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog extends DocumentData {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  timestamp: Timestamp;
}

function AuditLogPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      if (!firestore) return;
      setLoading(true);
      try {
        const logsRef = collection(firestore, 'auditLogs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuditLog[];
        setLogs(logsData);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        toast({
          variant: "destructive",
          title: "Erro de Permissão",
          description: "Você não tem permissão para visualizar os logs de atividade."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [firestore, toast]);
  
  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityTitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  const getActionBadge = (action: string) => {
    if (action.includes('created')) return <Badge variant="default" className="bg-green-600">Criação</Badge>;
    if (action.includes('updated')) return <Badge variant="warning">Edição</Badge>;
    if (action.includes('deleted')) return <Badge variant="destructive">Exclusão</Badge>;
    if (action.includes('granted')) return <Badge variant="default" className="bg-blue-600">Acesso Concedido</Badge>;
    if (action.includes('revoked')) return <Badge variant="secondary">Acesso Revogado</Badge>;
    if (action.includes('promoted')) return <Badge variant="warning">Promoção</Badge>;
    if (action.includes('demoted')) return <Badge variant="secondary">Rebaixamento</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  }

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
            <h1 className="text-3xl font-bold text-white">Logs de Atividade</h1>
            <p className="text-muted-foreground">Monitore todas as ações realizadas pelos administradores.</p>
        </div>
         <div className="w-full sm:w-auto">
            <Input 
                placeholder="Buscar nos logs..."
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
              <TableHead>Admin</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="font-medium text-white">{log.adminEmail}</div>
                  </TableCell>
                  <TableCell>
                    {getActionBadge(log.action)}
                  </TableCell>
                  <TableCell>
                     <div className="flex flex-col">
                        <span className="font-medium text-white">{log.entityTitle}</span>
                        <span className="text-xs text-muted-foreground">{log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                     {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Nenhum log encontrado.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


export default function AdminLogsPage() {
    return (
        <AdminGuard>
            <AuditLogPage />
        </AdminGuard>
    )
}
