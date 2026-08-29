export type UnitCategory =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'digital';

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  toBase: (val: number) => number;
  fromBase: (val: number) => number;
}

export interface UnitCategoryDefinition {
  id: UnitCategory;
  name: string;
  baseUnit: string;
  units: UnitDefinition[];
}

export const UNIT_CATEGORIES: UnitCategoryDefinition[] = [
  {
    id: 'length',
    name: 'Length',
    baseUnit: 'm',
    units: [
      { id: 'mm', name: 'Millimetres', symbol: 'mm', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { id: 'cm', name: 'Centimetres', symbol: 'cm', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      { id: 'm', name: 'Metres', symbol: 'm', toBase: (v) => v, fromBase: (v) => v },
      { id: 'km', name: 'Kilometres', symbol: 'km', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { id: 'in', name: 'Inches', symbol: 'in', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
      { id: 'ft', name: 'Feet', symbol: 'ft', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      { id: 'yd', name: 'Yards', symbol: 'yd', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
      { id: 'mi', name: 'Miles', symbol: 'mi', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    ],
  },
  {
    id: 'mass',
    name: 'Mass & Weight',
    baseUnit: 'kg',
    units: [
      { id: 'mg', name: 'Milligrams', symbol: 'mg', toBase: (v) => v / 1000000, fromBase: (v) => v * 1000000 },
      { id: 'g', name: 'Grams', symbol: 'g', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { id: 'kg', name: 'Kilograms', symbol: 'kg', toBase: (v) => v, fromBase: (v) => v },
      { id: 'oz', name: 'Ounces', symbol: 'oz', toBase: (v) => v * 0.028349523125, fromBase: (v) => v / 0.028349523125 },
      { id: 'lb', name: 'Pounds', symbol: 'lb', toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
      { id: 't', name: 'Metric Tonnes', symbol: 't', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    baseUnit: 'C',
    units: [
      { id: 'c', name: 'Celsius', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      { id: 'f', name: 'Fahrenheit', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { id: 'k', name: 'Kelvin', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'area',
    name: 'Area',
    baseUnit: 'm²',
    units: [
      { id: 'sq_m', name: 'Square Metres', symbol: 'm²', toBase: (v) => v, fromBase: (v) => v },
      { id: 'sq_km', name: 'Square Kilometres', symbol: 'km²', toBase: (v) => v * 1000000, fromBase: (v) => v / 1000000 },
      { id: 'sq_ft', name: 'Square Feet', symbol: 'sq ft', toBase: (v) => v * 0.09290304, fromBase: (v) => v / 0.09290304 },
      { id: 'acre', name: 'Acres', symbol: 'ac', toBase: (v) => v * 4046.8564224, fromBase: (v) => v / 4046.8564224 },
      { id: 'ha', name: 'Hectares', symbol: 'ha', toBase: (v) => v * 10000, fromBase: (v) => v / 10000 },
    ],
  },
  {
    id: 'volume',
    name: 'Volume (US Customary & Metric)',
    baseUnit: 'l',
    units: [
      { id: 'ml', name: 'Millilitres', symbol: 'mL', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { id: 'l', name: 'Litres', symbol: 'L', toBase: (v) => v, fromBase: (v) => v },
      { id: 'cu_m', name: 'Cubic Metres', symbol: 'm³', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { id: 'fl_oz', name: 'Fluid Ounces (US)', symbol: 'fl oz (US)', toBase: (v) => v * 0.0295735295625, fromBase: (v) => v / 0.0295735295625 },
      { id: 'cup', name: 'Cups (US)', symbol: 'cup (US)', toBase: (v) => v * 0.2365882365, fromBase: (v) => v / 0.2365882365 },
      { id: 'pt', name: 'Pints (US)', symbol: 'pt (US)', toBase: (v) => v * 0.473176473, fromBase: (v) => v / 0.473176473 },
      { id: 'gal', name: 'Gallons (US)', symbol: 'gal (US)', toBase: (v) => v * 3.785411784, fromBase: (v) => v / 3.785411784 },
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    baseUnit: 'm/s',
    units: [
      { id: 'mps', name: 'Metres per second', symbol: 'm/s', toBase: (v) => v, fromBase: (v) => v },
      { id: 'kmh', name: 'Kilometres per hour', symbol: 'km/h', toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
      { id: 'mph', name: 'Miles per hour', symbol: 'mph', toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
      { id: 'knot', name: 'Knots', symbol: 'kn', toBase: (v) => v * 0.514444444444, fromBase: (v) => v / 0.514444444444 },
    ],
  },
  {
    id: 'digital',
    name: 'Digital Storage (SI & IEC)',
    baseUnit: 'B',
    units: [
      { id: 'b', name: 'Bytes', symbol: 'B', toBase: (v) => v, fromBase: (v) => v },
      { id: 'kb', name: 'Kilobytes (10³)', symbol: 'kB', toBase: (v) => v * 1e3, fromBase: (v) => v / 1e3 },
      { id: 'mb', name: 'Megabytes (10⁶)', symbol: 'MB', toBase: (v) => v * 1e6, fromBase: (v) => v / 1e6 },
      { id: 'gb', name: 'Gigabytes (10⁹)', symbol: 'GB', toBase: (v) => v * 1e9, fromBase: (v) => v / 1e9 },
      { id: 'tb', name: 'Terabytes (10¹²)', symbol: 'TB', toBase: (v) => v * 1e12, fromBase: (v) => v / 1e12 },
      { id: 'kib', name: 'Kibibytes (2¹⁰)', symbol: 'KiB', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
      { id: 'mib', name: 'Mebibytes (2²⁰)', symbol: 'MiB', toBase: (v) => v * Math.pow(1024, 2), fromBase: (v) => v / Math.pow(1024, 2) },
      { id: 'gib', name: 'Gibibytes (2³⁰)', symbol: 'GiB', toBase: (v) => v * Math.pow(1024, 3), fromBase: (v) => v / Math.pow(1024, 3) },
      { id: 'tib', name: 'Tebibytes (2⁴⁰)', symbol: 'TiB', toBase: (v) => v * Math.pow(1024, 4), fromBase: (v) => v / Math.pow(1024, 4) },
    ],
  },
];

export function convertUnits(
  categoryId: UnitCategory,
  fromUnitId: string,
  toUnitId: string,
  value: number
): { result: number; formatted: string; formula: string } | null {
  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  const fromUnit = category.units.find((u) => u.id === fromUnitId);
  const toUnit = category.units.find((u) => u.id === toUnitId);
  if (!fromUnit || !toUnit) return null;

  if (isNaN(value)) {
    return { result: NaN, formatted: 'Invalid number', formula: '' };
  }

  const baseVal = fromUnit.toBase(value);
  const targetVal = toUnit.fromBase(baseVal);

  let formatted = '';
  if (Math.abs(targetVal) > 1e12 || (Math.abs(targetVal) < 1e-6 && targetVal !== 0)) {
    formatted = targetVal.toExponential(6);
  } else {
    // Avoid floating point inaccuracies like 0.0000000000000001
    const rounded = Number(targetVal.toFixed(8));
    formatted = rounded.toString();
  }

  return {
    result: targetVal,
    formatted,
    formula: `${value} ${fromUnit.symbol} = ${formatted} ${toUnit.symbol}`,
  };
}
