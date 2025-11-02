'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { Pencil, Play, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CourseCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  imageHint: string;
  priority?: boolean;
  isAdmin?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function CourseCard({ id, title, imageUrl, imageHint, priority = false, isAdmin = false, onEdit, onDelete }: CourseCardProps) {
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if(onDelete) {
      onDelete(id);
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(id);
    }
  };


  const finalImageUrl = imageUrl || `https://picsum.photos/seed/${id}/400/600`;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-lg bg-card shadow-lg transition-transform"
    >
      <Link href={`/courses/${id}`} className="block h-full w-full">
        <Image
          src={finalImageUrl}
          alt={title}
          width={400}
          height={600}
          data-ai-hint={imageHint}
          priority={priority}
          className="object-cover transition-transform duration-300 ease-in-out h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Play className="h-12 w-12 text-white/80" fill="currentColor" />
        </div>

        <div className="absolute bottom-0 left-0 p-4">
            <h3 className="font-semibold text-white transition-all duration-300 group-hover:text-primary">{title}</h3>
        </div>
      </Link>
      
      {isAdmin && (
        <div className="absolute top-3 right-3 z-20 flex flex-col items-center gap-2 transition-opacity duration-300">
          <Button 
            size="icon" 
            className="h-9 w-9 bg-black/60 hover:bg-primary border-white/20 text-white"
            onClick={onEdit ? handleEditClick : undefined}
          >
              <Pencil className="h-4 w-4" />
          </Button>
          {onDelete && (
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="h-9 w-9 bg-black/60 hover:bg-destructive/80 border-white/20" onClick={handleDeleteClick}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
          )}
        </div>
      )}
    </motion.div>
  );
}
