"use client"

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Twitch, Youtube, Twitter, Instagram, Building, Gamepad2 } from "lucide-react";

const clients = [
  { name: "GamerPro", icon: <Gamepad2 className="h-16 w-16" /> },
  { name: "StreamKing", icon: <Twitch className="h-16 w-16" /> },
  { name: "TubeMasters", icon: <Youtube className="h-16 w-16" /> },
  { name: "TweetGurus", icon: <Twitter className="h-16 w-16" /> },
  { name: "InstaCreators", icon: <Instagram className="h-16 w-16" /> },
  { name: "BizCorp", icon: <Building className="h-16 w-16" /> },
];

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
    <section id="clientes" className="bg-background border-t border-b border-border">
      <div ref={ref} className={cn('transition-opacity duration-1000 ease-out container mx-auto px-4 md:px-6', isVisible ? 'opacity-100' : 'opacity-0')}>
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Clientes</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Confiança e parceria com criadores e empresas de todos os tamanhos.
            </p>
          </div>
        </div>
        <div
          className="relative mt-12 w-full overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]"
        >
            <div className="scrolling-carousel">
                {[...clients, ...clients].map((client, index) => (
                    <div key={index} className="flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                        {client.icon}
                        <span className="font-semibold text-sm">{client.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </section>
  );
}
