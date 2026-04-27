import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import type { UserProfile } from '../domain/user-profile.types'

function userDocRef(uid: string) {
  return doc(db, 'users', uid)
}

export function subscribeToProfile(
  uid: string,
  onChange: (profile: UserProfile) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      const data = (snap.data() ?? {}) as Partial<UserProfile>
      onChange({
        taxCountryCode: data.taxCountryCode ?? null,
        taxCountryUpdatedAt: data.taxCountryUpdatedAt,
      })
    },
    (err) => onError?.(err as Error),
  )
}

export async function setTaxCountry(uid: string, countryCode: string | null): Promise<void> {
  await setDoc(
    userDocRef(uid),
    {
      taxCountryCode: countryCode,
      taxCountryUpdatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}
