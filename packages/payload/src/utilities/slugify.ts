export const slugify = (val?: string): string | undefined =>
  val
    ?.trim()
    .replaceAll(' ', '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
