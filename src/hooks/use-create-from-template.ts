import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { log } from "evlog";
import { createFormLocal } from "@/collections";
import { useOrgWorkspaces } from "@/hooks/use-live-hooks";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import { sortByManualOrder } from "@/lib/sort-utils";
import { buildTemplateContent, findTemplateMeta } from "@/lib/form-templates";
import type { FormTemplateId } from "@/lib/form-templates";

/**
 * Seeds a draft form from a template into the first workspace and opens the editor.
 * Shared by the dashboard quick-create row and the templates preview screen.
 */
export const useCreateFromTemplate = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });
  const { data: liveWorkspaces } = useOrgWorkspaces(activeOrg?.id);

  const createFromTemplate = useCallback(
    (templateId: FormTemplateId) => {
      const ordered = sortByManualOrder(
        liveWorkspaces ?? [],
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const targetId = ordered[0]?.id;
      if (!targetId) return;

      const title = findTemplateMeta(templateId)?.label ?? "Untitled";
      setIsCreating(true);
      try {
        const { form: newForm } = createFormLocal(targetId, {
          title,
          content: buildTemplateContent(templateId),
        });
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/edit",
          params: { workspaceId: targetId, formId: newForm.id },
        });
      } catch (error) {
        log.error({ tag: "templates", msg: "Failed to create form from template", error });
      } finally {
        setIsCreating(false);
      }
    },
    [liveWorkspaces, navigate],
  );

  return { createFromTemplate, isCreating, hasWorkspace: (liveWorkspaces?.length ?? 0) > 0 };
};
