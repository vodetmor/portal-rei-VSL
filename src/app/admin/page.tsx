'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import AdminGuard from '@/components/admin/admin-guard';
import { collection, getDocs, deleteDoc, doc, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, Pencil } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
}

function AdminDashboard() {
  const firestore = useFirestore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [userCount, setUserCount] = useState(0);

  const fetchCourses = async () => {
    if (!firestore) return;
    const querySnapshot = await getDocs(collection(firestore, 'courses'));
    const coursesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Course[];
    setCourses(coursesData);
  };
  
  const fetchUserCount = async () => {
    if (!firestore) return;
    const querySnapshot = await getDocs(collection(firestore, 'users'));
    setUserCount(querySnapshot.size);
  };


  useEffect(() => {
    if (firestore) {
      fetchCourses();
      fetchUserCount();
    }
  }, [firestore]);

  const handleDelete = async (courseId: string) => {
    if (!firestore) return;
    if (confirm('Tem certeza que deseja excluir este curso?')) {
      try {
        await deleteDoc(doc(firestore, 'courses', courseId));
        // Note: This doesn't delete the video from Storage.
        // A Cloud Function would be needed for that to avoid exposing delete permissions to clients.
        fetchCourses(); 
      } catch (error) {
        console.error("Error deleting course: ", error);
        alert("Ocorreu um erro ao excluir o curso.");
      }
    }
  };
  

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
        <Button asChild>
          <Link href="/admin/add-course">
            <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
          </Link>
        </Button>
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
              Total de usuários cadastrados na plataforma.
            </p>
          </CardContent>
        </Card>
      </div>


      <div className="bg-secondary p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Gerenciar Cursos</h2>
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course.id} className="group relative flex items-center justify-between p-4 rounded-md bg-background/50 hover:bg-background transition-colors">
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
                <Button variant="destructive" size="icon" onClick={() => handleDelete(course.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {courses.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado.</p>}
        </div>
      </div>
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
