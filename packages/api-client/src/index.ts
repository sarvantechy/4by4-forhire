import type { components } from '@4by4/contracts';

export type HealthResponse = components['schemas']['HealthResponse'];
export type ReadinessResponse = components['schemas']['ReadinessResponse'];
export type VersionResponse = components['schemas']['VersionResponse'];
export type ChallengeResponse =
  components['schemas']['app__domains__identity__schemas__ChallengeResponse'];
export type HandoverChallengeResponse =
  components['schemas']['app__domains__fulfillment__schemas__ChallengeResponse'];
export type EmailLoginRequest = components['schemas']['EmailLoginRequest'];
export type EmailRegistrationRequest = components['schemas']['EmailRegistrationRequest'];
export type EmailVerificationRequest = components['schemas']['EmailVerificationRequest'];
export type MobileOTPRequest = components['schemas']['MobileOTPRequest'];
export type MobileOTPVerificationRequest = components['schemas']['MobileOTPVerificationRequest'];
export type SessionTokensResponse = components['schemas']['SessionTokensResponse'];
export type SessionResponse = components['schemas']['SessionResponse'];
export type UserResponse = components['schemas']['UserResponse'];
export type CategoryResponse = components['schemas']['CategoryResponse'];
export type ListingCreateRequest = components['schemas']['ListingCreateRequest'];
export type ListingResponse = components['schemas']['ListingResponse'];
export type QuoteRequest = components['schemas']['QuoteRequest'];
export type QuoteResponse = components['schemas']['QuoteResponse'];
export type BookingCreateRequest = components['schemas']['BookingCreateRequest'];
export type BookingResponse = components['schemas']['BookingResponse'];
export type MessageCreateRequest = components['schemas']['MessageCreateRequest'];
export type MessageResponse = components['schemas']['MessageResponse'];
export type FulfillmentScheduleRequest = components['schemas']['FulfillmentScheduleRequest'];
export type FulfillmentResponse = components['schemas']['FulfillmentResponse'];
export type ChallengeConfirmRequest = components['schemas']['ChallengeConfirmRequest'];
export type ConditionReportRequest = components['schemas']['ConditionReportRequest'];
export type PaymentAcknowledgementRequest =
  components['schemas']['PaymentAcknowledgementRequest'];
export type ReviewRequest = components['schemas']['ReviewRequest'];
export type DisputeRequest = components['schemas']['DisputeRequest'];
export type ReportRequest = components['schemas']['ReportRequest'];
export type ModerationRequest = components['schemas']['ModerationRequest'];
export type ReportSummary = components['schemas']['AdminReportResponse'];

export type APIClientOptions = {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
};

