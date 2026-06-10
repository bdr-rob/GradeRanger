/**
 * eBay API Client — all calls proxied through Supabase Edge Function.
 * eBay credentials (App ID / Cert ID) are NEVER sent to the browser.
 * This file maintains the same interface as before so existing imports work unchanged.
 */
import { supabase } from "@/lib/supabase";
import type { APIResponse, EbaySearchParams } from "@/types";

class EbayAPIClient {
  /** Search active eBay listings */
  async searchCards(params: EbaySearchParams): Promise<APIResponse<any>> {
    try {
      const { data, error } = await supabase.functions.invoke("ebay-search", {
        body: { action: "search", ...params },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      return this.errorResponse("EBAY_SEARCH_ERROR", error);
    }
  }

  /**
   * Get sold comps for a card — used by GradingDecisionEngine & DealCard for ROI.
   * Returns { total, items[], stats: { avgPrice, minPrice, maxPrice, medianPrice, sampleSize, trend } }
   */
  async getSoldComps(params: {
    keywords: string;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<APIResponse<any>> {
    try {
      const { data, error } = await supabase.functions.invoke("ebay-search", {
        body: { action: "sold_comps", ...params },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      return this.errorResponse("EBAY_COMPS_ERROR", error);
    }
  }

  /** Evaluate a single eBay listing URL — used by DealFinder URL evaluator */
  async evaluateUrl(url: string): Promise<APIResponse<any>> {
    try {
      const { data, error } = await supabase.functions.invoke("ebay-search", {
        body: { action: "evaluate_url", url },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      return this.errorResponse("EBAY_URL_ERROR", error);
    }
  }

  /**
   * Get details for a single eBay item by ID.
   * Called by urlEvaluator — wraps evaluateUrl() for backward compatibility.
   */
  async getItemDetails(itemId: string): Promise<APIResponse<any>> {
    return this.evaluateUrl(`https://www.ebay.com/itm/${itemId}`);
  }

  private errorResponse(code: string, error: unknown): APIResponse<any> {
    return {
      success: false,
      error: {
        code,
        message: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
    };
  }
}

export const ebayAPI = new EbayAPIClient();
export default ebayAPI;