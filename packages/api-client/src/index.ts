import type { components } from '@4by4/contracts';

type ErrorPayload = {
  error?: {
    message?: string;
    details?: { fields?: { location?: string[]; message?: string }[] };
  };
} | null;

function extractErrorMessage(payload: ErrorPayload, status: number): string {
  const fields = payload?.error?.details?.fields;
  if (fields?.length) {
    return fields
      .map((field) => {
        const path = field.location?.filter((part) => part !== 'body').join('.');
        return path ? `${path}: ${field.message}` : field.message;
      })
      .join('; ');
  }
  return payload?.error?.message ?? `API request failed with status ${status}`;
}

type FilePart = { uri: string; name: string; type: string } | Blob;

// React Native's FormData only accepts a plain {uri,name,type} descriptor and has no
// filename argument on append(); passing a 3rd arg there breaks its native bridge with
// "Unsupported FormData part implementation". Real Blob/File (web) still needs the filename.
function appendFilePart(form: FormData, field: string, file: FilePart): void {
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const name = 'name' in file ? (file as unknown as { name?: string }).name : undefined;
    form.append(field, file, name);
  } else {
    form.append(field, file as unknown as Blob);
  }
}

export type HealthResponse = components['schemas']['HealthResponse'];
export type ReadinessResponse = components['schemas']['ReadinessResponse'];
export type VersionResponse = components['schemas']['VersionResponse'];
export type ChallengeResponse =
  components['schemas']['app__domains__identity__schemas__ChallengeResponse'];
export type HandoverChallengeResponse =
  components['schemas']['app__domains__fulfillment__schemas__ChallengeResponse'];
export type EmailLoginRequest = components['schemas']['EmailLoginRequest'];
export type EmailRegistrationRequest = components['schemas']['EmailRegistrationRequest'];
export type EmailDirectRegisterRequest = components['schemas']['EmailDirectRegisterRequest'];
export type EmailVerificationRequest = components['schemas']['EmailVerificationRequest'];
export type MobileOTPRequest = components['schemas']['MobileOTPRequest'];
export type MobileOTPVerificationRequest = components['schemas']['MobileOTPVerificationRequest'];
export type MobileDirectRegisterRequest = components['schemas']['MobileDirectRegisterRequest'];
export type SessionTokensResponse = components['schemas']['SessionTokensResponse'];
export type SessionResponse = components['schemas']['SessionResponse'];
export type UserResponse = components['schemas']['UserResponse'];
export type ProfileUpdateRequest = components['schemas']['ProfileUpdateRequest'];
export type AddressRequest = components['schemas']['AddressRequest'];
export type AddressResponse = components['schemas']['AddressResponse'];
export type CategoryResponse = components['schemas']['CategoryResponse'];
export type ListingCreateRequest = components['schemas']['ListingCreateRequest'];
export type ListingUpdateRequest = components['schemas']['ListingUpdateRequest'];
export type ListingResponse = components['schemas']['ListingResponse'];
export type ListingImageResponse = components['schemas']['ListingImageResponse'];
export type ListingStoreAssignmentRequest = components['schemas']['ListingStoreAssignmentRequest'];
export type StoreCreateRequest = components['schemas']['StoreCreateRequest'];
export type StoreOwnerResponse = components['schemas']['StoreOwnerResponse'];
export type StorePublicResponse = components['schemas']['StorePublicResponse'];
export type StoreUpdateRequest = components['schemas']['StoreUpdateRequest'];
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
export type ConversationSummaryResponse = components['schemas']['ConversationSummaryResponse'];
export type OfferCreateRequest = components['schemas']['OfferCreateRequest'];
export type OfferCounterRequest = components['schemas']['OfferCounterRequest'];
export type OfferResponse = components['schemas']['OfferResponse'];
export type BlockUserRequest = components['schemas']['BlockUserRequest'];
export type BlockedUserResponse = components['schemas']['BlockedUserResponse'];
export type AdminDisputeResponse = components['schemas']['AdminDisputeResponse'];
export type AdminCaseUpdateRequest = components['schemas']['AdminCaseUpdateRequest'];

