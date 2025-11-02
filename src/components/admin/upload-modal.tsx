'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '../ui/progress';
import { Label } from '../ui/label';

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"];

const uploadSchema = z.object({
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
  video: z.instanceof(File).refine(file => file.size > 0, "O arquivo de vídeo é obrigatório.")
    .refine(file => ACCEPTED_VIDEO_TYPES.includes(file.type), ".mp4, .webm e .ogg são os formatos aceitos."),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const firestore = useFirestore();
  const storage = getStorage();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: '',
      description: '',
      video: new File([], ""),
    },
  });

  const onSubmit = async (data: UploadFormValues) => {
    if (!firestore) return;
    setIsUploading(true);

    const videoFile = data.video;
    const videoId = uuidv4();
    const storageRef = ref(storage, `courses/${videoId}/${videoFile.name}`);
    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        alert("Falha no upload do vídeo. Tente novamente.");
        setIsUploading(false);
        setUploadProgress(null);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          // For simplicity, using a placeholder thumbnail.
          // A real implementation would generate a thumbnail from the video
          // or allow a separate thumbnail upload.
          const thumbnailUrl = `https://picsum.photos/seed/${videoId}/600/338`;

          await addDoc(collection(firestore, 'courses'), {
            title: data.title,
            description: data.description,
            videoUrl: downloadURL,
            thumbnailUrl: thumbnailUrl,
            duration: 0, // Placeholder, would be extracted from video metadata
            order: 0, // Placeholder for ordering
            isFeatured: false, // Default value
            createdAt: new Date(),
          });

          onUploadSuccess();
          form.reset();
        }).catch((error) => {
             console.error("Failed to get download URL:", error);
             alert("Falha ao obter URL do vídeo. Tente novamente.");
        }).finally(() => {
            setIsUploading(false);
            setUploadProgress(null);
        });
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Curso</DialogTitle>
          <DialogDescription>
            Preencha os detalhes e faça o upload do vídeo do curso.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Título do Curso</FormLabel>
                        <FormControl>
                            <Input placeholder="Ex: VSL do Zero ao Lançamento" {...field} disabled={isUploading} />
                        </FormControl>
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
                        <FormControl>
                            <Textarea placeholder="Descreva o que o aluno irá aprender..." {...field} disabled={isUploading}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="video"
                    render={({ field: { onChange, value, ...rest }}) => (
                        <FormItem>
                        <FormLabel>Arquivo de Vídeo</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                accept="video/mp4,video/webm,video/ogg"
                                onChange={(e) => onChange(e.target.files?.[0])} 
                                {...rest}
                                disabled={isUploading}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {isUploading && uploadProgress !== null && (
                    <div className="space-y-2">
                        <Label>Progresso do Upload</Label>
                        <Progress value={uploadProgress} />
                        <p className="text-sm text-muted-foreground text-center">{Math.round(uploadProgress)}%</p>
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isUploading}>
                        {isUploading ? 'Enviando...' : 'Salvar Curso'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
