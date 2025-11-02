'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, deleteDoc, DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

import AdminGuard from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, Upload, Link2, GripVertical } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface Module {
    id: string;
    title: string;
    thumbnailUrl: string;
    imageHint: string;
}

interface Course extends DocumentData {
  id: string;
  title: string;
  modules: Module[];
}

const DEFAULT_MODULE_IMAGE = "https://placehold.co/400x600/0f0f0f/b3b3b3?text=Module";

function EditCoursePageContent() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [modules, setModules] = useState<Module[]>([]);

  const fetchCourse = useCallback(async () => {
    if (!firestore || !courseId) return;
    setLoading(true);
    try {
      const courseRef = doc(firestore, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);

      if (courseSnap.exists()) {
        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        setCourse(courseData);
        setModules((courseData.modules || []).map(m => ({ ...m, id: m.id || uuidv4() })));
      } else {
        toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado." });
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      toast({ variant: "destructive", title: "Erro de Permissão", description: "Você não tem permissão para carregar este curso." });
    } finally {
      setLoading(false);
    }
  }, [firestore, courseId, router, toast]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);


  const addModule = () => {
    const newModule: Module = {
      id: uuidv4(),
      title: `Novo Módulo ${modules.length + 1}`,
      thumbnailUrl: DEFAULT_MODULE_IMAGE,
      imageHint: 'abstract'
    };
    setModules([...modules, newModule]);
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter(m => m.id !== moduleId));
  };
  
  const updateModuleField = <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => {
    setModules(modules.map(m => m.id === moduleId ? { ...m, [field]: value } : m));
  };


  const handleSaveChanges = async () => {
    if (!firestore || !courseId) return;
    setIsSaving(true);
    
    // Here we can also add logic to upload images for modules if they were changed.
    // For now, we just save the structure.

    try {
      const courseRef = doc(firestore, 'courses', courseId);
      await updateDoc(courseRef, {
        modules: modules.map(({ id, ...rest }) => rest), // Remove client-side id before saving
      });
      toast({ title: "Sucesso!", description: "A estrutura de módulos foi atualizada." });
    } catch (error) {
      console.error('Error updating course modules:', error);
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Ocorreu um erro ao salvar os módulos." });
    } finally {
      setIsSaving(false);
    }
  };
  

  if (loading) {
    return (
        <div className="container mx-auto px-4 py-8 pt-24 md:px-8 space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
  }
  
  if (!course) return null;

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2">
            <Link href={`/courses/${courseId}`}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Curso</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Gerenciar Módulos</h1>
          <p className="text-muted-foreground">Adicione, remova e edite os módulos do curso: <span className="font-semibold text-primary">{course.title}</span></p>
        </div>
        <Button onClick={handleSaveChanges} disabled={isSaving} size="sm"><Save className="mr-2 h-4 w-4" />{isSaving ? 'Salvando...' : 'Salvar Módulos'}</Button>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Estrutura de Módulos</CardTitle>
            <CardDescription>Arraste para reordenar, edite os detalhes de cada módulo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
              {modules.map((module, moduleIndex) => (
                <ModuleEditor 
                    key={module.id} 
                    module={module}
                    onUpdate={updateModuleField}
                    onRemove={removeModule}
                />
              ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addModule}><Plus className="mr-2 h-4 w-4" />Adicionar Módulo</Button>
        </CardContent>
      </Card>

    </div>
  );
}


// --- ModuleEditor Component ---

interface ModuleEditorProps {
    module: Module;
    onUpdate: <K extends keyof Module>(moduleId: string, field: K, value: Module[K]) => void;
    onRemove: (moduleId: string) => void;
}

function ModuleEditor({ module, onUpdate, onRemove }: ModuleEditorProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setUploadProgress(0); // Start progress
            // Simulate upload and get URL
            const storage = getStorage();
            const storageRef = ref(storage, `courses/modules/${module.id}/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => { console.error(error); setUploadProgress(null); },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        onUpdate(module.id, 'thumbnailUrl', downloadURL);
                        setUploadProgress(null);
                        setImageFile(null);
                    });
                }
            );
        }
    };

    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = event.target.value;
        onUpdate(module.id, 'thumbnailUrl', newUrl);
    };

    return (
        <div className="flex flex-col md:flex-row items-start gap-4 p-4 border rounded-lg bg-secondary/30">
            <div className="flex-shrink-0 flex items-center gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div className="relative aspect-[2/3] w-24 rounded-md overflow-hidden bg-muted">
                    <Image src={module.thumbnailUrl || DEFAULT_MODULE_IMAGE} alt={module.title} fill className="object-cover" />
                </div>
            </div>

            <div className="flex-grow w-full space-y-3">
                 <Input
                    placeholder="Título do Módulo"
                    value={module.title}
                    onChange={(e) => onUpdate(module.id, 'title', e.target.value)}
                    className="font-semibold"
                />

                <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'upload' | 'url')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="upload" className="text-xs">Enviar</TabsTrigger>
                        <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="mt-2">
                        <label htmlFor={`module-img-${module.id}`} className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                            <Upload className="h-3 w-3" /><span>{imageFile ? imageFile.name : 'Selecionar'}</span>
                        </label>
                        <Input id={`module-img-${module.id}`} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        {uploadProgress !== null && (<Progress value={uploadProgress} className="w-full h-1 mt-2" />)}
                    </TabsContent>
                    <TabsContent value="url" className="mt-2">
                        <div className="relative">
                            <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input type="text" placeholder="https://..." value={module.thumbnailUrl} onChange={handleUrlChange} className="w-full bg-background/50 pl-6 text-xs h-9"/>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Módulo?</AlertDialogTitle><AlertDialogDescription>Isso removerá "{module.title}" permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemove(module.id)}>Confirmar Exclusão</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


export default function EditCoursePage() {
    return (
        <AdminGuard>
            <EditCoursePageContent />
        </AdminGuard>
    )
}
