/**
 * Recipe Scaler & Cooking Converter Utility
 */

export type UnitSystem = 'original' | 'metric' | 'us';

export interface IngredientItem { id: string; amount: number; unit: string; name: string; notes?: string; }
export interface RecipeDoc { id: string; title: string; servings: number; ingredients: IngredientItem[]; }
export interface ScaledIngredientItem { name: string; amount: number; unit: string; formatted: string; notes?: string; }
export interface ScaledRecipeResult { title: string; servings: number; multiplier: number; ingredients: ScaledIngredientItem[]; }

export const SAMPLE_RECIPES: RecipeDoc[] = [
  { id: 'choc-chip-cookies', title: 'Classic Chocolate Chip Cookies', servings: 24, ingredients: [
    { id: '1', amount: 2.25, unit: 'cup', name: 'All-purpose flour' }, { id: '2', amount: 1, unit: 'tsp', name: 'Baking soda' },
    { id: '3', amount: 0.5, unit: 'tsp', name: 'Salt' }, { id: '4', amount: 1, unit: 'cup', name: 'Butter, softened' },
    { id: '5', amount: 0.75, unit: 'cup', name: 'Granulated sugar' }, { id: '6', amount: 0.75, unit: 'cup', name: 'Brown sugar, packed' },
    { id: '7', amount: 2, unit: 'pcs', name: 'Large eggs' }, { id: '8', amount: 2, unit: 'tsp', name: 'Vanilla extract' },
    { id: '9', amount: 2, unit: 'cup', name: 'Semi-sweet chocolate chips' },
  ]},
  { id: 'pancake-batter', title: 'Fluffy Buttermilk Pancakes', servings: 4, ingredients: [
    { id: '1', amount: 2, unit: 'cup', name: 'All-purpose flour' }, { id: '2', amount: 2, unit: 'tbsp', name: 'Sugar' },
    { id: '3', amount: 2, unit: 'tsp', name: 'Baking powder' }, { id: '4', amount: 0.5, unit: 'tsp', name: 'Salt' },
    { id: '5', amount: 2, unit: 'pcs', name: 'Eggs' }, { id: '6', amount: 1.75, unit: 'cup', name: 'Milk' },
    { id: '7', amount: 0.25, unit: 'cup', name: 'Melted butter' },
  ]},
  { id: 'pasta-sauce', title: 'San Marzano Tomato Pasta Sauce', servings: 6, ingredients: [
    { id: '1', amount: 800, unit: 'g', name: 'Whole peeled tomatoes (2 cans)' }, { id: '2', amount: 3, unit: 'tbsp', name: 'Extra virgin olive oil' },
    { id: '3', amount: 4, unit: 'cloves', name: 'Garlic, minced' }, { id: '4', amount: 1, unit: 'tsp', name: 'Dried oregano' },
    { id: '5', amount: 0.5, unit: 'tsp', name: 'Red pepper flakes' }, { id: '6', amount: 1, unit: 'tsp', name: 'Sea salt' },
    { id: '7', amount: 10, unit: 'leaves', name: 'Fresh basil' },
  ]},
];

export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, l: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, fl_oz: 29.5735295625,
  cup: 236.5882365, pt: 473.176473, qt: 946.352946, gal: 3785.411784,
};
export const MASS_TO_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };

const UNICODE_FRACTIONS: Record<string, number> = {
  '⅛': 1 / 8, '¼': 1 / 4, '⅓': 1 / 3, '⅜': 3 / 8, '½': 1 / 2,
  '⅝': 5 / 8, '⅔': 2 / 3, '¾': 3 / 4, '⅞': 7 / 8,
};

