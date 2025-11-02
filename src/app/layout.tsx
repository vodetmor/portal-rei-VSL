import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Toaster } from "@/components/ui/toaster";
import { Nav } from "@/components/nav";
import { EditModeProvider } from "@/context/EditModeContext";

const inter = Inter({ subsets: ["latin"], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Rei da VSL",
  description: "Sua plataforma para dominar a arte das VSLs.",
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <FirebaseClientProvider>
          <EditModeProvider>
            <Nav />
            <main>{children}</main>
            <Toaster />
          </EditModeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
