'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { Pencil } from 'lucide-react';

interface CourseCardProps {
  id: string;
  title: string;
  imageUrl: string;
  imageHint: string;
  priority?: boolean;
  isAdmin?: boolean;
}

export function CourseCard({ id, title, imageUrl, imageHint, priority = false, isAdmin = false }: CourseCardProps) {
  return (
    <div className="group relative block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-primary/20 hover:shadow-lg">
      <Link href={`/courses/${id}`} className="cursor-pointer">
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
        <Button asChild size="sm" className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/admin/edit-course/${id}`}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Link>
        </Button>
      )}
    </div>
  );
}
