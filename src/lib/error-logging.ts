type DatabaseErrorDetails = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function logDatabaseError(context: string, error: DatabaseErrorDetails) {
  console.error(`[${context}]`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function logServerError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[${context}]`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: message
      .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]")
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]"),
  });
}

export function isMissingColumn(error: DatabaseErrorDetails | null | undefined, column: string) {
  return error?.code === "42703" || error?.message?.includes(`column ${column} does not exist`);
}
