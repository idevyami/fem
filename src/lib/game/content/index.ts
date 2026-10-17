// FEMBOY WAR — content registry (pure data, safe to import anywhere)
export { ITEMS, ITEM_MAP, getItem } from "./items"
export { PET_SPECIES, PET_MAP, getPetSpecies } from "./pets"
export { NPCS, NPC_MAP, getNpc } from "./npcs"
export { DISTRICTS, DISTRICT_MAP, getDistrict } from "./districts"
export { JOBS, JOB_MAP, getJob, VEHICLES, VEHICLE_MAP, getVehicle, HOUSES, HOUSE_MAP, getHouse } from "./jobs"
export { EVENTS, EVENT_MAP, getEvent, findChainEvent } from "./events"
export {
  GLOBAL_EVENTS,
  GLOBAL_EVENT_MAP,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  TITLES,
  TITLE_MAP,
  getGlobalEvent,
} from "./globals"
export { ASPIRATIONS, aspirationProgress, type AspirationDef } from "./aspirations"
