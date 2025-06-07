export const LEARNHOUSE_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_LEARNHOUSE_HTTPS === 'true' ? 'https://' : 'http://'
const LEARNHOUSE_API_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_API_URL}`
export const LEARNHOUSE_BACKEND_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL}`
export const LEARNHOUSE_DOMAIN = process.env.NEXT_PUBLIC_LEARNHOUSE_DOMAIN
export const LEARNHOUSE_TOP_DOMAIN =
  process.env.NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN

export const getAPIUrl = () => LEARNHOUSE_API_URL
export const getBackendUrl = () => LEARNHOUSE_BACKEND_URL

// Multi Organization Mode
export const isMultiOrgModeEnabled = () =>
  process.env.NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG === 'true'

export const getUriWithOrg = (orgslug: string, path: string) => {
  return isMultiOrgModeEnabled()
    ? `${LEARNHOUSE_HTTP_PROTOCOL}${orgslug}.${LEARNHOUSE_DOMAIN}${path}`
    : `${LEARNHOUSE_HTTP_PROTOCOL}${LEARNHOUSE_DOMAIN}${path}`
}

export const getUriWithoutOrg = (path: string) =>
  `${LEARNHOUSE_HTTP_PROTOCOL}${LEARNHOUSE_DOMAIN}${path}`

export const getOrgFromUri = () => {
  if (isMultiOrgModeEnabled()) {
    return getDefaultOrg()
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    return hostname.replace(`.${LEARNHOUSE_DOMAIN}`, '')
  }
}

export const getDefaultOrg = () =>
  process.env.NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG
