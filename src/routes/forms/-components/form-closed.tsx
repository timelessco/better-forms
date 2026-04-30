import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTranslation } from "@/contexts/translation-context";
import { BanIcon } from "@/components/ui/icons";

interface FormClosedProps {
  message?: string | null;
}

export const FormClosed = ({ message }: FormClosedProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BanIcon />
          </EmptyMedia>
          <EmptyTitle>{t("formClosed")}</EmptyTitle>
          <EmptyDescription>{message || t("formClosedDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

export const AlreadySubmitted = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BanIcon />
          </EmptyMedia>
          <EmptyTitle>{t("alreadySubmitted")}</EmptyTitle>
          <EmptyDescription>{t("alreadySubmittedDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};
