import { describe, expect, it } from "vitest";
import { buildLeadAlgorithm, STORE_EVOLUTION_ALGORITHMS } from "@/core/services/leadAnalyzer";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const backendLeadAnalyzer = require("../../../backend/services/leadAnalyzer.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiService = require("../../../backend/services/ai.service.js");

describe("Lead Algorithm & Store Evolution Algorithms (Store Standard + Per-Lead Style)", () => {
  it("exposes the 5 canonical Store Evolution Algorithms in both backend and frontend", () => {
    expect(Object.keys(STORE_EVOLUTION_ALGORITHMS)).toEqual([
      "ALGO_CONVERSAO_RAPIDA_PIX",
      "ALGO_CONSULTIVO_TECNICO",
      "ALGO_QUEBRA_OBJECAO_VALOR",
      "ALGO_REATIVACAO_RESPOSTA_RAPIDA",
      "ALGO_POS_VENDA_PROTEGIDO",
    ]);
    expect(Object.keys(backendLeadAnalyzer.STORE_EVOLUTION_ALGORITHMS)).toEqual(
      Object.keys(STORE_EVOLUTION_ALGORITHMS)
    );
  });

  it("profiles a direct buyer asking for PIX/closing into ALGO_CONVERSAO_RAPIDA_PIX", () => {
    const algo = backendLeadAnalyzer.buildLeadAlgorithm(
      "Quero comprar a churrasqueira, manda o pix",
      [],
      { name: "Carlos" }
    );
    expect(algo.algorithmId).toBe("ALGO_CONVERSAO_RAPIDA_PIX");
    expect(algo.primaryProduct).toBe("churrasqueira");
    expect(algo.recommendedQuickReplyTitle).toBe("CHURRAS");
    expect(algo.hasPurchased).toBe(false);
    expect(algo.shouldFollowUp).toBe(true);
    expect(algo.followupHook).toContain("Carlos");

    const feAlgo = buildLeadAlgorithm("Quero comprar a churrasqueira, manda o pix");
    expect(feAlgo.algorithmId).toBe("ALGO_CONVERSAO_RAPIDA_PIX");
  });

  it("profiles a consultative lead asking about dimensions/freight into ALGO_CONSULTIVO_TECNICO", () => {
    const algo = backendLeadAnalyzer.buildLeadAlgorithm(
      "Bom dia! Qual a medida de altura e largura da churrasqueira média e quanto fica o frete para meu CEP?",
      [],
      { name: "Mariana" }
    );
    expect(algo.algorithmId).toBe("ALGO_CONSULTIVO_TECNICO");
    expect(algo.conversationStyle).toBe("consultative_detailed");
    expect(algo.primaryProduct).toBe("churrasqueira");
    expect(algo.shouldFollowUp).toBe(true);
  });

  it("profiles a price-sensitive lead asking for discount/installments into ALGO_QUEBRA_OBJECAO_VALOR", () => {
    const algo = backendLeadAnalyzer.buildLeadAlgorithm(
      "Achei muito caro o milheiro do tijolo, tem desconto à vista ou parcela em 10x?",
      [],
      { name: "Roberto" }
    );
    expect(algo.algorithmId).toBe("ALGO_QUEBRA_OBJECAO_VALOR");
    expect(algo.primaryProduct).toBe("tijolo");
    expect(algo.recommendedQuickReplyTitle).toBe("Tijolo Promo");
    expect(algo.shouldFollowUp).toBe(true);
  });

  it("protects customers who already purchased or scheduled delivery with ALGO_POS_VENDA_PROTEGIDO (blocks follow-up)", () => {
    const byFunnel = backendLeadAnalyzer.buildLeadAlgorithm(
      "Obrigado!",
      [],
      { name: "João", funnel_stage: "closed" }
    );
    expect(byFunnel.hasPurchased).toBe(true);
    expect(byFunnel.shouldFollowUp).toBe(false);
    expect(byFunnel.algorithmId).toBe("ALGO_POS_VENDA_PROTEGIDO");
    expect(byFunnel.followupHook).toBeNull();

    const byMessage = backendLeadAnalyzer.buildLeadAlgorithm(
      "Já paguei, segue o comprovante do pix!",
      [],
      { name: "Ana", funnel_stage: "negotiation" }
    );
    expect(byMessage.hasPurchased).toBe(true);
    expect(byMessage.shouldFollowUp).toBe(false);
    expect(byMessage.algorithmId).toBe("ALGO_POS_VENDA_PROTEGIDO");
  });

  it("injects [ALGORITMO DO LEAD & ESTILO DE CONVERSA PADRÃO DA LOJA] into compileSystemPrompt", () => {
    const leadAlgorithm = backendLeadAnalyzer.buildLeadAlgorithm(
      "Qual o valor do milheiro do tijolo baiano?",
      [],
      { name: "Pedro" }
    );
    const prompt = aiService.compileSystemPrompt(
      { name: "Camila", sector: "Vendas", objective: "Converter orçamentos" },
      {},
      {
        name: "Pedro",
        phone: "5519999999999",
        leadAlgorithm,
      }
    );

    expect(prompt).toContain("[ALGORITMO DO LEAD & ESTILO DE CONVERSA PADRÃO DA LOJA]");
    expect(prompt).toContain(leadAlgorithm.algorithmName);
    expect(prompt).toContain("Tijolo Baiano");
  });
});
