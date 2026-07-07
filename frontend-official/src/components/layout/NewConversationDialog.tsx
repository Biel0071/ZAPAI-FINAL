import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/stores/appStore";
import { apiService, type Contact } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { MagnifyingGlass, User, CaretDown, Check, Warning, Spinner } from "@phosphor-icons/react";

interface CountryCode {
  name: string;
  code: string;
  flag: string;
  placeholder: string;
}

const countries: CountryCode[] = [
  { name: "Brasil", code: "55", flag: "🇧🇷", placeholder: "Ex: 31 99999-9999" },
  { name: "Estados Unidos", code: "1", flag: "🇺🇸", placeholder: "Ex: 202 555-0143" },
  { name: "Portugal", code: "351", flag: "🇵🇹", placeholder: "Ex: 912 345 678" },
  { name: "Angola", code: "244", flag: "🇦🇴", placeholder: "Ex: 912 345 678" },
  { name: "Moçambique", code: "258", flag: "🇲🇿", placeholder: "Ex: 82 123 4567" },
  { name: "Espanha", code: "34", flag: "🇪🇸", placeholder: "Ex: 612 34 56 78" },
  { name: "Argentina", code: "54", flag: "🇦🇷", placeholder: "Ex: 9 11 1234-5678" },
  { name: "Colômbia", code: "57", flag: "🇨🇴", placeholder: "Ex: 300 123 4567" },
  { name: "Chile", code: "56", flag: "🇨🇱", placeholder: "Ex: 9 1234 5678" },
  { name: "México", code: "52", flag: "🇲🇽", placeholder: "Ex: 55 1234 5678" },
  { name: "Reino Unido", code: "44", flag: "🇬🇧", placeholder: "Ex: 7123 456789" },
  { name: "Itália", code: "39", flag: "🇮🇹", placeholder: "Ex: 312 345 6789" },
  { name: "França", code: "33", flag: "🇫🇷", placeholder: "Ex: 6 12 34 56 78" },
  { name: "Alemanha", code: "49", flag: "🇩🇪", placeholder: "Ex: 151 23456789" },
  { name: "Japão", code: "81", flag: "🇯🇵", placeholder: "Ex: 90-1234-5678" },
];

