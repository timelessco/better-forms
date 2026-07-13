import type { ReactNode } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface FormEmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
}

// Shared centered empty screen for public-form terminal states (not-found, unpublished, closed, already-submitted).
export const FormEmptyState = ({ icon, title, description }: FormEmptyStateProps) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
);
