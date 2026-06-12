import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "@/hooks/use-live-hooks";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { useUserPlan } from "@/hooks/use-user-plan";
import { getProCustomizationSections } from "@/lib/theme/pro-customization";

export type PublishOptions = { stripProStyles: boolean };

type PendingPublish = (opts: PublishOptions) => void;

/**
 * Soft Pro gate for publish. The customize sidebar no longer hard-blocks Pro sections — free
 * users can experiment in the draft. At publish time, if the draft holds Pro styles, this asks:
 * upgrade, or publish with the Pro styles left out (the server strips them regardless, this
 * dialog is the honest heads-up). Pro/business plans pass straight through.
 */
export const useProPublishGate = (formId: string | undefined) => {
  const { isFree } = useUserPlan();
  const { data } = useForm(formId);
  const customization = (data?.[0]?.customization ?? {}) as Record<string, string>;
  const proSections = getProCustomizationSections(customization);
  const [pendingPublish, setPendingPublish] = useState<PendingPublish | null>(null);

  const guardPublish = (publish: PendingPublish) => {
    if (isFree && proSections.length > 0) setPendingPublish(() => publish);
    else publish({ stripProStyles: false });
  };

  const closeDialog = () => setPendingPublish(null);

  const proPublishDialog = (
    <AlertDialog open={pendingPublish !== null} onOpenChange={(open) => !open && closeDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This form uses Pro styles</AlertDialogTitle>
          <AlertDialogDescription>
            Your {proSections.join(", ")} customization{proSections.length > 1 ? "s are" : " is"}{" "}
            part of Reform Pro. Upgrade to publish {proSections.length > 1 ? "them" : "it"}, or
            publish without — your draft keeps these styles either way.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            onClick={() => {
              pendingPublish?.({ stripProStyles: true });
              closeDialog();
            }}
          >
            Publish without Pro styles
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => {
              settingsDialogStore.open("billing");
              closeDialog();
            }}
          >
            Upgrade to Pro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guardPublish, proPublishDialog };
};
