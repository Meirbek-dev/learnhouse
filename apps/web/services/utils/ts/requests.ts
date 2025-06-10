import { getUriWithOrg } from '@services/config/config'

export const RequestBody = (method: string, data: any, next: any) => {
  const headers = { 'Content-Type': 'application/json' }
  const options: RequestInit & { next?: any } = {
    method,
    headers,
    redirect: 'follow',
    credentials: 'include',
    next,
  }
  if (data) options.body = JSON.stringify(data)
  return options
}

export const RequestBodyWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  token?: string
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const options: RequestInit & { next?: any } = {
    method,
    headers,
    redirect: 'follow',
    credentials: 'include',
    next,
  }
  if (
    (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
    data != null
  ) {
    options.body = JSON.stringify(data)
  }
  return options
}

export const RequestBodyForm = (method: string, data: any, next: any) => {
  const options: RequestInit & { next?: any } = {
    method,
    headers: {},
    redirect: 'follow',
    credentials: 'include',
    next,
  }
  if (method === 'POST' || method === 'PUT') options.body = JSON.stringify(data)
  return options
}

export const RequestBodyFormWithAuthHeader = (
  method: string,
  data: any,
  next: any,
  access_token: string
) => {
  const headers = { Authorization: `Bearer ${access_token}` }
  const options: RequestInit & { next?: any } = {
    method,
    headers,
    redirect: 'follow',
    credentials: 'include',
    body: data,
    next,
  }
  return options
}

export const swrFetcher = async (url: string, token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const options: RequestInit = {
    method: 'GET',
    headers,
    redirect: 'follow',
    credentials: 'include',
  }
  try {
    const request = await fetch(url, options)
    return errorHandling(request)
  } catch (error) {
    throw error
  }
}

export const errorHandling = (res: Response) => {
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
