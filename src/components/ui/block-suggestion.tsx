import type { TResolvedSuggestion } from "@platejs/suggestion";
import {
  acceptSuggestion,
  getSuggestionKey,
  keyId2SuggestionId,
  rejectSuggestion,
} from "@platejs/suggestion";
import { SuggestionPlugin } from "@platejs/suggestion/react";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { ElementApi, KEYS, PathApi, TextApi } from "platejs";
import type { NodeEntry, Path, TElement, TSuggestionText } from "platejs";
import { useEditorPlugin, usePluginOption } from "platejs/react";
import * as React from "react";
import { discussionPlugin } from "@/components/editor/plugins/discussion-kit";
import type { TDiscussion } from "@/components/editor/plugins/discussion-kit";
import { suggestionPlugin } from "@/components/editor/plugins/suggestion-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { Comment, CommentCreateForm, formatCommentDate } from "./comment";
import type { TComment } from "./comment";

export interface ResolvedSuggestion extends TResolvedSuggestion {
  comments: TComment[];
}

const BLOCK_SUGGESTION = "__block__";

const TYPE_TEXT_MAP: Record<string, (node?: TElement) => string> = {
  [KEYS.audio]: () => "Audio",
  [KEYS.blockquote]: () => "Blockquote",
  [KEYS.callout]: () => "Callout",
  [KEYS.codeBlock]: () => "Code Block",
  [KEYS.column]: () => "Column",
  [KEYS.equation]: () => "Equation",
  [KEYS.file]: () => "File",
  [KEYS.h1]: () => "Heading 1",
  [KEYS.h2]: () => "Heading 2",
  [KEYS.h3]: () => "Heading 3",
  [KEYS.h4]: () => "Heading 4",
  [KEYS.h5]: () => "Heading 5",
  [KEYS.h6]: () => "Heading 6",
  [KEYS.hr]: () => "Horizontal Rule",
  [KEYS.img]: () => "Image",
  [KEYS.mediaEmbed]: () => "Media",
  [KEYS.p]: (node) => {
    if (node?.[KEYS.listType] === KEYS.listTodo) return "Todo List";
    if (node?.[KEYS.listType] === KEYS.ol) return "Ordered List";
    if (node?.[KEYS.listType] === KEYS.ul) return "List";

    return "Paragraph";
  },
  [KEYS.table]: () => "Table",
  [KEYS.toc]: () => "Table of Contents",
  [KEYS.toggle]: () => "Toggle",
  [KEYS.video]: () => "Video",
};

type SuggestionLineEntry = {
  text: string;
  key: string;
};

const createSuggestionLineEntries = (lines: string[], prefix: string): SuggestionLineEntry[] => {
  const seen: Record<string, number> = {};

  return lines.map((line) => {
    const normalized = line || "__line-break__";
    const count = seen[normalized] ?? 0;
    seen[normalized] = count + 1;

    return {
      text: line,
      key: `${prefix}-${normalized}-${count}`,
    };
  });
};

