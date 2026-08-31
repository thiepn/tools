import { parseHumanNumber } from './human-number';

export type UnitCategory = 'weight' | 'volume' | 'count' | 'length' | 'area';
export type NormalizationBasis = 'standard' | 'hundred' | 'base';

export interface UnitDefinition {
  id: string;
  label: string;
  category: UnitCategory;
  baseRatio: number;
  displayStandardUnit: string;
}

export const SUPPORTED_UNITS: UnitDefinition[] = [
  { id: 'mg', label: 'Milligrams (mg)', category: 'weight', baseRatio: 0.001, displayStandardUnit: 'kg' },
  { id: 'g', label: 'Grams (g)', category: 'weight', baseRatio: 1, displayStandardUnit: 'kg' },
  { id: 'kg', label: 'Kilograms (kg)', category: 'weight', baseRatio: 1000, displayStandardUnit: 'kg' },
  { id: 'oz', label: 'Ounces (oz)', category: 'weight', baseRatio: 28.349523125, displayStandardUnit: 'lb' },
  { id: 'lb', label: 'Pounds (lb)', category: 'weight', baseRatio: 453.59237, displayStandardUnit: 'lb' },
  { id: 'ml', label: 'Milliliters (ml)', category: 'volume', baseRatio: 1, displayStandardUnit: 'L' },
  { id: 'l', label: 'Liters (L)', category: 'volume', baseRatio: 1000, displayStandardUnit: 'L' },
  { id: 'floz', label: 'Fluid Ounces (fl oz)', category: 'volume', baseRatio: 29.5735295625, displayStandardUnit: 'fl oz' },
  { id: 'gal', label: 'Gallons (US gal)', category: 'volume', baseRatio: 3785.411784, displayStandardUnit: 'gal' },
  { id: 'pt', label: 'Pints (US pt)', category: 'volume', baseRatio: 473.176473, displayStandardUnit: 'gal' },
  { id: 'qt', label: 'Quarts (US qt)', category: 'volume', baseRatio: 946.352946, displayStandardUnit: 'gal' },
  { id: 'item', label: 'Items / Units', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'pcs', label: 'Pieces (pcs)', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'pack', label: 'Packs (e.g. 10-pack)', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'sheet', label: 'Sheets / Rolls', category: 'count', baseRatio: 1, displayStandardUnit: 'sheet' },
  { id: 'm', label: 'Meters (m)', category: 'length', baseRatio: 1, displayStandardUnit: 'm' },
  { id: 'cm', label: 'Centimeters (cm)', category: 'length', baseRatio: 0.01, displayStandardUnit: 'm' },
  { id: 'ft', label: 'Feet (ft)', category: 'length', baseRatio: 0.3048, displayStandardUnit: 'ft' },
  { id: 'yd', label: 'Yards (yd)', category: 'length', baseRatio: 0.9144, displayStandardUnit: 'yd' },
  { id: 'sqm', label: 'Square Meters (m²)', category: 'area', baseRatio: 1, displayStandardUnit: 'm²' },
  { id: 'sqft', label: 'Square Feet (sq ft)', category: 'area', baseRatio: 0.09290304, displayStandardUnit: 'sq ft' },
];

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  packCount: number;
  unitSize: number;
  unitId: string;
}

export interface EvaluatedProduct {
  id: string;
  name: string;
  totalPrice: number;
  totalQuantityInBase: number;
  pricePerBaseUnit: number;
  pricePerStandardUnit: number;
  standardUnitLabel: string;
  unitCategory: UnitCategory;
  isBestValue: boolean;
  isTie: boolean;
  savingsPercentageVsWorst: number;
  savingsPercentageVsNext: number;
  priceDifferenceVsBest: number;
}

export function parseFlexibleNumber(val: string | number): number {
  return parseHumanNumber(val) ?? 0;
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-9;
}

function getBasis(category: UnitCategory, basis: NormalizationBasis) {
  if (basis === 'hundred') {
    if (category === 'weight') return { multiplier: 100, label: '100g' };
    if (category === 'volume') return { multiplier: 100, label: '100ml' };
    return { multiplier: 1, label: category === 'count' ? 'item' : category === 'area' ? 'm²' : 'm' };
  }
  if (basis === 'base') {
    if (category === 'weight') return { multiplier: 1, label: 'g' };
    if (category === 'volume') return { multiplier: 1, label: 'ml' };
    if (category === 'area') return { multiplier: 1, label: 'm²' };
    if (category === 'length') return { multiplier: 1, label: 'm' };
    return { multiplier: 1, label: 'item' };
  }
  if (category === 'weight') return { multiplier: 1000, label: 'kg' };
  if (category === 'volume') return { multiplier: 1000, label: 'L' };
  if (category === 'area') return { multiplier: 1, label: 'm²' };
  if (category === 'length') return { multiplier: 1, label: 'm' };
  return { multiplier: 1, label: 'item' };
}

