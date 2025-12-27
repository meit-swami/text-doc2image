import { Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-card py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            {t.footer.madeWith}{' '}
            <Heart className="inline h-4 w-4 text-primary" />{' '}
            {t.footer.forOffline}
          </p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {t.appName}
          </p>
        </div>
      </div>
    </footer>
  );
};
