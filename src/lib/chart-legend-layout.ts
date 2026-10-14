/** Keep the family legend clear of the Current frontier label at narrow widths. */
export function compactLegendStartY(tokenPrices: boolean, hasCurrentFrontier: boolean): number {
  return (tokenPrices ? 30 : 15) + (hasCurrentFrontier ? 16 : 0);
}
