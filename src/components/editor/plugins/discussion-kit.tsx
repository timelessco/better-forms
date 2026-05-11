import { discussionPluginBase } from "@/components/editor/plugins/discussion-plugin";
import { BlockDiscussion } from "@/components/ui/block-discussion";

export { discussionPlugin } from "@/components/editor/plugins/discussion-plugin";
export type { TComment, TDiscussion } from "@/components/editor/plugins/discussion-plugin";

const discussionPluginWithUI = discussionPluginBase
  .configure({
    render: { aboveNodes: BlockDiscussion },
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => getOption("users")[getOption("currentUserId")],
    user: (id: string) => getOption("users")[id],
  }));

export const DiscussionKit = [discussionPluginWithUI];
