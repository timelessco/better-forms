import { useTranslation } from "@/contexts/translation-context";
import { BanIcon } from "@/components/ui/icons";
import { FormEmptyState } from "@/routes/forms/-components/form-empty-state";

interface FormClosedProps {
  message?: string | null;
}

export const FormClosed = ({ message }: FormClosedProps) => {
  const { t } = useTranslation();
  return (
    <FormEmptyState
      icon={<BanIcon />}
      title={t("formClosed")}
      description={message || t("formClosedDescription")}
    />
  );
};

export const AlreadySubmitted = () => {
  const { t } = useTranslation();
  return (
    <FormEmptyState
      icon={<BanIcon />}
      title={t("alreadySubmitted")}
      description={t("alreadySubmittedDescription")}
    />
  );
};
