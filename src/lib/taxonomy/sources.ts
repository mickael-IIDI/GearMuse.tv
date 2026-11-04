/**
 * Sources de découverte proposées à l'amorçage. Les identifiants de chaînes ne sont
 * PAS écrits en dur : ils sont résolus via Wikidata (propriété P2397) puis vérifiés
 * par le flux RSS officiel de YouTube. Une chaîne introuvable ou non vérifiée est
 * simplement ignorée (aucun identifiant n'est inventé).
 */

export type CuratedChannelSeed = {
  /** Libellé exact (anglais) de l'élément Wikidata. */
  name: string;
  universe: string | null;
  official?: boolean;
  trust: number;
};

export const CURATED_CHANNELS: CuratedChannelSeed[] = [
  // Automobile — journalisme, ingénierie, restauration
  { name: "Engineering Explained", universe: "automobile", trust: 85 },
  { name: "Jay Leno's Garage", universe: "automobile", trust: 80 },
  { name: "Doug DeMuro", universe: "automobile", trust: 70 },
  { name: "Hagerty", universe: "automobile", trust: 75 },
  { name: "Petrolicious", universe: "automobile", trust: 75 },
  { name: "Savagegeese", universe: "automobile", trust: 75 },
  { name: "Donut Media", universe: "automobile", trust: 60 },
  { name: "ChrisFix", universe: "automobile", trust: 75 },
  { name: "Throttle House", universe: "automobile", trust: 65 },
  { name: "Carwow", universe: "automobile", trust: 60 },
  { name: "Mighty Car Mods", universe: "automobile", trust: 65 },
  { name: "Vice Grip Garage", universe: "automobile", trust: 70 },
  { name: "Top Gear", universe: "automobile", trust: 65 },
  { name: "Motor Trend", universe: "automobile", trust: 60 },
  { name: "Regular Car Reviews", universe: "automobile", trust: 60 },
  { name: "Vilebrequin", universe: "automobile", trust: 60 },
  { name: "Animagraffs", universe: null, trust: 85 },
  { name: "Lesics", universe: null, trust: 75 },
  { name: "Jared Owen", universe: null, trust: 75 },
  { name: "Petersen Automotive Museum", universe: "automobile", official: true, trust: 80 },
  // Moto
  { name: "FortNine", universe: "moto", trust: 80 },
  { name: "Cycle World", universe: "moto", trust: 65 },
  { name: "Isle of Man TT", universe: "moto", official: true, trust: 70 },
  // Aviation et espace
  { name: "Mentour Pilot", universe: "aviation", trust: 85 },
  { name: "Captain Joe", universe: "aviation", trust: 70 },
  { name: "Scott Manley", universe: "autres-vehicules", trust: 85 },
  { name: "Everyday Astronaut", universe: "autres-vehicules", trust: 85 },
  { name: "Curious Droid", universe: null, trust: 70 },
  { name: "Mustard", universe: null, trust: 75 },
  { name: "Smithsonian National Air and Space Museum", universe: "aviation", official: true, trust: 85 },
  { name: "Royal Aeronautical Society", universe: "aviation", official: true, trust: 80 },
  // Nautisme
  { name: "Drachinifel", universe: "nautisme", trust: 80 },
  { name: "Casual Navigation", universe: "nautisme", trust: 70 },
  // Autres véhicules et multi-univers
  { name: "The Tank Museum", universe: "autres-vehicules", official: true, trust: 85 },
  { name: "Real Engineering", universe: null, trust: 75 },
  { name: "Wendover Productions", universe: null, trust: 70 },
  { name: "Smarter Every Day", universe: null, trust: 80 },
  // Chaînes officielles (constructeurs, compétitions, agences)
  { name: "Formula One", universe: "automobile", official: true, trust: 65 },
  { name: "MotoGP", universe: "moto", official: true, trust: 65 },
  { name: "Porsche", universe: "automobile", official: true, trust: 60 },
  { name: "Ferrari", universe: "automobile", official: true, trust: 60 },
  { name: "Airbus", universe: "aviation", official: true, trust: 60 },
  { name: "SpaceX", universe: "autres-vehicules", official: true, trust: 65 },
  { name: "NASA", universe: "autres-vehicules", official: true, trust: 70 },
  { name: "European Space Agency", universe: "autres-vehicules", official: true, trust: 70 },
  { name: "Boston Dynamics", universe: "autres-vehicules", official: true, trust: 60 },
];

/** Requêtes de découverte dans les commentaires Hacker News (« youtube » + terme). */
export const HN_DISCOVERY_QUERIES: { query: string; universe: string | null }[] = [
  { query: "engine", universe: null },
  { query: "jet engine", universe: "aviation" },
  { query: "turbofan", universe: "aviation" },
  { query: "aircraft", universe: "aviation" },
  { query: "airliner", universe: "aviation" },
  { query: "pilot", universe: "aviation" },
  { query: "helicopter", universe: "aviation" },
  { query: "cockpit", universe: "aviation" },
  { query: "SR-71", universe: "aviation" },
  { query: "Concorde", universe: "aviation" },
  { query: "car", universe: "automobile" },
  { query: "carburetor", universe: "automobile" },
  { query: "gearbox", universe: "automobile" },
  { query: "transmission", universe: "automobile" },
  { query: "restoration", universe: null },
  { query: "Formula 1", universe: "automobile" },
  { query: "Le Mans", universe: "automobile" },
  { query: "rally", universe: "automobile" },
  { query: "motorcycle", universe: "moto" },
  { query: "ship", universe: "nautisme" },
  { query: "submarine", universe: "nautisme" },
  { query: "boat", universe: "nautisme" },
  { query: "container ship", universe: "nautisme" },
  { query: "locomotive", universe: "autres-vehicules" },
  { query: "train", universe: "autres-vehicules" },
  { query: "tractor", universe: "autres-vehicules" },
  { query: "excavator", universe: "autres-vehicules" },
  { query: "tank", universe: "autres-vehicules" },
  { query: "rocket", universe: "autres-vehicules" },
  { query: "Saturn V", universe: "autres-vehicules" },
  { query: "space shuttle", universe: "autres-vehicules" },
  { query: "steam engine", universe: null },
  { query: "diesel", universe: null },
  { query: "electric vehicle", universe: null },
  { query: "factory", universe: null },
];

export const REDDIT_SUBREDDITS: { name: string; universe: string | null }[] = [
  { name: "cars", universe: "automobile" },
  { name: "Autos", universe: "automobile" },
  { name: "projectcar", universe: "automobile" },
  { name: "motorcycles", universe: "moto" },
  { name: "aviation", universe: "aviation" },
  { name: "flying", universe: "aviation" },
  { name: "boating", universe: "nautisme" },
  { name: "engineering", universe: null },
  { name: "Trains", universe: "autres-vehicules" },
  { name: "spacex", universe: "autres-vehicules" },
];
