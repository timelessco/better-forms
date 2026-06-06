import { Skeleton } from "@/components/ui/skeleton";
import type { FieldType } from "./fields/shared";

const InputSkeleton = () => <Skeleton className="h-7 w-full rounded-[8px]" />;

const TextareaSkeleton = () => <Skeleton className="h-24 w-full rounded-[8px]" />;

const FileUploadSkeleton = () => <Skeleton className="h-20 w-full rounded-[8px]" />;

const OptionListSkeleton = ({ withBadge = false }: { withBadge?: boolean }) => (
  <div className="flex flex-col gap-2">
    {["a", "b", "c"].map((id) => (
      <div className="flex items-center gap-2" key={id}>
        <Skeleton className={withBadge ? "size-5 rounded" : "size-4 rounded-[4px]"} />
        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
    ))}
  </div>
);

const LinearScaleSkeleton = () => (
  <div className="flex flex-wrap gap-2">
    {["a", "b", "c", "d", "e"].map((id) => (
      <Skeleton className="size-8 rounded-[8px]" key={id} />
    ))}
  </div>
);

const RatingSkeleton = () => (
  <div className="flex gap-1">
    {["a", "b", "c", "d", "e"].map((id) => (
      <Skeleton className="size-7 rounded-[4px]" key={id} />
    ))}
  </div>
);

const MatrixSkeleton = () => <Skeleton className="h-28 w-full rounded-[8px]" />;

const SignatureSkeleton = () => <Skeleton className="h-40 w-full rounded-[8px]" />;

const FIELD_SKELETONS: Record<FieldType, React.ComponentType> = {
  Input: InputSkeleton,
  Textarea: TextareaSkeleton,
  Email: InputSkeleton,
  Phone: InputSkeleton,
  Number: InputSkeleton,
  Link: InputSkeleton,
  Date: InputSkeleton,
  Time: InputSkeleton,
  FileUpload: FileUploadSkeleton,
  Checkbox: OptionListSkeleton,
  MultiChoice: () => <OptionListSkeleton withBadge />,
  MultiSelect: InputSkeleton,
  Ranking: () => <OptionListSkeleton withBadge />,
  Dropdown: InputSkeleton,
  LinearScale: LinearScaleSkeleton,
  Rating: RatingSkeleton,
  Matrix: MatrixSkeleton,
  Signature: SignatureSkeleton,
};

export const FieldSkeleton = ({ fieldType }: { fieldType: FieldType }) => {
  const Component = FIELD_SKELETONS[fieldType];
  return Component ? <Component /> : <InputSkeleton />;
};
