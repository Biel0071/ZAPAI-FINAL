import { supabase } from "@/integrations/supabase/client";

export type LearningIssueType =
  | "unanswered_question"
  | "lost_lead"
  | "frequent_question"
  | "failed_conversation"
  | "drop_off";

export interface LearningSuggestion {
  id: string;
  conversationId: string;
  issueType: LearningIssueType | string;
  problemDetected: string;
  suggestedResponse: string;
  suggestedPromptImprovement: string;
  suggestedNewFlow: string;
  status: "pending" | "applied" | "ignored" | "edited" | string;
  frequentQuestion?: string;
  dropOffMoment?: string;
  createdAt: string;
}

export interface LearningMetrics {
  totalConversationsAnalyzed: number;
  missingResponses: number;
  lostLeads: number;
  conversionRate: number;
  promptImprovementsApplied: number;
}

export interface LearningDashboardData {
  runDate: string;
  metrics: LearningMetrics;
  issues: LearningSuggestion[];
  frequentQuestions: Array<{ question: string; count: number }>;
  dropPoints: Array<{ point: string; count: number }>;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-learning-engine", { body });
  if (error) throw new Error(error.message || "Erro no AI Learning Engine");
  return data as T;
}

export const aiLearningService = {
  getDashboard: () => invoke<LearningDashboardData>({ action: "get-dashboard" }),
  runAnalysisNow: () => invoke<{ success: boolean; createdLogs: number }>({ action: "run-analysis" }),
  applyImprovement: (logId: string, newPrompt: string) =>
    invoke<{ success: boolean; promptVersionId: string }>({ action: "apply-improvement", logId, newPrompt }),
  editSuggestion: (logId: string, payload: Partial<Pick<LearningSuggestion, "suggestedResponse" | "suggestedPromptImprovement" | "suggestedNewFlow">>) =>
    invoke<{ success: boolean }>({ action: "edit-suggestion", logId, ...payload }),
  ignoreSuggestion: (logId: string) => invoke<{ success: boolean }>({ action: "ignore-suggestion", logId }),
};
