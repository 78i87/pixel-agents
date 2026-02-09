import { FurnitureType } from '../types.js'
import type { FurnitureCatalogEntry, SpriteData } from '../types.js'
import {
  DESK_SQUARE_SPRITE,
  BOOKSHELF_SPRITE,
  PLANT_SPRITE,
  COOLER_SPRITE,
  WHITEBOARD_SPRITE,
  CHAIR_SPRITE,
  PC_SPRITE,
  LAMP_SPRITE,
} from '../sprites/spriteData.js'
import {
  TS_TABLE_WOOD_SM_VERTICAL,
  TS_CHAIR_CUSHION, TS_CHAIR_SPINNING, TS_BENCH,
  TS_WATER_COOLER, TS_FRIDGE, TS_DECO_3,
  TS_CLOCK, TS_LIBRARY_GRAY_FULL, TS_PLANT_SMALL,
  TS_PAINTING_LARGE_1, TS_PAINTING_LARGE_2,
  TS_PAINTING_SMALL_1, TS_PAINTING_SMALL_2, TS_PAINTING_SMALL_3,
} from '../sprites/tilesetSprites.js'

export interface LoadedAssetData {
  catalog: Array<{
    id: string
    label: string
    category: string
    width: number
    height: number
    footprintW: number
    footprintH: number
    isDesk: boolean
  }>
  sprites: Record<string, SpriteData>
}

export type FurnitureCategory = 'desks' | 'chairs' | 'storage' | 'decor' | 'electronics' | 'misc'

export interface CatalogEntryWithCategory extends FurnitureCatalogEntry {
  category: FurnitureCategory
}

export const FURNITURE_CATALOG: CatalogEntryWithCategory[] = [
  // ── Original hand-drawn sprites ──
  { type: FurnitureType.DESK,       label: 'Desk',       footprintW: 2, footprintH: 2, sprite: DESK_SQUARE_SPRITE,  isDesk: true,  category: 'desks' },
  { type: FurnitureType.BOOKSHELF,  label: 'Bookshelf',  footprintW: 1, footprintH: 2, sprite: BOOKSHELF_SPRITE,    isDesk: false, category: 'storage' },
  { type: FurnitureType.PLANT,      label: 'Plant',      footprintW: 1, footprintH: 1, sprite: PLANT_SPRITE,        isDesk: false, category: 'decor' },
  { type: FurnitureType.COOLER,     label: 'Cooler',     footprintW: 1, footprintH: 1, sprite: COOLER_SPRITE,       isDesk: false, category: 'misc' },
  { type: FurnitureType.WHITEBOARD, label: 'Whiteboard', footprintW: 2, footprintH: 1, sprite: WHITEBOARD_SPRITE,   isDesk: false, category: 'decor' },
  { type: FurnitureType.CHAIR,      label: 'Chair',      footprintW: 1, footprintH: 1, sprite: CHAIR_SPRITE,        isDesk: false, category: 'chairs' },
  { type: FurnitureType.PC,         label: 'PC',         footprintW: 1, footprintH: 1, sprite: PC_SPRITE,           isDesk: false, category: 'electronics' },
  { type: FurnitureType.LAMP,       label: 'Lamp',       footprintW: 1, footprintH: 1, sprite: LAMP_SPRITE,         isDesk: false, category: 'decor' },

  // ── Tileset — Desks ──
  { type: FurnitureType.TABLE_WOOD_SM_VERTICAL, label: 'Wood Table Vertical', footprintW: 1, footprintH: 2, sprite: TS_TABLE_WOOD_SM_VERTICAL, isDesk: true, category: 'desks' },

  // ── Tileset — Chairs ──
  { type: FurnitureType.CHAIR_CUSHION,  label: 'Cushioned Chair', footprintW: 4, footprintH: 1, sprite: TS_CHAIR_CUSHION,  isDesk: false, category: 'chairs' },
  { type: FurnitureType.CHAIR_SPINNING, label: 'Spinning Chair',  footprintW: 4, footprintH: 1, sprite: TS_CHAIR_SPINNING, isDesk: false, category: 'chairs' },
  { type: FurnitureType.BENCH,          label: 'Bench',           footprintW: 1, footprintH: 1, sprite: TS_BENCH,          isDesk: false, category: 'chairs' },

  // ── Tileset — Decor ──
  { type: FurnitureType.WATER_COOLER,     label: 'Water Cooler',     footprintW: 1, footprintH: 2, sprite: TS_WATER_COOLER,     isDesk: false, category: 'decor' },
  { type: FurnitureType.FRIDGE,           label: 'Fridge',           footprintW: 1, footprintH: 2, sprite: TS_FRIDGE,           isDesk: false, category: 'decor' },
  { type: FurnitureType.DECO_3,           label: 'DECO 3',           footprintW: 2, footprintH: 2, sprite: TS_DECO_3,           isDesk: false, category: 'decor' },
  { type: FurnitureType.CLOCK,            label: 'Clock',            footprintW: 1, footprintH: 1, sprite: TS_CLOCK,            isDesk: false, category: 'decor' },
  { type: FurnitureType.LIBRARY_GRAY_FULL, label: 'Library Gray Full', footprintW: 2, footprintH: 2, sprite: TS_LIBRARY_GRAY_FULL, isDesk: false, category: 'decor' },
  { type: FurnitureType.PLANT_SMALL,      label: 'Small Plant',      footprintW: 1, footprintH: 1, sprite: TS_PLANT_SMALL,      isDesk: false, category: 'decor' },
  { type: FurnitureType.PAINTING_LARGE_1, label: 'Painting Large 1', footprintW: 2, footprintH: 1, sprite: TS_PAINTING_LARGE_1, isDesk: false, category: 'decor' },
  { type: FurnitureType.PAINTING_LARGE_2, label: 'Painting Large 2', footprintW: 2, footprintH: 1, sprite: TS_PAINTING_LARGE_2, isDesk: false, category: 'decor' },
  { type: FurnitureType.PAINTING_SMALL_1, label: 'Painting Small 1', footprintW: 1, footprintH: 1, sprite: TS_PAINTING_SMALL_1, isDesk: false, category: 'decor' },
  { type: FurnitureType.PAINTING_SMALL_2, label: 'Painting Small 2', footprintW: 1, footprintH: 1, sprite: TS_PAINTING_SMALL_2, isDesk: false, category: 'decor' },
  { type: FurnitureType.PAINTING_SMALL_3, label: 'Painting Small 3', footprintW: 1, footprintH: 1, sprite: TS_PAINTING_SMALL_3, isDesk: false, category: 'decor' },
]

