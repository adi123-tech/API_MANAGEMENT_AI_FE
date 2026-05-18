export interface Toast {
  id?: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const useToast = () => {
  const toast = (t: Omit<Toast, 'id'>) => {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__addToast) {
      ((window as unknown as Record<string, unknown>).__addToast as (t: Omit<Toast, 'id'>) => void)(t);
    }
  };

  return { toast };
};
