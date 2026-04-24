export interface DddHeatmapEntry {
  ddd: string;
  state: string;
  region: string;
  count: number;
}

export interface RegionSummaryEntry {
  region: string;
  states: string[];
  count: number;
}

export interface StateHeatmapEntry {
  state: string;
  ddds: string[];
  contactCount: number;
}

const DDD_STATE_MAP: Record<string, { state: string; region: string }> = {
  '11': { state: 'SP', region: 'Sudeste' },
  '12': { state: 'SP', region: 'Sudeste' },
  '13': { state: 'SP', region: 'Sudeste' },
  '14': { state: 'SP', region: 'Sudeste' },
  '15': { state: 'SP', region: 'Sudeste' },
  '16': { state: 'SP', region: 'Sudeste' },
  '17': { state: 'SP', region: 'Sudeste' },
  '18': { state: 'SP', region: 'Sudeste' },
  '19': { state: 'SP', region: 'Sudeste' },
  '21': { state: 'RJ', region: 'Sudeste' },
  '22': { state: 'RJ', region: 'Sudeste' },
  '24': { state: 'RJ', region: 'Sudeste' },
  '27': { state: 'ES', region: 'Sudeste' },
  '28': { state: 'ES', region: 'Sudeste' },
  '31': { state: 'MG', region: 'Sudeste' },
  '32': { state: 'MG', region: 'Sudeste' },
  '33': { state: 'MG', region: 'Sudeste' },
  '34': { state: 'MG', region: 'Sudeste' },
  '35': { state: 'MG', region: 'Sudeste' },
  '37': { state: 'MG', region: 'Sudeste' },
  '38': { state: 'MG', region: 'Sudeste' },
  '41': { state: 'PR', region: 'Sul' },
  '42': { state: 'PR', region: 'Sul' },
  '43': { state: 'PR', region: 'Sul' },
  '44': { state: 'PR', region: 'Sul' },
  '45': { state: 'PR', region: 'Sul' },
  '46': { state: 'PR', region: 'Sul' },
  '47': { state: 'PR', region: 'Sul' },
  '48': { state: 'SC', region: 'Sul' },
  '49': { state: 'SC', region: 'Sul' },
  '51': { state: 'RS', region: 'Sul' },
  '53': { state: 'RS', region: 'Sul' },
  '54': { state: 'RS', region: 'Sul' },
  '55': { state: 'RS', region: 'Sul' },
  '61': { state: 'DF', region: 'Centro-Oeste' },
  '62': { state: 'GO', region: 'Centro-Oeste' },
  '63': { state: 'GO', region: 'Centro-Oeste' },
  '64': { state: 'GO', region: 'Centro-Oeste' },
  '65': { state: 'GO', region: 'Centro-Oeste' },
  '66': { state: 'GO', region: 'Centro-Oeste' },
  '67': { state: 'GO', region: 'Centro-Oeste' },
  '68': { state: 'GO', region: 'Centro-Oeste' },
  '69': { state: 'GO', region: 'Centro-Oeste' },
  '71': { state: 'BA', region: 'Nordeste' },
  '73': { state: 'BA', region: 'Nordeste' },
  '74': { state: 'BA', region: 'Nordeste' },
  '75': { state: 'BA', region: 'Nordeste' },
  '77': { state: 'BA', region: 'Nordeste' },
  '79': { state: 'BA', region: 'Nordeste' },
  '81': { state: 'PE', region: 'Nordeste' },
  '87': { state: 'PE', region: 'Nordeste' },
  '82': { state: 'AL', region: 'Nordeste' },
  '83': { state: 'AL', region: 'Nordeste' },
  '84': { state: 'SE', region: 'Nordeste' },
  '85': { state: 'CE', region: 'Nordeste' },
  '88': { state: 'CE', region: 'Nordeste' },
  '86': { state: 'PI', region: 'Nordeste' },
  '89': { state: 'PI', region: 'Nordeste' },
  '92': { state: 'MA', region: 'Nordeste' },
  '93': { state: 'PA', region: 'Norte' },
  '94': { state: 'PA', region: 'Norte' },
  '91': { state: 'PA', region: 'Norte' },
  '95': { state: 'RR', region: 'Norte' },
  '96': { state: 'AP', region: 'Norte' },
  '97': { state: 'AM', region: 'Norte' },
  '98': { state: 'AM', region: 'Norte' },
  '99': { state: 'AM', region: 'Norte' },
};

export function extractDdd(phone: string): string | null {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.length >= 2) {
    const ddd = cleaned.slice(0, 2);
    if (DDD_STATE_MAP[ddd]) {
      return ddd;
    }
  }
  return null;
}

export function buildDddHeatmap(contacts: any[]): DddHeatmapEntry[] {
  const dddCounts: Record<string, number> = {};

  for (const contact of contacts) {
    const phone = contact.phone || contact.phoneNumber;
    const ddd = extractDdd(phone);
    if (ddd) {
      dddCounts[ddd] = (dddCounts[ddd] || 0) + 1;
    }
  }

  return Object.entries(dddCounts)
    .map(([ddd, count]) => {
      const mapping = DDD_STATE_MAP[ddd] || { state: 'Desconhecido', region: 'Outros' };
      return {
        ddd,
        state: mapping.state,
        region: mapping.region,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function buildRegionSummary(heatmap: DddHeatmapEntry[]): RegionSummaryEntry[] {
  const regionMap: Record<string, { states: Set<string>; count: number }> = {};

  for (const entry of heatmap) {
    if (!regionMap[entry.region]) {
      regionMap[entry.region] = { states: new Set(), count: 0 };
    }
    regionMap[entry.region].states.add(entry.state);
    regionMap[entry.region].count += entry.count;
  }

  return Object.entries(regionMap)
    .map(([region, data]) => ({
      region,
      states: Array.from(data.states),
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildStateHeatmap(heatmap: DddHeatmapEntry[]): StateHeatmapEntry[] {
  const stateMap: Record<string, { ddds: Set<string>; count: number }> = {};

  for (const entry of heatmap) {
    if (!stateMap[entry.state]) {
      stateMap[entry.state] = { ddds: new Set(), count: 0 };
    }
    stateMap[entry.state].ddds.add(entry.ddd);
    stateMap[entry.state].count += entry.count;
  }

  return Object.entries(stateMap)
    .map(([state, data]) => ({
      state,
      ddds: Array.from(data.ddds).sort(),
      contactCount: data.count,
    }))
    .sort((a, b) => b.contactCount - a.contactCount);
}
