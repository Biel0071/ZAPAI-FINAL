/**
 * AI Learning Service — Backend API mode.
 *
 * Previously called Supabase Edge Functions. Now routes through
 * the backend's AI learning engine for training data management.
 */
import { requestApiEndpoint } from "@/services/apiService";

export interface LearningSuggestion {
  id: string;
  issueType: string;
  problemDetected: string;
  suggestedResponse?: string;
  suggestedPromptImprovement?: string;
  suggestedNewFlow?: string;
  status: "pending" | "edited" | "applied" | "ignored";
  createdAt: string;
}

export interface LearningDashboardData {
  suggestions: LearningSuggestion[];
  issues: LearningSuggestion[];
  frequentQuestions: Array<{ question: string; count: number }>;
  dropPoints: Array<{ point: string; count: number }>;
  metrics: {
    totalConversationsAnalyzed: number;
    missingResponses: number;
    lostLeads: number;
    conversionRate: number;
    promptImprovementsApplied: number;
  };
}

type RawLearningSuggestion = LearningSuggestion & {
  suggestedImprovement?: {
    suggestedResponse?: string;
    suggestedPromptImprovement?: string;
    suggestedNewFlow?: string;
  };
};

function normalizeSuggestion(item: RawLearningSuggestion): LearningSuggestion {
  return {
    ...item,
    suggestedResponse: item.suggestedResponse ?? item.suggestedImprovement?.suggestedResponse,
    suggestedPromptImprovement:
      item.suggestedPromptImprovement ?? item.suggestedImprovement?.suggestedPromptImprovement,
    suggestedNewFlow: item.suggestedNewFlow ?? item.suggestedImprovement?.suggestedNewFlow,
  };
}

function emptyDashboard(): LearningDashboardData {
  return {
    suggestions: [],
    issues: [],
    frequentQuestions: [],
    dropPoints: [],
    metrics: {
      totalConversationsAnalyzed: 0,
      missingResponses: 0,
      lostLeads: 0,
      conversionRate: 0,
      promptImprovementsApplied: 0,
    },
  };
}

export const aiLearningService = {
  async getDashboardData(): Promise<LearningDashboardData> {
    try {
      const data = await requestApiEndpoint<any>(
        "/api/ai/learning/dashboard",
        "GET",
      );
      if (!data) return emptyDashboard();
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.map(normalizeSuggestion)
        : [];
      const issues = Array.isArray(data.dailyDetectedIssues)
        ? data.dailyDetectedIssues.map(normalizeSuggestion)
        : suggestions;
      return {
        suggestions,
        issues,
        frequentQuestions: Array.isArray(data.frequentCustomerQuestions)
          ? data.frequentCustomerQuestions
          : [],
        dropPoints: Array.isArray(data.conversationDropPoints)
          ? data.conversationDropPoints
          : [],
        metrics: {
          ...emptyDashboard().metrics,
          ...(data.metrics ?? {}),
        },
      };
    } catch {
      return emptyDashboard();
    }
  },

  async getDashboard(): Promise<LearningDashboardData> {
    return this.getDashboardData();
  },

  async runAnalysisNow(): Promise<void> {
    await requestApiEndpoint("/api/ai/learning/analyze", "POST");
  },

  async applyImprovement(id: string, _newPrompt: string): Promise<{ promptVersionId: string }> {
    const result = await requestApiEndpoint<any>(
      `/api/ai/learning/${encodeURIComponent(id)}/apply`,
      "POST",
    );
    return {
      promptVersionId: String(result?.promptVersion?.id ?? result?.promptVersion?.version ?? ""),
    };
  },

  async editSuggestion(id: string, updates: Partial<LearningSuggestion>): Promise<boolean> {
    await requestApiEndpoint(
      `/api/ai/learning/${encodeURIComponent(id)}`,
      "PUT",
      updates,
    );
    return true;
  },

  async ignoreSuggestion(id: string): Promise<boolean> {
    await requestApiEndpoint(
      `/api/ai/learning/${encodeURIComponent(id)}/ignore`,
      "POST",
    );
    return true;
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