export type SearchListingsParams = {
  query?: string;
  categoryId?: string;
  listingType?: 'item' | 'service';
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
};


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

  registerEmailDirect(payload: EmailDirectRegisterRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/email/register-direct', 'POST', payload);
  }

  requestMobileOTP(payload: MobileOTPRequest): Promise<ChallengeResponse> {
    return this.#request<ChallengeResponse>('/auth/mobile/request-otp', 'POST', payload);
  }

  verifyMobileOTP(payload: MobileOTPVerificationRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/mobile/verify-otp', 'POST', payload);
  }

  registerMobileDirect(payload: MobileDirectRegisterRequest): Promise<SessionTokensResponse> {
    return this.#request<SessionTokensResponse>('/auth/mobile/register-direct', 'POST', payload);
  }

  getCurrentUser(accessToken?: string): Promise<UserResponse> {
    return this.#request<UserResponse>('/auth/me', 'GET', undefined, accessToken);
  }

  updateProfile(
    payload: ProfileUpdateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<UserResponse> {
    return this.#request<UserResponse>('/auth/me', 'PATCH', payload, accessToken, csrfToken);
  }

  deactivateAccount(csrfToken?: string, accessToken?: string): Promise<void> {
    return this.#request<void>('/auth/me', 'DELETE', undefined, accessToken, csrfToken);
  }

  listAddresses(accessToken?: string): Promise<AddressResponse[]> {
    return this.#request<AddressResponse[]>('/auth/me/addresses', 'GET', undefined, accessToken);
  }

  createAddress(
    payload: AddressRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<AddressResponse> {
    return this.#request<AddressResponse>(
      '/auth/me/addresses',
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  updateAddress(
    addressId: string,
    payload: AddressRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<AddressResponse> {
    return this.#request<AddressResponse>(
      `/auth/me/addresses/${addressId}`,
      'PUT',
      payload,
      accessToken,
      csrfToken,
    );
  }

  deleteAddress(
    addressId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<void> {
    return this.#request<void>(
      `/auth/me/addresses/${addressId}`,
      'DELETE',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  uploadAvatar(
    file: { uri: string; name: string; type: string } | Blob,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<UserResponse> {
    const form = new FormData();
    appendFilePart(form, 'file', file);
    return this.#requestMultipart<UserResponse>('/auth/me/avatar', form, accessToken, csrfToken);
  }

  getCategories(): Promise<CategoryResponse[]> {
    return this.#request<CategoryResponse[]>('/categories', 'GET');
  }

  searchListings(params?: SearchListingsParams, accessToken?: string): Promise<ListingResponse[]> {
    const search = new URLSearchParams();
    if (params?.query) search.set('q', params.query);
    if (params?.categoryId) search.set('category_id', params.categoryId);
    if (params?.listingType) search.set('listing_type', params.listingType);
    if (params?.latitude != null) search.set('latitude', String(params.latitude));
    if (params?.longitude != null) search.set('longitude', String(params.longitude));
    if (params?.radiusKm != null) search.set('radius_km', String(params.radiusKm));
    if (params?.limit != null) search.set('limit', String(params.limit));
    const qs = search.toString();
    const path = qs ? `/listings?${qs}` : '/listings';
    return this.#request<ListingResponse[]>(path, 'GET', undefined, accessToken);
  }

  getListing(listingId: string, accessToken?: string): Promise<ListingResponse> {
    return this.#request<ListingResponse>(`/listings/${listingId}`, 'GET', undefined, accessToken);
  }

  getMyListings(accessToken?: string): Promise<ListingResponse[]> {
    return this.#request<ListingResponse[]>('/me/listings', 'GET', undefined, accessToken);
  }

  listMyStores(accessToken?: string): Promise<StoreOwnerResponse[]> {
    return this.#request<StoreOwnerResponse[]>('/me/stores', 'GET', undefined, accessToken);
  }

  createStore(
    payload: StoreCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<StoreOwnerResponse> {
    return this.#request<StoreOwnerResponse>('/me/stores', 'POST', payload, accessToken, csrfToken);
  }

  assignListingStore(
    listingId: string,
    payload: ListingStoreAssignmentRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    return this.#request<ListingResponse>(
      `/me/listings/${listingId}/store`,
      'PUT',
      payload,
      accessToken,
      csrfToken,
    );
  }

  createListing(
    payload: ListingCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    return this.#request<ListingResponse>('/listings', 'POST', payload, accessToken, csrfToken);
  }

  updateListing(
    listingId: string,
    payload: ListingUpdateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    return this.#request<ListingResponse>(
      `/listings/${listingId}`,
      'PATCH',
      payload,
      accessToken,
      csrfToken,
    );
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

  uploadListingImage(
    listingId: string,
    file: { uri: string; name: string; type: string } | Blob,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ListingResponse> {
    const form = new FormData();
    appendFilePart(form, 'file', file);
    return this.#requestMultipart<ListingResponse>(
      `/listings/${listingId}/images`,
      form,
      accessToken,
      csrfToken,
    );
  }

  deleteListingImage(
    listingId: string,
    imageId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<void> {
    return this.#request<void>(
      `/listings/${listingId}/images/${imageId}`,
      'DELETE',
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

  createOffer(
    listingId: string,
    payload: OfferCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/listings/${listingId}/offers`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listOffers(accessToken?: string): Promise<OfferResponse[]> {
    return this.#request<OfferResponse[]>('/offers', 'GET', undefined, accessToken);
  }

  acceptOffer(offerId: string, csrfToken?: string, accessToken?: string): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/accept`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  declineOffer(offerId: string, csrfToken?: string, accessToken?: string): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/decline`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  counterOffer(
    offerId: string,
    payload: OfferCounterRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/counter`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  acceptOfferCounter(
    offerId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/counter/accept`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  declineOfferCounter(
    offerId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/counter/decline`,
      'POST',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  withdrawOffer(
    offerId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<OfferResponse> {
    return this.#request<OfferResponse>(
      `/offers/${offerId}/withdraw`,
      'POST',
      undefined,
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

  listListingMessages(listingId: string, accessToken?: string): Promise<MessageResponse[]> {
    return this.#request<MessageResponse[]>(
      `/listings/${listingId}/messages`,
      'GET',
      undefined,
      accessToken,
    );
  }

  sendListingMessage(
    listingId: string,
    payload: MessageCreateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<MessageResponse> {
    return this.#request<MessageResponse>(
      `/listings/${listingId}/messages`,
      'POST',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listConversations(accessToken?: string): Promise<ConversationSummaryResponse[]> {
    return this.#request<ConversationSummaryResponse[]>(
      '/conversations',
      'GET',
      undefined,
      accessToken,
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

  updateReportCase(
    reportId: string,
    payload: AdminCaseUpdateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<ReportSummary> {
    return this.#request<ReportSummary>(
      `/admin/reports/${reportId}`,
      'PATCH',
      payload,
      accessToken,
      csrfToken,
    );
  }

  listAdminDisputes(accessToken?: string): Promise<AdminDisputeResponse[]> {
    return this.#request<AdminDisputeResponse[]>('/admin/disputes', 'GET', undefined, accessToken);
  }

  updateDisputeCase(
    disputeId: string,
    payload: AdminCaseUpdateRequest,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<AdminDisputeResponse> {
    return this.#request<AdminDisputeResponse>(
      `/admin/disputes/${disputeId}`,
      'PATCH',
      payload,
      accessToken,
      csrfToken,
    );
  }

  blockUser(
    blockedUserId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ status: string }> {
    return this.#request<{ status: string }>(
      '/trust/blocks',
      'POST',
      { blocked_user_id: blockedUserId } satisfies BlockUserRequest,
      accessToken,
      csrfToken,
    );
  }

  unblockUser(
    blockedUserId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<{ status: string }> {
    return this.#request<{ status: string }>(
      `/trust/blocks/${blockedUserId}`,
      'DELETE',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  listBlockedUsers(accessToken?: string): Promise<BlockedUserResponse[]> {
    return this.#request<BlockedUserResponse[]>('/trust/blocks', 'GET', undefined, accessToken);
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

  revokeSession(
    sessionId: string,
    csrfToken?: string,
    accessToken?: string,
  ): Promise<void> {
    return this.#request<void>(
      `/auth/sessions/${sessionId}`,
      'DELETE',
      undefined,
      accessToken,
      csrfToken,
    );
  }

  logout(csrfToken?: string, accessToken?: string): Promise<void> {
    return this.#request<void>('/auth/logout', 'POST', undefined, accessToken, csrfToken);
  }

  async #get<Response>(path: string): Promise<Response> {
    return this.#request<Response>(path, 'GET');
  }

  async #requestMultipart<Response>(
    path: string,
    form: FormData,
    accessToken?: string,
    csrfToken?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      body: form,
      credentials: 'include',
      headers,
      method: 'POST',
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw new Error(extractErrorMessage(payload, response.status));
    }
    return response.json() as Promise<Response>;
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
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw new Error(extractErrorMessage(payload, response.status));
    }
    if (response.status === 204) {
      return undefined as Response;
    }
    return response.json() as Promise<Response>;
  }
}
