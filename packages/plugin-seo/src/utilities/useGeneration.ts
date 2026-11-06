'use client'

import { toast, useTranslation } from '@payloadcms/ui'
import { useCallback, useRef, useState } from 'react'

export function useGeneration({
  generate,
  readOnly,
}: {
  generate: () => Promise<void>
  readOnly?: boolean
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const isPending = useRef(false)
  const { t } = useTranslation()

  const run = useCallback(async () => {
    if (readOnly || isPending.current) {
      return
    }
    isPending.current = true
    setIsGenerating(true)
    try {
      await generate()
    } catch {
      toast.error(t('error:unknown'))
    } finally {
      isPending.current = false
      setIsGenerating(false)
    }
  }, [generate, readOnly, t])

  return { isGenerating, run }
}