export class APIClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor({ baseUrl, fetch: fetchImplementation }: APIClientOptions) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#fetch = fetchImplementation ?? globalThis.fetch.bind(globalThis);
  }

  getLiveness(): Promise<HealthResponse> {
    return this.#get<HealthResponse>('/health/live');
  }

  getReadiness(): Promise<ReadinessResponse> {
    return this.#get<ReadinessResponse>('/health/ready');
  }

  getVersion(): Promise<VersionResponse> {
    return this.#get<VersionResponse>('/version');
  }

  registerEmail(payload: EmailRegistrationRequest): Promise<ChallengeResponse> {
    return this.#request<ChallengeResponse>('/auth/email/register', 'POST', payload);
  }

  verifyEmail(payload: EmailVerificationRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/email/verify', 'POST', payload);
  }

  loginEmail(payload: EmailLoginRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/login', 'POST', payload);
  }

  requestMobileOTP(payload: MobileOTPRequest): Promise<ChallengeResponse> {
    return this.#request<ChallengeResponse>('/auth/mobile/request-otp', 'POST', payload);
  }

  verifyMobileOTP(payload: MobileOTPVerificationRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/mobile/verify-otp', 'POST', payload);
  }

  getCurrentUser(accessToken?: string): Promise<UserResponse> {
    return this.#request<UserResponse>('/auth/me', 'GET', undefined, accessToken);
  }

  getCategories(): Promise<CategoryResponse[]> {
    return this.#request<CategoryResponse[]>('/categories', 'GET');
  }

  searchListings(query?: string): Promise<ListingResponse[]> {
    const search = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.#request<ListingResponse[]>(`/listings${search}`, 'GET');
  }

  getMyListings(accessToken?: string): Promise<ListingResponse[]> {
    return this.#request<ListingResponse[]>('/me/listings', 'GET', undefined, accessToken);
  }

  createListing(
    payload: ListingCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    return this.#request<ListingResponse>('/listings', 'POST', payload, accessToken, csrfToken);
  }

  transitionListing(
    listingId: string,
    action: 'publish' | 'pause' | 'resume' | 'archive',
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    return this.#request<ListingResponse>(
      `/listings/${listingId}/${action}`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  createQuote(
    listingId: string,
    payload: QuoteRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<QuoteResponse> {
    return this.#request<QuoteResponse>(
      `/listings/${listingId}/quotes`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  createBooking(
    payload: BookingCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      '/bookings',
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listBookings(accessToken?: string): Promise<BookingResponse[]> {
    return this.#request<BookingResponse[]>('/bookings', 'GET', undefined, accessToken);
  }

  getBooking(bookingId: string, accessToken?: string): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      `/bookings/${bookingId}`,
      'GET',
      undefined,
      accessToken,
    );
  }

  transitionBooking(
    bookingId: string,
    action: 'accept' | 'reject' | 'cancel',
    csrfToken?: string,
    accessToken?: string,
  ): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      `/bookings/${bookingId}/${action}`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  listMessages(bookingId: string, accessToken?: string): Promise<MessageResponse[]> {
    return this.#request<MessageResponse[]>(
      `/bookings/${bookingId}/messages`,
      'GET',
      undefined,
      accessToken,
    );
  }

  sendMessage(
    bookingId: string,
    payload: MessageCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<MessageResponse> {
    return this.#request<MessageResponse>(
      `/bookings/${bookingId}/messages`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  scheduleFulfillment(
    bookingId: string,
    payload: FulfillmentScheduleRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<FulfillmentResponse> {
    return this.#request<FulfillmentResponse>(
      `/bookings/${bookingId}/fulfillment`,
      'PUT',
      payload,
      accessToken,
      csrfToken,
    );
  }

  createHandoverChallenge(
    bookingId: string,
    purpose: 'handover' | 'return',
    csrfToken?: string,
    accessToken?: string,
  ): Promise<HandoverChallengeResponse> {
    return this.#request<HandoverChallengeResponse>(
      `/bookings/${bookingId}/${purpose}/challenge`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  confirmHandoverChallenge(
    bookingId: string,
    payload: ChallengeConfirmRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      `/bookings/${bookingId}/challenge/confirm`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  addConditionReport(
    bookingId: string,
    payload: ConditionReportRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string }> {
    return this.#request<{ id: string }>(
      `/bookings/${bookingId}/condition-reports`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  acknowledgePayment(
    bookingId: string,
    payload: PaymentAcknowledgementRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string; disagreement: boolean }> {
    return this.#request<{ id: string; disagreement: boolean }>(
      `/bookings/${bookingId}/payment-at-pickup/acknowledge`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  initiateReturn(
    bookingId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      `/bookings/${bookingId}/return/initiate`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  acceptInspection(
    bookingId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<BookingResponse> {
    return this.#request<BookingResponse>(
      `/bookings/${bookingId}/inspection/accept`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  createReview(
    bookingId: string,
    payload: ReviewRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string; rating: number }> {
    return this.#request<{ id: string; rating: number }>(
      `/bookings/${bookingId}/reviews`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  createDispute(
    bookingId: string,
    payload: DisputeRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string; status: string }> {
    return this.#request<{ id: string; status: string }>(
      `/bookings/${bookingId}/disputes`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  createReport(
    payload: ReportRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string; status: string }> {
    return this.#request<{ id: string; status: string }>(
      '/reports',
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listAdminReports(accessToken?: string): Promise<ReportSummary[]> {
    return this.#request<ReportSummary[]>('/admin/reports', 'GET', undefined, accessToken);
  }

  moderateListing(
    listingId: string,
    payload: ModerationRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ id: string; status: string }> {
    return this.#request<{ id: string; status: string }>(
      `/admin/listings/${listingId}/moderate`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listSessions(accessToken?: string): Promise<SessionResponse[]> {
    return this.#request<SessionResponse[]>('/auth/sessions', 'GET', undefined, accessToken);
  }

  logout(csrfToken?: string, accessToken?: string): Promise<void> {
    return this.#request<void>('/auth/logout', 'POST', undefined, accessToken, csrfToken);
  }

  async #get<Response>(path: string): Promise<Response> {
    return this.#request<Response>(path, 'GET');
  }

  async #request<Response>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body?: object,
    accessToken?: string,
    csrfToken?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      headers,
      method,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        payload?.error?.message ?? `API request failed with status ${response.status}`,
      );
    }
    if (response.status === 204) {
      return undefined as Response;
    }
    return response.json() as Promise<Response>;
  }
}
