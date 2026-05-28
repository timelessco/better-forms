type TranslationKey =
  // Buttons
  | "next"
  | "previous"
  | "submit"
  | "submitting"
  // State pages
  | "formNotFound"
  | "formNotFoundDescription"
  | "formNotAvailable"
  | "formNotAvailableDescription"
  | "formClosed"
  | "formClosedDescription"
  | "alreadySubmitted"
  | "alreadySubmittedDescription"
  | "thankYou"
  | "responseSubmitted"
  | "submitAnother"
  // Password gate
  | "passwordProtected"
  | "passwordDescription"
  | "enterPassword"
  | "verifying"
  | "unlock"
  | "pleaseEnterPassword"
  | "incorrectPassword"
  | "somethingWentWrong"
  // Branding
  | "poweredBy"
  // Redirect
  | "redirecting"
  // Errors
  | "submitFailed"
  // AI Chat
  | "aiChatInvalidRetry"
  | "aiChatUnavailable"
  | "aiChatSkipped"
  | "aiChatSubmitted"
  | "aiChatSwitchToStandard"
  | "aiChatResumeRecap"
  | "aiChatContinue";

type Translations = Record<TranslationKey, string>;

const en: Translations = {
  next: "Next",
  previous: "Previous",
  submit: "Submit",
  submitting: "Submitting...",
  formNotFound: "Form not found",
  formNotFoundDescription: "This form doesn't exist or is no longer available.",
  formNotAvailable: "Form not available",
  formNotAvailableDescription: "This form is not currently accepting responses.",
  formClosed: "Form closed",
  formClosedDescription: "This form is no longer accepting responses.",
  alreadySubmitted: "Already submitted",
  alreadySubmittedDescription:
    "You have already submitted this form. Each person can only submit once.",
  thankYou: "Thank you!",
  responseSubmitted: "Your response has been submitted successfully.",
  submitAnother: "Submit another response",
  passwordProtected: "Password protected",
  passwordDescription: "Enter the password to access this form.",
  enterPassword: "Enter password",
  verifying: "Verifying...",
  unlock: "Unlock",
  pleaseEnterPassword: "Please enter a password",
  incorrectPassword: "Incorrect password. Please try again.",
  somethingWentWrong: "Something went wrong. Please try again.",
  poweredBy: "Powered by",
  redirecting: "Redirecting in {n} second{s}...",
  submitFailed: "Failed to submit form. Please try again.",
  aiChatInvalidRetry: "Hmm, I didn't quite catch that. Could you try again?",
  aiChatUnavailable: "We're having trouble — switched to a standard form. Your answers are saved.",
  aiChatSkipped: "Skipped",
  aiChatSubmitted: "Thanks — your response has been submitted.",
  aiChatSwitchToStandard: "Switch to standard form",
  aiChatResumeRecap: "Here's what you've shared so far",
  aiChatContinue: "Continue where you left off",
};

const es: Translations = {
  next: "Siguiente",
  previous: "Anterior",
  submit: "Enviar",
  submitting: "Enviando...",
  formNotFound: "Formulario no encontrado",
  formNotFoundDescription: "Este formulario no existe o ya no está disponible.",
  formNotAvailable: "Formulario no disponible",
  formNotAvailableDescription: "Este formulario no está aceptando respuestas actualmente.",
  formClosed: "Formulario cerrado",
  formClosedDescription: "Este formulario ya no acepta respuestas.",
  alreadySubmitted: "Ya enviado",
  alreadySubmittedDescription:
    "Ya has enviado este formulario. Cada persona solo puede enviarlo una vez.",
  thankYou: "¡Gracias!",
  responseSubmitted: "Tu respuesta ha sido enviada exitosamente.",
  submitAnother: "Enviar otra respuesta",
  passwordProtected: "Protegido con contraseña",
  passwordDescription: "Ingresa la contraseña para acceder a este formulario.",
  enterPassword: "Ingresa la contraseña",
  verifying: "Verificando...",
  unlock: "Desbloquear",
  pleaseEnterPassword: "Por favor ingresa una contraseña",
  incorrectPassword: "Contraseña incorrecta. Inténtalo de nuevo.",
  somethingWentWrong: "Algo salió mal. Inténtalo de nuevo.",
  poweredBy: "Desarrollado por",
  redirecting: "Redirigiendo en {n} segundo{s}...",
  submitFailed: "Error al enviar el formulario. Inténtalo de nuevo.",
  aiChatInvalidRetry: "Mmm, no entendí del todo. ¿Podrías intentarlo de nuevo?",
  aiChatUnavailable:
    "Estamos teniendo problemas — cambiamos a un formulario estándar. Tus respuestas están guardadas.",
  aiChatSkipped: "Omitida",
  aiChatSubmitted: "Gracias — tu respuesta ha sido enviada.",
  aiChatSwitchToStandard: "Cambiar a formulario estándar",
  aiChatResumeRecap: "Esto es lo que has compartido hasta ahora",
  aiChatContinue: "Continuar donde lo dejaste",
};

const fr: Translations = {
  next: "Suivant",
  previous: "Précédent",
  submit: "Soumettre",
  submitting: "Envoi en cours...",
  formNotFound: "Formulaire introuvable",
  formNotFoundDescription: "Ce formulaire n'existe pas ou n'est plus disponible.",
  formNotAvailable: "Formulaire non disponible",
  formNotAvailableDescription: "Ce formulaire n'accepte pas de réponses actuellement.",
  formClosed: "Formulaire fermé",
  formClosedDescription: "Ce formulaire n'accepte plus de réponses.",
  alreadySubmitted: "Déjà soumis",
  alreadySubmittedDescription:
    "Vous avez déjà soumis ce formulaire. Chaque personne ne peut soumettre qu'une seule fois.",
  thankYou: "Merci !",
  responseSubmitted: "Votre réponse a été soumise avec succès.",
  submitAnother: "Soumettre une autre réponse",
  passwordProtected: "Protégé par mot de passe",
  passwordDescription: "Entrez le mot de passe pour accéder à ce formulaire.",
  enterPassword: "Entrez le mot de passe",
  verifying: "Vérification...",
  unlock: "Déverrouiller",
  pleaseEnterPassword: "Veuillez entrer un mot de passe",
  incorrectPassword: "Mot de passe incorrect. Veuillez réessayer.",
  somethingWentWrong: "Une erreur est survenue. Veuillez réessayer.",
  poweredBy: "Propulsé par",
  redirecting: "Redirection dans {n} seconde{s}...",
  submitFailed: "Échec de l'envoi du formulaire. Veuillez réessayer.",
  aiChatInvalidRetry: "Hmm, je n'ai pas bien compris. Pourriez-vous réessayer ?",
  aiChatUnavailable:
    "Nous rencontrons un problème — passage à un formulaire standard. Vos réponses sont enregistrées.",
  aiChatSkipped: "Ignorée",
  aiChatSubmitted: "Merci — votre réponse a été soumise.",
  aiChatSwitchToStandard: "Passer au formulaire standard",
  aiChatResumeRecap: "Voici ce que vous avez partagé jusqu'à présent",
  aiChatContinue: "Reprendre là où vous en étiez",
};

const translations: Record<string, Translations> = { en, es, fr };

const languageCodeMap: Record<string, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
};

export const languageToCode = (language: string): string => languageCodeMap[language] ?? "en";

export const getTranslations = (langOrCode: string): Translations => {
  // Accept either language name or code
  const code = languageCodeMap[langOrCode] ?? langOrCode;
  return translations[code] ?? en;
};

export type { TranslationKey, Translations };
