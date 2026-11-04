import type { PayloadRequest } from 'payload'

/** Authentication in another collection must not become a customer relationship. */
export const getCustomer = ({
  customersSlug = 'users',
  req,
}: {
  customersSlug?: string
  req: Pick<PayloadRequest, 'user'>
}): null | PayloadRequest['user'] => (req.user?.collection === customersSlug ? req.user : null)
