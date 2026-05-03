export type FollowSource = 'ai-pick' | 'dividend' | 'monthly-dy' | 'quarterly-dy'

export interface FollowedCompany {
  ticker: string
  company: string
  country: string
  countryCode: string
  sector: string
  exchange: string
  source: FollowSource
  followedAt: string
}

export interface UserDoc {
  followed?: string[]
  followedMeta?: Record<string, FollowedCompany>
}
