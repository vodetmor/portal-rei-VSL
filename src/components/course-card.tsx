'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CourseCardProps {
  id: string;
  title: string;
  imageUrl: string;
  imageHint: string;
  priority?: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export function CourseCard({ id, title, imageUrl, imageHint, priority = false, isAdmin = false, onDelete }: CourseCardProps) {
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if(onDelete) {
      onDelete(id);
    }
  }
  
  return (
    <div className="group relative block h-full overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-primary/20 hover:shadow-lg">
      <Link href={`/courses/${id}`} className="cursor-pointer h-full flex flex-col">
        <div className="aspect-[3/4] overflow-hidden">
          <Image
            src={imageUrl}
            alt={title}
            width={400}
            height={533}
            data-ai-hint={imageHint}
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
      </Link>
      {isAdmin && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button asChild size="icon" className="h-9 w-9">
            <Link href={`/admin/edit-course/${id}`} onClick={(e) => e.stopPropagation()}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          {onDelete && (
            <Button variant="destructive" size="icon" className="h-9 w-9" onClick={handleDeleteClick}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
