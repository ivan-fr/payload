'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
import { useEffect } from 'react'

/** Update editability without remounting the editor or replacing its content. */
export function EditablePlugin({ readOnly }: { readOnly: boolean }): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(!readOnly)
  }, [editor, readOnly])
  return null
}
