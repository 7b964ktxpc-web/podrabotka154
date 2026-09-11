export function fullAddress(city: string, address: string | null): string | null {
  if (!address?.trim()) return null;
  return address.toLocaleLowerCase("ru").includes(city.toLocaleLowerCase("ru"))
    ? address.trim()
    : `${city}, ${address.trim()}`;
}

export function mapLinks(city: string, address: string | null) {
  const full = fullAddress(city, address);
  if (!full) return null;
  const query = encodeURIComponent(full);
  return {
    yandex: `https://yandex.ru/maps/?text=${query}`,
    twoGis: `https://2gis.ru/search/${query}`,
  };
}
