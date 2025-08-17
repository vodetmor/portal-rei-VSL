"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ValorantBackground } from "./valorant-background"

export function HeroSection() {
  return (
    <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      <ValorantBackground />
      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center text-white">
        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in-up">
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
