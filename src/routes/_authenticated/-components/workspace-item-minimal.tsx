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
  DropdownMenuSeparator,
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
import { createFormLocal, moveFormToWorkspaceLocal, toggleFavoriteLocal } from "@/collections";
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
import { useRouter } from "@tanstack/react-router";
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
  favoriteFormIds: ReadonlySet<string>;
  activeFormId?: string;
  sortMode: string;
  onSortChange: (mode: "recent" | "oldest" | "alphabetical" | "manual") => void;
  onRename: (workspace: WorkspaceWithForms) => void;
  onDelete: (workspace: WorkspaceWithForms) => void;
  onDuplicateForm: (form: WorkspaceWithForms["forms"][0]) => void;
  onDeleteForm: (form: WorkspaceWithForms["forms"][0]) => void;
  onFormDragEnd: (workspaceId: string, event: DragEndEvent) => void;
  isFormDuplicating: (formId: string) => boolean;
}

export const WorkspaceItemMinimal = ({
  workspace,
  allWorkspaces,
  submissionCounts,
  favoriteFormIds,
  activeFormId,
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
      <LiteSidebarSection
        label={workspace.name}
        initialOpen={true}
        action={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="overflow-hidden rounded-lg p-[5px] text-muted-foreground"
              title="New form"
              aria-label="New form"
              disabled={isCreatingForm}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void handleCreateForm();
              }}
            >
              {isCreatingForm ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            </Button>
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
                <div
                  onMouseEnter={() => setSortExpanded(true)}
                  onMouseLeave={() => setSortExpanded(false)}
                >
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
                              {sortMode === option.value && (
                                <CheckIcon className="size-3 shrink-0" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuItem onClick={handleCreateForm} disabled={isCreatingForm}>
                    {isCreatingForm ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <PlusIcon />
                    )}
                    <span className="flex-1 text-left">New form</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRename(workspace)}>
                    <Pencil2Icon />
                    <span className="flex-1 text-left">Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(workspace)}>
                    <TrashIcon />
                    <span className="flex-1 text-left">Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
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
                isFavorite={favoriteFormIds.has(form.id)}
                isActive={form.id === activeFormId}
                onDuplicate={onDuplicateForm}
                onDelete={onDeleteForm}
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
      </LiteSidebarSection>
    </div>
  );
};

// Lightweight sidebar section that mirrors the look of the shared SidebarSection
// but does not pull in Base UI's Accordion + Collapsible. Those primitives
// broadcast AccordionItemContext + CollapsibleRootContext to every descendant on
// every internal state change (height measurements, mount transitions, etc.),
// which forces all 26 nested form rows + the dnd-kit useSortable subscribers to
// re-render even when no real data changed. With ~26 forms × multiple Base UI
// effects per render, that broadcast was the dominant cost in the sidebar.
const LiteSidebarSection = ({
  label,
  children,
  action,
  initialOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  initialOpen?: boolean;
}) => {
  // eslint-disable-next-line react-doctor/no-derived-useState -- uncontrolled component with initial-value pattern; later prop changes intentionally do not override user toggling
  const [open, setOpen] = useState(initialOpen);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div className="flex w-full flex-col">
      <div className="group/accordion-header flex">
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            "group/accordion-trigger relative ml-[0.55px] flex h-7.5 flex-1 cursor-pointer items-center gap-1 overflow-hidden rounded-lg border border-transparent px-1 py-1.5 text-start text-[13px] transition-all outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span className="truncate font-case text-[13px] font-medium tracking-4 text-muted-foreground">
              {label}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-2.5 shrink-0 text-muted-foreground transition-transform duration-200",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
          </span>
        </button>
        {action && (
          <div className="mr-[0.55px] flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/accordion-header:opacity-100">
            {action}
          </div>
        )}
      </div>
      {open && <div className="flex flex-col pt-0 pb-2.5">{children}</div>}
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

type FormForMinimal = {
  id: string;
  title: string | null;
  icon?: string | null;
  workspaceId: string;
  status: string;
  customization?: Record<string, string> | null;
};

interface WorkspaceFormMinimalProps {
  form: FormForMinimal;
  workspaceId: string;
  submissionCount: number;
  otherWorkspaces: Array<{ id: string; name: string }>;
  isFavorite: boolean;
  isActive: boolean;
  onDuplicate: (form: WorkspaceWithForms["forms"][0]) => void;
  onDelete: (form: WorkspaceWithForms["forms"][0]) => void;
  isDuplicating?: boolean;
}

const WorkspaceFormMinimal = ({
  form,
  workspaceId,
  submissionCount,
  otherWorkspaces,
  isFavorite: isFav,
  isActive,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: WorkspaceFormMinimalProps) => {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [moveExpanded, setMoveExpanded] = useState(false);

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
      <SidebarItem
        label={label}
        linkOptions={linkOptions}
        isActive={isActive}
        prefix={prefix}
        // Reserve space for the absolute-positioned options button so the
        // truncated title's ellipsis doesn't end up underneath it.
        className="group-hover/row:pe-7 group-has-[[data-state=open]]/row:pe-7"
      >
        {/* eslint-disable-next-line react-doctor/rendering-conditional-render -- showCount is a derived boolean (isPublished && submissionCount > 0); cannot render numeric 0 */}
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
            <DropdownMenuItem
              onClick={() => onDuplicate(form as WorkspaceWithForms["forms"][0])}
              disabled={isDuplicating}
            >
              <CopyIcon />
              <span className="flex-1 text-left">
                {isDuplicating ? "Duplicating…" : "Duplicate"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleFavorite} disabled={!userId}>
              <StarIcon className="size-3.5" />
              <span className="flex-1 text-left">
                {isFav ? "Remove from favorites" : "Add to favorites"}
              </span>
            </DropdownMenuItem>
            {otherWorkspaces.length > 0 && (
              <div
                onMouseEnter={() => setMoveExpanded(true)}
                onMouseLeave={() => setMoveExpanded(false)}
              >
                <Collapsible open={moveExpanded} onOpenChange={setMoveExpanded}>
                  <CollapsibleTrigger className="inline-flex h-[26px] w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg px-2 py-[5.5px] text-[13px] text-foreground transition-colors hover:bg-accent">
                    <FolderIcon className="size-3.5 shrink-0" />
                    <span className="flex-1 text-left">Move to workspace</span>
                    <ChevronDownIcon
                      className={cn(
                        "size-3 shrink-0 transition-transform duration-200",
                        moveExpanded && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                    <div className="flex flex-col pt-1">
                      {otherWorkspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          closeOnClick={false}
                          onClick={() => {
                            handleMoveToWorkspace(ws.id);
                            setMoveExpanded(false);
                          }}
                        >
                          <span className="flex-1 truncate text-left">{ws.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(form as WorkspaceWithForms["forms"][0])}
          >
            <TrashIcon />
            <span className="flex-1 text-left">Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
