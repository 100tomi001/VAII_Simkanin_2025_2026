// Diskusné témy
export const mockTopics = [
  {
    id: 1,
    title: "Hearts of Iron IV – nová meta po poslednom update",
    author: "Kaiser",
    replies: 42,
    game: "Hearts of Iron IV",
    createdAt: "2025-11-01T14:00:00",
    lastActivity: "2025-11-05T10:15:00",
    tags: ["HOI4", "meta", "strategie"],
  },
  {
    id: 2,
    title: "Europa Universalis IV – najlepšie štarty pre začiatočníkov",
    author: "NoviceGuide",
    replies: 15,
    game: "Europa Universalis IV",
    createdAt: "2025-10-28T09:00:00",
    lastActivity: "2025-10-30T18:20:00",
    tags: ["EU4", "začiatočník", "návod"],
  },
  {
    id: 3,
    title: "Stellaris – aké módy používate v roku 2025?",
    author: "StarGazer",
    replies: 27,
    game: "Stellaris",
    createdAt: "2025-11-05T18:00:00",
    lastActivity: "2025-11-06T12:45:00",
    tags: ["Stellaris", "módy", "diskusia"],
  },
];

// jednoduchý zoznam tagov – začiatok tag systému
export const mockTags = [
  "HOI4",
  "EU4",
  "Stellaris",
  "meta",
  "návod",
  "módy",
  "začiatočník",
  "strategie",
  "diskusia",
];

export const mockPostsByTopic = {
  1: [
    {
      id: 1,
      author: "Kaiser",
      createdAt: "2025-11-01 14:20",
      content:
        "Po poslednom patchi sa oplatí viac investovať do letectva, AI má slabšiu protivzdušnú obranu.",
    },
    {
      id: 2,
      author: "IronGeneral",
      createdAt: "2025-11-01 15:02",
      content:
        "Ja stále hrám klasiku – tanky + pechota, ale možno skúsim tvoju stratégiu.",
    },
  ],
  2: [
    {
      id: 1,
      author: "NoviceGuide",
      createdAt: "2025-10-28 09:10",
      content:
        "Začiatočníkom odporúčam Francúzsko alebo Kastíliu, máš priestor na chyby.",
    },
  ],
  3: [
    {
      id: 1,
      author: "StarGazer",
      createdAt: "2025-11-05 18:45",
      content:
        "Používam hlavne grafické módy a pár QoL vecí ako UI Overhaul Dynamic.",
    },
  ],
};

// Wiki články
export const mockWikiArticles = [
  {
    id: 1,
    slug: "hoi4-zaklady-armady",
    title: "Hearts of Iron IV – základy armády",
    game: "Hearts of Iron IV",
    summary: "Prehľad šablón divízií, zásobovania a základných tipov pre armády.",
    lastUpdated: "2025-10-20",
    tags: ["HOI4", "návod", "začiatočník"],
    content: `
V tomto wiki článku nájdeš základné informácie o stavbe divízií, zásobovaní a
manažmente armády v Hearts of Iron IV.

## Šablóny divízií
Pre začiatočníkov sa odporúča klasická 7/2 šablóna (7 pechotných práporov, 2 delostrelecké).

## Zásobovanie
Dbaj na infraštruktúru a logistiku – bez zásob armáda bojuje slabšie...

(ďalší text môžeš ľubovoľne doplniť)
    `,
  },
  {
    id: 2,
    slug: "eu4-ekonomika",
    title: "Europa Universalis IV – ako neskrachovať",
    game: "Europa Universalis IV",
    summary: "Tipy na správu ekonomiky a dlhov v EU4.",
    lastUpdated: "2025-09-15",
    tags: ["EU4", "ekonomika"],
    content: `
Ekonomika je kľúčom k úspechu v EU4. V tomto článku sa pozrieme na dane, produkciu a obchod.

## Dane a korupcia
Sleduj výdavky na armádu a korupciu. Zbytočne neprekračuj limity jednotiek...

(ďalší text môžeš upraviť podľa seba)
    `,
  },
];
