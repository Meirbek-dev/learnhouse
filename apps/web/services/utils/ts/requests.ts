import { getUriWithOrg } from '@services/config/config'

// Helper to create headers
const createHeaders = (contentType?: string, token?: string) => {
  const headers: Record<string, string> = {}
  if (contentType) headers['Content-Type'] = contentType
  if (token) headers.Authorization = `Bearer ${token}`
  return new Headers(headers)
}

// Generalized request body creator
const createRequestOptions = (
  method: string,
  data: any,
  next: any,
  contentType: string | null = 'application/json',
  token?: string,
  rawBody = false
) => {
  const options: any = {
    method,
    headers: createHeaders(contentType || undefined, token),
    redirect: 'follow',
    credentials: 'include',
    next,
  }
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = rawBody ? data : JSON.stringify(data)
  }
  return options
}

export const RequestBody = (method: string, data: any, next: any) =>
  createRequestOptions(method, data, next)

export const RequestBodyWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  token?: string
) => createRequestOptions(method, data, next, 'application/json', token)

export const RequestBodyForm = (method: string, data: any, next: any) =>
  createRequestOptions(method, data, next, null)

export const RequestBodyFormWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  access_token: string
) => createRequestOptions(method, data, next, null, access_token, true)

export const swrFetcher = async (url: string, token?: string) => {
  const options = createRequestOptions(
    'GET',
    null,
    undefined,
    'application/json',
    token
  )
  try {
    const res = await fetch(url, options)
    return await errorHandling(res)
  } catch (error) {
    throw error
  }
}

export const errorHandling = async (res: Response) => {
  if (!res.ok) {
    const error: any = new Error(res.statusText)
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
  fetch_result: any
): Promise<CustomResponseTyping> => {
  const json = await fetch_result.json()
  return {
    success: fetch_result.status === 200,
    data: json,
    status: fetch_result.status,
    HTTPmessage: fetch_result.statusText,
  }
}

export const revalidateTags = async (tags: string[], orgslug: string) => {
  const url = getUriWithOrg(orgslug, '')
  tags.forEach((tag) => {
    fetch(`${url}/api/revalidate?tag=${tag}`)
  })
}
