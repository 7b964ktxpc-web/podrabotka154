export function fullAddress(city: string, address: string | null): string | null {
  if (!address?.trim()) return null;
  return address.toLocaleLowerCase("ru").includes(city.toLocaleLowerCase("ru"))
    ? address.trim()
    : `${city}, ${address.trim()}`;
}
