/**
 * AI Learning Service — Backend API mode.
 *
 * Previously called Supabase Edge Functions. Now routes through
 * the backend's AI learning engine for training data management.
 */
import { requestApiEndpoint } from "@/services/apiService";

export interface LearningSuggestion {
  id: string;
  type: "response" | "prompt" | "flow";
  source: string;
  suggestion: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface LearningDashboardData {
  suggestions: LearningSuggestion[];
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  accuracy: number;
}

export const aiLearningService = {
  async getDashboardData(): Promise<LearningDashboardData> {
    try {
      const data = await requestApiEndpoint<LearningDashboardData>(
        "/api/ai/learning/dashboard",
        "GET",
      );
      return data ?? {
        suggestions: [],
        totalApproved: 0,
        totalRejected: 0,
        totalPending: 0,
        accuracy: 0,
      };
    } catch {
      return {
        suggestions: [],
        totalApproved: 0,
        totalRejected: 0,
        totalPending: 0,
        accuracy: 0,
      };
    }
  },

  async approveSuggestion(id: string, updates: Partial<LearningSuggestion>): Promise<boolean> {
    try {
      await requestApiEndpoint(`/api/ai/learning/suggestions/${encodeURIComponent(id)}/approve`, "POST", updates);
      return true;
    } catch {
      return false;
    }
  },

  async rejectSuggestion(id: string): Promise<boolean> {
    try {
      await requestApiEndpoint(`/api/ai/learning/suggestions/${encodeURIComponent(id)}/reject`, "POST");
      return true;
    } catch {
      return false;
    }
  },

  async trainFromApproved(): Promise<{ trained: number }> {
    try {
      return await requestApiEndpoint<{ trained: number }>("/api/ai/learning/train", "POST") ?? { trained: 0 };
    } catch {
      return { trained: 0 };
    }
  },
};
