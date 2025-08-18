"use client"

import Image from "next/image"
import { Users } from "lucide-react"
import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const clients = [
  {
    name: "GamerPro",
    followers: "1.2M",
    imageUrl: "https://placehold.co/128x128.png",
    aiHint: "gaming logo"
  },
  {
    name: "StreamKing",
    followers: "890K",
    imageUrl: "https://placehold.co/128x128.png",
    aiHint: "crown logo"
  },
  {
    name: "TubeMasters",
    followers: "2.5M",
    imageUrl: "https://placehold.co/128x128.png",
    aiHint: "play button logo"
  },
  {
    name: "TweetGurus",
    followers: "500K",
    imageUrl: "https://placehold.co/128x128.png",
    aiHint: "bird logo"
  },
  {
    name: "InstaCreators",
    followers: "3.1M",
    imageUrl: "https://placehold.co/128x128.png",
    aiHint: "camera logo"
  },
];

const duplicatedClients = [...clients, ...clients, ...clients];

export function ClientsSection() {
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
    <section id="clientes" className="bg-background py-12 md:py-24">
      <div  ref={ref} className={cn('transition-all duration-1000 ease-out container mx-auto px-4 md:px-6', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10')}>
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Clientes que já trabalhei</h2>
        </div>
        
        <div className="relative w-full overflow-hidden group/carousel">
          <div className="flex animate-scroll-slow group-hover/carousel:paused">
            {duplicatedClients.map((client, index) => (
              <div key={index} className="flex flex-col items-center justify-start flex-shrink-0 w-48 p-4 mx-4 transition-transform duration-300 ease-in-out hover:scale-110 cursor-pointer">
                  <div className="relative w-32 h-32 mb-4">
                      <Image
                          src={client.imageUrl}
                          alt={`Logo of ${client.name}`}
                          width={128}
                          height={128}
                          className="rounded-full object-cover border-4 border-card"
                          data-ai-hint={client.aiHint}
                      />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{client.name}</h3>
                  <div className="flex items-center text-muted-foreground mt-1">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{client.followers}</span>
                  </div>
              </div>
            ))}
          </div>
           <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
