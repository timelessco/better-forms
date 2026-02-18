import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import { ChevronRight, GripVertical } from "lucide-react";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector, useHotkeys, usePluginOption } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  CopyIcon,
  EyeOffIcon,
  Pencil2Icon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/sidebar-icons";
import { cn } from "@/lib/utils";

type BlockFieldType = "formInput" | "formButton" | "static" | "unknown";

// Get field type category for the menu
function getFieldType(nodeType: string | undefined): BlockFieldType {
  if (!nodeType) return "unknown";
  if (["formLabel", "formInput", "formTextarea"].includes(nodeType)) return "formInput";
  if (nodeType === "formButton") return "formButton";
  if (["h1", "h2", "h3", "p", "blockquote", "hr"].includes(nodeType)) return "static";
  return "unknown";
}

// Get label text from node
function extractLabelText(node: { children?: Array<{ text?: string }> }): string {
  if (!node.children) return "Untitled";
  return (
    node.children
      .map((child) => child.text || "")
      .join("")
      .trim() || "Untitled"
  );
}

export function BlockMenu({ children }: { children: React.ReactNode }) {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const openId = usePluginOption(BlockMenuPlugin, "openId");
  const isOpen = openId === BLOCK_CONTEXT_MENU_ID;

  // Retrieve position from plugin options
  const position = usePluginOption(BlockMenuPlugin, "position");
  const { x, y } = position ?? { x: 0, y: 0 };

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [fieldName, setFieldName] = React.useState("");
  const [showTurnInto, setShowTurnInto] = React.useState(false);
  const [buttonText, setButtonText] = React.useState("");
  // Track previous open state to detect open transition
  const wasOpenRef = React.useRef(false);
  const blockMenuTriggerRef = React.useRef<HTMLDivElement | null>(null);

  // Get the selected node info
  // Get the selected node info reactive to editor state changes
  const selectedNodes = useEditorSelector(
    (editor) => {
      if (!isOpen) return [];
      try {
        return editor.getApi(BlockSelectionPlugin).blockSelection.getNodes();
      } catch {
        return [];
      }
    },
    [isOpen],
  );

  const firstNode = selectedNodes[0]?.[0] as
    | {
        type?: string;
        required?: boolean;
        placeholder?: string;
        minLength?: number;
        maxLength?: number;
        defaultValue?: string;
        buttonText?: string;
        children?: Array<{ text?: string }>;
      }
    | undefined;
  const firstPath = selectedNodes[0]?.[1];

  const nodeType = firstNode?.type;
  const fieldType = getFieldType(nodeType);

  // Get label node (for formInput/formTextarea, look at previous sibling)
  const labelNode = React.useMemo(() => {
    if (nodeType === "formLabel" || nodeType === "formButton") return firstNode;
    if (["formInput", "formTextarea"].includes(nodeType ?? "") && firstPath) {
      // Look at previous sibling for label
      const prevPath = [...firstPath];
      prevPath[prevPath.length - 1] -= 1;
      try {
        const prev = editor.api.node(prevPath);
        if (prev && prev[0]?.type === "formLabel") {
          return prev[0] as typeof firstNode;
        }
      } catch {
        // No previous sibling
      }
    }
    return null;
  }, [nodeType, firstNode, firstPath, editor]);

  // Get input node (for formLabel, look at next sibling)
  const inputNode = React.useMemo(() => {
    if (["formInput", "formTextarea"].includes(nodeType ?? "")) return firstNode;
    if (nodeType === "formLabel" && firstPath) {
      // Look at next sibling for input or textarea
      const nextPath = [...firstPath];
      nextPath[nextPath.length - 1] += 1;
      try {
        const next = editor.api.node(nextPath);
        if (next && ["formInput", "formTextarea"].includes(next[0]?.type as string)) {
          return next[0] as typeof firstNode;
        }
      } catch {
        // No next sibling
      }
    }
    return null;
  }, [nodeType, firstNode, firstPath, editor]);

  // Helper to get the input path
  const getInputPath = React.useCallback(() => {
    if (!firstPath) return null;
    if (["formInput", "formTextarea"].includes(nodeType ?? "")) return firstPath;
    if (nodeType === "formLabel") {
      const inputPath = [...firstPath];
      inputPath[inputPath.length - 1] += 1;
      return inputPath;
    }
    return null;
  }, [nodeType, firstPath]);

  // Initialize state only when menu transitions to open (not on every node change)
  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const label = labelNode
        ? extractLabelText(labelNode)
        : firstNode
          ? extractLabelText(firstNode)
          : "Untitled";
      setFieldName(label);
      setIsEditingName(false);
      setShowTurnInto(false);
      if (nodeType === "formButton") {
        setButtonText((firstNode?.buttonText as string) || "Submit");
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, labelNode, firstNode, nodeType]);

  // Handlers for form input options
  const handleToggleRequired = () => {
    if (!labelNode || !firstPath) return;
    // Find the label path
    const labelPath = [...firstPath];
    if (["formInput", "formTextarea"].includes(nodeType ?? "")) {
      labelPath[labelPath.length - 1] -= 1;
    }
    const currentRequired = Boolean(labelNode.required);
    editor.tf.setNodes({ required: !currentRequired }, { at: labelPath });
  };

  const handleToggleMinLength = () => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const hasMinLength = inputNode?.minLength !== undefined;
    if (hasMinLength) {
      editor.tf.unsetNodes(["minLength"], { at: inputPath });
    } else {
      editor.tf.setNodes({ minLength: 1 }, { at: inputPath });
    }
  };

  const handleUpdateMinLength = (value: number) => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    editor.tf.setNodes({ minLength: value }, { at: inputPath });
  };

  const handleToggleMaxLength = () => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const hasMaxLength = inputNode?.maxLength !== undefined;
    if (hasMaxLength) {
      editor.tf.unsetNodes(["maxLength"], { at: inputPath });
    } else {
      editor.tf.setNodes({ maxLength: 100 }, { at: inputPath });
    }
  };

  const handleUpdateMaxLength = (value: number) => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    editor.tf.setNodes({ maxLength: value }, { at: inputPath });
  };

  const handleToggleDefaultValue = () => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const hasDefault = inputNode?.defaultValue !== undefined;
    if (hasDefault) {
      editor.tf.unsetNodes(["defaultValue"], { at: inputPath });
    } else {
      editor.tf.setNodes({ defaultValue: "" }, { at: inputPath });
    }
  };

  const handleUpdateDefaultValue = (value: string) => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    editor.tf.setNodes({ defaultValue: value }, { at: inputPath });
  };

  // Button-specific handlers
  const handleUpdateButtonText = (value: string) => {
    if (!firstPath || nodeType !== "formButton") return;
    setButtonText(value);

    // Update children to sync with the renderer in form-button-node.tsx
    editor.tf.insertNodes({ text: value }, { at: [...firstPath, 0], select: false });
    editor.tf.removeNodes({ at: [...firstPath, 1] });

    // Also keep buttonText property for backward compatibility
    editor.tf.setNodes({ buttonText: value }, { at: firstPath });
  };

  const handleUpdateFieldName = () => {
    if (!labelNode || !firstPath || !fieldName.trim()) return;
    const labelPath = [...firstPath];
    if (["formInput", "formTextarea"].includes(nodeType ?? "")) {
      labelPath[labelPath.length - 1] -= 1;
    }
    // Update the text content of the label
    editor.tf.insertNodes({ text: fieldName.trim() }, { at: [...labelPath, 0], select: false });
    editor.tf.removeNodes({ at: [...labelPath, 1] });
    setIsEditingName(false);
  };

  // Common actions
  const handleDelete = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
    editor.tf.focus();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleDuplicate = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleTurnInto = (type: string) => {
    editor
      .getApi(BlockSelectionPlugin)
      .blockSelection.getNodes()
      .forEach(([node, path]) => {
        if (node[KEYS.listType]) {
          editor.tf.unsetNodes([KEYS.listType, "indent"], {
            at: path,
          });
        }
        editor.tf.toggleBlock(type, { at: path });
      });
    api.blockMenu.hide();
  };

  React.useEffect(() => {
    const node = blockMenuTriggerRef.current;
    if (!node) return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    node.addEventListener("contextmenu", handleContextMenu);
    return () => {
      node.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [api.blockMenu]);

  // Keyboard shortcuts
  // Delete: Del or Backspace
  useHotkeys(
    "delete, backspace",
    handleDelete,
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, handleDelete],
  );

  // Duplicate: Cmd+D
  useHotkeys(
    "mod+d",
    handleDuplicate,
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, handleDuplicate],
  );

  // Hide: Cmd+Opt+H
  useHotkeys(
    "mod+alt+h",
    () => api.blockMenu.hide(),
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, api.blockMenu],
  );

  // Add conditional logic: Cmd+Opt+L
  useHotkeys(
    "mod+alt+l",
    () => api.blockMenu.hide(),
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, api.blockMenu],
  );

  // Get current node properties
  const isRequired = Boolean(labelNode?.required);
  const hasMinLength = inputNode?.minLength !== undefined;
  const hasMaxLength = inputNode?.maxLength !== undefined;
  const hasDefaultValue = inputNode?.defaultValue !== undefined;
  const currentMinLength = inputNode?.minLength;
  const currentMaxLength = inputNode?.maxLength;
  const currentDefaultValue = inputNode?.defaultValue;

  return (
    <>
      <div ref={blockMenuTriggerRef}>{children}</div>

      <Popover open={isOpen} onOpenChange={(open) => !open && api.blockMenu.hide()}>
        <PopoverAnchor
          style={{
            position: "fixed",
            left: `${x}px`,
            top: `${y}px`,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
        <PopoverContent className="w-[288px]" align="start" sideOffset={4}>
          {showTurnInto ? (
            /* Turn Into Submenu - sidebar popover style */
            <div>
              <Button
                variant="ghost"
                onClick={() => setShowTurnInto(false)}
                className="w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] text-light-gray-800 hover:bg-black/5 hover:text-foreground mb-1"
              >
                ← Back
              </Button>
              <div className="my-1 h-px bg-border" />
              <MenuItem onClick={() => handleTurnInto(KEYS.p)}>Paragraph</MenuItem>
              <MenuItem onClick={() => handleTurnInto(KEYS.h1)}>Heading 1</MenuItem>
              <MenuItem onClick={() => handleTurnInto(KEYS.h2)}>Heading 2</MenuItem>
              <MenuItem onClick={() => handleTurnInto(KEYS.h3)}>Heading 3</MenuItem>
              <MenuItem onClick={() => handleTurnInto(KEYS.blockquote)}>Blockquote</MenuItem>
            </div>
          ) : (
            /* Main Menu - sidebar popover style */
            <div>
              {/* Field Name Header */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                {isEditingName ? (
                  <Input
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    onBlur={handleUpdateFieldName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateFieldName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                    className="h-7 text-[13px] flex-1 rounded-lg"
                    autoFocus
                  />
                ) : (
                  <span className="text-[13px] font-medium flex-1 truncate text-light-gray-800">{fieldName}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-lg hover:bg-black/5"
                  onClick={() => setIsEditingName(!isEditingName)}
                >
                  <Pencil2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="my-1 h-px bg-border" />

              {/* Field-Specific Options */}
              {fieldType === "formInput" && (
                <>
                  <div className="px-2 py-1.5 space-y-2">
                    <ToggleOption
                      label="Required"
                      checked={isRequired}
                      onCheckedChange={handleToggleRequired}
                    />
                    <div className="space-y-1.5">
                      <ToggleOption
                        label="Default answer"
                        checked={hasDefaultValue}
                        onCheckedChange={handleToggleDefaultValue}
                      />
                      {hasDefaultValue && (
                        <Input
                          value={currentDefaultValue || ""}
                          onChange={(e) => handleUpdateDefaultValue(e.target.value)}
                          placeholder="Enter default value"
                          className="h-8 text-[13px] rounded-lg"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <ToggleOption
                        label="Min characters"
                        checked={hasMinLength}
                        onCheckedChange={handleToggleMinLength}
                      />
                      {hasMinLength && (
                        <Input
                          type="number"
                          min={1}
                          value={currentMinLength || 1}
                          onChange={(e) => handleUpdateMinLength(Number(e.target.value))}
                          placeholder="Min"
                          className="h-8 text-[13px] rounded-lg"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <ToggleOption
                        label="Max characters"
                        checked={hasMaxLength}
                        onCheckedChange={handleToggleMaxLength}
                      />
                      {hasMaxLength && (
                        <Input
                          type="number"
                          min={1}
                          value={currentMaxLength || 100}
                          onChange={(e) => handleUpdateMaxLength(Number(e.target.value))}
                          placeholder="Max"
                          className="h-8 text-[13px] rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                </>
              )}

              {/* Button-Specific Options */}
              {fieldType === "formButton" && (
                <>
                  <div className="px-2 py-1.5 space-y-2">
                    <Label className="text-[12px] font-medium text-muted-foreground tracking-[0.24px]">Button Name</Label>
                    <Input
                      value={buttonText}
                      onChange={(e) => handleUpdateButtonText(e.target.value)}
                      placeholder="Enter button name"
                      className="h-8 text-[13px] rounded-lg"
                    />
                  </div>
                  <div className="my-1 h-px bg-border" />
                </>
              )}

              {/* Common Actions */}
              <div className="px-0">
                <MenuItem destructive onClick={handleDelete}>
                  <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">Delete</span>
                  <span className="text-xs text-muted-foreground">Del</span>
                </MenuItem>
                <MenuItem onClick={handleDuplicate}>
                  <CopyIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">Duplicate</span>
                  <span className="text-xs text-muted-foreground">⌘D</span>
                </MenuItem>
                <MenuItem onClick={() => api.blockMenu.hide()}>
                  <EyeOffIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">Hide</span>
                  <span className="text-xs text-muted-foreground">⌘⌥H</span>
                </MenuItem>
                <MenuItem onClick={() => api.blockMenu.hide()}>
                  <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">Add conditional logic</span>
                  <span className="text-xs text-muted-foreground">⌘⌥L</span>
                </MenuItem>
                <div className="my-1 h-px bg-border mx-0" />
                <MenuItem onClick={() => setShowTurnInto(true)}>
                  <span className="text-[13px]">↺</span>
                  <span className="flex-1 text-left">Turn into</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                </MenuItem>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

// Reusable Toggle Option component - aligns with sidebar popover typography
function ToggleOption({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[13px] font-medium text-light-gray-800">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-90" />
    </div>
  );
}

// Reusable Menu Item component - matches sidebar popover style
function MenuItem({
  children,
  onClick,
  className,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors [&_svg]:shrink-0",
        destructive
          ? "text-red-500/70 hover:bg-red-500/5 hover:text-red-500 focus:bg-red-500/5 focus:text-red-500"
          : "text-light-gray-800 hover:bg-black/5 hover:text-foreground",
        className,
      )}
    >
      {children}
    </Button>
  );
}