// Dynamic catalog built from loaded assets (when available)
let dynamicCatalog: CatalogEntryWithCategory[] | null = null
let dynamicCategories: FurnitureCategory[] | null = null

/**
 * Build catalog from loaded assets. Returns true if successful.
 * Once built, all getCatalog* functions use the dynamic catalog.
 * Uses ONLY custom assets (excludes hardcoded furniture when assets are loaded).
 */
export function buildDynamicCatalog(assets: LoadedAssetData): boolean {
  if (!assets?.catalog || !assets?.sprites) return false

  const entries: CatalogEntryWithCategory[] = []

  // Add new exported assets (no hardcoded furniture when custom assets are present)
  const newAssets = assets.catalog.map((asset) => {
    const sprite = assets.sprites[asset.id]
    if (!sprite) {
      console.warn(`No sprite data for asset ${asset.id}`)
      return null
    }
    return {
      type: asset.id,
      label: asset.label,
      footprintW: asset.footprintW,
      footprintH: asset.footprintH,
      sprite,
      isDesk: asset.isDesk,
      category: asset.category as FurnitureCategory,
    }
  }).filter((e): e is CatalogEntryWithCategory => e !== null)

  entries.push(...newAssets)

  if (newAssets.length === 0) return false

  dynamicCatalog = entries
  dynamicCategories = Array.from(new Set(entries.map((e) => e.category)))
    .filter((c): c is FurnitureCategory => !!c)
    .sort()

  console.log(`✓ Built dynamic catalog with ${newAssets.length} custom assets (hardcoded furniture disabled)`)
  return true
}

export function getCatalogEntry(type: string): CatalogEntryWithCategory | undefined {
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.find((e) => e.type === type)
}

export function getCatalogByCategory(category: FurnitureCategory): CatalogEntryWithCategory[] {
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.filter((e) => e.category === category)
}

export function getActiveCatalog(): CatalogEntryWithCategory[] {
  return dynamicCatalog || FURNITURE_CATALOG
}

export function getActiveCategories(): Array<{ id: FurnitureCategory; label: string }> {
  const categories = dynamicCategories || (FURNITURE_CATEGORIES.map((c) => c.id) as FurnitureCategory[])
  return FURNITURE_CATEGORIES.filter((c) => categories.includes(c.id))
}

export const FURNITURE_CATEGORIES: Array<{ id: FurnitureCategory; label: string }> = [
  { id: 'desks', label: 'Desks' },
  { id: 'chairs', label: 'Chairs' },
  { id: 'storage', label: 'Storage' },
  { id: 'electronics', label: 'Tech' },
  { id: 'decor', label: 'Decor' },
  { id: 'misc', label: 'Misc' },
]
