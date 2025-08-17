"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ValorantBackground } from "./valorant-background"

export function HeroSection() {
  return (
    <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      <ValorantBackground />
      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center text-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center space-y-4 animate-fade-in-up">
            <div className="mb-4">
                <Image
                    src="https://placehold.co/160x160.png"
                    alt="Hades Profile Picture"
                    width={160}
                    height={160}
                    className="rounded-full border-4 border-primary/50 shadow-lg"
                    data-ai-hint="hades logo"
                />
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase font-headline bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-lg">
                Hades
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-gray-200 drop-shadow-md">
                Editor de vídeos que transforma suas jogadas em obras de arte.
            </p>
            <div className="pt-6">
                <Button asChild size="lg" className="shimmer-button text-lg px-8 py-6">
                    <Link href="#contato">Fale Comigo</Link>
                </Button>
            </div>
        </div>
      </div>
    </section>
  )
}
