'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, getDoc, updateDoc, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { CourseCard } from '@/components/course-card';
import { Plus, Pencil, Save, X, Upload, Link2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface Module {
    id: string;
    title: string;
    thumbnailUrl: string;
    imageHint: string;
}
  
interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  heroImageUrl?: string;
}

const DEFAULT_HERO_IMAGE = "https://picsum.photos/seed/default-hero/1920/1080";

export default function CoursePlayerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Temp states for editing
  const [tempHeroImage, setTempHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImageUrlInput, setHeroImageUrlInput] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const fetchCourse = useCallback(async () => {
    if (!firestore || !courseId) return;
    setLoading(true);
    try {
      const courseRef = doc(firestore, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);

      if (courseSnap.exists()) {
        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        setCourse(courseData);
        setTempTitle(courseData.title);
        setTempHeroImage(courseData.heroImageUrl || DEFAULT_HERO_IMAGE);
        setHeroImageUrlInput(courseData.heroImageUrl || '');
      } else {
        toast({ variant: "destructive", title: "Erro", description: "Curso não encontrado."});
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      toast({ variant: "destructive", title: "Erro de Permissão", description: "Você não tem permissão para ver este curso."});
    } finally {
      setLoading(false);
    }
  }, [firestore, courseId, toast, router]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user && firestore) {
        if (user.email === 'admin@reidavsl.com') {
          setIsAdmin(true);
          return;
        }
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          }
        } catch (error) {
          // Non-admin, ignore permission error for reading own role
        }
      }
    };
    checkAdmin();
  }, [user, firestore]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // Edit Mode Handlers
  const enterEditMode = () => setIsEditMode(true);
  const cancelEditMode = () => {
    setIsEditMode(false);
    if (course) {
      setTempTitle(course.title);
      setTempHeroImage(course.heroImageUrl || DEFAULT_HERO_IMAGE);
      setHeroImageUrlInput(course.heroImageUrl || '');
    }
    setHeroImageFile(null);
    setUploadProgress(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setTempHeroImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setHeroImageUrlInput(newUrl);
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      setTempHeroImage(newUrl);
    }
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !courseId) return;
    setIsSaving(true);
    setUploadProgress(null);

    let finalHeroImageUrl = tempHeroImage;
    try {
        if (imageInputMode === 'upload' && heroImageFile) {
            const storage = getStorage();
            const storageRef = ref(storage, `courses/${courseId}/hero/${Date.now()}-${heroImageFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, heroImageFile);
            
            finalHeroImageUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    (error) => reject(error),
                    () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
                );
            });
        } else if (imageInputMode === 'url') {
            finalHeroImageUrl = heroImageUrlInput;
        }

        const courseRef = doc(firestore, 'courses', courseId);
        const dataToSave = {
            title: tempTitle,
            heroImageUrl: finalHeroImageUrl,
        };

        await updateDoc(courseRef, dataToSave);

        setCourse(prev => prev ? { ...prev, ...dataToSave } : null);
        toast({ title: "Sucesso!", description: "O curso foi atualizado." });
        setIsEditMode(false);

    } catch (error) {
        console.error('Error saving course:', error);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar as alterações." });
        const permissionError = new FirestorePermissionError({ path: `courses/${courseId}`, operation: 'update', requestResourceData: { title: tempTitle, heroImageUrl: finalHeroImageUrl } });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsSaving(false);
        setUploadProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 md:px-8">
        <Skeleton className="h-[40vh] w-full mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] w-full" />)}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Curso não encontrado ou você não tem permissão para acessá-lo.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className={cn(
        "relative flex h-[50vh] min-h-[350px] w-full items-center justify-center text-center",
        isEditMode && "border-2 border-dashed border-primary/50"
      )}>
        <div className="absolute inset-0 z-0">
          <Image
            src={tempHeroImage}
            alt={course.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 p-4">
            {isEditMode ? (
                 <Input 
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="text-4xl md:text-6xl font-bold tracking-tight text-white bg-transparent border-2 border-dashed text-center"
                 />
            ) : (
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">{course.title}</h1>
            )}
        </div>
        
        {isAdmin && !isEditMode && (
          <div className="absolute top-24 right-8 z-20">
            <Button onClick={enterEditMode} variant="outline"><Pencil className="mr-2 h-4 w-4" /> Editar Curso</Button>
          </div>
        )}

        {isAdmin && isEditMode && (
          <div className="absolute bottom-8 right-8 z-20 flex flex-col gap-2 items-end">
            <div className="flex gap-2">
                <Button onClick={handleSaveChanges} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? 'Salvando...' : 'Salvar'}</Button>
                <Button onClick={cancelEditMode} variant="secondary"><X className="mr-2 h-4 w-4" /> Cancelar</Button>
            </div>
             <div className="w-full max-w-xs p-4 rounded-lg bg-background/80 border border-border backdrop-blur-sm space-y-2">
                <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'upload' | 'url')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Enviar</TabsTrigger><TabsTrigger value="url">URL</TabsTrigger></TabsList>
                    <TabsContent value="upload" className="mt-4">
                        <label htmlFor="hero-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-2 justify-center bg-background/50">
                            <Upload className="h-4 w-4" /><span>{heroImageFile ? heroImageFile.name : 'Selecione a imagem'}</span>
                        </label>
                        <Input id="hero-image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        {uploadProgress !== null && imageInputMode === 'upload' && (<Progress value={uploadProgress} className="w-full h-2 mt-2" />)}
                    </TabsContent>
                    <TabsContent value="url" className="mt-4">
                        <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" placeholder="https://exemplo.com/imagem.png" value={heroImageUrlInput} onChange={handleUrlInputChange} className="w-full bg-background/50 pl-9"/>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
          </div>
        )}
      </section>

      {/* Modules Grid */}
      <section className="container mx-auto px-4 py-12 md:px-8">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <TrophyIcon className="h-8 w-8 text-primary" />
                <div>
                    <h2 className="text-xl font-bold text-white">{course.title}</h2>
                    <p className="text-sm text-muted-foreground">Monster Copy ®</p>
                </div>
            </div>
             {isAdmin && isEditMode && (
                <Button asChild>
                    <Link href={`/admin/edit-course/${courseId}`}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar/Gerenciar Módulos
                    </Link>
                </Button>
            )}
        </div>
        
        {course.modules && course.modules.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {course.modules.map((module, index) => (
                // Here we will eventually link to the module player
                // For now, it's just a visual card.
              <CourseCard
                key={module.id || index}
                course={{ ...module, id: module.id || `module-${index}` }}
                priority={index < 5}
                isAdmin={false} // Editing happens at the course level for now
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 rounded-lg bg-secondary/50">
            <p className="text-muted-foreground">Nenhum módulo encontrado para este curso.</p>
            {isAdmin && isEditMode && (
                 <Button asChild className="mt-4">
                    <Link href={`/admin/edit-course/${courseId}`}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Módulo
                    </Link>
                </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

    