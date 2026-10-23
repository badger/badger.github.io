export function doomAliasDestination(pathname: string, base = '/') {
  const prefix = `${base.replace(/\/$/, '')}/`
  if (!pathname.startsWith(prefix)) return null
  const route = pathname.slice(prefix.length)
  if (!/^(doom|doom3d|d00m3d|virtual)\/?$/i.test(route)) return null
  if (route === 'virtual' || route === 'virtual/') return null
  return `${prefix}virtual/`
}
