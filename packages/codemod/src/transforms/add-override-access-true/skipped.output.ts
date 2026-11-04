const options = { overrideAccess: false }
await payload.find({ ...options, collection: 'posts' })
await req.payload.update(options)
await payload.jobs.queue(options)
await payload.find({ ...options, overrideAccess: false })
await other.find(options)
