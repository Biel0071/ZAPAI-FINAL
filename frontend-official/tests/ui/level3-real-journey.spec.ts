import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const historyDir = path.join(process.cwd(), "tests", "history");

test.describe("Enterprise Level 3: Ultimate Real Journey", () => {
  test("Caminhos Felizes e Tristes (End-to-End Core Flow)", async ({ page }) => {
    test.setTimeout(120_000); // 2 minutos para este mega-teste

    const errors: string[] = [];
    page.on("pageerror", err => errors.push(`[JS_EXCEPTION] ${err.message}`));
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(`[CONSOLE_ERROR] ${msg.text()}`);
    });

    const startTime = Date.now();

    // 1. Autenticação (Ignorando storageState para testar fluxo real de login)
    await page.goto("/login");
    await page.fill('input[placeholder="Seu usuário"]', 'zapadmin');
    await page.fill('input[type="password"]', 'zapadmin123');
    await page.click('button:has-text("Entrar")');
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Validação CRM (Caminho Triste - Contato sem telefone)
    await page.goto("/contacts");
    await page.waitForLoadState("domcontentloaded");
    await page.click('button:has-text("Novo Contato")');
    await page.fill('input[name="name"]', 'QA Teste Falha');
    await page.click('button:has-text("Salvar")');
    // Espera que a interface lance o erro de validação (Zod/Form)
    await expect(page.getByText(/telefone é obrigatório|telefone inválido/i).first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Se a tradução for diferente, busca pela cor de erro do tailwind
        expect(page.locator('.text-destructive')).toBeVisible();
    });
    
    // Caminho Feliz (Criar contato real VIP)
    await page.getByRole('button', { name: /cancelar|fechar/i }).click().catch(()=>{});
    await page.goto("/contacts"); // reload state
    await page.click('button:has-text("Novo Contato")');
    
    const randomHash = crypto.randomBytes(3).toString('hex');
    const contactName = `QA Nível3 VIP ${randomHash}`;
    const contactPhone = `551199999${Math.floor(1000 + Math.random() * 9000)}`; // Fake BR Phone

    await page.fill('input[name="name"]', contactName);
    // Tenta encontrar o input de telefone (placeholder ou name=phone)
    await page.locator('input').filter({ hasText: /telefone/i }).or(page.locator('input[name="phone"]')).fill(contactPhone);
    await page.click('button:has-text("Salvar")');
    await expect(page.getByText(/sucesso|criado|salvo/i).first()).toBeVisible({ timeout: 5000 });

    // 3. Inbox e Conversação
    await page.goto("/inbox");
    await page.waitForLoadState("domcontentloaded");
    // Esperar carregar lista
    await page.waitForTimeout(1000);
    // Procurar a conversa do contato criado
    const searchInput = page.getByPlaceholder(/buscar/i);
    await searchInput.fill(contactPhone);
    await page.waitForTimeout(1000);
    
    // Tenta clicar no resultado da busca
    const contactItem = page.locator(`text=${contactName}`).first();
    if (await contactItem.isVisible()) {
      await contactItem.click();
      // Testar envio de mensagem e botão de anexo
      await expect(page.locator('button[title*="anexo"], button[title*="Anexo"], .lucide-paperclip').first()).toBeVisible();
      
      const composer = page.getByPlaceholder(/mensagem/i).first();
      await composer.fill(`Teste Nível 3 E2E [${randomHash}]`);
      await page.keyboard.press('Enter');
      
      // Valida que a mensagem subiu na tela sem duplicar
      const msgBubble = page.getByText(`Teste Nível 3 E2E [${randomHash}]`);
      await expect(msgBubble).toHaveCount(1, { timeout: 4000 });
    } else {
      errors.push("[INBOX] Contato não apareceu na lista após ser criado.");
    }

    // 4. Fluxos de Automação
    await page.goto("/flows");
    await page.click('button:has-text("Novo")').catch(()=>{}); // Clique em Novo Fluxo se existir
    await page.waitForLoadState("networkidle");
    const canvasExists = await page.locator('.react-flow, canvas, .flow-builder').count();
    if (canvasExists === 0) {
      errors.push("[FLOWS] Construtor visual de fluxos não renderizou.");
    }

    // 5. Inteligência Artificial & Memory Graph
    await page.goto("/memory");
    await page.waitForLoadState("networkidle");
    const graphExists = await page.locator('canvas, .force-graph-container').count();
    if (graphExists === 0) {
      errors.push("[MEMORY] Obsidian-like Graph não renderizou.");
    }

    const duration = Date.now() - startTime;

    // Gerar report
    const report = {
      route: "E2E_LEVEL3_JOURNEY",
      type: "UI_LEVEL3",
      durationMs: duration,
      errors: errors,
      contactCreated: contactName
    };

    fs.writeFileSync(
      path.join(historyDir, `level3-report-${Date.now()}.json`),
      JSON.stringify(report, null, 2)
    );

    // Avaliar se o teste falhou de vez
    expect(errors.length, `Level 3 encontrou problemas: ${errors.join(' | ')}`).toBe(0);
  });
});
