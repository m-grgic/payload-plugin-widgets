import type { PayloadRequest } from 'payload'

// What Payload 3 and Payload 4 are asked differently, so that the same code serves both.
// Nothing here may import a component: this is read by the Payload config.

/**
 * What an access function is asked with, as Payload asks it: the request, and the slug of the collection it is
 * asked of. Payload 4 hands an access the slug, and its `AccessArgs` (and `executeAccess`) require it; Payload 3 has
 * no such field, and would refuse it written out in the call, so it is handed over as a value made here.
 */
export const accessArgs = (req: PayloadRequest, slug: string): { req: PayloadRequest; slug: string } => ({ req, slug })
