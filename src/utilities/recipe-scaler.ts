/**
 * Recipe Scaler & Cooking Converter Utility
 * Proportion scaling, culinary fractions, ingredient conversions, and text parsing
 */

export type UnitSystem = 'original' | 'metric' | 'us';

export interface IngredientItem {
  id: string;
  amount: number;
  unit: string;
  name: string;
  notes?: string;
}

export interface RecipeDoc {
  id: string;
  title: string;
  servings: number;
  ingredients: IngredientItem[];
}

export interface ScaledIngredientItem {
  name: string;
  amount: number;
  unit: string;
  formatted: string;
  notes?: string;
}

export interface ScaledRecipeResult {
  title: string;
  servings: number;
  multiplier: number;
  ingredients: ScaledIngredientItem[];
}

export const SAMPLE_RECIPES: RecipeDoc[] = [
  {
    id: 'choc-chip-cookies',
    title: 'Classic Chocolate Chip Cookies',
    servings: 24,
    ingredients: [
      { id: '1', amount: 2.25, unit: 'cup', name: 'All-purpose flour' },
      { id: '2', amount: 1, unit: 'tsp', name: 'Baking soda' },
      { id: '3', amount: 0.5, unit: 'tsp', name: 'Salt' },
      { id: '4', amount: 1, unit: 'cup', name: 'Butter, softened' },
      { id: '5', amount: 0.75, unit: 'cup', name: 'Granulated sugar' },
      { id: '6', amount: 0.75, unit: 'cup', name: 'Brown sugar, packed' },
      { id: '7', amount: 2, unit: 'pcs', name: 'Large eggs' },
      { id: '8', amount: 2, unit: 'tsp', name: 'Vanilla extract' },
      { id: '9', amount: 2, unit: 'cup', name: 'Semi-sweet chocolate chips' },
    ],
  },
  {
    id: 'pancake-batter',
    title: 'Fluffy Buttermilk Pancakes',
    servings: 4,
    ingredients: [
      { id: '1', amount: 2, unit: 'cup', name: 'All-purpose flour' },
      { id: '2', amount: 2, unit: 'tbsp', name: 'Sugar' },
      { id: '3', amount: 2, unit: 'tsp', name: 'Baking powder' },
      { id: '4', amount: 0.5, unit: 'tsp', name: 'Salt' },
      { id: '5', amount: 2, unit: 'pcs', name: 'Eggs' },
      { id: '6', amount: 1.75, unit: 'cup', name: 'Milk' },
      { id: '7', amount: 0.25, unit: 'cup', name: 'Melted butter' },
    ],
  },
  {
    id: 'pasta-sauce',
    title: 'San Marzano Tomato Pasta Sauce',
    servings: 6,
    ingredients: [
      { id: '1', amount: 800, unit: 'g', name: 'Whole peeled tomatoes (2 cans)' },
      { id: '2', amount: 3, unit: 'tbsp', name: 'Extra virgin olive oil' },
      { id: '3', amount: 4, unit: 'cloves', name: 'Garlic, minced' },
      { id: '4', amount: 1, unit: 'tsp', name: 'Dried oregano' },
      { id: '5', amount: 0.5, unit: 'tsp', name: 'Red pepper flakes' },
      { id: '6', amount: 1, unit: 'tsp', name: 'Sea salt' },
      { id: '7', amount: 10, unit: 'leaves', name: 'Fresh basil' },
    ],
  },
];

// Culinary Volume Conversion Factors (to Milliliters)
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  fl_oz: 29.5735,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
  gal: 3785.41,
};

// Culinary Mass Conversion Factors (to Grams)
export const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/**
 * Converts decimal value into friendly culinary fraction
 */
export function formatCulinaryFraction(val: number): string {
  if (val <= 0) return '0';

  const whole = Math.floor(val);
  const remainder = val - whole;
  const tol = 0.05;

  let frac = '';
  if (Math.abs(remainder - 0.125) < tol) frac = '1/8';
  else if (Math.abs(remainder - 0.25) < tol) frac = '1/4';
  else if (Math.abs(remainder - 0.333) < tol) frac = '1/3';
  else if (Math.abs(remainder - 0.375) < tol) frac = '3/8';
  else if (Math.abs(remainder - 0.5) < tol) frac = '1/2';
  else if (Math.abs(remainder - 0.625) < tol) frac = '5/8';
  else if (Math.abs(remainder - 0.667) < tol) frac = '2/3';
  else if (Math.abs(remainder - 0.75) < tol) frac = '3/4';
  else if (Math.abs(remainder - 0.875) < tol) frac = '7/8';
  else if (Math.abs(remainder - 1.0) < tol) return String(whole + 1);

  if (frac) {
    return whole > 0 ? `${whole} ${frac}` : frac;
  }

  // Format cleanly without trailing zeros
  return Number(val.toFixed(2)).toString();
}

