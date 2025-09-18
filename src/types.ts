export type ScryfallImageUris = { small?: string; normal?: string; large?: string };

export type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  image_uris?: ScryfallImageUris;
  card_faces?: { image_uris?: ScryfallImageUris }[];
  finishes?: string[];
  digital?: boolean;
  type_line?: string;

  // NYTT:
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;       // Cardmarket EUR
    eur_foil?: string | null;  // Cardmarket EUR foil
    tix?: string | null;
  };
  purchase_uris?: {
    cardmarket?: string;
    tcgplayer?: string;
  };
  related_uris?: {
    cardmarket?: string;
    tcgplayer?: string;
    gatherer?: string;
  };
};

export type SearchResult = {
  object: string;
  data: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
};

export type OwnedCard = {
  key: string;            // cardId::finish
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  finish: string;
  qty: number;
  image?: string;
};

export type DbCollectionItem = {
  user_id: string;
  key: string;
  id_card: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  finish: string;
  qty: number;
  image: string | null;
  updated_at?: string;
};
