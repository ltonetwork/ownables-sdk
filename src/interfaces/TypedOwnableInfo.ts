export interface TypedOwnableInfo {
  owner: string;
  issuer: string;
  ownable_type?: string;
  nft?: NftObject;
}

export interface NftObject {
  address: string;
  id: string;
  lock_service?: any;
  network: string;
}

export interface TypedMetadata {
  name: string;
  image?: string;
  image_data?: string;
  external_url?: string;
  description?: string;
  background_color?: string;
  animation_url?: string;
  youtube_url?: string;
}

export interface TypedOwnable {
  owner: string;
  email?: string;
  name: string;
  description?: string;
  keywords?: string[];
  evmAddress: string;
  network: string;
  image: File | null;
  templateId?: string;
}
