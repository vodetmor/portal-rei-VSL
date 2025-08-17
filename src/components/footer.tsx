import Link from "next/link"
import { Icons } from "./icons"

export function Footer() {
  return (
    <footer className="bg-card text-card-foreground py-6 px-4 md:px-6 border-t border-border">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Hades. Todos os direitos reservados.</p>
        <nav className="flex gap-4 sm:gap-6">
          <Link href="#" className="text-sm hover:underline underline-offset-4 text-muted-foreground hover:text-primary">
            Termos de Serviço
          </Link>
          <Link href="#" className="text-sm hover:underline underline-offset-4 text-muted-foreground hover:text-primary">
            Política de Privacidade
          </Link>
        </nav>
        <div className="flex gap-4">
            <Link href="#" aria-label="WhatsApp">
                <Icons.whatsapp className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
            <Link href="#" aria-label="Discord">
                <Icons.discord className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
        </div>
      </div>
    </footer>
  )
}
