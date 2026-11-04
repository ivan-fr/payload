/**
 * Creates a proxy for the given object that has its own property
 */
export function isolateObjectProperty<T extends object>(object: T, key: (keyof T)[] | keyof T): T {
  const keys = Array.isArray(key) ? key : [key]
  const delegate = {} as T
  const requestMethods = new Map<PropertyKey, { bound: unknown; original: unknown }>()

  // Initialize delegate with the keys, if they exist in the original object
  for (const k of keys) {
    if (k in object) {
      delegate[k] = object[k]
    }
  }

  const handler: ProxyHandler<T> = {
    deleteProperty(target, p): boolean {
      return Reflect.deleteProperty(keys.includes(p as keyof T) ? delegate : target, p)
    },
    get(target, p, receiver) {
      if (keys.includes(p as keyof T)) {
        return Reflect.get(delegate, p, receiver)
      }
      // Use target as receiver to preserve private field access (e.g., Request#headers in Node 24+)
      const value = Reflect.get(target, p, target)

      // Frameworks may override the standard Request methods with private-field access.
      // Bind only that API; application methods must still see the isolated scope.
      if (
        p !== 'constructor' &&
        typeof Request !== 'undefined' &&
        target instanceof Request &&
        typeof value === 'function' &&
        ['arrayBuffer', 'blob', 'bytes', 'clone', 'formData', 'json', 'text'].includes(String(p))
      ) {
        const cached = requestMethods.get(p)
        if (cached?.original === value) {
          return cached.bound
        }
        const bound = value.bind(target)
        requestMethods.set(p, { bound, original: value })
        return bound
      }

      return value
    },
    getOwnPropertyDescriptor(target, p) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, p)
      if (
        keys.includes(p as keyof T) &&
        descriptor?.configurable !== false &&
        Reflect.isExtensible(target)
      ) {
        const isolatedDescriptor = Reflect.getOwnPropertyDescriptor(delegate, p)
        return isolatedDescriptor
          ? { ...isolatedDescriptor, enumerable: descriptor?.enumerable ?? true }
          : undefined
      }
      return descriptor
    },
    has(target, p) {
      return Reflect.has(keys.includes(p as keyof T) ? delegate : target, p)
    },
    ownKeys(target) {
      const targetKeys = Reflect.ownKeys(target)
      const allKeys = [...targetKeys, ...Reflect.ownKeys(delegate)]
      return Reflect.isExtensible(target) ? [...new Set(allKeys)] : targetKeys
    },
    set(target, p, newValue, _receiver) {
      if (keys.includes(p as keyof T)) {
        // in case of transactionID we must ignore any receiver, because
        // "If provided and target does not have a setter for propertyKey, the property will be set on receiver instead."
        return Reflect.set(delegate, p, newValue)
      }
      return Reflect.set(target, p, newValue, target)
    },
  }
  return new Proxy(object, handler)
}
