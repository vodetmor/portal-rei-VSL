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
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

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
  isLocked?: boolean;
  onUpdate?: (id: string, data: { title?: string; thumbnailUrl?: string }) => void;
  onDelete?: (id: string) => void;
}

export function CourseCard({ course, priority = false, isAdmin = false, isEditing = false, isLocked = false, onUpdate, onDelete }: CourseCardProps) {
  const { toast } = useToast();
  const [tempTitle, setTempTitle] = useState(course.title);
  const [tempThumbnailUrl, setTempThumbnailUrl] = useState(course.thumbnailUrl || '');
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
    if (file && onUpdate) {
      setImageFile(file);
      
      // Start upload immediately
      setUploadProgress(0);
      const storage = getStorage();
      const storageRef = ref(storage, `courses/${course.id}/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          toast({ variant: 'destructive', title: 'Falha no Upload', description: 'Não foi possível enviar a imagem.' });
          setUploadProgress(null);
          setImageFile(null);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            onUpdate(course.id, { thumbnailUrl: downloadURL });
            setTempThumbnailUrl(downloadURL); // Update local preview
          });
          setUploadProgress(null);
          setImageFile(null);
        }
      );
    }
  };

  const handleUrlSave = () => {
    if (onUpdate && tempThumbnailUrl !== course.thumbnailUrl) {
        onUpdate(course.id, { thumbnailUrl: tempThumbnailUrl })
    }
  }

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
        onDelete(course.id);
    }
  };


  const finalImageUrl = tempThumbnailUrl || `https://picsum.photos/seed/${course.id}/400/600`;
  
  const cardContent = (
    <>
        <Image
          src={isEditing ? finalImageUrl : (course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/400/600`)}
          alt={course.title}
          width={400}
          height={600}
          data-ai-hint={course.imageHint}
          priority={priority}
          className={cn(
              "object-cover transition-transform duration-300 ease-in-out h-full w-full",
              isLocked && "grayscale"
            )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {!isLocked && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <Play className="h-12 w-12 text-white/80" fill="currentColor" />
            </div>
        )}

        <div className="absolute bottom-0 left-0 p-4 w-full">
            {isEditing && isAdmin ? (
                <div className="relative">
                    <Input 
                        value={tempTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleSave}
                        className="bg-background/80 border-primary/50 text-white font-semibold"
                        onKeyDown={(e) => { if (e.key === 'Enter') {e.preventDefault(); (e.target as HTMLInputElement).blur();} }}
                    />
                </div>
            ) : (
                <h3 className="font-semibold text-white transition-all duration-300 group-hover:text-primary">{course.title}</h3>
            )}
        </div>
    </>
  );
  
  const WrapperComponent = isLocked ? 'div' : Link;
  const wrapperProps = isLocked ? {} : { href: `/courses/${course.id}` };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: isLocked ? 1 : 1.05, zIndex: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
          "group relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-lg transition-transform",
          isEditing && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
          isLocked ? "cursor-not-allowed" : "cursor-pointer"
        )}
    >
        <WrapperComponent {...wrapperProps} className="block h-full w-full">
          {cardContent}
        </WrapperComponent>
      
      {isAdmin && !isLocked && (
        <div className={cn(
            "absolute top-3 right-3 z-20 flex flex-col items-center gap-2",
            !isEditing && "opacity-0 group-hover:opacity-100 transition-opacity"
        )}>
          {isEditing ? (
              <div className='flex flex-col gap-2'>
                <label htmlFor={`img-upload-${course.id}`} className="flex items-center justify-center h-9 w-9 cursor-pointer rounded-full bg-black/60 hover:bg-primary border border-white/20 text-white">
                    <Upload className="h-4 w-4" />
                </label>
                <Input id={`img-upload-${course.id}`} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 bg-black/60 hover:bg-primary border border-white/20 text-white">
                           <Link2 className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" side="left">
                        <div className="grid gap-2">
                           <p className="text-xs text-muted-foreground">Cole a URL da imagem</p>
                            <Input
                                value={tempThumbnailUrl}
                                onChange={(e) => setTempThumbnailUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') {e.preventDefault(); handleUrlSave(); (e.target as HTMLInputElement).blur();} }}
                                className="h-8 text-xs"
                                placeholder="https://..."
                            />
                             <Button onClick={handleUrlSave} size="sm" className="h-7 text-xs">Salvar URL</Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {uploadProgress !== null && <Progress value={uploadProgress} className="w-9 h-1 bg-background/50" />}
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
