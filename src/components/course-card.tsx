'use client';

import Image from 'next/image';
import Link from 'next/link';

interface CourseCardProps {
  id: string;
  title: string;
  imageUrl: string;
  imageHint: string;
  priority?: boolean;
}

export function CourseCard({ id, title, imageUrl, imageHint, priority = false }: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`} className="group relative block cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-primary/20 hover:shadow-lg">
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
       {/* Remove title overlay for cleaner card design as per reference */}
    </Link>
  );
}
