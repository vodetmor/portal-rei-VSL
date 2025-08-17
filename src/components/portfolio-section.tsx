"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

const videos = [
  { id: "U_p_C4S2bI4", title: "Highlight Reel 1", type: "16:9" },
  { id: "gXladzI4D68", title: "Shorts Clip 1", type: "9:16" },
  { id: "wYqNy6h0Wd0", title: "Gameplay Edit", type: "16:9" },
  { id: "S3_eL4Q6nL4", title: "Tutorial Motion", type: "16:9" },
  { id: "V9dYj4vLxbI", title: "Shorts Clip 2", type: "9:16" },
  { id: "cWGE9g2bKCM", title: "Client Project", type: "16:9" },
];

function VideoPlayer({ videoId, title, type }: { videoId: string, title: string, type: '16:9' | '9:16' }) {
    const [isClicked, setIsClicked] = useState(false);
    const isShort = type === '9:16';
  
    if (isClicked) {
      return (
        <div className={cn("w-full h-full", isShort ? 'aspect-[9/16]' : 'aspect-video')}>
            <iframe
                className="w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        </div>
      );
    }
  
    return (
      <div
        className={cn(
          "relative w-full h-full cursor-pointer group overflow-hidden rounded-lg shadow-lg",
          isShort ? 'aspect-[9/16]' : 'aspect-video'
        )}
        onClick={() => setIsClicked(true)}
      >
        <Image
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          alt={`Thumbnail for ${title}`}
          width={isShort ? 405 : 1280}
          height={isShort ? 720 : 720}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 opacity-0 group-hover:opacity-100">
          <PlayCircle className="w-16 h-16 text-white/80 drop-shadow-lg" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
            <h3 className="font-bold text-lg text-white drop-shadow-md">{title}</h3>
        </div>
      </div>
    );
  }

export function PortfolioSection() {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
            }
        },
        { threshold: 0.1 }
        );

        if (ref.current) {
        observer.observe(ref.current);
        }

        return () => {
        if (ref.current) {
            observer.unobserve(ref.current);
        }
        };
    }, []);

  return (
    <section id="trabalho" className="bg-card">
        <div ref={ref} className={cn('transition-all duration-1000 ease-out container mx-auto px-4 md:px-6', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10')}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Meu Trabalho</h2>
                    <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Uma amostra dos meus projetos mais recentes, de clipes rápidos a vídeos completos.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video, index) => (
                    <div key={video.id} className={cn(
                        "transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-primary/20 hover:shadow-2xl",
                        video.type === '9:16' ? 'sm:col-span-1' : 'sm:col-span-2'
                    )}>
                        <VideoPlayer videoId={video.id} title={video.title} type={video.type} />
                    </div>
                ))}
            </div>
      </div>
    </section>
  )
}