export function evaluateProducts(
  products: ProductItem[],
  basis: NormalizationBasis = 'standard'
): {
  items: EvaluatedProduct[];
  hasMismatchedCategories: boolean;
  primaryCategory: UnitCategory | null;
  hasIncompleteData: boolean;
} {
  if (products.length === 0) {
    return { items: [], hasMismatchedCategories: false, primaryCategory: null, hasIncompleteData: false };
  }

  const definitions = products.map((product) => SUPPORTED_UNITS.find((unit) => unit.id === product.unitId));
  const categories = definitions.map((definition) => definition?.category || 'count' as UnitCategory);
  const primaryCategory = categories[0];
  const hasMismatchedCategories = categories.some((category) => category !== primaryCategory);
  let hasIncompleteData = false;

  const evaluated: EvaluatedProduct[] = products.map((product, index) => {
    const unitDef = definitions[index] || {
      id: product.unitId,
      label: product.unitId,
      category: 'count' as UnitCategory,
      baseRatio: 1,
      displayStandardUnit: 'item',
    };
    const count = Number.isFinite(product.packCount) && product.packCount > 0 ? product.packCount : 1;
    const size = Number.isFinite(product.unitSize) && product.unitSize > 0 ? product.unitSize : 0;
    const price = Number.isFinite(product.price) && product.price >= 0 ? product.price : 0;
    if (size <= 0 || price <= 0 || !definitions[index]) hasIncompleteData = true;

    const totalQuantityInBase = count * size * unitDef.baseRatio;
    const pricePerBaseUnit = totalQuantityInBase > 0 ? price / totalQuantityInBase : 0;
    const normalizedBasis = getBasis(unitDef.category, basis);

    return {
      id: product.id,
      name: product.name || 'Unnamed Item',
      totalPrice: price,
      totalQuantityInBase,
      pricePerBaseUnit,
      pricePerStandardUnit: pricePerBaseUnit * normalizedBasis.multiplier,
      standardUnitLabel: normalizedBasis.label,
      unitCategory: unitDef.category,
      isBestValue: false,
      isTie: false,
      savingsPercentageVsWorst: 0,
      savingsPercentageVsNext: 0,
      priceDifferenceVsBest: 0,
    };
  });

  if (!hasMismatchedCategories) {
    const valid = evaluated.filter((item) => item.pricePerBaseUnit > 0).sort((a, b) => a.pricePerBaseUnit - b.pricePerBaseUnit);
    if (valid.length > 0) {
      const bestPrice = valid[0].pricePerBaseUnit;
      const worstPrice = valid.at(-1)!.pricePerBaseUnit;
      const bestItems = valid.filter((item) => nearlyEqual(item.pricePerBaseUnit, bestPrice));
      const nextDistinct = valid.find((item) => !nearlyEqual(item.pricePerBaseUnit, bestPrice));

      for (const item of evaluated) {
        if (item.pricePerBaseUnit <= 0) continue;
        item.isBestValue = nearlyEqual(item.pricePerBaseUnit, bestPrice);
        item.isTie = item.isBestValue && bestItems.length > 1;
        if (worstPrice > 0) {
          item.savingsPercentageVsWorst = Number((((worstPrice - item.pricePerBaseUnit) / worstPrice) * 100).toFixed(2));
        }
        if (item.isBestValue && nextDistinct) {
          item.savingsPercentageVsNext = Number((((nextDistinct.pricePerBaseUnit - bestPrice) / nextDistinct.pricePerBaseUnit) * 100).toFixed(2));
        }
        const basisInfo = getBasis(item.unitCategory, basis);
        item.priceDifferenceVsBest = Number(((item.pricePerBaseUnit - bestPrice) * basisInfo.multiplier).toFixed(6));
      }
    }
  }

  return { items: evaluated, hasMismatchedCategories, primaryCategory, hasIncompleteData };
}
