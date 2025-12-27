import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface ConverterCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  colorClass: string;
  cardClass: string;
  delay?: number;
}

export const ConverterCard: React.FC<ConverterCardProps> = ({
  title,
  description,
  icon: Icon,
  to,
  colorClass,
  cardClass,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link to={to} className={`converter-card ${cardClass} block group`}>
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon className="h-7 w-7 text-primary-foreground" />
        </div>
        
        <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        
        <div className="flex items-center gap-2 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Convert now
          <ArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </motion.div>
  );
};
