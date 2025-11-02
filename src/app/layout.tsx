import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Toaster } from "@/components/ui/toaster";
import { Nav } from "@/components/nav";
import { LayoutProvider } from "@/context/layout-context";


const poppins = Poppins({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans'
});

export const metadata: Metadata = {
  title: "Portal Rei da VSL",
  description: "Sua plataforma para dominar a arte das VSLs, no estilo Netflix.",
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
      <body className={poppins.className}>
        <FirebaseClientProvider>
          <LayoutProvider>
            <Nav />
            <main>{children}</main>
            <Toaster />
          </LayoutProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
