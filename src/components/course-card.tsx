'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { Pencil, Play, Trash2, Link2, Upload, Save } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    thumbnailUrl?: string;
    imageHint: string;
  };
  priority?: boolean;
  isAdmin?: boolean;
  isEditing?: boolean;
  onUpdate?: (id: string, data: { title?: string; thumbnailUrl?: string }) => void;
  onDelete?: (id: string) => void;
}

export function CourseCard({ course, priority = false, isAdmin = false, isEditing = false, onUpdate, onDelete }: CourseCardProps) {
  const { toast } = useToast();
  const [tempTitle, setTempTitle] = useState(course.title);
  const [tempThumbnail, setTempThumbnail] = useState(course.thumbnailUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  };
  
  const handleTitleSave = () => {
    if (onUpdate && tempTitle !== course.title) {
      onUpdate(course.id, { title: tempTitle });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempThumbnail(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSave = async () => {
    if (!onUpdate || !imageFile) return;

    setUploadProgress(0);
    const storage = getStorage();
    const storageRef = ref(storage, `courses/${course.id}/${Date.now()}-${imageFile.name}`);
    const uploadTask = uploadBytesResumable(storageRef, imageFile);

    try {
        const downloadURL = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => reject(error),
                () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
            );
        });
        onUpdate(course.id, { thumbnailUrl: downloadURL });
        setImageFile(null);
    } catch(error) {
        toast({ variant: 'destructive', title: 'Falha no Upload', description: 'Não foi possível enviar a imagem.' });
    } finally {
        setUploadProgress(null);
    }
  };


  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
        onDelete(course.id);
    }
  };


  const finalImageUrl = tempThumbnail || `https://picsum.photos/seed/${course.id}/400/600`;
  
  const cardContent = (
    <>
        <Image
          src={finalImageUrl}
          alt={course.title}
          width={400}
          height={600}
          data-ai-hint={course.imageHint}
          priority={priority}
          className="object-cover transition-transform duration-300 ease-in-out h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Play className="h-12 w-12 text-white/80" fill="currentColor" />
        </div>

        <div className="absolute bottom-0 left-0 p-4 w-full">
            {isEditing && isAdmin ? (
                <div className="relative">
                    <Input 
                        value={tempTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleSave}
                        className="bg-background/80 border-primary/50 text-white font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); }}
                    />
                </div>
            ) : (
                <h3 className="font-semibold text-white transition-all duration-300 group-hover:text-primary">{course.title}</h3>
            )}
        </div>
    </>
  );
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
          "group relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-lg bg-card shadow-lg transition-transform",
          isEditing && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
        )}
    >
      {isEditing && isAdmin ? (
        <div className="block h-full w-full">{cardContent}</div>
      ) : (
        <Link href={`/courses/${course.id}`} className="block h-full w-full">
            {cardContent}
        </Link>
      )}
      
      {isAdmin && (
        <div className={cn(
            "absolute top-3 right-3 z-20 flex flex-col items-center gap-2",
            !isEditing && "opacity-0 group-hover:opacity-100 transition-opacity"
        )}>
          {isEditing ? (
              <div className='flex flex-col gap-2'>
                <label htmlFor={`img-${course.id}`} className="flex items-center justify-center h-9 w-9 cursor-pointer rounded-full bg-black/60 hover:bg-primary border border-white/20 text-white">
                    <Upload className="h-4 w-4" />
                </label>
                <Input id={`img-${course.id}`} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {imageFile && (
                    <Button size="icon" className="h-9 w-9 bg-green-600/80 hover:bg-green-500 border-white/20 text-white" onClick={handleImageSave}>
                       <Save className="h-4 w-4" />
                    </Button>
                )}
                {uploadProgress !== null && <Progress value={uploadProgress} className="w-9 h-1" />}
              </div>

          ) : (
            <Button asChild size="icon" className="h-9 w-9 bg-black/60 hover:bg-primary border-white/20 text-white">
                <Link href={`/admin/edit-course/${course.id}`}>
                    <Pencil className="h-4 w-4" />
                </Link>
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="h-9 w-9 bg-black/60 hover:bg-destructive/80 border-white/20">
                  <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso irá excluir permanentemente o curso e todos os seus dados.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={e => {e.stopPropagation();}}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </motion.div>
  );
}
