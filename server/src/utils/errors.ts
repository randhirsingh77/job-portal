export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const badRequest = (m: string) => new HttpError(400, 'bad_request', m);
export const unauthorised = (m = 'Invalid credentials') => new HttpError(401, 'unauthorised', m);
export const forbidden = (m = 'You do not have access to this resource') => new HttpError(403, 'forbidden', m);
export const notFound = (m = 'Not found') => new HttpError(404, 'not_found', m);
