export type PublishedMerchandising = {
  basePrice: number | null;
  finalPrice: number | null;
  discountAmount: number | null;
  discountPct: number | null;
  installmentCount: number | null;
  installmentValue: number | null;
  creditEnabled: boolean;
};

function positiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function readPublishedMerchandising(source: any): PublishedMerchandising {
  const attrs = source?.attrs || {};
  const pricing = attrs?.pricing || source?.pricing || {};
  const finance =
    attrs?.finance ||
    attrs?.credit ||
    attrs?.pay?.finance ||
    source?.finance ||
    source?.credit ||
    source?.meta?.pay?.finance ||
    source?.meta?.finance ||
    {};
  const credit = finance?.credit && typeof finance.credit === "object" ? finance.credit : finance;
  const explicitlyFinalPrice = positiveNumber(
    pricing?.salePrice,
    pricing?.finalPrice,
    attrs?.salePrice,
    attrs?.finalPrice,
    source?.salePrice,
    source?.finalPrice,
  );
  const ordinaryPrice = positiveNumber(
    attrs?.precio,
    attrs?.price,
    source?.precio,
    source?.price,
  );
  const finalPrice = explicitlyFinalPrice || ordinaryPrice;
  const basePrice = positiveNumber(
    pricing?.comparisonPrice,
    pricing?.basePrice,
    attrs?.comparisonPrice,
    attrs?.basePrice,
    source?.comparisonPrice,
    source?.basePrice,
    explicitlyFinalPrice && ordinaryPrice && ordinaryPrice > explicitlyFinalPrice
      ? ordinaryPrice
      : null,
  );
  const emittedDiscountAmount = positiveNumber(
    pricing?.discountAmount,
    attrs?.discountAmount,
    source?.discountAmount,
  );
  const emittedDiscountPct = positiveNumber(
    pricing?.discountPct,
    attrs?.discountPct,
    source?.discountPct,
  );
  const hasRealDiscount = Boolean(basePrice && finalPrice && basePrice > finalPrice && (emittedDiscountPct || emittedDiscountAmount));
  const discountPct = hasRealDiscount && emittedDiscountPct
    ? Math.min(99, Math.round(emittedDiscountPct))
    : null;
  const publishedInstallmentOptions = [
    credit?.installmentOptions,
    finance?.installmentOptions,
    attrs?.installmentOptions,
    source?.installmentOptions,
  ]
    .filter(Array.isArray)
    .flat()
    .map((option: any) => ({
      count: positiveNumber(option?.count, option?.installmentCount),
      amount: positiveNumber(option?.installmentAmount),
    }))
    .filter((option) => option.count && option.amount)
    .sort((a, b) => Number(b.count) - Number(a.count));
  const publishedOption = publishedInstallmentOptions[0] || null;
  const directInstallmentCount = positiveNumber(
    credit?.publicMaxInstallments,
    credit?.installmentCount,
    attrs?.publicMaxInstallments,
    attrs?.installmentCount,
    source?.publicMaxInstallments,
    source?.installmentCount,
  );
  const directInstallmentAmount = positiveNumber(
    credit?.installmentAmount,
    credit?.installmentValue,
    attrs?.installmentAmount,
    attrs?.installmentValue,
    source?.installmentAmount,
    source?.installmentValue,
  );
  const legacyInstallmentPrice = positiveNumber(
    credit?.installmentPrice,
    attrs?.installmentPrice,
    source?.installmentPrice,
  );
  const installmentCount = publishedOption?.count || directInstallmentCount;
  const installmentValue =
    publishedOption?.amount || directInstallmentAmount || legacyInstallmentPrice;
  const creditEnabled = Boolean(
    credit?.creditEnabled === true ||
      attrs?.creditEnabled === true ||
      source?.creditEnabled === true ||
      (installmentCount && installmentValue),
  );

  return {
    basePrice: hasRealDiscount ? basePrice : null,
    finalPrice,
    discountAmount: hasRealDiscount ? emittedDiscountAmount : null,
    discountPct,
    installmentCount: creditEnabled && installmentCount ? Math.max(1, Math.round(installmentCount)) : null,
    installmentValue: creditEnabled ? installmentValue : null,
    creditEnabled,
  };
}
