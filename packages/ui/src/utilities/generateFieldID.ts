export const generateFieldID = (
  path: string | undefined,
  editDepth: number,
  uuid: string | undefined,
  prefix: string = 'field',
) => {
  if (!path) {
    return undefined
  }
  return `${prefix}-${path.replaceAll('.', '__')}${editDepth > 1 ? `-${editDepth}` : ''}${uuid ? `-${uuid}` : ''}`
}
