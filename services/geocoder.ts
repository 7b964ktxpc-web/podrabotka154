type YandexGeocoderResponse = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: {
              kind?: string;
              precision?: string;
            };
          };
        };
      }>;
    };
  };
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  precision: 'exact' | 'approximate';
};

export async function geocodeAddress(address: string, city?: string | null): Promise<GeocodeResult | null> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey || !address.trim()) return null;

  const query = [city, address].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    apikey: apiKey,
    geocode: query,
    lang: 'ru_RU',
    format: 'json',
    kind: 'house',
    results: '1',
  });

  const response = await fetch(`https://geocode-maps.yandex.ru/v1/?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Yandex geocoder returned ${response.status}`);
  }

  const data = (await response.json()) as YandexGeocoderResponse;
  const object = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = object?.Point?.pos;
  if (!pos) return null;

  const [longitude, latitude] = pos.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const kind = object.metaDataProperty?.GeocoderMetaData?.kind;
  const precision = object.metaDataProperty?.GeocoderMetaData?.precision;
  const exact = kind === 'house' && precision === 'exact';

  return {
    latitude,
    longitude,
    precision: exact ? 'exact' : 'approximate',
  };
}
