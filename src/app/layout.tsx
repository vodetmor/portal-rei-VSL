import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Toaster } from "@/components/ui/toaster";
import { Nav } from "@/components/nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portal Rei da VSL",
  description: "Sua plataforma para dominar a arte das VSLs.",
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
          <Nav />
          <main>{children}</main>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
