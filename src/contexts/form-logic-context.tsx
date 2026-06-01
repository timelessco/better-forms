import * as React from "react";

import type { FormLogicValue } from "@/lib/logic/build-form-logic";

export type { FormLogicValue };

const FormLogicContext = React.createContext<FormLogicValue | null>(null);

export const FormLogicProvider = FormLogicContext.Provider;

/** Null when no logic context is mounted (e.g. RSC preview) — callers treat as "no logic". */
export const useFormLogic = (): FormLogicValue | null => React.use(FormLogicContext);
