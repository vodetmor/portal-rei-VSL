'use client';

import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface PageEditActionsProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function PageEditActions({ onSave, onCancel, isSaving }: PageEditActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] p-2 bg-background/80 border border-border rounded-xl shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
        <Button onClick={onCancel} variant="secondary" className="gap-2">
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </motion.div>
  );
}
