'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import AdminGuard from '@/components/admin/admin-guard';
import { collection, getDocs, deleteDoc, doc, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, Pencil, BookOpen } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
}

function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    if (!firestore) return;
    try {
        const coursesQuery = await getDocs(collection(firestore, 'courses'));
        const coursesData = coursesQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        setCourses(coursesData);
        setCourseCount(coursesData.length);

        const usersQuery = await getDocs(collection(firestore, 'users'));
        setUserCount(usersQuery.size);

    } catch (e) {
        toast({
            variant: "destructive",
            title: "Erro de Permissão",
            description: "Não foi possível carregar os dados do painel. Verifique suas permissões."
        })
    }
  };

  useEffect(() => {
    if (firestore) {
      fetchData();
    }
  }, [firestore]);

  const handleDelete = async () => {
    if (!firestore || !courseToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'courses', courseToDelete));
      toast({
        title: "Curso Excluído",
        description: "O curso foi removido com sucesso.",
      })
      fetchData(); 
    } catch (error) {
      console.error("Error deleting course: ", error);
      toast({
        variant: "destructive",
        title: "Erro ao Excluir",
        description: "Não foi possível excluir o curso. Verifique as permissões."
      });
    } finally {
      setCourseToDelete(null);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 md:px-8">
      <div className="flex justify-between items-center mb-8 pt-20">
        <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
            <p className="text-xs text-muted-foreground">
              Total de usuários cadastrados.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cursos Totais</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseCount}</div>
            <p className="text-xs text-muted-foreground">
              Total de cursos na plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
      
       <div className="flex justify-end gap-4 mb-8">
          <Button asChild>
              <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" /> Gerenciar Usuários
              </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/add-course">
              <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
            </Link>
          </Button>
      </div>

      <AlertDialog>
        <div className="bg-secondary/50 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Gerenciar Cursos</h2>
          <div className="space-y-4">
            {courses.map(course => (
              <div key={course.id} className="group relative flex items-center justify-between p-4 rounded-md bg-background/50 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <Image src={course.thumbnailUrl} alt={course.title} width={80} height={45} className="rounded-md object-cover aspect-video" />
                  <span className="font-medium text-white">{course.title}</span>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button asChild variant="outline" size="icon">
                    <Link href={`/admin/edit-course/${course.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={() => setCourseToDelete(course.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </div>
              </div>
            ))}
            {courses.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado.</p>}
          </div>
        </div>
         <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso irá excluir permanentemente o curso.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPage() {
    return (
        <AdminGuard>
            <AdminDashboard />
        </AdminGuard>
    )
}
