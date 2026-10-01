import apiClient from './client'
import type { InviteStatus, TokenResponse } from '../types'

export async function getInvite(id: string): Promise<InviteStatus> {
  const { data } = await apiClient.get<InviteStatus>(`/api/invites/${id}`)
  return data
}

export interface RegisterWithInvitePayload {
  email: string
  username: string
  password: string
  confirm_password: string
}

export async function registerWithInvite(
  id: string,
  payload: RegisterWithInvitePayload,
): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>(`/api/invites/${id}/register`, payload)
  return data
}
