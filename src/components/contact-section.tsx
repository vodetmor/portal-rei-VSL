"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Icons } from "./icons"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "O nome deve ter pelo menos 2 caracteres.",
  }),
  email: z.string().email({
    message: "Por favor, insira um email válido.",
  }),
  message: z.string().min(10, {
    message: "A mensagem deve ter pelo menos 10 caracteres.",
  }).max(500, {
    message: "A mensagem não pode ter mais de 500 caracteres.",
  })
})

export function ContactSection() {
  const { toast } = useToast()
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
    toast({
      title: "Mensagem Enviada!",
      description: "Obrigado por entrar em contato. Retornarei em breve.",
    })
    form.reset();
  }
  
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
                        <Icons.whatsapp className="h-6 w-6 mr-2" />
                        WhatsApp
                    </a>
                </Button>
                <Button size="lg" variant="secondary" className="shimmer-button bg-[#5865F2] hover:bg-[#4f5bda] text-white" onClick={onDiscordClick}>
                    <Icons.discord className="h-6 w-6 mr-2" />
                    Discord: @hades_god1
                </Button>
            </div>
          </div>
          <div className="w-full">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva seu projeto ou sua ideia..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" className="w-full shimmer-button">Enviar Mensagem</Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </section>
  )
}
