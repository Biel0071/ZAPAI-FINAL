'use strict';

/**
 * PuppetManipulator — ZAPFLOW WhatsApp Web Remote Controller
 * Executes direct actions (clicks, typing, catalog selection, and triggers)
 * on the headless WhatsApp Web instance running in the background.
 */

const webBridgeSessionManager = require('./WebBridgeSessionManager');

class PuppetManipulator {
  /**
   * Helper: Get active page from WebBridgeSessionManager
   */
  async getActivePage(sessionId = 'main', companyId = 'default') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const session = await webBridgeSessionManager.launchSession(sId, companyId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`Sessão WebBridge "${sId}" não possui página ativa.`);
    }
    return session.page;
  }

  /**
   * Open / Focus a specific chat by JID or phone
   */
  async openChat(sessionId = 'main', companyId = 'default', jid) {
    const page = await this.getActivePage(sessionId, companyId);
    const cleanPhone = String(jid || '').replace(/@.*$/, '').replace(/\D/g, '');

    if (!cleanPhone) {
      throw new Error('JID ou telefone inválido para abrir conversa.');
    }

    console.log(`[PUPPET] Abrindo conversa com ${cleanPhone} no WhatsApp Web (${sessionId})...`);

    const result = await page.evaluate(async (phone) => {
      try {
        // Tenta abrir via Store interna do WhatsApp Web se disponível
        if (window.Store && window.Store.Chat && window.Store.Chat.find) {
          const chat = await window.Store.Chat.find(`${phone}@c.us`) || await window.Store.Chat.find(`${phone}@s.whatsapp.net`);
          if (chat && window.Store.Cmd && window.Store.Cmd.openChatAt) {
            window.Store.Cmd.openChatAt(chat);
            return { success: true, method: 'store' };
          }
        }

        // Fallback: clica na busca e digita o telefone
        const searchInput = document.querySelector('div[contenteditable="true"][data-tab="3"], #side div[contenteditable="true"]');
        if (searchInput) {
          searchInput.focus();
          document.execCommand('insertText', false, phone);
          await new Promise(r => setTimeout(r, 600));

          // Clica no primeiro resultado
          const firstResult = document.querySelector('#pane-side div[role="listitem"], #pane-side div[data-testid="cell-frame-container"]');
          if (firstResult) {
            firstResult.click();
            return { success: true, method: 'dom_search' };
          }
        }

        return { success: false, reason: 'Chat selector not triggered' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, cleanPhone);

    return result;
  }

  /**
   * Send a text message natively via the WhatsApp Web DOM
   */
  async sendTextMessage(sessionId = 'main', companyId = 'default', jid, text) {
    const page = await this.getActivePage(sessionId, companyId);
    await this.openChat(sessionId, companyId, jid);

    console.log(`[PUPPET] Enviando mensagem de texto para ${jid} via WhatsApp Web...`);

    const result = await page.evaluate(async (msgText) => {
      try {
        // Localiza a caixa de digitação da conversa ativa
        const composer = document.querySelector('footer div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]');
        if (!composer) {
          return { success: false, error: 'Composer de mensagem não encontrado' };
        }

        composer.focus();
        // Insere o texto
        document.execCommand('insertText', false, msgText);
        await new Promise(r => setTimeout(r, 300));

        // Clica no botão de envio
        const sendBtn = document.querySelector('button[aria-label="Enviar"], span[data-icon="send"]')?.closest('button');
        if (sendBtn) {
          sendBtn.click();
          return { success: true, method: 'dom_click' };
        }

        // Fallback: dispara tecla Enter
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        composer.dispatchEvent(enterEvent);
        return { success: true, method: 'enter_key' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, text);

    return result;
  }

  /**
   * Send an official catalog product card natively via WhatsApp Web
   */
  async sendProduct(sessionId = 'main', companyId = 'default', jid, productData = {}) {
    const page = await this.getActivePage(sessionId, companyId);
    await this.openChat(sessionId, companyId, jid);

    console.log(`[PUPPET] Enviando produto "${productData.name || productData.title}" para ${jid}...`);

    const result = await page.evaluate(async (prod) => {
      try {
        // Clica no botão de anexar (ícone de clipe '+')
        const attachBtn = document.querySelector('button[aria-label="Anexar"], button[title="Anexar"], span[data-icon="plus"]')?.closest('button') ||
                          document.querySelector('div[title="Anexar"], span[data-icon="attach-menu-plus"]')?.closest('div');

        if (attachBtn) {
          attachBtn.click();
          await new Promise(r => setTimeout(r, 400));

          // Procura o botão "Catálogo" no menu de anexos
          const catalogOption = Array.from(document.querySelectorAll('ul li, div[role="button"], span'))
            .find(el => el.textContent && el.textContent.toLowerCase().includes('catálogo'));

          if (catalogOption) {
            catalogOption.click();
            await new Promise(r => setTimeout(r, 700));

            // Procura o item do produto pelo nome dentro do modal
            const prodNameTarget = (prod.name || prod.title || '').trim().toLowerCase();
            const productCards = Array.from(document.querySelectorAll('div[role="listitem"], div[data-testid*="product"]'));

            const targetCard = productCards.find(c => c.textContent && c.textContent.toLowerCase().includes(prodNameTarget));
            if (targetCard) {
              targetCard.click();
              await new Promise(r => setTimeout(r, 400));

              // Clica no botão de envio dentro do modal de produto
              const sendProductBtn = document.querySelector('span[data-icon="send"]')?.closest('button') ||
                                     Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Enviar'));
              if (sendProductBtn) {
                sendProductBtn.click();
                return { success: true, method: 'native_catalog_modal' };
              }
            }
          }
        }

        return {
          success: false,
          fallbackRequired: true,
          reason: 'Menu de catálogo não acessível no DOM atual'
        };
      } catch (err) {
        return { success: false, error: err.message, fallbackRequired: true };
      }
    }, productData);

    return result;
  }
}

module.exports = new PuppetManipulator();

