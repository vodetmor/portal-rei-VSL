'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CourseCardProps {
  title: string;
  imageUrl: string;
  imageHint: string;
  priority?: boolean;
}

export function CourseCard({ title, imageUrl, imageHint, priority = false }: CourseCardProps) {
  return (
    <div className="group relative block cursor-pointer overflow-hidden rounded-lg">
      <div className="aspect-video overflow-hidden">
        <Image
          src={imageUrl}
          alt={title}
          width={600}
          height={338}
          data-ai-hint={imageHint}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 p-4">
        <h3 className="font-bold text-white">{title}</h3>
      </div>
    </div>
  );
}
