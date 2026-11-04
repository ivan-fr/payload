export const mergeCollapsedRows = ({
  collapsedIDs,
  currentRowIDs,
  previousCollapsedIDs = [],
}: {
  collapsedIDs: string[]
  currentRowIDs: string[]
  previousCollapsedIDs?: string[]
}): string[] => {
  const currentIDs = new Set(currentRowIDs)
  const retainedIDs = previousCollapsedIDs.filter((id) => !currentIDs.has(id))
  const mergedIDs = [...retainedIDs, ...collapsedIDs]
  return [...new Set(mergedIDs)]
}
