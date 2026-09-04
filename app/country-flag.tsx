import { getCountryName } from '@/lib/countries';
/* oxlint-disable next/no-img-element -- These tiny same-origin SVGs need no raster optimization. */

export function CountryFlag({ code }: { code: string }) {
  return (
    <img
      className="country-flag"
      src={`/flags/${code.toLowerCase()}.svg`}
      alt={`${getCountryName(code)} 국기`}
      width={64}
      height={48}
      draggable={false}
    />
  );
}
