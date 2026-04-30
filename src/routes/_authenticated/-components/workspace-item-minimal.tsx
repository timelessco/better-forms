import { ThemedFormIcon } from "@/components/icon-picker";
import { SidebarItem } from "@/components/sidebar-item";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlphabeticalIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockRewindIcon,
  CopyIcon,
  FolderIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Pencil2Icon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { SidebarSection } from "@/components/ui/sidebar-section";
import {
  createFormLocal,
  moveFormToWorkspaceLocal,
  renameFormLocal,
  toggleFavoriteLocal,
} from "@/collections";
import { useIsFavorite } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocation, useRouter } from "@tanstack/react-router";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export type WorkspaceWithForms = {
  id: string;
  organizationId: string;
  createdByUserId?: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  sortIndex?: string | null;
  forms: Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    workspaceId: string;
    icon?: string | null;
    status: string;
    sortIndex?: string | null;
    customization?: Record<string, string> | null;
  }>;
};

export interface WorkspaceItemMinimalProps {
  workspace: WorkspaceWithForms;
  allWorkspaces: Array<Pick<WorkspaceWithForms, "id" | "name">>;
  submissionCounts: Map<string, number>;
  sortMode: string;
  onSortChange: (mode: "recent" | "oldest" | "alphabetical" | "manual") => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicateForm: (form: WorkspaceWithForms["forms"][0]) => void;
  onDeleteForm: (form: WorkspaceWithForms["forms"][0]) => void;
  onFormDragEnd: (workspaceId: string, event: DragEndEvent) => void;
  isFormDuplicating: (formId: string) => boolean;
}

