import React, { useState } from 'react';
import {
  Utensils,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  BookOpen,
  Thermometer,
  Scale,
  AlertTriangle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  IngredientItem,
  RecipeDoc,
  scaleRecipe,
  formatScaledRecipeToText,
  parseRawRecipeText,
  SAMPLE_RECIPES,
  UnitSystem,
  INGREDIENT_DENSITIES,
  convertVolumeToMass,
  convertCookingTemperature,
} from '../../utilities/recipe-scaler';
import { copyToClipboard } from '../../utilities/clipboard';

export const RecipeScalerTool: React.FC = () => {
  const [recipe, setRecipe] = useState<RecipeDoc>(SAMPLE_RECIPES[0]);
  const [targetServings, setTargetServings] = useState<number>(SAMPLE_RECIPES[0].servings * 2);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('original');
  const [useFractions, setUseFractions] = useState<boolean>(true);

  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [showConverterPanel, setShowConverterPanel] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Quick Kitchen Converters State
  const [tempVal, setTempVal] = useState<number>(350);
  const [tempUnit, setTempUnit] = useState<'f' | 'c' | 'gas'>('f');
  const convertedTemp = convertCookingTemperature(tempVal, tempUnit);

  const [densityIngId, setDensityIngId] = useState<string>(INGREDIENT_DENSITIES[0].id);
  const [densityVolAmt, setDensityVolAmt] = useState<number>(1);
  const [densityVolUnit, setDensityVolUnit] = useState<string>('cup');
  const convertedMass = convertVolumeToMass(densityIngId, densityVolAmt, densityVolUnit);

  // Scaled Recipe Calculation
  const scaled = scaleRecipe(recipe, targetServings, unitSystem, useFractions);
  const multiplier = targetServings / Math.max(1, recipe.servings);
  const formattedText = formatScaledRecipeToText(scaled);

  const handleUpdateIngredient = (id: string, updates: Partial<IngredientItem>) => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => (ing.id === id ? { ...ing, ...updates } : ing)),
    }));
  };

  const handleAddIngredient = () => {
    const newItem: IngredientItem = {
      id: `ing-${Date.now()}`,
      name: 'New Ingredient',
      amount: 1,
      unit: 'cup',
    };
    setRecipe((prev) => ({ ...prev, ingredients: [...prev.ingredients, newItem] }));
  };

  const handleRemoveIngredient = (id: string) => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }));
  };

  const handleLoadSample = (sampleId: string) => {
    const s = SAMPLE_RECIPES.find((r) => r.id === sampleId);
    if (s) {
      setRecipe(s);
      setTargetServings(s.servings);
    }
  };

  const handleParsePaste = () => {
    if (!rawPasteText.trim()) return;
    const parsed = parseRawRecipeText(rawPasteText);
    setRecipe(parsed);
    setTargetServings(parsed.servings);
    setShowPasteModal(false);
    setRawPasteText('');
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(formattedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recipe.title.toLowerCase().replace(/\s+/g, '-')}-scaled.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell
      toolId="recipe-scaler"
      title="Recipe Scaler & Unit Converter"
      description="Scale recipe ingredients precisely for any serving size with automatic metric/US unit conversions and fraction formatting."
      category="productivity"
      relatedToolIds={['unit-converter', 'random-picker', 'checklist', 'notepad']}
      outputToTransfer={formattedText}
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Sample Recipes:
            </span>
            {SAMPLE_RECIPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleLoadSample(s.id)}
                className="px-2 py-1 text-[11px] rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
              >
                {s.title}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowPasteModal(!showPasteModal)}
              className="px-2 py-1 text-[11px] rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:bg-blue-100"
            >
              Paste Raw Recipe Text
            </button>

            <button
              type="button"
              onClick={() => setShowConverterPanel(!showConverterPanel)}
              className={`px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 ${
                showConverterPanel
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Thermometer className="w-3 h-3 text-amber-600" />
              <span>Oven Temp & Density</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Recipe!' : 'Copy Scaled'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .TXT</span>
            </button>
          </div>
        </div>

        {/* Paste Raw Modal / Dropdown */}
        {showPasteModal && (
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              Paste Any Recipe Ingredients
            </span>
            <textarea
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="Paste recipe list here, e.g.:&#10;2 cups all-purpose flour&#10;1 tsp baking soda&#10;1/2 cup granulated sugar"
              rows={4}
              className="w-full p-2.5 text-xs font-mono border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1 text-xs rounded border bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePaste}
                className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Auto-Parse Ingredients
              </button>
            </div>
          </div>
        )}

        {/* Kitchen Temperature & Density Conversion Panel */}
        {showConverterPanel && (
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5 text-sm">
                <Thermometer className="w-4 h-4 text-amber-600" />
                <span>Culinary Temperature & Density-Aware Weight Calculator</span>
              </span>
              <button
                type="button"
                onClick={() => setShowConverterPanel(false)}
                className="text-neutral-500 hover:text-neutral-900 text-xs font-semibold"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Oven Temperature Converter */}
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-amber-200/80 dark:border-amber-800/80 space-y-2.5">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 block border-b pb-1">
                  Oven Temperature Converter
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tempVal}
                    onChange={(e) => setTempVal(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-bold"
                  />
                  <select
                    value={tempUnit}
                    onChange={(e) => setTempUnit(e.target.value as 'f' | 'c' | 'gas')}
                    className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="f">°F (Fahrenheit)</option>
                    <option value="c">°C (Celsius)</option>
                    <option value="gas">Gas Mark (UK)</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded border">
                    <div className="text-[10px] text-neutral-500">Fahrenheit</div>
                    <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {convertedTemp.fahrenheit}°F
                    </div>
                  </div>
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded border">
                    <div className="text-[10px] text-neutral-500">Celsius</div>
                    <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {convertedTemp.celsius}°C
                    </div>
                  </div>
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded border">
                    <div className="text-[10px] text-neutral-500">Gas Mark</div>
                    <div className="font-bold text-sm text-amber-600 dark:text-amber-400">
                      Gas {convertedTemp.gasMark}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Density-Aware Volume to Grams */}
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-amber-200/80 dark:border-amber-800/80 space-y-2.5">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 block border-b pb-1">
                  Ingredient Density Volume ➔ Mass (Grams)
                </span>
                <select
                  value={densityIngId}
                  onChange={(e) => setDensityIngId(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-medium"
                >
                  {INGREDIENT_DENSITIES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.gramsPerCup}g / cup)
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={densityVolAmt}
                    onChange={(e) => setDensityVolAmt(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-bold"
                  />
                  <select
                    value={densityVolUnit}
                    onChange={(e) => setDensityVolUnit(e.target.value)}
                    className="px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="cup">Cup(s)</option>
                    <option value="tbsp">Tablespoon(s)</option>
                    <option value="tsp">Teaspoon(s)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="fl_oz">Fluid Ounces (fl oz)</option>
                  </select>
                </div>

                {convertedMass && (
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-950 rounded border flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      = {convertedMass.grams} g ({convertedMass.ounces} oz)
                    </span>
                    <span className="text-[10px] text-neutral-400">Calculated by exact density</span>
                  </div>
                )}

                <div className="flex items-start gap-1 text-[10px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Volume-to-mass conversions depend strictly on ingredient density and packing method.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scaler Knobs Ribbon */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Servings knob */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">
              Scale Servings: {recipe.servings} ➔ {targetServings} ({multiplier.toFixed(2)}x)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={targetServings}
                onChange={(e) => setTargetServings(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-semibold border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
              />
              <div className="flex items-center gap-1">
                {[0.5, 1, 1.5, 2, 3, 4].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setTargetServings(Math.max(1, Math.round(recipe.servings * scale)))}
                    className="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border text-[10px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unit System */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">Unit Conversion</label>
            <div className="flex items-center gap-1">
              {[
                { id: 'original', label: 'Keep Original' },
                { id: 'metric', label: 'Metric (g, ml)' },
                { id: 'us', label: 'US Custom (cups, oz)' },
              ].map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnitSystem(u.id as UnitSystem)}
                  className={`px-2.5 py-1 rounded border text-[11px] font-medium ${
                    unitSystem === u.id
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                      : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fraction Formatting */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300">Number Display</label>
            <div className="flex items-center gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => setUseFractions(true)}
                className={`px-2.5 py-1 rounded border text-[11px] font-medium ${
                  useFractions
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                Fractions (1 1/2)
              </button>
              <button
                type="button"
                onClick={() => setUseFractions(false)}
                className={`px-2.5 py-1 rounded border text-[11px] font-medium ${
                  !useFractions
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                Decimals (1.5)
              </button>
            </div>
          </div>
        </div>

        {/* Editor Grid: Left Ingredients Table, Right Scaled Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Recipe Ingredients Source */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                className="text-sm font-bold bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none text-neutral-900 dark:text-neutral-100 px-1"
              />
              <button
                type="button"
                onClick={handleAddIngredient}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {recipe.ingredients.map((ing) => (
                <div
                  key={ing.id}
                  className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs"
                >
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ing.amount}
                    onChange={(e) =>
                      handleUpdateIngredient(ing.id, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-16 px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-semibold"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    placeholder="unit"
                    onChange={(e) => handleUpdateIngredient(ing.id, { unit: e.target.value })}
                    className="w-20 px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-neutral-500"
                  />
                  <input
                    type="text"
                    value={ing.name}
                    placeholder="ingredient name"
                    onChange={(e) => handleUpdateIngredient(ing.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 border rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(ing.id)}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded"
                    title="Delete ingredient"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Scaled Ingredients View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Scaled Result ({scaled.servings} Servings)
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {unitSystem.toUpperCase()} • {useFractions ? 'Fractions' : 'Decimals'}
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-2.5 min-h-[340px]">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 border-b pb-2">
                {scaled.title}
              </h3>
              <ul className="space-y-2 text-xs">
                {scaled.ingredients.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                  >
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.formatted} {item.name}
                    </span>
                    {item.notes && <span className="text-neutral-400 text-[11px] italic">{item.notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default RecipeScalerTool;
