/**
 * Sources de découverte proposées à l'amorçage. Les identifiants de chaînes proviennent
 * de Wikidata (propriété P2397) ou de l'API YouTube (résolution des handles) et sont
 * toujours revérifiés par le flux RSS officiel avant inscription. Une chaîne introuvable
 * ou dont le titre ne concorde pas est ignorée (aucun identifiant n'est inventé).
 */

export type CuratedChannelSeed = {
  /** Libellé exact (anglais) de l'élément Wikidata. */
  name: string;
  universe: string | null;
  official?: boolean;
  trust: number;
};

export type VerifiedChannelSeed = {
  channelId: string;
  /** Titre attendu : comparé au titre du flux RSS avant inscription. */
  name: string;
  universe: string;
  official?: boolean;
  trust: number;
};

/**
 * Chaînes résolues par leur handle via l'API YouTube officielle (channels.list forHandle) le 5 novembre 2026,
 * retenues après contrôle du titre, de la description et du flux RSS. Elles comblent les univers moto et
 * nautisme, peu couverts par Wikidata. Les niveaux de confiance sont une évaluation éditoriale, ajustable
 * depuis l'administration (Sources).
 */
export const VERIFIED_CHANNELS: VerifiedChannelSeed[] = [
  // Moto
  { channelId: "UCNSMdQtn1SuFzCZjfK2C7dQ", name: "FortNine", universe: "moto", trust: 85 },
  { channelId: "UCdl-mzSkTtqAqed7CRNcD5Q", name: "MotoGeo", universe: "moto", trust: 70 },
  { channelId: "UCEIs9nkveW9WmYtsOcJBwTg", name: "Itchy Boots", universe: "moto", trust: 75 },
  { channelId: "UCLQZTXj_AnL7fDC8sLrTGMw", name: "RevZilla", universe: "moto", trust: 60 },
  { channelId: "UCeQf8mZkzUswAL42uQs84iA", name: "WorldSBK", universe: "moto", official: true, trust: 60 },
  { channelId: "UCdCzEBaIZQy3JXzc06ByNAg", name: "Bret Tkacs ADV", universe: "moto", trust: 75 },
  { channelId: "UC0FFFneMi9GwRHUsuBjM0jA", name: "MotoJitsu", universe: "moto", trust: 75 },
  { channelId: "UCkegEsZItEPQNItECCZA_pw", name: "Yammie Noob", universe: "moto", trust: 60 },
  { channelId: "UCidMMQafCAomjuD_a3DcdHw", name: "Chaseontwowheels", universe: "moto", trust: 65 },
  { channelId: "UChWBtAacaOja7iK_AHVWXBg", name: "MOTORRAD", universe: "moto", trust: 70 },
  { channelId: "UCj8_8RcJRf73iO_0o1Djd-g", name: "Dirt Bike Channel", universe: "moto", trust: 65 },
  { channelId: "UC1LDiLhhLi9oW1P8HeF1IwQ", name: "Le Repaire des Motards", universe: "moto", trust: 70 },
  { channelId: "UC2aXNbihvVIxcG7kZu2r7KA", name: "BikeBound", universe: "moto", trust: 65 },
  { channelId: "UCDeNRE5zcKQCwq084kzlivA", name: "American Motorcyclist Association", universe: "moto", official: true, trust: 60 },
  // Nautisme et maritime
  { channelId: "UCKLeLXNWfr0w2fO0h5Bt7mw", name: "BoatTEST.com", universe: "nautisme", trust: 75 },
  { channelId: "UC5_HIscbiDZM0dMX-nCksuA", name: "Casual Navigation", universe: "nautisme", trust: 75 },
  { channelId: "UC81BxUCw12jtyvdyv6Hxh-g", name: "Chief MAKOi", universe: "nautisme", trust: 75 },
  { channelId: "UC__0nIHpSnvXOBVXbF8VGNg", name: "marineinsight", universe: "nautisme", trust: 70 },
  { channelId: "UCAiDWnTP0WB1xCp6uuUo0VA", name: "Acorn To Arabella", universe: "nautisme", trust: 65 },
  { channelId: "UCg-_lYeV8hBnDSay7nmphUA", name: "Sampson Boat Co", universe: "nautisme", trust: 75 },
  { channelId: "UCLjcjAfNhz23WvYBmgBcK6w", name: "Sea-Doo", universe: "nautisme", official: true, trust: 60 },
  { channelId: "UCIrW5ZZnd5oBXbvYIuXh6kg", name: "Mercury Marine", universe: "nautisme", official: true, trust: 60 },
  { channelId: "UCalykb8yWDdpFxYm-1mNYKQ", name: "Azimut Yachts", universe: "nautisme", official: true, trust: 60 },
  { channelId: "UC8jP6Edfm7ialPrzBzHfARg", name: "F1H2O World Championship", universe: "nautisme", official: true, trust: 60 },
  { channelId: "UCZiaSUekMl9qG7FBn4rNZ9Q", name: "Maersk", universe: "nautisme", official: true, trust: 55 },
  { channelId: "UCP8ZI3kj2nZkIwh8CtNB9uQ", name: "Boating Magazine", universe: "nautisme", trust: 70 },
  { channelId: "UCFg6FgZ6xsJCYoDRpqm9J0g", name: "PowerBoat Television", universe: "nautisme", trust: 65 },
  { channelId: "UCaO9orJHxkML8rpcKkILPIw", name: "Yachting Monthly", universe: "nautisme", trust: 60 },
  { channelId: "UC36Hy_G_pHxIO3c2avWfLOw", name: "Motor Boat & Yachting", universe: "nautisme", trust: 75 },
];

/** Chaînes à ne jamais inscrire (identifiants trouvés par Wikidata mais ne correspondant pas à la source attendue). */
export const EXCLUDED_CHANNEL_IDS: Record<string, string> = {
  "UCNC9ca-hClRHiVv95k9QS8g": "« Airbus - Topic » : chaîne générée automatiquement par YouTube (agrégat musical), pas la chaîne officielle d'Airbus",
  "UCYeXD06E5nIk7BwRr5Q954w": "« NASA Marathon » : marathons de speedrun de jeux vidéo, rattachée à tort à NASA par un alias Wikidata",
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
