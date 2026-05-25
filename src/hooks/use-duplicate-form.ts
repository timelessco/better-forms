import { duplicateFormById } from "@/collections";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

export const useDuplicateForm = () => {
  const navigate = useNavigate();

  const duplicateForm = useCallback(
    async (formId: string) => {
      const { form: newForm } = duplicateFormById(formId);
      toast.success("Form duplicated");
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId: newForm.workspaceId, formId: newForm.id },
      });
      return newForm;
    },
    [navigate],
  );

  return duplicateForm;
};
