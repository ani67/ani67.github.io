/**
 * Query parameter naming the open gallery piece, e.g. `/?piece=instrument`.
 *
 * Its own module so the server-rendered grid and the client-side overlay host
 * can share it without the grid pulling in client code.
 */
export const PIECE_PARAM = 'piece';
