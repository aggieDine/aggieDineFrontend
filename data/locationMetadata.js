/**
 * Local metadata for all dining locations — coordinates, category, description.
 * Sourced from the dineoncampus.com public API.
 * Keyed by location_name as it appears in the S3 scrape data.
 */
export const LOCATION_METADATA = {
  // --- Dining Halls ---
  'The Commons Dining Hall (South Campus)': {
    category: 'Dining Hall',
    coordinates: { latitude: 30.615459649796595, longitude: -96.33607513173831 },
    description: 'All-you-care-to-eat dining hall on south campus featuring home-style fare, stir fry, vegan, vegetarian, and all-day breakfast.',
  },
  'Sbisa Dining Hall (North Campus)': {
    category: 'Dining Hall',
    coordinates: { latitude: 30.6171351, longitude: -96.3437766 },
    description: 'Historic all-you-care-to-eat dining hall established in 1912, newly renovated with diverse menu selections.',
  },
  'Duncan Dining Hall (South Campus/Quad)': {
    category: 'Dining Hall',
    coordinates: { latitude: 30.6120718, longitude: -96.3355046 },
    description: 'All-you-care-to-eat dining hall anchoring the south end of the Quadrangle near the Corps of Cadets dormitories.',
  },

  // --- North Campus ---
  '1876 Burgers - Sbisa Complex': {
    category: 'Fast Food',
    coordinates: { latitude: 30.617141042891, longitude: -96.34412935186765 },
    description: 'Classic American comfort food — burgers, fries, sandwiches, and salads in the Sbisa Underground Food Court.',
  },
  'Aggie Express - Hullabaloo': {
    category: 'Convenience',
    coordinates: { latitude: 30.616600962559502, longitude: -96.34644287064897 },
    description: 'Convenience store with snacks, sushi, school supplies, and more.',
  },
  'Chick-Fil-A - Sbisa Underground Food Court': {
    category: 'Fast Food',
    coordinates: { latitude: 30.6171351, longitude: -96.34377669999999 },
    description: 'Chicken sandwiches, nuggets, waffle fries, and more.',
  },
  "Copperhead Jack's - Sbisa Complex": {
    category: 'Fast Food',
    coordinates: { latitude: 30.617100093759838, longitude: -96.34392473862306 },
    description: 'Southwestern kitchen with tacos, burritos, and quesadillas in the Sbisa Dining Complex.',
  },
  'Einstein Bros. Bagels - Sbisa Complex': {
    category: 'Cafe',
    coordinates: { latitude: 30.617168450954566, longitude: -96.34422788227846 },
    description: 'Freshly baked bagels, breakfast and lunch sandwiches, and coffee.',
  },
  'Houston Street Subs - Underground Food Court': {
    category: 'Fast Food',
    coordinates: { latitude: 30.6171351, longitude: -96.3437766 },
    description: 'Custom deli subs and chopped salads made fresh daily.',
  },
  'Bagel Block': {
    category: 'Cafe',
    coordinates: { latitude: 30.6194797, longitude: -96.3421333 },
    description: 'Coffee stop with Polite Coffee Roasters lattes, pastries, and grab-n-go items in Blocker Building.',
  },
  'Pizza @ Underground': {
    category: 'Fast Food',
    coordinates: { latitude: 30.6171351, longitude: -96.3437766 },
    description: 'Pizza, custom mac and cheese, and pasta in the lower level of Sbisa.',
  },
  'Starbucks Coffee - Hullabaloo': {
    category: 'Coffee',
    coordinates: { latitude: 30.616271798835434, longitude: -96.34604574882661 },
    description: 'Full Starbucks coffeehouse with premium teas, pastries, and more.',
  },
  'Smoothie King - Sbisa Underground Food Court': {
    category: 'Drinks',
    coordinates: { latitude: 30.6171351, longitude: -96.3437766 },
    description: 'Smoothies and blended drinks in the Sbisa Underground.',
  },

  // --- Central Campus ---
  'Aggie Express - Pavilion': {
    category: 'Convenience',
    coordinates: { latitude: 30.61656630940704, longitude: -96.33824527604096 },
    description: 'Convenience store with snacks, drinks, and school supplies.',
  },
  'Cabo Grill - MSC': {
    category: 'Fast Food',
    coordinates: { latitude: 30.612240925980263, longitude: -96.3413476589302 },
    description: 'Build-your-own TexMex burritos, bowls, salads, and tacos.',
  },
  'ILCB Food Truck': {
    category: 'Food Truck',
    coordinates: { latitude: 30.612417050682364, longitude: -96.34307565518645 },
    description: 'Rotating food truck zone with a fresh truck and new flavors daily.',
  },
  'Market at Lamar St.': {
    category: 'Convenience',
    coordinates: { latitude: 30.612301445303856, longitude: -96.3440814614296 },
    description: 'Store and coffee bar in the ILCB with Polite Coffee, snacks, and grab-and-go meals.',
  },
  'Moore Family Creamery': {
    category: 'Dessert',
    coordinates: { latitude: 30.610509608758935, longitude: -96.3373294816147 },
    description: 'Blue Bell ice cream scoops and hand-spun milkshakes.',
  },
  'Panda Express - MSC': {
    category: 'Fast Food',
    coordinates: { latitude: 30.6122063, longitude: -96.3411304 },
    description: 'Chinese-American wok-fired entrees and sides in the MSC lower level.',
  },
  "Rev's American Grill - MSC": {
    category: 'Fast Food',
    coordinates: { latitude: 30.6122063, longitude: -96.3411304 },
    description: 'Burgers, chicken sandwiches, tenders, salads, and the famous Gig \'Em sauce.',
  },
  'Starbucks Coffee - Evans Library': {
    category: 'Coffee',
    coordinates: { latitude: 30.617244548607335, longitude: -96.33907016745911 },
    description: 'Starbucks coffeehouse in Evans Library.',
  },
  'Shake Smart - MSC': {
    category: 'Drinks',
    coordinates: { latitude: 30.6122063, longitude: -96.3411304 },
    description: 'Protein shakes, acai bowls, peanut sandwiches, and cold brew coffee.',
  },
  'The University Club': {
    category: 'Restaurant',
    coordinates: { latitude: 30.613053972133272, longitude: -96.33991421901857 },
    description: 'Daily lunch buffet open to visitors, faculty, staff, and students.',
  },
  'Whoop Coop': {
    category: 'Fast Food',
    coordinates: { latitude: 30.616803603845362, longitude: -96.33811800331875 },
    description: 'Fried chicken tenders, fries, coleslaw, Texas toast, and dipping sauces.',
  },

  // --- South Campus ---
  'Aggie Express - Commons': {
    category: 'Convenience',
    coordinates: { latitude: 30.615206039794952, longitude: -96.33585525461392 },
    description: 'Convenience store with snacks, drinks, and school supplies.',
  },
  'Starbucks Coffee - The Quad': {
    category: 'Coffee',
    coordinates: { latitude: 30.61357104762382, longitude: -96.33747887323301 },
    description: 'Starbucks coffeehouse near the Quad.',
  },
  'Houston Street Subs - Southside': {
    category: 'Fast Food',
    coordinates: { latitude: 30.61501645104702, longitude: -96.33589810594333 },
    description: 'Custom sub sandwiches and chopped salads with bread baked daily.',
  },

  // --- East Campus ---
  'Azimuth Cafe - Langford': {
    category: 'Cafe',
    coordinates: { latitude: 30.619008682797052, longitude: -96.3375613036007 },
    description: 'Artisan sandwiches and Polite Coffee near the Colleges of Architecture and Liberal Arts.',
  },
  'Food Truck Row': {
    category: 'Food Truck',
    coordinates: { latitude: 30.620555592170106, longitude: -96.34031567713775 },
    description: 'Rotating food trucks outside the Zachry Engineering Building.',
  },
  'Houston Street Subs - Polo Garage': {
    category: 'Fast Food',
    coordinates: { latitude: 30.622540712255752, longitude: -96.33797872130967 },
    description: 'Custom sub sandwiches and chopped salads with bread baked daily.',
  },
  'Market at Polo Garage': {
    category: 'Convenience',
    coordinates: { latitude: 30.62328306958482, longitude: -96.33777837315522 },
    description: 'Snacks, drinks, and prepackaged meals.',
  },
  'Panda Express - Polo Garage': {
    category: 'Fast Food',
    coordinates: { latitude: 30.622351443549153, longitude: -96.33780705993271 },
    description: 'Chinese-American wok-fired entrees and sides at Polo Rd. Garage.',
  },
  'Salata': {
    category: 'Fast Food',
    coordinates: { latitude: 30.62318151159157, longitude: -96.3375959829422 },
    description: 'Custom salads and wraps with 50+ fresh toppings and signature dressings.',
  },
  'Shake Smart - Polo Garage': {
    category: 'Drinks',
    coordinates: { latitude: 30.62271613170209, longitude: -96.33819061582184 },
    description: 'Protein shakes, acai bowls, and cold brew coffee.',
  },
  'Starbucks Coffee - Zachry': {
    category: 'Coffee',
    coordinates: { latitude: 30.62095612759077, longitude: -96.34056417794034 },
    description: 'Starbucks coffeehouse in the Zachry Engineering Building.',
  },

  // --- West Campus ---
  'Reynolds and Reynolds Cafe': {
    category: 'Cafe',
    coordinates: { latitude: 30.61133239209848, longitude: -96.34974758902435 },
    description: 'Coffee and beverages in the Wayne Roberts \'85 Building.',
  },
  'ILSQ Food Truck': {
    category: 'Food Truck',
    coordinates: { latitude: 30.61127582281874, longitude: -96.34609962698367 },
    description: 'Rotating food truck zone with a fresh truck and new flavors daily.',
  },
  'Chick-fil-A - West Campus Food Hall': {
    category: 'Fast Food',
    coordinates: { latitude: 30.61020392212249, longitude: -96.3486354173355 },
    description: 'Chicken sandwiches, nuggets, waffle fries, and more.',
  },
  "Copperhead Jack's - West Campus Food Hall": {
    category: 'Fast Food',
    coordinates: { latitude: 30.610165000472044, longitude: -96.34852856397629 },
    description: 'Southwestern tacos, burritos, and quesadillas in the West Campus Food Hall.',
  },
  'Creekside Market': {
    category: 'Convenience',
    coordinates: { latitude: 30.60776619970698, longitude: -96.35378539496764 },
    description: 'Store and restaurant stop on West Campus with snacks, drinks, and four food stations.',
  },
  'The Kitchen - Creekside Market': {
    category: 'Fast Food',
    coordinates: { latitude: 30.607770816716766, longitude: -96.35377466613159 },
    description: 'Food station inside Creekside Market.',
  },
  "Spin n' Stone Pizza - Creekside Market": {
    category: 'Fast Food',
    coordinates: { latitude: 30.6075634, longitude: -96.35387399999999 },
    description: 'Pizza at Creekside Market.',
  },
  "Spin 'N Stone Pizza - MSC": {
    category: 'Fast Food',
    coordinates: { latitude: 30.6122063, longitude: -96.3411304 },
    description: 'Pizza in the MSC.',
  },
  "Spin 'n Stone Pasta - Creekside Market": {
    category: 'Fast Food',
    coordinates: { latitude: 30.6077892847536, longitude: -96.35377466613159 },
    description: 'Pasta at Creekside Market.',
  },
  'Health Science Center Cafe': {
    category: 'Cafe',
    coordinates: { latitude: 30.5983982, longitude: -96.3950067 },
    description: 'Coffee, breakfast sandwiches, and lunch options at HSC.',
  },
  'Houston Street Deli - RELLIS': {
    category: 'Fast Food',
    coordinates: { latitude: 30.641282490718428, longitude: -96.46684917483407 },
    description: 'Fresh, handcrafted breakfast and lunch on the RELLIS campus.',
  },
  'Wild Blue Sushi - Creekside Market': {
    category: 'Fast Food',
    coordinates: { latitude: 30.607793901762243, longitude: -96.35378539496764 },
    description: 'Sushi at Creekside Market.',
  },
  'Houston Street Subs - West Campus Food Hall': {
    category: 'Fast Food',
    coordinates: { latitude: 30.610172472604752, longitude: -96.34859725728609 },
    description: 'Custom sub sandwiches and chopped salads with bread baked daily.',
  },
  'Market - Ag Cafe': {
    category: 'Convenience',
    coordinates: { latitude: 30.6108468, longitude: -96.3490257 },
    description: 'Snacks, drinks, and prepackaged meals.',
  },
  'Shake Smart - West Campus Food Hall': {
    category: 'Drinks',
    coordinates: { latitude: 30.61019120323365, longitude: -96.34866091957396 },
    description: 'Protein shakes, acai bowls, and cold brew coffee.',
  },
  'Starbucks - Ag Cafe': {
    category: 'Coffee',
    coordinates: { latitude: 30.6108468, longitude: -96.3490257 },
    description: 'Starbucks coffeehouse at the Ag Cafe.',
  },
  'Shake Smart- Rec Center': {
    category: 'Drinks',
    coordinates: { latitude: 30.6070466, longitude: -96.3428697 },
    description: 'Protein shakes and smoothies at the Rec Center.',
  },
  'The 41st Club - Bush Library': {
    category: 'Cafe',
    coordinates: { latitude: 30.597620652577213, longitude: -96.3524461700884 },
    description: 'Drinks and grab-n-go snacks outside the Allen Building near Bush Library.',
  },
  'Vet Med Cafe': {
    category: 'Cafe',
    coordinates: { latitude: 30.611745504805995, longitude: -96.35731401079788 },
    description: 'Breakfast sandwiches, tacos, paninis, salads, and burgers for the vet med community.',
  },
  'Market Express - Business Library (BLCC)': {
    category: 'Convenience',
    coordinates: { latitude: 30.611372931697144, longitude: -96.3501471483101 },
    description: 'Hot coffee, specialty drinks, grab-n-go sandwiches and pastries in the West Campus Library.',
  },
};

const DEFAULT_METADATA = {
  category: 'Dining',
  coordinates: null,
  status: { isOpen: true },
  description: '',
  hours: [],
};

/**
 * Look up metadata for a location by name.
 * Tries exact match first, then partial match.
 */
export function getMetadataForLocation(locationName) {
  if (LOCATION_METADATA[locationName]) {
    return { ...DEFAULT_METADATA, ...LOCATION_METADATA[locationName] };
  }

  // Partial match — S3 names may differ slightly from API names
  const key = Object.keys(LOCATION_METADATA).find(
    (k) => locationName.includes(k) || k.includes(locationName)
  );

  if (key) {
    return { ...DEFAULT_METADATA, ...LOCATION_METADATA[key] };
  }

  return { ...DEFAULT_METADATA };
}
