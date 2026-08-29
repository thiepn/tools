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
  const price = Math.max(0, originalPrice);
  const fixed = Math.min(price, Math.max(0, fixedDiscountAmount));
  const priceAfterFixed = price - fixed;

  const primaryDiscount = priceAfterFixed * (Math.max(0, Math.min(100, primaryPercent)) / 100);
  const priceAfterPrimary = priceAfterFixed - primaryDiscount;

  const secondaryDiscount =
    priceAfterPrimary * (Math.max(0, Math.min(100, secondaryPercent)) / 100);
  const finalPrice = Math.max(0, priceAfterPrimary - secondaryDiscount);

  const totalSaved = price - finalPrice;
  const effectiveDiscountPercent = price > 0 ? (totalSaved / price) * 100 : 0;

  return {
    originalPrice: price,
    primaryDiscountAmount: primaryDiscount + fixed,
    secondaryDiscountAmount: secondaryDiscount,
    totalSaved,
    finalPrice,
    effectiveDiscountPercent,
  };
}

export interface VatResult {
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
}

export function calculateVatAdd(netAmount: number, taxRate: number): VatResult {
  const net = Math.max(0, netAmount);
  const rate = Math.max(0, taxRate);
  const tax = net * (rate / 100);
  const gross = net + tax;

  return {
    netAmount: net,
    taxAmount: tax,
    grossAmount: gross,
    taxRate: rate,
  };
}

export function calculateVatExtract(grossAmount: number, taxRate: number): VatResult {
  const gross = Math.max(0, grossAmount);
  const rate = Math.max(0, taxRate);
  const net = rate > -100 ? gross / (1 + rate / 100) : gross;
  const tax = gross - net;

  return {
    netAmount: net,
    taxAmount: tax,
    grossAmount: gross,
    taxRate: rate,
  };
}

export interface MarginMarkupResult {
  cost: number;
  revenue: number;
  profit: number;
  marginPercent: number; // profit / revenue * 100
  markupPercent: number; // profit / cost * 100
}

export function calculateFromCostAndRevenue(cost: number, revenue: number): MarginMarkupResult {
  const c = Math.max(0, cost);
  const r = Math.max(0, revenue);
  const profit = r - c;
  const marginPercent = r > 0 ? (profit / r) * 100 : 0;
  const markupPercent = c > 0 ? (profit / c) * 100 : 0;

  return {
    cost: c,
    revenue: r,
    profit,
    marginPercent,
    markupPercent,
  };
}

export function calculateFromCostAndMargin(cost: number, marginPercent: number): MarginMarkupResult {
  const c = Math.max(0, cost);
  const m = Math.max(0, Math.min(99.99, marginPercent));
  const revenue = m < 100 ? c / (1 - m / 100) : c;
  const profit = revenue - c;
  const markupPercent = c > 0 ? (profit / c) * 100 : 0;

  return {
    cost: c,
    revenue,
    profit,
    marginPercent: m,
    markupPercent,
  };
}

export function calculateFromCostAndMarkup(cost: number, markupPercent: number): MarginMarkupResult {
  const c = Math.max(0, cost);
  const mk = Math.max(0, markupPercent);
  const revenue = c * (1 + mk / 100);
  const profit = revenue - c;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    cost: c,
    revenue,
    profit,
    marginPercent,
    markupPercent: mk,
  };
}
