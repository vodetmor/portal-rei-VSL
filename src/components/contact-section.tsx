"use client"

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Icons } from "./icons"
import { Label } from '@/components/ui/label';

export function ContactSection() {
  const { toast } = useToast()
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('message', formData.message);
    data.append('_captcha', 'false');

    try {
      const response = await fetch('https://formsubmit.co/contato.hadess@gmail.com', {
        method: 'POST',
        body: data,
        headers: {
            'Accept': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Mensagem Enviada!",
          description: "Obrigado por entrar em contato. Retornarei em breve.",
        });
        setFormData({ name: '', email: '', message: '' }); // Reset form
      } else {
        throw new Error('Network response was not ok.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Ocorreu um erro.",
        description: "Não foi possível enviar sua mensagem. Tente novamente mais tarde.",
        variant: "destructive"
      });
    }
  };
  
  function onDiscordClick() {
    navigator.clipboard.writeText("@hades_god1");
    toast({
        title: "Copiado!",
        description: "Usuário do Discord copiado para a área de transferência.",
    });
  }

  return (
    <section id="contato" className="border-t border-border">
      <div ref={ref} className={cn('transition-all duration-1000 ease-out container mx-auto px-4 md:px-6', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10')}>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Vamos trabalhar juntos?</h2>
            <p className="text-muted-foreground md:text-xl/relaxed">
              Tem um projeto em mente? Preencha o formulário ou entre em contato direto para discutir sua ideia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild size="lg" className="shimmer-button bg-green-500 hover:bg-green-600 text-white">
                    <a href="https://wa.me/5524993078772" target="_blank" rel="noopener noreferrer">
                        <Icons.whatsapp className="w-6 h-6 mr-2" />
                        WhatsApp
                    </a>
                </Button>
                <Button size="lg" className="shimmer-button bg-[#5865F2] hover:bg-[#4f5bda] text-white" onClick={onDiscordClick}>
                    <Icons.discord className="w-6 h-auto mr-2" />
                    Discord: @hades_god1
                </Button>
            </div>
          </div>
          <div className="w-full">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" type="text" name="name" placeholder="Seu nome completo" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" name="email" placeholder="seu@email.com" value={formData.email} onChange={handleChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea id="message" name="message" placeholder="Descreva seu projeto ou sua ideia..." className="min-h-[120px]" value={formData.message} onChange={handleChange} required />
                 </div>
                <Button type="submit" size="lg" className="w-full shimmer-button">Enviar Mensagem</Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
