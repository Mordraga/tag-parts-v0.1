// Offline reverse geocoding using bundled GeoNames city data.
// cities.json format: [[name, lat, lng, countryCode, admin1Code], ...]

let cities = null;

async function loadCities() {
  if (cities) return cities;
  try {
    const mod = await import('../data/cities.json', { assert: { type: 'json' } });
    cities = mod.default;
  } catch {
    cities = [];
  }
  return cities;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatCity(name, cc, admin1) {
  // For US/CA/AU, admin1 is a readable state/province code
  const showAdmin = ['US', 'CA', 'AU'].includes(cc) && admin1;
  return showAdmin ? `${name}, ${admin1}` : `${name}, ${cc}`;
}

export async function nearestCity(lat, lng) {
  const data = await loadCities();
  if (!data.length) return null;

  let best = null;
  let bestDist = Infinity;

  for (const [name, clat, clng, cc, admin1] of data) {
    const d = haversineKm(lat, lng, clat, clng);
    if (d < bestDist) {
      bestDist = d;
      best = { name, cc, admin1, distKm: d };
    }
  }

  return best ? formatCity(best.name, best.cc, best.admin1) : null;
}
