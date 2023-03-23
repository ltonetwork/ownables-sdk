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
