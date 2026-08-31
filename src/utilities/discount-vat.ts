function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finitePercent(value: number, max = Infinity): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
}

/** Removes ordinary binary floating-point display noise without forcing currency cents. */
export function roundFinancial(value: number, decimals = 10): number {
  if (!Number.isFinite(value)) return 0;
  const places = Math.max(0, Math.min(12, Math.floor(decimals)));
  return Number(value.toFixed(places));
}

export interface DiscountResult {
  originalPrice: number;
  primaryDiscountAmount: number;
  secondaryDiscountAmount: number;
  totalSaved: number;
  finalPrice: number;
  effectiveDiscountPercent: number;
}

export function calculateDiscount(
  originalPrice: number,
  primaryPercent: number,
  secondaryPercent = 0,
  fixedDiscountAmount = 0
): DiscountResult {
  const price = finiteNonNegative(originalPrice);
  const fixed = Math.min(price, finiteNonNegative(fixedDiscountAmount));
  const priceAfterFixed = price - fixed;
  const primaryRate = finitePercent(primaryPercent, 100) / 100;
  const secondaryRate = finitePercent(secondaryPercent, 100) / 100;
  const primaryDiscount = priceAfterFixed * primaryRate;
  const priceAfterPrimary = priceAfterFixed - primaryDiscount;
  const secondaryDiscount = priceAfterPrimary * secondaryRate;
  const finalPrice = Math.max(0, priceAfterPrimary - secondaryDiscount);
  const totalSaved = price - finalPrice;
  const effectiveDiscountPercent = price > 0 ? (totalSaved / price) * 100 : 0;

  return {
    originalPrice: roundFinancial(price),
    primaryDiscountAmount: roundFinancial(primaryDiscount + fixed),
    secondaryDiscountAmount: roundFinancial(secondaryDiscount),
    totalSaved: roundFinancial(totalSaved),
    finalPrice: roundFinancial(finalPrice),
    effectiveDiscountPercent: roundFinancial(effectiveDiscountPercent),
  };
}

/**
 * Reverse a sequence of percentage discounts to recover the pre-discount price.
 * Fixed discounts are assumed to have been applied first, matching calculateDiscount().
 */
export function calculateOriginalPriceFromDiscount(
  finalPrice: number,
  primaryPercent: number,
  secondaryPercent = 0,
  fixedDiscountAmount = 0
): { originalPrice: number | null; error?: string } {
  const finalValue = finiteNonNegative(finalPrice);
  const primaryFactor = 1 - finitePercent(primaryPercent, 100) / 100;
  const secondaryFactor = 1 - finitePercent(secondaryPercent, 100) / 100;
  const combinedFactor = primaryFactor * secondaryFactor;
  if (combinedFactor <= 0) return { originalPrice: null, error: 'A 100% discount cannot be reversed.' };
  const fixed = finiteNonNegative(fixedDiscountAmount);
  return { originalPrice: roundFinancial(finalValue / combinedFactor + fixed) };
}

export interface VatResult {
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
}

export function calculateVatAdd(netAmount: number, taxRate: number): VatResult {
  const net = finiteNonNegative(netAmount);
  const rate = finitePercent(taxRate);
  const tax = net * (rate / 100);
  const gross = net + tax;
  return {
    netAmount: roundFinancial(net),
    taxAmount: roundFinancial(tax),
    grossAmount: roundFinancial(gross),
    taxRate: roundFinancial(rate),
  };
}

export function calculateVatExtract(grossAmount: number, taxRate: number): VatResult {
  const gross = finiteNonNegative(grossAmount);
  const rate = finitePercent(taxRate);
  const divisor = 1 + rate / 100;
  const net = divisor > 0 ? gross / divisor : gross;
  const tax = gross - net;
  return {
    netAmount: roundFinancial(net),
    taxAmount: roundFinancial(tax),
    grossAmount: roundFinancial(gross),
    taxRate: roundFinancial(rate),
  };
}

export interface MarginMarkupResult {
  cost: number;
  revenue: number;
  profit: number;
  marginPercent: number;
  markupPercent: number;
}

export function calculateFromCostAndRevenue(cost: number, revenue: number): MarginMarkupResult {
  const c = finiteNonNegative(cost);
  const r = finiteNonNegative(revenue);
  const profit = r - c;
  const marginPercent = r > 0 ? (profit / r) * 100 : 0;
  const markupPercent = c > 0 ? (profit / c) * 100 : 0;
  return {
    cost: roundFinancial(c),
    revenue: roundFinancial(r),
    profit: roundFinancial(profit),
    marginPercent: roundFinancial(marginPercent),
    markupPercent: roundFinancial(markupPercent),
  };
}

export function calculateFromCostAndMargin(cost: number, marginPercent: number): MarginMarkupResult {
  const c = finiteNonNegative(cost);
  const m = finitePercent(marginPercent, 99.999999);
  const revenue = c / (1 - m / 100);
  const profit = revenue - c;
  const markupPercent = c > 0 ? (profit / c) * 100 : 0;
  return {
    cost: roundFinancial(c),
    revenue: roundFinancial(revenue),
    profit: roundFinancial(profit),
    marginPercent: roundFinancial(m),
    markupPercent: roundFinancial(markupPercent),
  };
}

export function calculateFromCostAndMarkup(cost: number, markupPercent: number): MarginMarkupResult {
  const c = finiteNonNegative(cost);
  const mk = finitePercent(markupPercent);
  const revenue = c * (1 + mk / 100);
  const profit = revenue - c;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  return {
    cost: roundFinancial(c),
    revenue: roundFinancial(revenue),
    profit: roundFinancial(profit),
    marginPercent: roundFinancial(marginPercent),
    markupPercent: roundFinancial(mk),
  };
}