/**
 * Scales a full recipe document
 */
export function scaleRecipe(
  recipe: RecipeDoc,
  targetServings: number,
  unitSystem: UnitSystem = 'original',
  useFractions = true
): ScaledRecipeResult {
  const origServings = Math.max(1, recipe.servings);
  const multiplier = targetServings / origServings;

  const scaledIngredients: ScaledIngredientItem[] = recipe.ingredients.map((ing) => {
    let finalAmount = ing.amount * multiplier;
    let finalUnit = ing.unit.toLowerCase();

    // Unit conversion
    if (unitSystem === 'metric') {
      if (finalUnit === 'cup') {
        finalAmount = finalAmount * 240;
        finalUnit = 'ml';
      } else if (finalUnit === 'tbsp') {
        finalAmount = finalAmount * 15;
        finalUnit = 'ml';
      } else if (finalUnit === 'tsp') {
        finalAmount = finalAmount * 5;
        finalUnit = 'ml';
      } else if (finalUnit === 'oz') {
        finalAmount = finalAmount * 28.35;
        finalUnit = 'g';
      } else if (finalUnit === 'lb') {
        finalAmount = finalAmount * 453.6;
        finalUnit = 'g';
      }
    } else if (unitSystem === 'us') {
      if (finalUnit === 'ml' && finalAmount >= 240) {
        finalAmount = finalAmount / 240;
        finalUnit = 'cup';
      } else if (finalUnit === 'ml' && finalAmount >= 15) {
        finalAmount = finalAmount / 15;
        finalUnit = 'tbsp';
      } else if (finalUnit === 'g' && finalAmount >= 450) {
        finalAmount = finalAmount / 453.6;
        finalUnit = 'lb';
      } else if (finalUnit === 'g') {
        finalAmount = finalAmount / 28.35;
        finalUnit = 'oz';
      }
    }

    const formattedAmount = useFractions
      ? formatCulinaryFraction(finalAmount)
      : Number(finalAmount.toFixed(2)).toString();

    const formatted = `${formattedAmount} ${finalUnit}`.trim();

    return {
      name: ing.name,
      amount: finalAmount,
      unit: finalUnit,
      formatted,
      notes: ing.notes,
    };
  });

  return {
    title: recipe.title,
    servings: targetServings,
    multiplier,
    ingredients: scaledIngredients,
  };
}

/**
 * Formats scaled recipe into clean text for clipboard / download
 */
export function formatScaledRecipeToText(scaled: ScaledRecipeResult): string {
  const lines: string[] = [
    `=== ${scaled.title} ===`,
    `Servings: ${scaled.servings} (Scaled ×${scaled.multiplier.toFixed(2)})`,
    '',
    'Ingredients:',
  ];

  scaled.ingredients.forEach((ing) => {
    lines.push(`• ${ing.formatted} ${ing.name}${ing.notes ? ` (${ing.notes})` : ''}`);
  });

  return lines.join('\n');
}

/**
 * Parses raw text into a RecipeDoc
 */
