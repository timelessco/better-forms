/** Determine the route destination based on form status */
export type RouteDecision = "editor" | "submissions" | "archived" | "not-found";

export const resolveFormRoute = (status: string | undefined): RouteDecision => {
  switch (status) {
    case "draft":
      return "editor";
    case "published":
      return "submissions";
    case "archived":
      return "archived";
    default:
      return "not-found";
  }
};
