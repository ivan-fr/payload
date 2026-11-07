'use client'

import React, { createContext, use, useState } from 'react'

type ActionsContextType = {
  Actions: {
    [key: string]: React.ReactNode
  }
  setViewActions: (actions: ActionsContextType['Actions']) => void
}

const ActionsContext = createContext<ActionsContextType>({
  Actions: {},
  setViewActions: () => {},
})

export const useActions = () => use(ActionsContext)

export const ActionsProvider: React.FC<{
  readonly Actions?: {
    [key: string]: React.ReactNode
  }
  readonly children: React.ReactNode
  readonly viewKey?: string
}> = ({ Actions, children, viewKey }) => {
  const [viewActions, setViewActions] = useState(Actions)
  const [currentViewKey, setCurrentViewKey] = useState(viewKey)

  // Reset before the new view mounts, so its effects can register their actions.
  if (currentViewKey !== viewKey) {
    setCurrentViewKey(viewKey)
    setViewActions(Actions)
  }

  return (
    <ActionsContext
      value={{
        Actions: {
          ...viewActions,
          ...Actions,
        },
        setViewActions,
      }}
    >
      {children}
    </ActionsContext>
  )
}
