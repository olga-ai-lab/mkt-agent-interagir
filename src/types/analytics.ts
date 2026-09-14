// Analytics Types

export interface PostAnalytics {
  id: string;
  post_id: string;
  channel: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays: number;
  engagements: number;
  engagement_rate: number;
  insights_source: string;
  recorded_at: string;
  recorded_date: string;
  created_at: string;
}

export interface AggregatedMetrics {
  totalImpressions: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalPlays: number;
  totalEngagements: number;
  avgEngagementRate: number;
}

export interface MetricTrend {
  date: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  engagements: number;
  plays: number;
}

export interface PostWithAnalytics {
  post_id: string;
  post_title: string;
  channel: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays: number;
  engagements: number;
  engagement_rate: number;
  recorded_at: string;
  recorded_date: string;
}

export interface DailyMetricSnapshot {
  recorded_date: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays: number;
  engagements: number;
}

export interface PostMetricsHistory {
  post_id: string;
  post_title: string;
  channel: string;
  history: DailyMetricSnapshot[];
}

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  percentChange: number;
}

export type ChannelType = 'instagram' | 'facebook' | 'linkedin';

export interface ChannelMetrics {
  channel: ChannelType;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays: number;
  engagements: number;
  engagement_rate: number;
}

export interface PostChannelComparison {
  post_id: string;
  post_title: string;
  channels: ChannelMetrics[];
  best_channel: ChannelType | null;
  total_engagements: number;
}
