import { cn } from "@/lib/utils";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

export const toastManager = ToastPrimitive.createToastManager();

const TOAST_SHADOW =
  "0 0 1px 0 rgba(0, 0, 0, 0.19), 0 1px 2px 0 rgba(0, 0, 0, 0.07), 0 6px 15px -5px rgba(0, 0, 0, 0.11)";

const Provider = (props: ToastPrimitive.Provider.Props) => (
  <ToastPrimitive.Provider toastManager={toastManager} timeout={5000} {...props} />
);

const Viewport = (props: ToastPrimitive.Viewport.Props) => {
  const { className, ...rest } = props;
  return (
    <ToastPrimitive.Viewport
      className={cn("fixed right-4 bottom-4 z-9999 flex w-fit flex-col items-end gap-4", className)}
      {...rest}
    />
  );
};

const Root = (props: ToastPrimitive.Root.Props) => {
  const { className, ...rest } = props;
  return (
    <ToastPrimitive.Root
      className={cn("toast-root min-h-0 w-[320px] rounded-2xl bg-gray-950 px-4 py-3", className)}
      style={{ boxShadow: TOAST_SHADOW }}
      {...rest}
    />
  );
};

const Title = (props: ToastPrimitive.Title.Props) => {
  const { className, ...rest } = props;
  return (
    <ToastPrimitive.Title
      className={cn("font-450 text-gray-0 text-sm not-italic", className)}
      {...rest}
    />
  );
};

const Description = (props: ToastPrimitive.Description.Props) => {
  const { className, ...rest } = props;
  return (
    <ToastPrimitive.Description
      className={cn("text-13 font-450 mt-[4px] text-gray-500 not-italic", className)}
      {...rest}
    />
  );
};

const Close = (props: ToastPrimitive.Close.Props) => <ToastPrimitive.Close {...props} />;

const List = () => {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((toast) => (
    <Root key={toast.id} toast={toast}>
      <div className="flex gap-2">
        {toast.data?.icon}
        <div>
          <Title />
          {toast.description && <Description />}
        </div>
      </div>
    </Root>
  ));
};

/**
 * Pre-composed toast setup for use in layout files (Server Components).
 * Renders Provider + Viewport + List as a single client component boundary.
 */
export const ToastSetup = () => (
  <Provider>
    <Viewport>
      <List />
    </Viewport>
  </Provider>
);

export const Toast = {
  Close,
  Description,
  List,
  Provider,
  Root,
  Title,
  Viewport,
};
