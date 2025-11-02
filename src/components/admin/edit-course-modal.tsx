'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, type DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link2, Trash2, Check, Star, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';

const editCourseSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
  isFeatured: z.boolean().default(false),
});

type EditCourseFormValues = z.infer<typeof editCourseSchema>;

interface Course extends DocumentData {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  isFeatured?: boolean;
}

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  onCourseUpdate: () => void;
}

const DEFAULT_COURSE_IMAGE = "https://picsum.photos/seed/default-course/400/600";

export function EditCourseModal({ isOpen, onClose, course, onCourseUpdate }: EditCourseModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  
  const [tempImage, setTempImage] = useState(course?.thumbnailUrl || DEFAULT_COURSE_IMAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');

  const form = useForm<EditCourseFormValues>({
    resolver: zodResolver(editCourseSchema),
  });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        description: course.description || '',
        isFeatured: course.isFeatured || false,
      });
      setTempImage(course.thumbnailUrl || DEFAULT_COURSE_IMAGE);
      setImageUrlInput(course.thumbnailUrl || '');
    }
  }, [course, form, isOpen]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setImageUrlInput(newUrl);
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      setTempImage(newUrl);
    }
  };

  const handleRemoveImage = () => {
    setTempImage(DEFAULT_COURSE_IMAGE);
    setImageUrlInput('');
    setImageFile(null);
  };

  const onSubmit = async (data: EditCourseFormValues) => {
    if (!firestore || !course) return;
    setIsSaving(true);
    setUploadProgress(null);

    let finalImageUrl = tempImage;
    
    if (imageInputMode === 'upload' && imageFile) {
        const storage = getStorage();
        const storageRef = ref(storage, `courses/${course.id}/${Date.now()}-${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        finalImageUrl = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => {
                    console.error("Upload failed:", error);
                    toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar a imagem." });
                    reject(error);
                },
                () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
            );
        }).catch(() => {
            setIsSaving(false);
            return '';
        });

    } else if (imageInputMode === 'url') {
        finalImageUrl = imageUrlInput;
    }

    if (!finalImageUrl) {
        toast({ variant: "destructive", title: "Erro", description: "Nenhuma imagem válida foi fornecida." });
        setIsSaving(false);
        return;
    }

    const courseRef = doc(firestore, 'courses', course.id);
    try {
      const dataToSave = {
        title: data.title,
        description: data.description,
        thumbnailUrl: finalImageUrl,
        isFeatured: data.isFeatured,
      };

      await updateDoc(courseRef, dataToSave);
      
      toast({ title: "Sucesso!", description: "O curso foi atualizado." });
      onCourseUpdate();
      onClose();

    } catch (error) {
      console.error("Error updating course:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar as alterações." });
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
      setImageFile(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
            <DialogTitle>Editar Curso: {course?.title}</DialogTitle>
            <DialogDescription>
                Faça alterações no curso abaixo.
            </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <div className="space-y-6 p-1">
            <Form {...form}>
                <form id="edit-course-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                     <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Título</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Descrição</FormLabel>
                                <FormControl><Textarea {...field} rows={4} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="isFeatured"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-primary" /> 
                                        Curso em Destaque
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">
                                        Marque para exibir este curso na seção de destaques.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Imagem da Miniatura</h3>
                <div className="aspect-[2/3] w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-muted relative">
                    <Image src={tempImage} alt="Pré-visualização da miniatura" fill className="object-cover"/>
                </div>
                <div className="w-full max-w-xs mx-auto space-y-2">
                    <Tabs value={imageInputMode} onValueChange={(value) => setImageInputMode(value as 'upload' | 'url')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
                            <TabsTrigger value="url">Usar URL</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="mt-4">
                            <label htmlFor="course-image-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
                                <Upload className="h-4 w-4" />
                                <span>{imageFile ? imageFile.name : 'Clique para selecionar'}</span>
                            </label>
                            <Input id="course-image-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            {uploadProgress !== null && imageInputMode === 'upload' && (
                                <Progress value={uploadProgress} className="w-full h-2 mt-2" />
                            )}
                        </TabsContent>
                        <TabsContent value="url" className="mt-4">
                            <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="https://exemplo.com/imagem.png"
                                    value={imageUrlInput}
                                    onChange={handleUrlInputChange}
                                    className="w-full bg-background/50 pl-9"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                    <Button onClick={handleRemoveImage} variant="outline" size="sm" className="w-full gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Remover Imagem
                    </Button>
                </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" form="edit-course-form" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
