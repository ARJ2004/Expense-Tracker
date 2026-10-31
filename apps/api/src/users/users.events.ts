/** Domain events emitted by the users module. Listeners live in the reacting module. */
export const USER_SIGNED_UP = 'user.signed_up';

export interface UserSignedUpEvent {
  userId: string;
}
