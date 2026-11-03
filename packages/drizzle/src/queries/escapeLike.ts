/** Escape literal search text before adding SQL LIKE wildcards. */
export const escapeLike = ({ value }: { value: string }): string => value.replace(/[\\%_]/g, '\\$&')
