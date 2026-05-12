// @ts-nocheck
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L, { type DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

export type WorldLeadPoint = {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  ddd?: string;
  ip?: string;
  source?: string;
  campaign?: string;
  score?: number;
  stage?: string;
  lastInteraction?: string;
  conversationId?: string;
  converted?: boolean;
  lat: number;
  lng: number;
};

type Props = {
  leads: WorldLeadPoint[];
  onOpenLeadConversation: (lead: WorldLeadPoint) => void;
};

function markerIcon(): DivIcon {
  return L.divIcon({
    className: "",
    html: '<div style="width:14px;height:14px;border-radius:9999px;background:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary) / 0.25)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const baseCenter: [number, number] = [-14.2, -51.9];

export function WorldLeadsMap({ leads, onOpenLeadConversation }: Props) {
  const [activeRegion, setActiveRegion] = useState<string>("all");

  const groupedByRegion = useMemo(() => {
    return leads.reduce<Record<string, WorldLeadPoint[]>>((acc, lead) => {
      const regionKey = `${lead.city || "Sem cidade"}, ${lead.state || "--"}, ${lead.country || "--"}`;
      acc[regionKey] = [...(acc[regionKey] ?? []), lead];
      return acc;
    }, {});
  }, [leads]);

  const regionOptions = useMemo(
    () => Object.entries(groupedByRegion).sort((a, b) => b[1].length - a[1].length),
    [groupedByRegion],
  );

  const visibleLeads = useMemo(() => {
    if (activeRegion === "all") return leads;
    return groupedByRegion[activeRegion] ?? [];
  }, [activeRegion, groupedByRegion, leads]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base">Mapa mundial interativo de leads</CardTitle>
          <p className="text-xs text-muted-foreground">Zoom, clusters e camada de calor por concentração real de contatos.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[460px] w-full">
            <MapContainer center={baseCenter} zoom={3} minZoom={2} className="h-full w-full bg-background" worldCopyJump>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {leads.map((lead) => (
                <Circle
                  key={`heat-${lead.id}`}
                  center={[lead.lat, lead.lng]}
                  radius={Math.max(8000, (lead.score ?? 40) * 550)}
                  pathOptions={{ color: "hsl(var(--primary))", fillColor: "hsl(var(--primary))", fillOpacity: 0.08, weight: 0 }}
                />
              ))}

              <MarkerClusterGroup chunkedLoading>
                {visibleLeads.map((lead) => (
                  <Marker
                    key={lead.id}
                    position={[lead.lat, lead.lng]}
                    icon={markerIcon()}
                    eventHandlers={{
                      click: () => setActiveRegion(`${lead.city || "Sem cidade"}, ${lead.state || "--"}, ${lead.country || "--"}`),
                    }}
                  >
                    <Popup>
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold">{lead.name}</p>
                        <p>{lead.phone}</p>
                        <p>{lead.city} • {lead.state} • {lead.country}</p>
                        <button
                          type="button"
                          onClick={() => onOpenLeadConversation(lead)}
                          style={{ color: "hsl(var(--primary))", fontWeight: 600 }}
                        >
                          Abrir conversa
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Região selecionada</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeRegion === "all" ? "default" : "outline"}
              onClick={() => setActiveRegion("all")}
              className="h-7 text-xs"
            >
              Todas
            </Button>
            {regionOptions.slice(0, 5).map(([region, regionLeads]) => (
              <Button
                key={region}
                type="button"
                size="sm"
                variant={activeRegion === region ? "default" : "outline"}
                onClick={() => setActiveRegion(region)}
                className="h-7 max-w-full truncate text-xs"
                title={region}
              >
                {region.split(",")[0]} ({regionLeads.length})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {visibleLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem leads na seleção atual.</p>
          ) : (
            visibleLeads.slice(0, 80).map((lead) => (
              <button
                key={`lead-${lead.id}`}
                type="button"
                className="w-full rounded-lg border border-border/70 bg-card/60 p-2 text-left transition-colors hover:bg-card"
                onClick={() => onOpenLeadConversation(lead)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{lead.name}</p>
                  <Badge variant="secondary" className="h-5 text-[10px]">{lead.stage ?? "lead"}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{lead.phone}</p>
                <p className="truncate text-[11px] text-muted-foreground">{lead.city} • {lead.state} • {lead.country}</p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
