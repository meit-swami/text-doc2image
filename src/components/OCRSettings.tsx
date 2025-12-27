import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OCRLanguage } from '@/lib/ocr';

interface OCRSettingsProps {
  language: OCRLanguage;
  onLanguageChange: (lang: OCRLanguage) => void;
}

export const OCRSettings: React.FC<OCRSettingsProps> = ({
  language,
  onLanguageChange,
}) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 font-medium text-foreground">{t.ocrSettings.title}</h4>
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          {t.ocrSettings.language}
        </Label>
        <RadioGroup
          value={language}
          onValueChange={(val) => onLanguageChange(val as OCRLanguage)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="eng" id="eng" />
            <Label htmlFor="eng" className="cursor-pointer">
              {t.ocrSettings.english}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="hin" id="hin" />
            <Label htmlFor="hin" className="cursor-pointer">
              {t.ocrSettings.hindi}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="eng+hin" id="eng+hin" />
            <Label htmlFor="eng+hin" className="cursor-pointer">
              {t.ocrSettings.mixed}
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
