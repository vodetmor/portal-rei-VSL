'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  registerSaveHandler: (handler: () => Promise<void>) => void;
  triggerSave: () => Promise<void>;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => Promise<void>) | null>(null);

  const registerSaveHandler = useCallback((handler: () => Promise<void>) => {
    setSaveHandler(() => handler);
  }, []);

  const triggerSave = async () => {
    if (saveHandler) {
      await saveHandler();
    }
  };

  const toggleEditMode = () => {
    // When exiting edit mode, trigger a save.
    if (isEditMode) {
      triggerSave();
    }
    setIsEditMode(prev => !prev);
  };

  return (
    <EditModeContext.Provider value={{ isEditMode, toggleEditMode, registerSaveHandler, triggerSave }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}