export const WorkspaceItemMinimal = ({
  workspace,
  allWorkspaces,
  submissionCounts,
  sortMode,
  onSortChange,
  onRename,
  onDelete,
  onDuplicateForm,
  onDeleteForm,
  onFormDragEnd,
  isFormDuplicating,
}: WorkspaceItemMinimalProps) => {
  const router = useRouter();
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [sortExpanded, setSortExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isThisDragging,
  } = useSortable({ id: workspace.id, data: { type: "workspace" } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isThisDragging ? 0.5 : 1,
  };

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!open) setSortExpanded(false);
  }, []);

  const sortOptions = [
    { value: "recent", label: "Recent First", icon: CalendarIcon },
    { value: "oldest", label: "Oldest First", icon: ClockRewindIcon },
    { value: "alphabetical", label: "Alphabetical", icon: AlphabeticalIcon },
    { value: "manual", label: "Manual", icon: CopyIcon },
  ] as const;

  const currentSort = sortOptions.find((o) => o.value === sortMode) || sortOptions[0];

  const handleCreateForm = useCallback(async () => {
    setIsCreatingForm(true);
    try {
      const { form: newForm } = createFormLocal(workspace.id);
      void router.navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId: workspace.id, formId: newForm.id },
      });
    } catch (error) {
      console.error("Failed to create form:", error);
    } finally {
      setIsCreatingForm(false);
    }
  }, [workspace.id, router]);

  const handleFormDragEnd = useCallback(
    (event: DragEndEvent) => onFormDragEnd(workspace.id, event),
    [onFormDragEnd, workspace.id],
  );

  const formSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const formIds = useMemo(() => workspace.forms.map((f) => f.id), [workspace.forms]);
  const otherWorkspaces = useMemo(
    () => allWorkspaces.filter((w) => w.id !== workspace.id),
    [allWorkspaces, workspace.id],
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SidebarSection
        label={workspace.name}
        initialOpen={true}
        action={
          <DropdownMenu onOpenChange={handlePopoverOpenChange}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-sidebar-active mr-1 overflow-hidden rounded-lg p-[5px] text-muted-foreground hover:text-foreground"
                  title="More options"
                  onPointerDown={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48" sideOffset={4}>
              <Collapsible open={sortExpanded} onOpenChange={setSortExpanded}>
                <CollapsibleTrigger className="inline-flex h-[26px] w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg px-2 py-[5.5px] text-[13px] text-foreground transition-colors">
                  <currentSort.icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{currentSort.label}</span>
                  <ChevronDownIcon
                    className={cn("size-3 shrink-0 transition-transform duration-200")}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                  <div className="flex flex-col pt-1">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      {sortOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          closeOnClick={false}
                          onClick={() => {
                            onSortChange(option.value);
                            setSortExpanded(false);
                          }}
                          className={cn(sortMode === option.value && "bg-black/5")}
                        >
                          <option.icon />
                          <span className="flex-1 text-left">{option.label}</span>
                          {sortMode === option.value && <CheckIcon className="size-3 shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleCreateForm} disabled={isCreatingForm}>
                  {isCreatingForm ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon />}
                  <span className="flex-1 text-left">New form</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRename}>
                  <Pencil2Icon />
                  <span className="flex-1 text-left">Rename</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <TrashIcon />
                  <span className="flex-1 text-left">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <DndContext
          sensors={formSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFormDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={formIds} strategy={verticalListSortingStrategy}>
            {workspace.forms.map((form) => (
              <WorkspaceFormMinimal
                key={form.id}
                form={form}
                workspaceId={workspace.id}
                submissionCount={submissionCounts.get(form.id) || 0}
                otherWorkspaces={otherWorkspaces}
                onDuplicate={() => onDuplicateForm(form)}
                onDelete={() => onDeleteForm(form)}
                isDuplicating={isFormDuplicating(form.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {workspace.forms.length === 0 && (
          <span className="px-8 py-1 text-[11px] text-muted-foreground/50 italic">
            No forms yet
          </span>
        )}
      </SidebarSection>
    </div>
  );
};

const getFormIcon = (
  _title: string,
  icon?: string | null,
  customization?: Record<string, string> | null,
) => <ThemedFormIcon icon={icon} customization={customization} />;

const stopBubble = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

interface WorkspaceFormMinimalProps {
  form: {
    id: string;
    title: string | null;
    icon?: string | null;
    workspaceId: string;
    status: string;
    customization?: Record<string, string> | null;
  };
  workspaceId: string;
  submissionCount: number;
  otherWorkspaces: Array<{ id: string; name: string }>;
  onDuplicate: () => void;
  onDelete: () => void;
  isDuplicating?: boolean;
}

const WorkspaceFormMinimal = ({
  form,
  workspaceId,
  submissionCount,
  otherWorkspaces,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: WorkspaceFormMinimalProps) => {
  const location = useLocation();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isFav = useIsFavorite(userId, form.id);
  const [renameOpen, setRenameOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: form.id,
    data: { type: "form", workspaceId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isPublishedForm = form.status === "published";
  const linkOptions = {
    to: isPublishedForm
      ? "/workspace/$workspaceId/form-builder/$formId/submissions"
      : "/workspace/$workspaceId/form-builder/$formId/edit",
    params: { workspaceId, formId: form.id },
  } as const;
  const isActive = location.pathname.startsWith(
    `/workspace/${workspaceId}/form-builder/${form.id}`,
  );
  const label = form.title || "Untitled";

  const prefix = getFormIcon(label, form.icon, form.customization);

  const isPublished = form.status === "published";
  const showCount = isPublished && submissionCount > 0;

  const handleToggleFavorite = useCallback(() => {
    if (!userId) return;
    toggleFavoriteLocal(userId, form.id).catch(() => toast.error("Failed to update favorite"));
  }, [userId, form.id]);

  const handleMoveToWorkspace = useCallback(
    (targetWorkspaceId: string) => {
      moveFormToWorkspaceLocal(form.id, targetWorkspaceId).catch(() =>
        toast.error("Failed to move form"),
      );
    },
    [form.id],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group/row relative"
    >
      <SidebarItem label={label} linkOptions={linkOptions} isActive={isActive} prefix={prefix}>
        {showCount && (
          <span className="shrink-0 font-case text-[11px] tracking-5 text-muted-foreground tabular-nums transition-opacity group-hover/row:opacity-0 group-has-[[data-state=open]]/row:opacity-0">
            {submissionCount}
          </span>
        )}
      </SidebarItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Form options"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={stopBubble}
              className="hover:bg-sidebar-active absolute top-1/2 right-2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground data-[state=open]:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Form</DropdownMenuLabel>
            <DropdownMenuItem onClick={onDuplicate} disabled={isDuplicating}>
              <CopyIcon />
              <span className="flex-1 text-left">
                {isDuplicating ? "Duplicating…" : "Duplicate"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil2Icon />
              <span className="flex-1 text-left">Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleFavorite} disabled={!userId}>
              <StarIcon className="size-3.5" />
              <span className="flex-1 text-left">
                {isFav ? "Remove from favorites" : "Add to favorites"}
              </span>
            </DropdownMenuItem>
            {otherWorkspaces.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderIcon className="size-3.5" />
                  <span className="flex-1 text-left">Move to workspace</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    {otherWorkspaces.map((ws) => (
                      <DropdownMenuItem key={ws.id} onClick={() => handleMoveToWorkspace(ws.id)}>
                        <span className="flex-1 truncate text-left">{ws.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <TrashIcon />
            <span className="flex-1 text-left">Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renameOpen && (
        <InlineRenameForm
          initialValue={form.title || ""}
          onClose={() => setRenameOpen(false)}
          onSubmit={(next) => {
            renameFormLocal(form.id, next).catch(() => toast.error("Failed to rename form"));
            setRenameOpen(false);
          }}
        />
      )}
    </div>
  );
};

const InlineRenameForm = ({
  initialValue,
  onSubmit,
  onClose,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      className="px-2 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
        else onClose();
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: rename input should focus immediately
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full rounded-md bg-secondary px-2 py-1 text-[13px] ring-1 ring-foreground/20 outline-hidden"
        aria-label="Rename form"
      />
    </form>
  );
};
