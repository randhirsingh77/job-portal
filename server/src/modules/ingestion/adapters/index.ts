import type { Adapter } from './types.js';
import { greenhouse } from './greenhouse.js';
import { lever } from './lever.js';
import { ashby } from './ashby.js';
import { workable } from './workable.js';
export const ADAPTERS: Record<string, Adapter> = { greenhouse, lever, ashby, workable };
export type { Adapter, RawJob } from './types.js';
