/** Domain events emitted by the users module. Listeners live in the reacting module. */
export const USER_SIGNED_UP = 'user.signed_up';

export interface UserSignedUpEvent {
  userId: string;
}

/** Emitted after a user and all their data are purged (DELETE /v1/me). */
export const USER_DELETED = 'user.deleted';

export interface UserDeletedEvent {
  userId: string;
}
