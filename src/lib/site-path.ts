export function sitePath(path: string, base = import.meta.env?.BASE_URL ?? '/') {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const prefix = base.replace(/\/$/, '')
  if (!prefix || path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path}`
}
