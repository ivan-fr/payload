import type { MigrateUpArgs } from '@payloadcms/db-mongodb'

import { home } from '../seed/home'

import { advanced } from '../seed/advanced'
import { advancedForm } from '../seed/advancedForm'
import { basicForm } from '../seed/basicForm'
import { contact } from '../seed/contact'
import { contactForm } from '../seed/contactForm'
import { signUp } from '../seed/signUp'
import { signUpForm } from '../seed/signUpForm'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.create({
    collection: 'users',
    data: {
      email: 'demo@payloadcms.com',
      password: 'demo',
    },
    overrideAccess: true,
  })

  const basicFormJSON = JSON.parse(JSON.stringify(basicForm))

  const { id: basicFormID } = await payload.create({
    collection: 'forms',
    data: basicFormJSON,
    overrideAccess: true,
  })

  const contactFormJSON = JSON.parse(JSON.stringify(contactForm))

  const { id: contactFormID } = await payload.create({
    collection: 'forms',
    data: contactFormJSON,
    overrideAccess: true,
  })

  const advancedFormJSON = JSON.parse(JSON.stringify(advancedForm))

  const { id: advancedFormID } = await payload.create({
    collection: 'forms',
    data: advancedFormJSON,
    overrideAccess: true,
  })

  const signUpFormJSON = JSON.parse(JSON.stringify(signUpForm))

  const { id: signUpFormID } = await payload.create({
    collection: 'forms',
    data: signUpFormJSON,
    overrideAccess: true,
  })

  const homePageJSON = JSON.parse(
    JSON.stringify(home).replaceAll('{{BASIC_FORM_ID}}', basicFormID.toString()),
  )

  const contactPageJSON = JSON.parse(
    JSON.stringify(contact).replaceAll('{{CONTACT_FORM_ID}}', contactFormID.toString()),
  )

  const advancedPageJSON = JSON.parse(
    JSON.stringify(advanced).replaceAll('{{ADVANCED_FORM_ID}}', advancedFormID.toString()),
  )

  const signupPageJSON = JSON.parse(
    JSON.stringify(signUp).replaceAll('{{SIGNUP_FORM_ID}}', signUpFormID.toString()),
  )

  await payload.create({
    collection: 'pages',
    data: homePageJSON,
    overrideAccess: true,
  })

  const { id: contactPageID } = await payload.create({
    collection: 'pages',
    data: contactPageJSON,
    overrideAccess: true,
  })

  const { id: advancedPageID } = await payload.create({
    collection: 'pages',
    data: advancedPageJSON,
    overrideAccess: true,
  })

  const { id: signupPageID } = await payload.create({
    collection: 'pages',
    data: signupPageJSON,
    overrideAccess: true,
  })

  await payload.updateGlobal({
    slug: 'main-menu',
    data: {
      navItems: [
        {
          link: {
            type: 'reference',
            label: 'Contact Form',
            reference: {
              relationTo: 'pages',
              value: contactPageID,
            },
          },
        },
        {
          link: {
            type: 'reference',
            label: 'Advanced Form',
            reference: {
              relationTo: 'pages',
              value: advancedPageID,
            },
          },
        },
        {
          link: {
            type: 'reference',
            label: 'Signup Form',
            reference: {
              relationTo: 'pages',
              value: signupPageID,
            },
          },
        },
      ],
    },
    overrideAccess: true,
  })
}