/** Parses decimals, 3/4, 1 1/2, 1-1/2 and Unicode fractions such as 1½. */
export function parseCulinaryAmount(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const unicode = text.match(/^([+-]?\d+(?:\.\d+)?)?\s*([⅛¼⅓⅜½⅝⅔¾⅞])$/u);
  if (unicode) {
    const whole = unicode[1] ? Number(unicode[1]) : 0;
    const fraction = UNICODE_FRACTIONS[unicode[2]];
    return Number.isFinite(whole) ? whole + Math.sign(whole || 1) * fraction : null;
  }
  const mixed = text.match(/^([+-]?\d+)\s*(?:\s+|-)\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]); const numerator = Number(mixed[2]); const denominator = Number(mixed[3]);
    if (!denominator) return null;
    return whole < 0 ? whole - numerator / denominator : whole + numerator / denominator;
  }
  const fraction = text.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]); const denominator = Number(fraction[2]);
    return denominator ? numerator / denominator : null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function formatCulinaryFraction(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const whole = Math.floor(value);
  const remainder = value - whole;
  const choices: Array<[number, string]> = [[1/8,'1/8'],[1/4,'1/4'],[1/3,'1/3'],[3/8,'3/8'],[1/2,'1/2'],[5/8,'5/8'],[2/3,'2/3'],[3/4,'3/4'],[7/8,'7/8']];
  const nearest = choices.reduce((best, candidate) => Math.abs(candidate[0] - remainder) < Math.abs(best[0] - remainder) ? candidate : best);
  if (remainder < 0.04) return String(whole);
  if (1 - remainder < 0.04) return String(whole + 1);
  if (Math.abs(nearest[0] - remainder) <= 0.035) return whole > 0 ? `${whole} ${nearest[1]}` : nearest[1];
  return Number(value.toFixed(2)).toString();
}

export function scaleRecipe(recipe: RecipeDoc, targetServings: number, unitSystem: UnitSystem = 'original', useFractions = true): ScaledRecipeResult {
  const originalServings = Math.max(1, Number.isFinite(recipe.servings) ? recipe.servings : 1);
  const safeTarget = Math.max(0, Number.isFinite(targetServings) ? targetServings : originalServings);
  const multiplier = safeTarget / originalServings;
  const ingredients = recipe.ingredients.map((ingredient) => {
    let amount = Math.max(0, ingredient.amount * multiplier);
    let unit = ingredient.unit.toLowerCase();
    if (unitSystem === 'metric') {
      if (VOLUME_TO_ML[unit] && unit !== 'ml' && unit !== 'l') { amount *= VOLUME_TO_ML[unit]; unit = amount >= 1000 ? 'l' : 'ml'; if (unit === 'l') amount /= 1000; }
      else if (MASS_TO_G[unit] && unit !== 'g' && unit !== 'kg') { amount *= MASS_TO_G[unit]; unit = amount >= 1000 ? 'kg' : 'g'; if (unit === 'kg') amount /= 1000; }
    } else if (unitSystem === 'us') {
      if (unit === 'ml' || unit === 'l') {
        const ml = amount * VOLUME_TO_ML[unit];
        if (ml >= VOLUME_TO_ML.cup) { amount = ml / VOLUME_TO_ML.cup; unit = 'cup'; }
        else if (ml >= VOLUME_TO_ML.tbsp) { amount = ml / VOLUME_TO_ML.tbsp; unit = 'tbsp'; }
        else { amount = ml / VOLUME_TO_ML.tsp; unit = 'tsp'; }
      } else if (unit === 'g' || unit === 'kg') {
        const grams = amount * MASS_TO_G[unit];
        if (grams >= MASS_TO_G.lb) { amount = grams / MASS_TO_G.lb; unit = 'lb'; }
        else { amount = grams / MASS_TO_G.oz; unit = 'oz'; }
      }
    }
    const formattedAmount = useFractions ? formatCulinaryFraction(amount) : Number(amount.toFixed(2)).toString();
    return { name: ingredient.name, amount, unit, formatted: `${formattedAmount} ${unit}`.trim(), notes: ingredient.notes };
  });
  return { title: recipe.title, servings: safeTarget, multiplier, ingredients };
}

export function formatScaledRecipeToText(scaled: ScaledRecipeResult): string {
  return [`=== ${scaled.title} ===`, `Servings: ${scaled.servings} (Scaled ×${scaled.multiplier.toFixed(2)})`, '', 'Ingredients:',
    ...scaled.ingredients.map((ingredient) => `• ${ingredient.formatted} ${ingredient.name}${ingredient.notes ? ` (${ingredient.notes})` : ''}`)].join('\n');
}

