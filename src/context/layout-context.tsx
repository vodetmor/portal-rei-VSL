'use client';
import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_DEFAULTS = {
    logoUrl: "https://reidavsl.com/wp-content/uploads/2025/03/logo-horizontal.webp",
    heroTitle: "Seu Reinado <span class='text-primary'>começa aqui</span>.",
    heroSubtitle: "No Rei da VSL, cada copy se torna uma conversão poderosa.",
    heroImage: "https://picsum.photos/seed/hero-bg/1920/1080",
    ctaText: "Assistir Agora",
    heroAlignment: "left" as "left" | "center" | "end",
}

interface LayoutData {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ctaText: string;
  heroAlignment: "left" | "center" | "end";
  isLoading: boolean;
  defaults: Omit<typeof DEFAULT_DEFAULTS, 'membersTitle' | 'membersSubtitle' | 'membersIcon'>;
}

interface LayoutContextType {
  layoutData: LayoutData;
  setLayoutData: React.Dispatch<React.SetStateAction<LayoutData>>;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const firestore = useFirestore();
  const [layoutData, setLayoutData] = useState<LayoutData>({
    ...DEFAULT_DEFAULTS,
    isLoading: true,
    defaults: DEFAULT_DEFAULTS,
  });
  const [isEditMode, setIsEditMode] = useState(false);


  const fetchPageContent = useCallback(async () => {
    if (!firestore) return;
    setLayoutData(prev => ({ ...prev, isLoading: true }));
    const layoutRef = doc(firestore, 'layout', 'dashboard-hero');
    try {
      const docSnap = await getDoc(layoutRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLayoutData(prev => ({
            ...prev,
            heroTitle: data.title || prev.defaults.heroTitle,
            heroSubtitle: data.subtitle || prev.defaults.heroSubtitle,
            heroImage: data.imageUrl || prev.defaults.heroImage,
            ctaText: data.ctaText || prev.defaults.ctaText,
            heroAlignment: data.heroAlignment || prev.defaults.heroAlignment,
        }));
      }
    } catch (error) {
       console.error("Error fetching layout:", error);
    } finally {
      setLayoutData(prev => ({ ...prev, isLoading: false }));
    }
  }, [firestore]);

  useEffect(() => {
    fetchPageContent();
  }, [fetchPageContent]);

  return (
    <LayoutContext.Provider value={{ layoutData, setLayoutData, isEditMode, setIsEditMode }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
