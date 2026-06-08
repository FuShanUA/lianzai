export interface Chapter {
  id: number;
  title: string;
  outline: string;
  content: string;
  status: 'pending' | 'draft' | 'completed';
  versions: Version[];
  visualPoints?: any[];
  visuals?: any[];
}

export interface Version {
  version: string;
  content: string;
  timestamp: number;
  issuesSnapshot?: Chapter[];
}

export interface VisualHistoryEntry {
  path: string;
  absolutePath: string;
  timestamp: number;
  description?: string;
  styleDNA?: string;
  labels?: string;
  anchorText?: string;
  isCurrent?: boolean;
}

export interface VisualAsset {
  id: string;
  type: 'cover' | 'infographic';
  description: string;
  labels: string;
  anchorText: string;
  generated: boolean;
  history: VisualHistoryEntry[];
  activeTimestampPath?: string;
  chapterId?: number;
  path?: string;
  absolutePath?: string;
  styleDNA?: string;
}