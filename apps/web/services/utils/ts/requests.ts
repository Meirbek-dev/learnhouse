import { getUriWithOrg } from '@services/config/config'

// Internal helper to create request options, reducing code duplication.
const createRequestInit = (
  method: string,
  config: {
    data?: any
    token?: string
    next?: any
    isJson?: boolean
    // When true, only adds a body for POST, PUT, or DELETE methods.
    limitBodyToMethods?: boolean
  }
): RequestInit & { next?: any } => {
  const {
    data,
    token,
    next,
    isJson = true,
    limitBodyToMethods = false,
  } = config

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const options: RequestInit & { next?: any } = {
    method,
    headers,
    redirect: 'follow',
    credentials: 'include',
    next,
  }

  if (isJson) {
    headers['Content-Type'] = 'application/json'
  }

  const shouldSetBody =
    data != null &&
    (!limitBodyToMethods || ['POST', 'PUT', 'DELETE'].includes(method))

  if (shouldSetBody) {
    options.body = isJson ? JSON.stringify(data) : data
  }

  return options
}

// --- EXPORTED FUNCTIONS (UNCHANGED SIGNATURES) ---

export const RequestBody = (method: string, data: any, next: any) => {
  return createRequestInit(method, { data, next })
}

export const RequestBodyWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  token?: string
) => {
  return createRequestInit(method, {
    data,
    next,
    token,
    limitBodyToMethods: true,
  })
}

/**
 * Note: This function stringifies the body but does not set the
 * 'Content-Type': 'application/json' header. This behavior is preserved
 * for backwards compatibility but may be unintended.
 */
export const RequestBodyForm = (method: string, data: any, next: any) => {
  const options: RequestInit & { next?: any } = {
    method,
    headers: {},
    redirect: 'follow',
    credentials: 'include',
    next,
  }
  if (method === 'POST' || method === 'PUT') {
    options.body = JSON.stringify(data)
  }
  return options
}

export const RequestBodyFormWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  access_token: string
) => {
  // Handles FormData, so isJson is false.
  return createRequestInit(method, {
    data,
    next,
    token: access_token,
    isJson: false,
  })
}

export const swrFetcher = async (url: string, token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const options: RequestInit = {
    method: 'GET',
    headers,
    redirect: 'follow',
    credentials: 'include',
  }
  // The fetch call will throw on network error, and errorHandling throws on non-ok status.
  // The redundant try/catch block has been removed.
  const response = await fetch(url, options)
  return errorHandling(response)
}

export const errorHandling = (res: Response) => {
  if (!res.ok) {
    const error: any = new Error(res.statusText || 'Request failed')
    error.status = res.status
    throw error
  }
  return res.json()
}

type CustomResponseTyping = {
  success: boolean
  data: any
  status: number
  HTTPmessage: string
}

export const getResponseMetadata = async (
  response: Response
): Promise<CustomResponseTyping> => {
  let data: any = null

  // Safely attempt to parse the response body as JSON.
  // This prevents errors if the response is empty (e.g., 204 No Content) or not valid JSON.
  try {
    data = await response.json()
  } catch (error) {
    // Ignore parsing error; data will remain null.
  }

  return {
    success: response.status === 200,
    data,
    status: response.status,
    HTTPmessage: response.statusText,
  }
}

export const revalidateTags = async (tags: string[], orgslug: string) => {
  const url = getUriWithOrg(orgslug, '')
  tags.forEach((tag) => {
    fetch(`${url}/api/revalidate?tag=${tag}`)
  })
}
