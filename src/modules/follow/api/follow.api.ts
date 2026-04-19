import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import type { FollowedCompany, UserDoc } from '../domain/follow.types'

function userDocRef(uid: string) {
  return doc(db, 'users', uid)
}

export function subscribeToUserDoc(
  uid: string,
  onChange: (data: UserDoc) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snap) => onChange((snap.data() as UserDoc | undefined) ?? {}),
    (err) => onError?.(err as Error),
  )
}

export async function followCompany(uid: string, entry: FollowedCompany): Promise<void> {
  const ref = userDocRef(uid)
  // setDoc with merge creates the doc on first follow and updates otherwise.
  await setDoc(
    ref,
    {
      followed: arrayUnion(entry.ticker),
      followedMeta: { [entry.ticker]: entry },
    },
    { merge: true },
  )
}

export async function unfollowCompany(uid: string, ticker: string): Promise<void> {
  const ref = userDocRef(uid)
  await updateDoc(ref, {
    followed: arrayRemove(ticker),
    [`followedMeta.${ticker}`]: deleteField(),
  })
}
