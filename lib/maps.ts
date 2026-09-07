function clean(address: string): string { const v = address.trim(); if (!v)
    throw new Error("Адрес не указан"); return v; }
export function build2GisUrl(address: string): string { return `https://2gis.ru/search/${encodeURIComponent(clean(address))}`; }
export function buildYandexMapsUrl(address: string): string { return `https://yandex.ru/maps/?text=${encodeURIComponent(clean(address))}`; }
export function fullAddress(city: string, address: string | null): string | null { if (!address?.trim())
    return null; return address.toLocaleLowerCase("ru").includes(city.toLocaleLowerCase("ru")) ? address.trim() : `${city}, ${address.trim()}`; }
