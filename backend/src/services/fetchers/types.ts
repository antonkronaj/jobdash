export interface FetchedJob {
  source: string;
  sourceId: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  url: string;
  description: string;
  postedAt: string | null;
  salary: string | null;
}

export interface FetchParams {
  title: string;
  location: string;
  includeRemote: boolean;
}

export type Fetcher = (params: FetchParams) => Promise<FetchedJob[]>;
