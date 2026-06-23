/**
 * Central TypeScript types for the Grade Ranger card management system.
 * These mirror the Supabase database schema.
 */

export type CardStatus = 'intake' | 'collection' | 'grading' | 'listed' | 'sold' | 'cancelled';
export type GradingService = 'PSA' | 'BGS' | 'CGC' | 'TAG' | 'SGC';
export type GradingBundleStatus = 'building' | 'submitted' | 'at_grader' | 'returned';
export type ListingMarketplace = 'tcgplayer' | 'ebay' | 'shopify' | 'cardtrader' | 'other';
export type ListingStatus = 'active' | 'sold' | 'expired' | 'cancelled';
export type AIReportStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Card {
  id: string;
  user_id: string;
  internal_card_id: string;
  card_name: string;
  player_name?: string;
  year?: string;
  set_name?: string;
  card_number?: string;
  variation?: string;
  sport?: string;
  is_graded: boolean;
  grading_company?: GradingService;
  official_grade?: string;
  certified_id?: string;
  image_front_url?: string;
  image_back_url?: string;
  status: CardStatus;
  scan_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  purchases?: Purchase;
  ai_reports?: AIReport;
  market_valuations?: MarketValuation;
}

export interface Purchase {
  id: string;
  card_id: string;
  purchase_price: number;
  shipping_cost: number;
  cost_basis: number;
  purchase_site?: string;
  purchase_order?: string;
  purchase_date: string;
  notes?: string;
  created_at: string;
}

export interface AIReport {
  id: string;
  card_id: string;
  submitted_at: string;
  completed_at?: string;
  overall_grade?: number;
  confidence_score?: number;
  centering_lr?: number;
  centering_tb?: number;
  corner_score?: number;
  edge_score?: number;
  surface_score?: number;
  written_summary?: string;
  annotated_front_url?: string;
  annotated_back_url?: string;
  raw_response?: Record<string, unknown>;
  status: AIReportStatus;
  source?: string;
  condition_label?: string;
  created_at: string;
}

export interface GradedValues {
  [service: string]: {
    [grade: string]: number;
  };
}

export interface MarketValuation {
  id: string;
  card_id: string;
  fetched_at: string;
  raw_low?: number;
  raw_median?: number;
  raw_high?: number;
  graded_values?: GradedValues;
  data_source?: string;
  created_at: string;
}

export interface GradingBundle {
  id: string;
  user_id: string;
  name: string;
  grading_service: GradingService;
  service_tier?: string;
  status: GradingBundleStatus;
  submitted_at?: string;
  returned_at?: string;
  tracking_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: GradingBundleItem[];
}

export interface GradingBundleItem {
  id: string;
  bundle_id: string;
  card_id: string;
  grading_fee?: number;
  official_grade?: string;
  graded_at?: string;
  quantity?: number;
  declared_value?: number;
  created_at: string;
  card?: Card;
}

export interface Listing {
  id: string;
  card_id: string;
  user_id: string;
  marketplace: ListingMarketplace;
  listing_price: number;
  shipping_amount?: number;
  external_listing_id?: string;
  listing_url?: string;
  status: ListingStatus;
  listed_at: string;
  sold_at?: string;
  created_at: string;
  updated_at: string;
  card?: Card;
}

export interface Transaction {
  id: string;
  listing_id: string;
  card_id: string;
  sale_price: number;
  marketplace_fee: number;
  shipping_paid: number;
  net_proceeds: number;
  net_profit_loss: number;
  completed_at: string;
  notes?: string;
  created_at: string;
}

export interface GradingFeeSchedule {
  id: string;
  grading_service: GradingService;
  tier_name: string;
  price: number;
  turnaround_days?: number;
  is_custom: boolean;
  user_id?: string;
  effective_from?: string;
  effective_to?: string;
  created_at: string;
  updated_at: string;
}

export const PURCHASE_SOURCES = [
  'eBay',
  'COMC',
  'Fanatics',
  'CollX',
  'Facebook Marketplace',
  'Card Show',
  'Private Sale',
  'Other',
] as const;

export const GRADING_SERVICES: GradingService[] = ['PSA', 'BGS', 'CGC', 'TAG', 'SGC'];

export const GRADING_SERVICE_TIERS: Record<GradingService, string[]> = {
  PSA: ['Economy', 'Standard', 'Express', 'Super Express', 'Walk-Through'],
  BGS: ['Economy', 'Standard', 'Express', 'Pristine'],
  CGC: ['Economy', 'Standard', 'Express'],
  TAG: ['Standard', 'Express'],
  SGC: ['Economy', 'Standard', 'Express'],
};

export const STATUS_LABELS: Record<CardStatus, string> = {
  intake: 'Intake',
  collection: 'In Collection',
  grading: 'At Grader',
  listed: 'Listed',
  sold: 'Sold',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  intake: 'bg-blue-100 text-blue-800',
  collection: 'bg-purple-100 text-purple-800',
  grading: 'bg-yellow-100 text-yellow-800',
  listed: 'bg-orange-100 text-orange-800',
  sold: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};
