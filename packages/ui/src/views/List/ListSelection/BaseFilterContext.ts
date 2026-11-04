'use client'

import type { Where } from 'payload'

import { createContext } from 'react'

/** The server-resolved list constraint also applies to grouped and mobile bulk actions. */
export const ListBaseFilterContext = createContext<undefined | Where>(undefined)
