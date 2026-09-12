// I6 source · complex custom-typed field · test synthesis must REFUSE.
export interface CustomSettings {
  readonly theme: "light" | "dark";
  readonly notifications: boolean;
}
export interface UserProfile {
  readonly profileId: string;
  readonly settings: CustomSettings;
}
