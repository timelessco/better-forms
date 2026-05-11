import { commentPlugin as basePlugin } from "@/components/editor/plugins/comment-plugin";
import { CommentLeaf } from "@/components/ui/comment-node";

export { commentPlugin } from "@/components/editor/plugins/comment-plugin";

const commentPluginWithUI = basePlugin.configure({
  node: { component: CommentLeaf },
});

export const CommentKit = [commentPluginWithUI];
