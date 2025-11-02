'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import AdminGuard from '@/components/admin/admin-guard';
import { collection, getDocs, deleteDoc, doc, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { UploadModal } from '@/components/admin/upload-modal';
import Image from 'next/image';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
}

function AdminDashboard() {
  const firestore = useFirestore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCourses = async () => {
    if (!firestore) return;
    const querySnapshot = await getDocs(collection(firestore, 'courses'));
    const coursesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Course[];
    setCourses(coursesData);
  };

  useEffect(() => {
    fetchCourses();
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
  
  const handleUploadSuccess = () => {
    fetchCourses();
    setIsModalOpen(false);
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
        </Button>
      </div>

      <div className="bg-secondary p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Gerenciar Cursos</h2>
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course.id} className="flex items-center justify-between p-4 rounded-md bg-background/50 hover:bg-background">
              <div className="flex items-center gap-4">
                <Image src={course.thumbnailUrl} alt={course.title} width={80} height={45} className="rounded-md object-cover aspect-video" />
                <span className="font-medium text-white">{course.title}</span>
              </div>
              <Button variant="destructive" size="icon" onClick={() => handleDelete(course.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {courses.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado.</p>}
        </div>
      </div>

      <UploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
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
