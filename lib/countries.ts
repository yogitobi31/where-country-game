import { countries } from 'countries-list';

export type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

export const continentOptions: Array<{
  code: ContinentCode;
  name: string;
  shortName: string;
  color: string;
}> = [
  { code: 'AS', name: '아시아', shortName: '아시아', color: '#ff7557' },
  { code: 'EU', name: '유럽', shortName: '유럽', color: '#5b84c4' },
  { code: 'AF', name: '아프리카', shortName: '아프리카', color: '#f0b532' },
  { code: 'NA', name: '북아메리카', shortName: '북미', color: '#39b879' },
  { code: 'SA', name: '남아메리카', shortName: '남미', color: '#a56bd4' },
  { code: 'OC', name: '오세아니아', shortName: '오세아니아', color: '#3aa7ba' },
];

export const sovereignByContinent: Record<ContinentCode, string[]> = {
  AF: [
    'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CD', 'CG',
    'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
    'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
    'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
    'ZM', 'ZW',
  ],
  AS: [
    'AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'CY', 'GE', 'IN', 'ID',
    'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KP', 'KR', 'KW', 'KG', 'LA', 'LB', 'MY',
    'MV', 'MN', 'MM', 'NP', 'OM', 'PK', 'PS', 'PH', 'QA', 'SA', 'SG', 'LK', 'SY',
    'TW', 'TJ', 'TH', 'TL', 'TR', 'TM', 'AE', 'UZ', 'VN', 'YE',
  ],
  EU: [
    'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC',
    'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES',
    'SE', 'CH', 'UA', 'GB', 'VA', 'XK',
  ],
  NA: [
    'AG', 'BS', 'BB', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'SV', 'GD', 'GT', 'HT',
    'HN', 'JM', 'MX', 'NI', 'PA', 'KN', 'LC', 'VC', 'TT', 'US',
  ],
  SA: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
  OC: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU'],
};

export const allCountryCodes = Object.values(sovereignByContinent).flat();

export const microCountryCodes = new Set([
  'AD', 'AG', 'BH', 'BB', 'CV', 'KM', 'DM', 'GD', 'KI', 'LI', 'LU', 'MV', 'MT',
  'MH', 'FM', 'MC', 'NR', 'PW', 'KN', 'LC', 'VC', 'SM', 'SC', 'SG', 'ST', 'TO',
  'TT', 'TV', 'VA', 'WS',
]);

const displayNames = new Intl.DisplayNames(['ko'], { type: 'region' });

const koreanCapitalNames: Record<string, string> = {
  KR: '서울', JP: '도쿄', CN: '베이징', MN: '울란바토르', IN: '뉴델리', ID: '자카르타',
  TH: '방콕', VN: '하노이', PH: '마닐라', SG: '싱가포르', MY: '쿠알라룸푸르',
  US: '워싱턴 D.C.', CA: '오타와', MX: '멕시코시티', BR: '브라질리아', AR: '부에노스아이레스',
  CL: '산티아고', PE: '리마', CO: '보고타', GB: '런던', FR: '파리', DE: '베를린',
  IT: '로마', ES: '마드리드', PT: '리스본', RU: '모스크바', UA: '키이우', GR: '아테네',
  EG: '카이로', ZA: '프리토리아', KE: '나이로비', NG: '아부자', ET: '아디스아바바',
  MA: '라바트', AU: '캔버라', NZ: '웰링턴', TR: '앙카라', SA: '리야드', AE: '아부다비',
};

const countryFacts: Record<string, string> = {
  KR: '한반도 남쪽에 있으며 삼면이 바다로 둘러싸여 있어요.',
  JP: '아시아 동쪽 태평양에 길게 이어진 섬나라예요.',
  CN: '동아시아에 자리한 세계에서 면적이 매우 큰 나라예요.',
  IN: '남아시아의 인도양 쪽으로 뻗은 큰 반도에 있어요.',
  BR: '남아메리카에서 면적이 가장 큰 나라예요.',
  CA: '북아메리카 북부에 위치하며 대서양과 태평양에 모두 닿아요.',
  US: '캐나다와 멕시코 사이에 자리하고 있어요.',
  FR: '서유럽에 있으며 대서양과 지중해에 모두 닿아요.',
  GB: '유럽 대륙의 북서쪽에 있는 섬나라예요.',
  IT: '지중해로 뻗은 장화 모양의 반도로 유명해요.',
  EG: '아프리카 북동부, 나일강 하류에 자리해요.',
  ZA: '아프리카 대륙의 남쪽 끝에 가까이 있어요.',
  AU: '오세아니아에서 가장 넓은 나라예요.',
  NZ: '오스트레일리아 남동쪽 태평양에 있는 섬나라예요.',
  RU: '유럽 동부에서 아시아 북부까지 길게 이어져 있어요.',
  CL: '남아메리카 서쪽 해안을 따라 남북으로 아주 길어요.',
};

export function getCountryName(code: string) {
  const normalized = code.toUpperCase();
  try {
    return displayNames.of(normalized) ?? countries[normalized as keyof typeof countries]?.name ?? normalized;
  } catch {
    return countries[normalized as keyof typeof countries]?.name ?? normalized;
  }
}

export function getCountryFlag(code: string) {
  return code
    .toUpperCase()
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

export function getCountryCapital(code: string) {
  const normalized = code.toUpperCase();
  if (koreanCapitalNames[normalized]) return koreanCapitalNames[normalized];
  return countries[normalized as keyof typeof countries]?.capital || '수도 정보 준비 중';
}

export function getCountryContinent(code: string): ContinentCode {
  const normalized = code.toUpperCase();
  const match = continentOptions.find((continent) => sovereignByContinent[continent.code].includes(normalized));
  return match?.code ?? 'AS';
}

export function getCountryFact(code: string) {
  const continent = continentOptions.find((item) => item.code === getCountryContinent(code));
  return countryFacts[code.toUpperCase()] ?? `${continent?.name ?? '세계'}에 자리한 나라예요.`;
}

export function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
