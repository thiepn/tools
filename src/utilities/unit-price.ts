export type UnitCategory = 'weight' | 'volume' | 'count' | 'length' | 'area';

export type NormalizationBasis = 'standard' | 'hundred' | 'base';

export interface UnitDefinition {
  id: string;
  label: string;
  category: UnitCategory;
  baseRatio: number; // multiplier to convert 1 unit to base category unit (g, ml, count, m, sq_m)
  displayStandardUnit: string;
}

export const SUPPORTED_UNITS: UnitDefinition[] = [
  // Weight (Base: gram)
  { id: 'mg', label: 'Milligrams (mg)', category: 'weight', baseRatio: 0.001, displayStandardUnit: 'kg' },
  { id: 'g', label: 'Grams (g)', category: 'weight', baseRatio: 1, displayStandardUnit: 'kg' },
  { id: 'kg', label: 'Kilograms (kg)', category: 'weight', baseRatio: 1000, displayStandardUnit: 'kg' },
  { id: 'oz', label: 'Ounces (oz)', category: 'weight', baseRatio: 28.349523, displayStandardUnit: 'lb' },
  { id: 'lb', label: 'Pounds (lb)', category: 'weight', baseRatio: 453.59237, displayStandardUnit: 'lb' },

  // Volume (Base: milliliter)
  { id: 'ml', label: 'Milliliters (ml)', category: 'volume', baseRatio: 1, displayStandardUnit: 'L' },
  { id: 'l', label: 'Liters (L)', category: 'volume', baseRatio: 1000, displayStandardUnit: 'L' },
  { id: 'floz', label: 'Fluid Ounces (fl oz)', category: 'volume', baseRatio: 29.5735, displayStandardUnit: 'fl oz' },
  { id: 'gal', label: 'Gallons (US gal)', category: 'volume', baseRatio: 3785.411784, displayStandardUnit: 'gal' },
  { id: 'pt', label: 'Pints (US pt)', category: 'volume', baseRatio: 473.176473, displayStandardUnit: 'gal' },
  { id: 'qt', label: 'Quarts (US qt)', category: 'volume', baseRatio: 946.352946, displayStandardUnit: 'gal' },

  // Count / Pieces (Base: item)
  { id: 'item', label: 'Items / Units', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'pcs', label: 'Pieces (pcs)', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'pack', label: 'Packs (e.g. 10-pack)', category: 'count', baseRatio: 1, displayStandardUnit: 'item' },
  { id: 'sheet', label: 'Sheets / Rolls', category: 'count', baseRatio: 1, displayStandardUnit: 'sheet' },

  // Length (Base: meter)
  { id: 'm', label: 'Meters (m)', category: 'length', baseRatio: 1, displayStandardUnit: 'm' },
  { id: 'cm', label: 'Centimeters (cm)', category: 'length', baseRatio: 0.01, displayStandardUnit: 'm' },
  { id: 'ft', label: 'Feet (ft)', category: 'length', baseRatio: 0.3048, displayStandardUnit: 'ft' },
  { id: 'yd', label: 'Yards (yd)', category: 'length', baseRatio: 0.9144, displayStandardUnit: 'yd' },

  // Area (Base: sq meter)
  { id: 'sqm', label: 'Square Meters (m²)', category: 'area', baseRatio: 1, displayStandardUnit: 'm²' },
  { id: 'sqft', label: 'Square Feet (sq ft)', category: 'area', baseRatio: 0.092903, displayStandardUnit: 'sq ft' },
];

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  packCount: number; // e.g. 2 packs of 500g
  unitSize: number; // e.g. 500
  unitId: string; // e.g. 'g'
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
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const sanitized = val.toString().replace(',', '.').trim();
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
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

  // Find categories
  const categories = products.map((p) => {
    const def = SUPPORTED_UNITS.find((u) => u.id === p.unitId);
    return def?.category || 'count';
  });

  const primaryCategory = categories[0];
  const hasMismatchedCategories = categories.some((c) => c !== primaryCategory);

  let hasIncompleteData = false;

  const evaluated = products.map((prod) => {
    const unitDef = SUPPORTED_UNITS.find((u) => u.id === prod.unitId) || {
      id: prod.unitId,
      label: prod.unitId,
      category: 'count' as UnitCategory,
      baseRatio: 1,
      displayStandardUnit: 'item',
    };

    const count = prod.packCount > 0 ? prod.packCount : 1;
    const size = prod.unitSize > 0 ? prod.unitSize : 0;
    const price = prod.price >= 0 ? prod.price : 0;

    if (size <= 0 || price <= 0) {
      hasIncompleteData = true;
    }

    const totalAmount = count * size;
    const totalBaseUnits = totalAmount * unitDef.baseRatio;
    const pricePerBase = totalBaseUnits > 0 ? price / totalBaseUnits : 0;

    // Multipliers based on basis
    let standardMultiplier = 1;
    let standardLabel = unitDef.id;

    if (basis === 'hundred') {
      if (unitDef.category === 'weight') {
        standardMultiplier = 100; // per 100g
        standardLabel = '100g';
      } else if (unitDef.category === 'volume') {
        standardMultiplier = 100; // per 100ml
        standardLabel = '100ml';
      } else {
        standardMultiplier = 1;
        standardLabel = 'item';
      }
    } else if (basis === 'base') {
      if (unitDef.category === 'weight') {
        standardMultiplier = 1; // per 1g
        standardLabel = 'g';
      } else if (unitDef.category === 'volume') {
        standardMultiplier = 1; // per 1ml
        standardLabel = 'ml';
      } else if (unitDef.category === 'length') {
        standardMultiplier = 1; // per 1m
        standardLabel = 'm';
      } else if (unitDef.category === 'area') {
        standardMultiplier = 1; // per 1m²
        standardLabel = 'm²';
      } else {
        standardMultiplier = 1;
        standardLabel = 'item';
      }
    } else {
      // standard (1 kg, 1 L, 1 m, 1 m², 1 item)
      if (unitDef.category === 'weight') {
        standardMultiplier = 1000;
        standardLabel = 'kg';
      } else if (unitDef.category === 'volume') {
        standardMultiplier = 1000;
        standardLabel = 'L';
      } else if (unitDef.category === 'length') {
        standardMultiplier = 1;
        standardLabel = 'm';
      } else if (unitDef.category === 'area') {
        standardMultiplier = 1;
        standardLabel = 'm²';
      } else {
        standardMultiplier = 1;
        standardLabel = 'item';
      }
    }

    const pricePerStandard = pricePerBase * standardMultiplier;

    return {
      id: prod.id,
      name: prod.name || 'Unnamed Item',
      totalPrice: price,
      totalQuantityInBase: totalBaseUnits,
      pricePerBaseUnit: pricePerBase,
      pricePerStandardUnit: pricePerStandard,
      standardUnitLabel: standardLabel,
      unitCategory: unitDef.category,
      isBestValue: false,
      isTie: false,
      savingsPercentageVsWorst: 0,
      savingsPercentageVsNext: 0,
      priceDifferenceVsBest: 0,
    };
  });

  // Calculate best value and savings
  if (evaluated.length > 0 && !hasMismatchedCategories) {
    const validPrices = evaluated.filter((e) => e.pricePerBaseUnit > 0);
    if (validPrices.length > 0) {
      const minPrice = Math.min(...validPrices.map((e) => e.pricePerBaseUnit));
      const maxPrice = Math.max(...validPrices.map((e) => e.pricePerBaseUnit));
      const bestItems = validPrices.filter((e) => Math.abs(e.pricePerBaseUnit - minPrice) < 0.000001);
      const isTie = bestItems.length > 1;

      evaluated.forEach((item) => {
        if (Math.abs(item.pricePerBaseUnit - minPrice) < 0.000001 && item.pricePerBaseUnit > 0) {
          item.isBestValue = true;
          item.isTie = isTie;
        }
        if (maxPrice > 0 && item.pricePerBaseUnit > 0) {
          item.savingsPercentageVsWorst = Math.round(
            ((maxPrice - item.pricePerBaseUnit) / maxPrice) * 100
          );
        }
        if (minPrice > 0 && item.pricePerStandardUnit > 0) {
          const bestStandardPrice = minPrice * (item.pricePerStandardUnit / (item.pricePerBaseUnit || 1));
          item.priceDifferenceVsBest = Number((item.pricePerStandardUnit - bestStandardPrice).toFixed(4));
        }
      });
    }
  }

  return {
    items: evaluated,
    hasMismatchedCategories,
    primaryCategory,
    hasIncompleteData,
  };
}
