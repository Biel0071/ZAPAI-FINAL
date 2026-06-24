const businessHours = {
  open: '07:00',
  close: '20:00',
  timezone: 'America/Sao_Paulo',
  autoReplyOutsideHours: true,
  absenceMessage:
    'Obrigada pelo contato! No momento estamos fora do horário de atendimento online. Nosso atendimento ocorre das 7h às 20h e atendimento na loja das 7h às 18h. Retorne dentro do horário para que eu possa te ajudar.',
};

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentMinutesInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: timezone,
  });

  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);

  return hour * 60 + minute;
}

function isBusinessOpen() {
  const currentMinutes = getCurrentMinutesInTimezone(businessHours.timezone);
  const openMinutes = timeToMinutes(businessHours.open);
  const closeMinutes = timeToMinutes(businessHours.close);

  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

module.exports = {
  businessHours,
  isBusinessOpen,
};