export function parseRawRecipeText(text: string): RecipeDoc {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  let title = 'Custom Scaled Recipe';
  let servings = 4;
  const ingredients: IngredientItem[] = [];

  lines.forEach((line, index) => {
    const servingMatch = line.match(/(?:serves|servings|yields?|yield)\s*:?\s*(\d+(?:[.,]\d+)?)/i);
    if (servingMatch) { servings = Number(servingMatch[1].replace(',', '.')) || 4; return; }
    if (index === 0 && !/^[\d⅛¼⅓⅜½⅝⅔¾⅞•\-*]/u.test(line)) { title = line.replace(/^[#=]+\s*/, '').trim(); return; }
    const clean = line.replace(/^(?:[-*•]\s*|\[[ xX]?\]\s*|\d+[.)]\s*)/, '').trim();
    if (!clean) return;

    const amountMatch = clean.match(/^((?:[+-]?\d+(?:[.,]\d+)?\s*(?:[- ]\s*\d+\s*\/\s*\d+)?|[+-]?\d+\s*\/\s*\d+|[+-]?\d*(?:[.,]\d+)?\s*[⅛¼⅓⅜½⅝⅔¾⅞]))(?:\s+|$)/u);
    const amountText = amountMatch?.[1]?.trim() || '';
    const parsedAmount = parseCulinaryAmount(amountText);
    let remainder = amountMatch ? clean.slice(amountMatch[0].length).trim() : clean;
    const unitMatch = remainder.match(/^([\p{L}°_]+)\b\s*/u);
    const unit = unitMatch?.[1]?.toLowerCase() || 'pcs';
    if (unitMatch) remainder = remainder.slice(unitMatch[0].length).trim();
    ingredients.push({ id: `ing-${index + 1}`, amount: parsedAmount ?? 1, unit, name: remainder || clean });
  });

  return { id: 'recipe-custom', title, servings, ingredients: ingredients.length ? ingredients : SAMPLE_RECIPES[0].ingredients.map((item) => ({ ...item })) };
}

export interface IngredientDensity { id: string; name: string; gramsPerCup: number; }
export const INGREDIENT_DENSITIES: IngredientDensity[] = [
  { id: 'all-purpose-flour', name: 'All-Purpose Flour (dip & sweep)', gramsPerCup: 120 }, { id: 'bread-flour', name: 'Bread Flour', gramsPerCup: 130 },
  { id: 'granulated-sugar', name: 'Granulated White Sugar', gramsPerCup: 200 }, { id: 'brown-sugar', name: 'Brown Sugar (packed)', gramsPerCup: 220 },
  { id: 'powdered-sugar', name: 'Powdered / Icing Sugar', gramsPerCup: 120 }, { id: 'butter', name: 'Butter', gramsPerCup: 227 },
  { id: 'milk', name: 'Whole Milk / Liquid Dairy', gramsPerCup: 245 }, { id: 'water', name: 'Water', gramsPerCup: 236.6 },
  { id: 'vegetable-oil', name: 'Vegetable / Canola Oil', gramsPerCup: 218 }, { id: 'olive-oil', name: 'Olive Oil', gramsPerCup: 216 },
  { id: 'honey', name: 'Honey / Molasses / Maple Syrup', gramsPerCup: 340 }, { id: 'cocoa-powder', name: 'Unsweetened Cocoa Powder', gramsPerCup: 85 },
  { id: 'rolled-oats', name: 'Rolled Oats', gramsPerCup: 90 },
];

export function convertVolumeToMass(ingredientId: string, volumeAmount: number, volumeUnit: string): { grams: number; ounces: number; ingredientName: string } | null {
  const density = INGREDIENT_DENSITIES.find((item) => item.id === ingredientId);
  const mlFactor = VOLUME_TO_ML[volumeUnit.toLowerCase()];
  if (!density || !mlFactor || !Number.isFinite(volumeAmount)) return null;
  const grams = Math.round((volumeAmount * mlFactor / VOLUME_TO_ML.cup) * density.gramsPerCup * 10) / 10;
  return { grams, ounces: Math.round((grams / MASS_TO_G.oz) * 100) / 100, ingredientName: density.name };
}

export function convertCookingTemperature(value: number, fromUnit: 'f' | 'c' | 'gas'): { fahrenheit: number; celsius: number; gasMark: string } {
  let fahrenheit = 350;
  if (fromUnit === 'f') fahrenheit = value;
  else if (fromUnit === 'c') fahrenheit = (value * 9) / 5 + 32;
  else if (fromUnit === 'gas') fahrenheit = value === 0.25 ? 225 : value === 0.5 ? 250 : 250 + value * 25;
  const roundedF = Math.round(fahrenheit);
  const celsius = Math.round(((fahrenheit - 32) * 5) / 9);
  let gasMark = '-';
  if (roundedF <= 235) gasMark = '1/4';
  else if (roundedF <= 260) gasMark = '1/2';
  else if (roundedF <= 500) gasMark = String(Math.max(1, Math.round((roundedF - 250) / 25)));
  return { fahrenheit: roundedF, celsius, gasMark };
}
