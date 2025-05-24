export const OPENU_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_OPENU_HTTPS === 'true' ? 'https://' : 'http://'
const OPENU_API_URL = `${process.env.NEXT_PUBLIC_OPENU_API_URL}`
export const OPENU_BACKEND_URL = `${process.env.NEXT_PUBLIC_OPENU_BACKEND_URL}`
export const OPENU_DOMAIN = process.env.NEXT_PUBLIC_OPENU_DOMAIN
export const OPENU_TOP_DOMAIN =
  process.env.NEXT_PUBLIC_OPENU_TOP_DOMAIN

export const getAPIUrl = () => OPENU_API_URL
export const getBackendUrl = () => OPENU_BACKEND_URL

// Multi Organization Mode
export const isMultiOrgModeEnabled = () =>
  process.env.NEXT_PUBLIC_OPENU_MULTI_ORG === 'true' ? true : false

export const getUriWithOrg = (orgslug: string, path: string) => {
  const multi_org = isMultiOrgModeEnabled()
  if (multi_org) {
    return `${OPENU_HTTP_PROTOCOL}${orgslug}.${OPENU_DOMAIN}${path}`
  }
  return `${OPENU_HTTP_PROTOCOL}${OPENU_DOMAIN}${path}`
}

export const getUriWithoutOrg = (path: string) => {
  const multi_org = isMultiOrgModeEnabled()
  if (multi_org) {
    return `${OPENU_HTTP_PROTOCOL}${OPENU_DOMAIN}${path}`
  }
  return `${OPENU_HTTP_PROTOCOL}${OPENU_DOMAIN}${path}`
}

export const getOrgFromUri = () => {
  const multi_org = isMultiOrgModeEnabled()
  if (multi_org) {
    getDefaultOrg()
  } else {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname

      return hostname.replace(`.${OPENU_DOMAIN}`, '')
    }
  }
}

export const getDefaultOrg = () => {
  return process.env.NEXT_PUBLIC_OPENU_DEFAULT_ORG
}