export const BlockSuggestionCard = ({
  idx: _idx,
  isLast,
  suggestion,
}: {
  idx: number;
  isLast: boolean;
  suggestion: ResolvedSuggestion;
}) => {
  const { api, editor } = useEditorPlugin(SuggestionPlugin);

  const userInfo = usePluginOption(discussionPlugin, "user", suggestion.userId);

  const handleAccept = React.useCallback(() => {
    api.suggestion.withoutSuggestions(() => {
      acceptSuggestion(editor, suggestion);
    });
  }, [api.suggestion, editor, suggestion]);

  const handleReject = React.useCallback(() => {
    api.suggestion.withoutSuggestions(() => {
      rejectSuggestion(editor, suggestion);
    });
  }, [api.suggestion, editor, suggestion]);

  const [hovering, setHovering] = React.useState(false);

  const suggestionText2Array = (text: string) => {
    if (text === BLOCK_SUGGESTION) return ["line breaks"];

    return text.split(BLOCK_SUGGESTION).filter(Boolean);
  };

  const removeLines =
    suggestion.type === "remove"
      ? createSuggestionLineEntries(
          suggestionText2Array(suggestion.text ?? ""),
          `${suggestion.suggestionId}-remove`,
        )
      : [];

  const insertLines =
    suggestion.type === "insert"
      ? createSuggestionLineEntries(
          suggestionText2Array(suggestion.newText ?? ""),
          `${suggestion.suggestionId}-insert`,
        )
      : [];

  const replaceNewLines =
    suggestion.type === "replace"
      ? createSuggestionLineEntries(
          suggestionText2Array(suggestion.newText ?? ""),
          `${suggestion.suggestionId}-replace-new`,
        )
      : [];

  const replaceOldLines =
    suggestion.type === "replace"
      ? createSuggestionLineEntries(
          suggestionText2Array(suggestion.text ?? ""),
          `${suggestion.suggestionId}-replace-old`,
        )
      : [];

  const [editingId, setEditingId] = React.useState<string | null>(null);

  const handleMouseEnter = React.useCallback(() => setHovering(true), []);
  const handleMouseLeave = React.useCallback(() => setHovering(false), []);

  return (
    <article
      key={suggestion.suggestionId}
      className="relative"
      aria-label={`Suggestion by ${userInfo?.name ?? "Unknown contributor"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col p-4">
        <div className="relative flex items-center">
          <Avatar className="size-5">
            <AvatarImage alt={userInfo?.name} src={userInfo?.avatarUrl} />
            <AvatarFallback>{userInfo?.name?.[0]}</AvatarFallback>
          </Avatar>
          <h4 className="mx-2 text-sm font-semibold">{userInfo?.name}</h4>
          <div className="text-xs text-muted-foreground/80">
            <span className="mr-1">{formatCommentDate(new Date(suggestion.createdAt))}</span>
          </div>
        </div>

        <div className="relative mt-1 mb-4 pl-[32px]">
          <div className="flex flex-col gap-2">
            {suggestion.type === "remove" &&
              removeLines.map(({ key, text }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Delete:</span>

                  <span className="text-sm">{text}</span>
                </div>
              ))}

            {suggestion.type === "insert" &&
              insertLines.map(({ key, text }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Add:</span>

                  <span className="text-sm">{text || "line breaks"}</span>
                </div>
              ))}

            {suggestion.type === "replace" && (
              <div className="flex flex-col gap-2">
                {replaceNewLines.map(({ key, text }) => (
                  <div key={key} className="text-brand/80 flex items-start gap-2">
                    <span className="text-sm">with:</span>
                    <span className="text-sm">{text || "line breaks"}</span>
                  </div>
                ))}

                {replaceOldLines.map(({ key, text }, index) => (
                  <div key={key} className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground">
                      {index === 0 ? "Replace:" : "Delete:"}
                    </span>
                    <span className="text-sm">{text || "line breaks"}</span>
                  </div>
                ))}
              </div>
            )}

            {suggestion.type === "update" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {Object.keys(suggestion.properties).map((key) => (
                    <span key={key}>Un{key}</span>
                  ))}

                  {Object.keys(suggestion.newProperties).map((key) => (
                    <span key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  ))}
                </span>
                <span className="text-sm">{suggestion.newText}</span>
              </div>
            )}
          </div>
        </div>

        {suggestion.comments.map((comment, index) => (
          <Comment
            key={comment.id}
            comment={comment}
            discussionLength={suggestion.comments.length}
            documentContent="__suggestion__"
            editingId={editingId}
            index={index}
            setEditingId={setEditingId}
          />
        ))}

        {hovering && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="ghost"
              className="size-6 p-1 text-muted-foreground"
              aria-label="Accept suggestion"
              onClick={handleAccept}
            >
              <CheckIcon className="size-4" />
            </Button>

            <Button
              variant="ghost"
              className="size-6 p-1 text-muted-foreground"
              aria-label="Reject suggestion"
              onClick={handleReject}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        )}

        <CommentCreateForm discussionId={suggestion.suggestionId} />
      </div>

      {!isLast && <div className="h-px w-full bg-muted" />}
    </article>
  );
};

export const useResolveSuggestion = (
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[],
  blockPath: Path,
) => {
  const discussions = usePluginOption(discussionPlugin, "discussions");

  const { api, editor, getOption, setOption } = useEditorPlugin(suggestionPlugin);

  suggestionNodes.forEach(([node]) => {
    const id = api.suggestion.nodeId(node);
    const map = getOption("uniquePathMap");

    if (!id) return;

    const previousPath = map.get(id);

    // If there are no suggestion nodes in the corresponding path in the map, then update it.
    if (PathApi.isPath(previousPath)) {
      const nodes = api.suggestion.node({ id, at: previousPath, isText: true });
      const parentNode = api.node(previousPath);
      let lineBreakId: string | null = null;

      if (parentNode && ElementApi.isElement(parentNode[0])) {
        lineBreakId = api.suggestion.nodeId(parentNode[0]) ?? null;
      }

      if (!nodes && lineBreakId !== id) {
        setOption("uniquePathMap", new Map(map).set(id, blockPath));
      }
    } else {
      setOption("uniquePathMap", new Map(map).set(id, blockPath));
    }
  });

  const resolvedSuggestion: ResolvedSuggestion[] = React.useMemo(() => {
    const map = getOption("uniquePathMap");

    if (suggestionNodes.length === 0) return [];

    const suggestionIds = new Set(
      suggestionNodes
        .flatMap(([node]) => {
          if (TextApi.isText(node)) {
            const dataList = api.suggestion.dataList(node);
            const includeUpdate = dataList.some((data) => data.type === "update");

            if (!includeUpdate) {
              return api.suggestion.nodeId(node) ?? [];
            }

            return dataList.filter((data) => data.type === "update").map((d) => d.id);
          }
          if (ElementApi.isElement(node)) {
            return api.suggestion.nodeId(node) ?? [];
          }

          return [];
        })
        .filter(Boolean),
    );

    const res: ResolvedSuggestion[] = [];

    suggestionIds.forEach((id) => {
      if (!id) return;

      const path = map.get(id);

      if (!path || !PathApi.isPath(path)) return;
      if (!PathApi.equals(path, blockPath)) return;

      const entries = [
        ...editor.api.nodes<TElement | TSuggestionText>({
          at: [],
          mode: "all",
          match: (n) =>
            (n[KEYS.suggestion] && n[getSuggestionKey(id)]) ||
            api.suggestion.nodeId(n as TElement) === id,
        }),
      ];

      // move line break to the end
      entries.sort(([, path1], [, path2]) => (PathApi.isChild(path1, path2) ? -1 : 1));

      let newText = "";
      let text = "";
      let properties: Record<string, unknown> = {};
      let newProperties: Record<string, unknown> = {};

      // overlapping suggestion
      entries.forEach(([node]) => {
        if (TextApi.isText(node)) {
          const dataList = api.suggestion.dataList(node);

          dataList.forEach((data) => {
            if (data.id === id) {
              switch (data.type) {
                case "insert": {
                  newText += node.text;

                  break;
                }
                case "remove": {
                  text += node.text;

                  break;
                }
                case "update": {
                  properties = {
                    ...properties,
                    ...data.properties,
                  };

                  newProperties = {
                    ...newProperties,
                    ...data.newProperties,
                  };

                  newText += node.text;

                  break;
                }
                // No default
              }
            }
          });
        } else {
          const lineBreakData = api.suggestion.isBlockSuggestion(node)
            ? node.suggestion
            : undefined;

          if (lineBreakData?.id === keyId2SuggestionId(id)) {
            if (lineBreakData.type === "insert") {
              newText += lineBreakData.isLineBreak
                ? BLOCK_SUGGESTION
                : BLOCK_SUGGESTION + TYPE_TEXT_MAP[node.type](node);
            } else if (lineBreakData.type === "remove") {
              text += lineBreakData.isLineBreak
                ? BLOCK_SUGGESTION
                : BLOCK_SUGGESTION + TYPE_TEXT_MAP[node.type](node);
            }
          }
        }
      });

      if (entries.length === 0) return;

      const nodeData = api.suggestion.suggestionData(entries[0][0]);

      if (!nodeData) return;

      const comments = discussions.find((s: TDiscussion) => s.id === id)?.comments || [];
      const createdAt = new Date(nodeData.createdAt);

      const keyId = getSuggestionKey(id);

      if (nodeData.type === "update") {
        res.push({
          comments,
          createdAt,
          keyId,
          newProperties,
          newText,
          properties,
          suggestionId: keyId2SuggestionId(id),
          type: "update",
          userId: nodeData.userId,
        });
      } else if (newText.length > 0 && text.length > 0) {
        res.push({
          comments,
          createdAt,
          keyId,
          newText,
          suggestionId: keyId2SuggestionId(id),
          text,
          type: "replace",
          userId: nodeData.userId,
        });
      } else if (newText.length > 0) {
        res.push({
          comments,
          createdAt,
          keyId,
          newText,
          suggestionId: keyId2SuggestionId(id),
          type: "insert",
          userId: nodeData.userId,
        });
      } else if (text.length > 0) {
        res.push({
          comments,
          createdAt,
          keyId,
          suggestionId: keyId2SuggestionId(id),
          text,
          type: "remove",
          userId: nodeData.userId,
        });
      }
    });

    return res;
  }, [api.suggestion, blockPath, discussions, editor.api, getOption, suggestionNodes]);

  return resolvedSuggestion;
};

export const isResolvedSuggestion = (
  suggestion: ResolvedSuggestion | TDiscussion,
): suggestion is ResolvedSuggestion => "suggestionId" in suggestion;
