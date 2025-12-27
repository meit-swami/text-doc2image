import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { OCRLanguage } from '@/lib/ocr';
import { Sparkles } from 'lucide-react';

interface OCRSettingsProps {
  language: OCRLanguage;
  onLanguageChange: (lang: OCRLanguage) => void;
  enhancedMode?: boolean;
  onEnhancedModeChange?: (enabled: boolean) => void;
}

export const OCRSettings: React.FC<OCRSettingsProps> = ({
  language,
  onLanguageChange,
  enhancedMode = false,
  onEnhancedModeChange,
}) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h4 className="mb-3 font-medium text-foreground">{t.ocrSettings.title}</h4>
      
      {/* Language Selection */}
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

      {/* AI-Enhanced Mode Toggle */}
      {onEnhancedModeChange && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <Label htmlFor="enhanced-mode" className="cursor-pointer font-medium">
                  {t.ocrSettings.enhancedMode}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t.ocrSettings.enhancedModeDesc}
                </p>
              </div>
            </div>
            <Switch
              id="enhanced-mode"
              checked={enhancedMode}
              onCheckedChange={onEnhancedModeChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
