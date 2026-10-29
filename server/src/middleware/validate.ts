import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../utils/errors.js';

export function validate(schema: ZodSchema, part: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) return next(badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
    (req as unknown as Record<string, unknown>)[part === 'body' ? 'validatedBody' : 'validatedQuery'] = parsed.data;
    next();
  };
}
declare global { namespace Express { interface Request { validatedBody?: unknown; validatedQuery?: unknown } } }
export const body = <T>(req: Request): T => req.validatedBody as T;
