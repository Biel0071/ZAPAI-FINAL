export interface BubbleOriginInput {
  fromMe?: boolean;
  origin?: string;
  message_origin?: string;
}

/** True only for messages sent from the phone/WhatsApp app itself (blue bubble). */
export function isWhatsappDeviceMessage(message: BubbleOriginInput): boolean {
  return Boolean(message.fromMe && (message.origin === "whatsapp_device" || message.message_origin === "whatsapp_device"));
}

/** Bubble CSS class. Device origin wins over AI/system so the phone's messages are always blue. */
export function bubbleClassFor({ fromMe, isDevice, isAi }: { fromMe?: boolean; isDevice: boolean; isAi: boolean }): string {
  if (!fromMe) return "chat-bubble-received";
  if (isDevice) return "chat-bubble-wa";
  return isAi ? "chat-bubble-ai-sent" : "chat-bubble-sent";
}
