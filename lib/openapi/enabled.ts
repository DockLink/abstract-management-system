/** Docs are always on in development; production requires ENABLE_API_DOCS=true. */
export function isApiDocsEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_API_DOCS === "true"
  );
}
