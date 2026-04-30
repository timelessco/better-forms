import { BarChart3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  hasData: boolean;
}

export const EmptyState = ({ hasData }: EmptyStateProps) => {
  if (hasData) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">No visits yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Share your form to start collecting visits. Once people view or submit it, your insights
            will appear here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
