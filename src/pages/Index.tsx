import { motion } from 'framer-motion';
import { Image, FileText, Table, Wifi, Shield, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ConverterCard } from '@/components/ConverterCard';
import { InstallPrompt } from '@/components/InstallPrompt';

const Index = () => {
  const { t } = useLanguage();

  const converters = [
    {
      title: t.converters.imageToDocx.title,
      description: t.converters.imageToDocx.description,
      icon: Image,
      to: '/image-to-docx',
      colorClass: 'icon-image',
      cardClass: 'converter-card-image',
    },
    {
      title: t.converters.pdfToDocx.title,
      description: t.converters.pdfToDocx.description,
      icon: FileText,
      to: '/pdf-to-docx',
      colorClass: 'icon-pdf',
      cardClass: 'converter-card-pdf',
    },
    {
      title: t.converters.pdfToExcel.title,
      description: t.converters.pdfToExcel.description,
      icon: Table,
      to: '/pdf-to-excel',
      colorClass: 'icon-excel',
      cardClass: 'converter-card-excel',
    },
  ];

  const features = [
    {
      icon: Wifi,
      title: t.features.offline,
      description: t.features.offlineDesc,
    },
    {
      icon: Shield,
      title: t.features.privacy,
      description: t.features.privacyDesc,
    },
    {
      icon: Sparkles,
      title: t.features.accurate,
      description: t.features.accurateDesc,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 -z-10 opacity-30">
            <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-image/20 blur-3xl" />
          </div>

          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                {t.hero.subtitle}
              </span>
              <h1 className="mb-6 text-4xl font-extrabold leading-tight text-foreground md:text-6xl lg:text-7xl">
                {t.hero.title.split(' ').map((word, i) => (
                  <span key={i} className={i === 0 ? 'text-gradient' : ''}>
                    {word}{' '}
                  </span>
                ))}
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                {t.hero.description}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Converters Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {converters.map((converter, index) => (
                <ConverterCard key={converter.to} {...converter} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border bg-muted/30 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <InstallPrompt />
    </div>
  );
};

export default Index;
