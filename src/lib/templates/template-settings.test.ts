import { expect, it } from "vitest";
import { defaultFormSettings } from "@/types/form-settings";
import {
  TEMPLATE_SETTINGS_ALLOWLIST,
  pickTemplateSettings,
  applyTemplateSettings,
} from "./template-settings";

it("keeps only allowlisted presentational keys", () => {
  const dirty = {
    ...defaultFormSettings,
    notificationEmail: "leak@example.com",
    password: "hunter2",
    passwordProtect: true,
    redirectUrl: "https://author.example.com/thanks",
    progressBar: true,
    presentationMode: "field-by-field" as const,
  };
  const picked = pickTemplateSettings(dirty);
  expect(Object.keys(picked).sort()).toEqual([...TEMPLATE_SETTINGS_ALLOWLIST].sort());
  expect(picked.progressBar).toBe(true);
  expect(picked.presentationMode).toBe("field-by-field");
  expect((picked as Record<string, unknown>).notificationEmail).toBeUndefined();
  expect((picked as Record<string, unknown>).password).toBeUndefined();
});

it("merges allowlisted settings onto defaults, leaving sensitive keys at default", () => {
  const merged = applyTemplateSettings({
    progressBar: true,
    presentationMode: "field-by-field",
    language: "English",
    saveAnswersForLater: false,
    preventDuplicateSubmissions: true,
  });
  expect(merged.progressBar).toBe(true);
  expect(merged.notificationEmail).toBe(defaultFormSettings.notificationEmail); // null
  expect(merged.passwordProtect).toBe(false);
});
