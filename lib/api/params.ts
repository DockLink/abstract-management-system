export async function routeParams<T extends Record<string, string>>(
  context: { params: Promise<T> | T },
): Promise<T> {
  return Promise.resolve(context.params);
}
