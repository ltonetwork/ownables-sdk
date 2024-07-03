export interface TypedOwnableInfo {
  owner: string;
  issuer: string;
  ownable_type?: string;
}

export interface TypedMetadata {
  name: string,
  image?: string,
  image_data?: string,
  external_url?: string,
  description?: string,
  background_color?: string,
  animation_url?: string,
  youtube_url?: string,
}

export interface TypedOwnable {
  owner: string;
  email: string;
  name: string;
  description?: string;
  keywords?: string[];
  ethereumAddress: string;
  network: string;
  image: File | null;
}

export interface TypedReadyOwnable {
  RID: string;
  NAME: string;
  CLAIMED?: boolean;
  CID: string;
  id?: string;
  name: string;
  status: string;
  link: string;
  NFT_BLOCKCHAIN: string;
}

export interface TypedTxInfo {
  id: string;
}