export function NewConversationDialog() {
  const isOpen = useAppStore((state) => state.isNewChatDialogOpen);
  const setIsOpen = useAppStore((state) => state.setIsNewChatDialogOpen);
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setSelectedConversationId = useAppStore((state) => state.setActiveConversationId);

  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingNumber, setCheckingNumber] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);

  // Country Prefix Selector state
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countries[0]); // Brasil preselected
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const ddiContainerRef = useRef<HTMLDivElement>(null);

  // Contacts search state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Reset inputs when opened
  useEffect(() => {
    if (isOpen) {
      const preferred = activeSessionId || (sessions && sessions[0]?.id) || "main";
      setTargetSessionId(preferred);
      setPhoneInput("");
      setNameInput("");
      setContactSearch("");
      setNumberError(null);
      setSelectedCountry(countries[0]); // Brazil
      setCountryDropdownOpen(false);
      setCountrySearch("");

      // Fetch contacts
      void fetchContacts();
    }
  }, [isOpen, activeSessionId, sessions]);

  // Click outside country dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ddiContainerRef.current && !ddiContainerRef.current.contains(event.target as Node)) {
        setCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const list = await apiService.getContacts(true);
      if (Array.isArray(list)) {
        setContacts(list);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Filter countries
  const filteredCountries = useMemo(() => {
    const s = countrySearch.toLowerCase().trim();
    if (!s) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.code.includes(s)
    );
  }, [countrySearch]);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    const s = contactSearch.toLowerCase().trim();
    if (!s) return contacts.slice(0, 10); // Show initial list of 10 contacts
    return contacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(s) ||
        (c.phone || "").includes(s)
    );
  }, [contacts, contactSearch]);

  // Auto-fill from contact selection
  const handleSelectContact = (contact: Contact) => {
    setNameInput(contact.name || "");
    
    // Parse phone DDI if exists, else keep raw
    let rawPhone = contact.phone.replace(/\D/g, "");
    
    // Find matching DDI
    let matchedCountry = countries[0]; // default Brasil
    for (const c of countries) {
      if (rawPhone.startsWith(c.code) && rawPhone.length > c.code.length + 4) {
        matchedCountry = c;
        rawPhone = rawPhone.slice(c.code.length);
        break;
      }
    }
    
    setSelectedCountry(matchedCountry);
    setPhoneInput(rawPhone);
    setContactSearch(""); // Close selection
    setNumberError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNumberError(null);

    const rawPhoneDigits = phoneInput.replace(/\D/g, "");
    if (!rawPhoneDigits) {
      toast({
        title: "Erro de validação",
        description: "Por favor, insira o número de telefone.",
        variant: "destructive",
      });
      return;
    }

    // Combine DDI code + phone digits
    const fullPhone = `${selectedCountry.code}${rawPhoneDigits}`;
    const selectedSession = sessions.find((s) => s.id === targetSessionId);

    setLoading(true);

    try {
      // 1. If session is connected, verify WhatsApp availability
      if (selectedSession && selectedSession.status === "connected") {
        setCheckingNumber(true);
        try {
          const check = await apiService.checkNumber(targetSessionId, fullPhone);
          setCheckingNumber(false);
          if (check && !check.exists) {
            setNumberError(`O número +${selectedCountry.code} ${phoneInput} não possui uma conta de WhatsApp ativa.`);
            setLoading(false);
            return;
          }
        } catch (checkErr: any) {
          setCheckingNumber(false);
          console.warn("Could not check number status directly:", checkErr?.message || checkErr);
          // Non-fatal, continue with conversation creation if network error
        }
      }

      // 2. Create the conversation
      const newConv = await apiService.createConversation({
        phone: fullPhone,
        name: nameInput.trim() || undefined,
        sessionId: targetSessionId || undefined,
      });

      toast({
        title: "Conversa Iniciada",
        description: "Nova conversa criada com sucesso!",
      });

      setIsOpen(false);

      // 3. Redirect to /inbox if not there, select conversation, and refresh
      if (location.pathname !== "/inbox") {
        navigate("/inbox");
      }

      if (newConv && newConv.id) {
        setSelectedConversationId(String(newConv.id));
      }
    } catch (err: any) {
      console.error("Erro ao iniciar conversa:", err);
      toast({
        title: "Erro ao iniciar conversa",
        description: err.message || "Não foi possível criar a conversa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg border-border/80 bg-card/95 backdrop-blur-xl text-foreground rounded-2xl shadow-2xl p-6">
        <DialogHeader className="border-b border-border/10 pb-4">
          <DialogTitle className="font-display text-lg font-bold text-foreground">Nova Conversa</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Contact Search / List Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Pesquisar Contato Salvo (Opcional)</Label>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Digite o nome ou número do contato..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/60 rounded-xl"
              />
            </div>
            
            {/* Contacts list display */}
            {contactSearch.trim() || (contacts.length > 0 && !phoneInput) ? (
              <div className="max-h-36 overflow-y-auto border border-border/60 rounded-xl bg-background/30 p-1 space-y-0.5">
                {loadingContacts ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">Carregando contatos...</div>
                ) : filteredContacts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">Nenhum contato encontrado.</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs hover:bg-primary/10 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold font-display">
                        {contact.name ? contact.name.slice(0, 1).toUpperCase() : <User size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{contact.name || "Sem Nome"}</p>
                        <p className="text-muted-foreground font-mono">{contact.phone}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number Input with Custom Country/DDI Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="phoneInput" className="text-xs font-semibold text-muted-foreground">Número de WhatsApp</Label>
              <div className="flex gap-2">
                {/* DDI dropdown container */}
                <div className="relative" ref={ddiContainerRef}>
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="flex h-10 items-center justify-between gap-1.5 rounded-xl border border-border/60 bg-background/50 px-3 text-sm hover:bg-muted/40 transition-colors focus:outline-none focus:ring-1 focus:ring-primary min-w-[90px]"
                  >
                    <span className="text-lg leading-none">{selectedCountry.flag}</span>
                    <span className="font-semibold">+{selectedCountry.code}</span>
                    <CaretDown size={12} className="text-muted-foreground" />
                  </button>

                  {/* Country Selector Dropdown List */}
                  {countryDropdownOpen && (
                    <div className="absolute left-0 mt-1 z-50 w-64 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl p-2 shadow-2xl space-y-2">
                      <div className="relative">
                        <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar país..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="h-7 pl-8 bg-background/80 text-xs border-border/50 rounded-lg"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredCountries.length === 0 ? (
                          <div className="p-2 text-center text-xs text-muted-foreground">Nenhum país encontrado</div>
                        ) : (
                          filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setCountryDropdownOpen(false);
                                setCountrySearch("");
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-primary/10 text-left transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{c.flag}</span>
                                <span className="font-medium text-foreground truncate max-w-[120px]">{c.name}</span>
                              </div>
                              <span className="font-mono text-muted-foreground">+{c.code}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  id="phoneInput"
                  placeholder={selectedCountry.placeholder}
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setNumberError(null);
                  }}
                  required
                  className="flex-1 bg-background/50 border-border/60 rounded-xl h-10"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/80 font-display">O código do país (+{selectedCountry.code}) já está selecionado. Insira apenas o DDD + número.</p>
            </div>

            {/* Contact Name Input */}
            <div className="space-y-1.5">
              <Label htmlFor="nameInput" className="text-xs font-semibold text-muted-foreground font-display">Nome do Contato (Opcional)</Label>
              <Input
                id="nameInput"
                placeholder="Ex: João Silva"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="bg-background/50 border-border/60 rounded-xl"
              />
            </div>

            {/* Session Selector */}
            {sessions && sessions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="newChatSession" className="text-xs font-semibold text-muted-foreground font-display">Sessão do WhatsApp</Label>
                <Select value={targetSessionId} onValueChange={setTargetSessionId}>
                  <SelectTrigger className="bg-background/50 border-border/60 rounded-xl">
                    <SelectValue placeholder="Selecione uma sessão" />
                  </SelectTrigger>
                  <SelectContent className="border-border/80 bg-popover/90 backdrop-blur-xl">
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name || session.id} ({session.status === 'connected' ? 'Conectado' : 'Desconectado'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Error Banner */}
            {numberError && (
              <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <Warning size={16} className="shrink-0 mt-0.5" />
                <p>{numberError}</p>
              </div>
            )}

            {/* Dialog Footer Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border/10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="rounded-xl font-display"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="rounded-xl gap-1.5 font-display">
                {checkingNumber ? (
                  <>
                    <Spinner className="h-3.5 w-3.5 animate-spin" />
                    Verificando...
                  </>
                ) : loading ? (
                  <>
                    <Spinner className="h-3.5 w-3.5 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  "Iniciar"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
