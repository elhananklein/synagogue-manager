export type BulletinItemKind = "text" | "image";

export type BulletinItem = {
  id: string;
  kind: BulletinItemKind;
  title: string | null;
  bodyText: string | null;
  imageUrl: string | null;
  sortOrder: number;
  published: boolean;
  displayFrom: string;
  displayUntil: string;
};

export type BulletinItemInput = {
  id?: string;
  kind: BulletinItemKind;
  title?: string | null;
  bodyText?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  published: boolean;
  displayFrom: string;
  displayUntil: string;
};