export function parseRawRecipeText(text: string): RecipeDoc {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let title = 'Custom Scaled Recipe';
  let servings = 4;
  const ingredients: IngredientItem[] = [];

  lines.forEach((line, idx) => {
    // Check if line contains title or servings
    const servMatch = line.match(/(?:serves|servings|yields?|yield):\s*(\d+)/i);
    if (servMatch) {
      servings = parseInt(servMatch[1], 10) || 4;
      return;
    }

    if (idx === 0 && !line.match(/^[\d•\-\*]/)) {
      title = line.replace(/^[#=]+\s*/, '').trim();
      return;
    }

    // Clean bullet points
    const cleanLine = line.replace(/^[•\-\*\[\]\d+\.]+\s*/, '').trim();
    if (!cleanLine) return;

    // Parse amount, unit, name
    const match = cleanLine.match(/^([\d\.\/\s]+)?\s*([a-zA-Z°]+)?\s*(.*)$/);
    if (!match) {
      ingredients.push({
        id: `ing-${idx}`,
        amount: 1,
        unit: 'pcs',
        name: cleanLine,
      });
      return;
    }

    let amt = 1;
    if (match[1]) {
      const trimmedAmt = match[1].trim();
      if (trimmedAmt.includes('/')) {
        const parts = trimmedAmt.split('/');
        const n = parseFloat(parts[0]);
        const d = parseFloat(parts[1]);
        if (d) amt = n / d;
      } else {
        amt = parseFloat(trimmedAmt) || 1;
      }
    }

    const unit = (match[2] || 'pcs').toLowerCase();
    const name = match[3] || cleanLine;

    ingredients.push({
      id: `ing-${idx}-${Date.now()}`,
      amount: amt,
      unit,
      name,
    });
  });

  return {
    id: `recipe-${Date.now()}`,
    title,
    servings,
    ingredients: ingredients.length > 0 ? ingredients : SAMPLE_RECIPES[0].ingredients,
  };
}

// Common Ingredient Densities (grams per 1 US Cup / 236.59 ml)
export interface IngredientDensity {
  id: string;
  name: string;
  gramsPerCup: number;
}

export const INGREDIENT_DENSITIES: IngredientDensity[] = [
  { id: 'all-purpose-flour', name: 'All-Purpose Flour (dip & sweep)', gramsPerCup: 120 },
  { id: 'bread-flour', name: 'Bread Flour', gramsPerCup: 130 },
  { id: 'granulated-sugar', name: 'Granulated White Sugar', gramsPerCup: 200 },
  { id: 'brown-sugar', name: 'Brown Sugar (packed)', gramsPerCup: 220 },
  { id: 'powdered-sugar', name: 'Powdered / Icing Sugar', gramsPerCup: 120 },
  { id: 'butter', name: 'Butter', gramsPerCup: 227 },
  { id: 'milk', name: 'Whole Milk / Liquid Dairy', gramsPerCup: 245 },
  { id: 'water', name: 'Water', gramsPerCup: 236.6 },
  { id: 'vegetable-oil', name: 'Vegetable / Canola Oil', gramsPerCup: 218 },
  { id: 'olive-oil', name: 'Olive Oil', gramsPerCup: 216 },
  { id: 'honey', name: 'Honey / Molasses / Maple Syrup', gramsPerCup: 340 },
  { id: 'cocoa-powder', name: 'Unsweetened Cocoa Powder', gramsPerCup: 85 },
  { id: 'rolled-oats', name: 'Rolled Oats', gramsPerCup: 90 },
];

/**
 * Calculates mass in grams from volume based on specific ingredient density
 */
export function convertVolumeToMass(
  ingredientId: string,
  volumeAmount: number,
  volumeUnit: string
): { grams: number; ounces: number; ingredientName: string } | null {
  const density = INGREDIENT_DENSITIES.find((d) => d.id === ingredientId);
  if (!density) return null;

  const mlFactor = VOLUME_TO_ML[volumeUnit.toLowerCase()] || (volumeUnit === 'cup' ? 236.588 : 0);
  if (!mlFactor) return null;

  const totalMl = volumeAmount * mlFactor;
  const cups = totalMl / 236.588;
  const grams = Math.round(cups * density.gramsPerCup * 10) / 10;
  const ounces = Math.round((grams / 28.3495) * 100) / 100;

  return {
    grams,
    ounces,
    ingredientName: density.name,
  };
}

/**
 * Converts temperatures between Fahrenheit, Celsius, and British Gas Mark
 */
export function convertCookingTemperature(
  value: number,
  fromUnit: 'f' | 'c' | 'gas'
): { fahrenheit: number; celsius: number; gasMark: string } {
  let f = 350;

  if (fromUnit === 'f') {
    f = value;
  } else if (fromUnit === 'c') {
    f = (value * 9) / 5 + 32;
  } else if (fromUnit === 'gas') {
    // Gas mark approximation: GM 1 = 275F, each mark adds 25F (Gas 1/4 = 225F, Gas 1/2 = 250F)
    if (value === 0.25) f = 225;
    else if (value === 0.5) f = 250;
    else f = 250 + value * 25;
  }

  const c = Math.round(((f - 32) * 5) / 9);
  const roundedF = Math.round(f);

  let gasMark = '-';
  if (roundedF <= 235) gasMark = '1/4';
  else if (roundedF <= 260) gasMark = '1/2';
  else if (roundedF >= 265 && roundedF <= 500) {
    const mark = Math.round((roundedF - 250) / 25);
    gasMark = mark > 0 ? `${mark}` : '1/2';
  }

  return {
    fahrenheit: roundedF,
    celsius: c,
    gasMark,
  };
}
