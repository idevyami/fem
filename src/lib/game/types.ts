// FEMBOY WAR — engine-side types (server only)
import { z } from "zod"

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "unknown"

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "unknown"]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "معمولی",
  uncommon: "غیرمعمولی",
  rare: "نادر",
  epic: "حماسی",
  legendary: "افسانه‌ای",
  unknown: "؟؟؟",
}

export type StatKey =
  | "health"
  | "energy"
  | "luck"
  | "intelligence"
  | "chaos"
  | "fame"
  | "crime"
  | "reputation"
  | "xp"
  | "money"
  | "debt"

export type EventCategory = "story" | "funny" | "dark" | "mystery" | "absurd" | "wholesome" | "legendary"

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  story: "داستانی",
  funny: "خنده‌دار",
  dark: "تاریک",
  mystery: "مرموز",
  absurd: "عجیب",
  wholesome: "دل‌گرم‌کننده",
  legendary: "افسانه‌ای",
}

// ─── Items ────────────────────────────────────────────────────────────────────

export type ItemCategory = "consumable" | "gear" | "collectible" | "junk" | "mystery"

export interface ItemEffect {
  stat: StatKey
  amount: number
}

export interface ItemDef {
  key: string
  name: string
  emoji: string
  rarity: Rarity
  category: ItemCategory
  basePrice: number
  tradable: boolean
  usable: boolean
  description: string
  effect?: ItemEffect
  secret?: boolean // rendered as ??? until owned once
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

export interface PetSpeciesDef {
  key: string
  species: string
  emoji: string
  rarity: Rarity
  personality: string
  description: string
  traits: string[]
  baseLoyalty: number
}

// ─── NPCs ─────────────────────────────────────────────────────────────────────

export interface NpcDef {
  key: string
  name: string
  emoji: string
  occupation: string
  district: string
  personality: string
  description: string
  base: { trust: number; affection: number; respect: number; fear: number }
  secret?: string
}

// ─── Districts ────────────────────────────────────────────────────────────────

export interface DistrictDef {
  key: string
  name: string
  emoji: string
  description: string
  mood: string
  risk: 1 | 2 | 3 | 4
  eventBias: Partial<Record<EventCategory, number>> // weight multipliers
  shops: string[] // itemKeys the local shop stocks
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface JobDef {
  key: string
  name: string
  emoji: string
  description: string
  income: [number, number]
  energyCost: number
  risk: number // 0..1
  cooldownMinutes: number
  minLevel: number
  quirks: string
  workLines: string[] // flavor on success
  failLines: string[] // flavor on risk hit
}

// ─── Vehicles / Houses ────────────────────────────────────────────────────────

export interface VehicleDef {
  key: string
  name: string
  emoji: string
  rarity: Rarity
  basePrice: number
  speed: number
  description: string
  quirk: string
}

export interface HouseDef {
  key: string
  name: string
  emoji: string
  price: number
  rent: number
  comfort: number
  security: number
  description: string
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventCondition {
  minLevel?: number
  minMoney?: number
  minDebt?: number
  stats?: Partial<Record<"luck" | "intelligence" | "chaos" | "fame" | "crime" | "reputation", number>>
  hasItem?: string
  hasPet?: boolean
  hasJob?: boolean
  hasHouse?: boolean
  hasVehicle?: boolean
  districts?: string[]
  weathers?: string[]
  moods?: string[]
  globalEvent?: string
  requiresFlag?: string
  excludesFlag?: string
  minWorldChaos?: number
  maxWorldChaos?: number
}

export interface EffectSpec {
  stat: StatKey
  amount: number
}

export interface NpcDelta {
  npcKey: string
  trust?: number
  affection?: number
  respect?: number
  fear?: number
  memory?: string // what the NPC will remember
}

export interface Outcome {
  weight: number
  text: string
  effects?: EffectSpec[]
  grantItem?: { itemKey: string; quantity?: number }
  grantPet?: { speciesKey: string; suggestedName?: string }
  grantTitle?: string
  grantAchievement?: string
  npc?: NpcDelta[]
  setFlag?: string
  clearFlag?: string
  continueChain?: { nextStep: number; afterMinutes: number }
  notification?: { icon: string; title: string; body: string; delayMinutes?: number }
  worldFeed?: string
  weatherChange?: string
  historyText?: string
}

export interface EventChoice {
  label: string
  hint?: string
  requires?: EventCondition // hides/disables option when unmet
  outcomes: Outcome[]
}

export interface EventDef {
  key: string
  title: string
  emoji: string
  category: EventCategory
  rarity: Rarity
  weight: number
  text: string
  choices: EventChoice[]
  conditions?: EventCondition
  districts?: string[] // event only fires in these districts
  cooldownMinutes?: number
  once?: boolean
  chain?: { key: string; step: number }
}

// ─── Global events / achievements / titles ────────────────────────────────────

export interface GlobalEventDef {
  key: string
  name: string
  emoji: string
  description: string
  feedText: string
  durationMinutes: number
  weight: number
  minWorldDay?: number
  effects: {
    chaos?: number
    economyIndex?: number
    weather?: string
    mood?: string
    boostCategory?: EventCategory
    priceBoost?: { itemKeys: string[]; percent: number }
  }
}

export interface AchievementDef {
  key: string
  name: string
  emoji: string
  description: string
  hidden?: boolean
}

export interface TitleDef {
  key: string
  name: string
  emoji: string
  description: string
  hidden?: boolean
}

// ─── Flags (hidden variables JSON on Player.flags) ────────────────────────────

export interface PlayerFlags {
  seenEvents?: string[]
  pendingChain?: { key: string; nextStep: number; notBefore: number } | null
  counters?: Record<string, number>
  discovered?: string[] // item keys discovered
  hiddenVars?: Record<string, number>
  onboardIntroDone?: boolean
  visitedDistricts?: string[] // V4: محله‌های دیده‌شده (برای آرزوی کاوشگر)
  [k: string]: unknown
}

// ─── API request schemas (zod) ────────────────────────────────────────────────

export const loginSchema = z.object({
  initData: z.string().optional(),
  name: z.string().min(2).max(24).optional(),
  avatar: z.string().max(8).optional(),
})

export const chooseSchema = z.object({
  eventId: z.string().min(1),
  optionIndex: z.number().int().min(0).max(9),
})

export const actionSchema = z.object({
  action: z.enum([
    "work",
    "travel",
    "rest",
    "feedPet",
    "playPet",
    "renamePet",
    "useItem",
    "equipItem",
    "favoriteItem",
    "buyItem",
    "sellItem",
    "createListing",
    "cancelListing",
    "payDebt",
    "buyVehicle",
    "buyHouse",
    "setJob",
    "quitJob",
    "setTitle",
    "buyPetFood",
    "readNotifications",
    "gamble",
    "claimOpportunity",
    "setIdentity",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type ActionInput = z.infer<typeof actionSchema>
