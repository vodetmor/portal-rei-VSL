
'use client';
import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import AdminGuard from '@/components/admin/admin-guard';
import { collection, getDocs, deleteDoc, doc, addDoc, setDoc, DocumentData, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, Pencil, BookOpen, Link as LinkIcon, Copy, History } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { logAdminAction } from '@/lib/audit';

interface Course extends DocumentData {
  id: string;
  title: string;
  thumbnailUrl: string;
}

interface PremiumLink extends DocumentData {
    id: string;
    name: string;
    courseIds: string[];
}

function AdminDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [premiumLinks, setPremiumLinks] = useState<PremiumLink[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);
  const [itemToDelete, setItemToDelete] = useState<{id: string; title: string, type: 'course' | 'link'} | null>(null);

  // State for the "Create Premium Link" dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    if (!firestore) return;
    try {
        const coursesQuery = await getDocs(collection(firestore, 'courses'));
        const coursesData = coursesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
        setCourses(coursesData);
        setCourseCount(coursesData.length);

        const linksQuery = await getDocs(collection(firestore, 'premiumLinks'));
        setPremiumLinks(linksQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as PremiumLink)));

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
  }, [firestore, toast]);
  
  const handleAddCourse = async () => {
    if (!firestore || !user) return;
    try {
      const newCourseData = {
        title: "Novo Curso (Rascunho)",
        description: "Adicione uma descrição incrível para o seu novo curso.",
        thumbnailUrl: "https://i.imgur.com/1X3ta7W.png",
        imageHint: 'placeholder',
        createdAt: serverTimestamp(),
        modules: [],
      };
      const docRef = await addDoc(collection(firestore, 'courses'), newCourseData);
      
      await logAdminAction(firestore, user, 'course_created', {
        type: 'Course',
        id: docRef.id,
        title: newCourseData.title,
      });

      toast({
        title: "Rascunho Criado!",
        description: "Seu novo curso foi iniciado. Agora edite os detalhes.",
      });
      router.push(`/admin/edit-course/${docRef.id}`);
    } catch (error) {
       console.error("Error creating new course draft: ", error);
       toast({
        variant: "destructive",
        title: "Erro ao Criar Rascunho",
        description: "Não foi possível criar o rascunho do curso."
      });
    }
  };

  const handleDelete = async () => {
    if (!firestore || !itemToDelete || !user) return;
    const { id, type, title } = itemToDelete;
    const collectionName = type === 'course' ? 'courses' : 'premiumLinks';

    try {
      await deleteDoc(doc(firestore, collectionName, id));
      
      await logAdminAction(firestore, user, `${type}_deleted`, {
        type: type === 'course' ? 'Course' : 'Premium Link',
        id: id,
        title: title,
      });

      toast({
        title: `${type === 'course' ? 'Curso' : 'Link'} Excluído`,
        description: `O ${type === 'course' ? 'curso' : 'link'} foi removido com sucesso.`,
      })
      fetchData(); 
    } catch (error) {
      console.error(`Error deleting ${type}: `, error);
      toast({
        variant: "destructive",
        title: "Erro ao Excluir",
        description: `Não foi possível excluir o ${type}. Verifique as permissões.`
      });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleCreatePremiumLink = async () => {
    if (!firestore || !newLinkName.trim() || !user) {
        toast({ variant: "destructive", title: "Erro", description: "O nome do link é obrigatório." });
        return;
    }
    const courseIds = Object.keys(selectedCourses).filter(id => selectedCourses[id]);
    if (courseIds.length === 0) {
        toast({ variant: "destructive", title: "Erro", description: "Selecione pelo menos um curso." });
        return;
    }

    try {
        const newLink = { name: newLinkName, courseIds };
        const docRef = await addDoc(collection(firestore, 'premiumLinks'), newLink);
        
        await logAdminAction(firestore, user, 'premium_link_created', {
            type: 'Premium Link',
            id: docRef.id,
            title: newLink.name
        })

        toast({ title: "Sucesso!", description: "Link premium criado." });
        setNewLinkName('');
        setSelectedCourses({});
        setIsLinkDialogOpen(false);
        fetchData();
    } catch (error) {
        console.error("Error creating premium link: ", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar o link." });
    }
  };

  const copyLinkToClipboard = (id: string) => {
    const url = `${window.location.origin}/premium/${id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copiado!", description: "O link de acesso foi copiado para a área de transferência." });
  }
  
  return (
    <div className="container mx-auto px-4 py-8 md:px-8 space-y-8">
      <div className="flex justify-between items-center pt-24">
        <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      
       <div className="flex justify-end gap-4">
          <Button asChild>
              <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" /> Gerenciar Usuários
              </Link>
          </Button>
           <Button asChild variant="secondary">
              <Link href="/admin/logs">
                  <History className="mr-2 h-4 w-4" /> Ver Logs de Atividade
              </Link>
          </Button>
      </div>

       {/* Premium Links & Courses Section */}
       <AlertDialog>
        <div className="space-y-8">
          {/* Premium Links Section */}
          <div className="bg-secondary/30 p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Links de Acesso Premium</h2>
                <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Criar Link</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Link de Acesso</DialogTitle>
                      <DialogDescription>Dê um nome ao link e selecione os cursos que ele irá liberar.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="link-name">Nome do Link</Label>
                            <Input id="link-name" value={newLinkName} onChange={e => setNewLinkName(e.target.value)} placeholder="Ex: Pacote VSL Completo" />
                        </div>
                        <div>
                            <Label>Cursos Inclusos</Label>
                            <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border p-4 mt-2">
                                {courses.map(course => (
                                    <div key={course.id} className="flex items-center gap-3">
                                        <Checkbox id={`course-${course.id}`} checked={selectedCourses[course.id] || false} onCheckedChange={checked => setSelectedCourses(prev => ({ ...prev, [course.id]: !!checked }))} />
                                        <Label htmlFor={`course-${course.id}`} className="font-normal">{course.title}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                      <Button onClick={handleCreatePremiumLink}>Criar Link</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2">
                {premiumLinks.map(link => (
                  <div key={link.id} className="group relative flex items-center justify-between p-3 rounded-md bg-background/50 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="h-5 w-5 text-primary" />
                      <span className="font-medium text-white">{link.name}</span>
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="icon" onClick={() => copyLinkToClipboard(link.id)}><Copy className="h-4 w-4" /></Button>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => setItemToDelete({ id: link.id, type: 'link', title: link.name })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </div>
                  </div>
                ))}
                {premiumLinks.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum link premium criado.</p>}
              </div>
            </div>

            {/* Courses Section */}
            <div className="bg-secondary/50 p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Gerenciar Cursos</h2>
                 <Button onClick={handleAddCourse}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Curso
                 </Button>
              </div>
              <div className="space-y-4">
                {courses.map(course => (
                  <div key={course.id} className="group relative flex items-center justify-between p-4 rounded-md bg-background/50 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Image src={course.thumbnailUrl || 'https://i.imgur.com/1X3ta7W.png'} alt={course.title} width={80} height={45} className="rounded-md object-cover aspect-video" />
                      <span className="font-medium text-white">{course.title}</span>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button asChild variant="outline" size="icon">
                        <Link href={`/admin/edit-course/${course.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => setItemToDelete({ id: course.id, type: 'course', title: course.title})}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </div>
                  </div>
                ))}
                {courses.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum curso encontrado.</p>}
              </div>
            </div>
          </div>
          
         <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso irá excluir permanentemente o {itemToDelete?.type === 'course' ? 'curso' : 'link'}
                <span className="font-bold text-white"> {itemToDelete?.title}</span>.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
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
