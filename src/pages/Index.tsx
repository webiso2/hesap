import React, { useState, useEffect } from 'react';
import { User, Database, DollarSign, ShoppingCart, FileText, Archive, Settings, Package, Banknote, Truck, LogOut, Loader2, Sliders, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import CustomerModule from "@/components/CustomerModule";
import StockModule from "@/components/StockModule";
import SalesModule from "@/components/SalesModule";
import CashierModule from "@/components/CashierModule";
import BackupModule from "@/components/BackupModule";
import ReportsModule from "@/components/ReportsModule";
import ServiceModule from "@/components/ServiceModule";
import NeedsModule from "@/components/NeedsModule";
import AccountsModule from "@/components/AccountsModule";
import WholesalerModule from "@/components/WholesalerModule";
import SettingsModule from "@/components/SettingsModule";
import ModuleButton from "@/components/ModuleButton";
import LoginForm from "@/components/LoginForm";
import Dashboard from "@/components/Dashboard";
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

import PriceCalculatorModule from "@/components/PriceCalculatorModule";
import VoiceControl from "@/components/voice/VoiceControl";

const Index = () => {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const { toast } = useToast();

  const handleVoiceCommand = (command: string) => {
    const cmd = command.toLowerCase().trim();

    // Modül Navigasyonu (Tam eşleşme kullanarak çakışmaları önleyelim)
    const isCustomer = cmd === 'müşteri' || cmd === 'müşteriler' || cmd === 'müşteri ekle' || cmd === 'kullanıcılar' || cmd === 'müşteri modülü';
    const isSales = cmd === 'satış' || cmd === 'satışlar' || cmd === 'satış modülü' || cmd === 'satış ekle';
    const isService = cmd === 'servis' || cmd === 'servisler' || cmd === 'servis modülü' || cmd === 'servis ekle' || cmd === 'teknik servis';
    const isStock = cmd === 'stok' || cmd === 'stoklar' || cmd === 'stok modülü';
    const isCashier = cmd === 'kasa' || cmd === 'kasa modülü';
    const isWholesaler = cmd === 'toptancı' || cmd === 'toptancılar' || cmd === 'toptancı modülü';
    const isReports = cmd === 'raporlar' || cmd === 'rapor modülü';
    const isNeeds = cmd === 'ihtiyaçlar' || cmd === 'ihtiyaç modülü';
    const isAccounts = cmd === 'hesaplar' || cmd === 'hesap modülü';
    const isBackup = cmd === 'yedek' || cmd === 'yedekleme' || cmd === 'yedek modülü';
    const isSettings = cmd === 'ayarlar' || cmd === 'ayar' || cmd === 'ayarlar modülü';
    const isCalculator = cmd === 'hesapla' || cmd === 'hesap makinesi' || cmd.includes('fiyat modülü') || cmd === 'fiyatlar';
    const isHome = cmd === 'ana sayfa' || cmd === 'modülü kapat' || cmd === 'geri dön' || cmd === 'çıkış yap';

    if (isCustomer) setActiveModule('customer');
    else if (isSales) setActiveModule('sales');
    else if (isService) setActiveModule('service');
    else if (isStock) setActiveModule('stock');
    else if (isCashier) setActiveModule('cashier');
    else if (isWholesaler) setActiveModule('wholesaler');
    else if (isReports) setActiveModule('reports');
    else if (isNeeds) setActiveModule('needs');
    else if (isAccounts) setActiveModule('accounts');
    else if (isBackup) setActiveModule('backup');
    else if (isSettings) setActiveModule('settings');
    else if (isCalculator) setActiveModule('calculator');
    else if (isHome) setActiveModule(null);
  };

  useEffect(() => {
    setAuthLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      console.log(">>> [Index.tsx] Başlangıç Oturumu:", session);
    }).catch(error => {
      console.error(">>> [Index.tsx] Oturum alınırken hata:", error);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(">>> [Index.tsx] Auth State Değişti:", _event, session);
      setSession(session);
      setActiveModule(null);
      setAuthLoading(false);
    });

    return () => { authListener?.subscription?.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    setLoginLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Çıkış Hatası", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    }
    setLoginLoading(false);
  };

  const renderModule = () => {
    if (authLoading) return <div className="p-4 text-center flex items-center justify-center h-full text-white"><Loader2 className="h-6 w-6 animate-spin mr-2" />Oturum kontrol...</div>;
    if (!session) return <div className="p-4 text-center text-red-400 flex items-center justify-center h-full">Modülleri görmek için giriş yapmalısınız.</div>;

    switch (activeModule) {
      case 'customer': return <CustomerModule onClose={() => setActiveModule(null)} />;
      case 'stock': return <StockModule onClose={() => setActiveModule(null)} />;
      case 'cashier': return <CashierModule onClose={() => setActiveModule(null)} />;
      case 'sales': return <SalesModule onClose={() => setActiveModule(null)} />;
      case 'service': return <ServiceModule onClose={() => setActiveModule(null)} />;
      case 'reports': return <ReportsModule onClose={() => setActiveModule(null)} />;
      case 'needs': return <NeedsModule onClose={() => setActiveModule(null)} />;
      case 'accounts': return <AccountsModule onClose={() => setActiveModule(null)} />;
      case 'wholesaler': return <WholesalerModule onClose={() => setActiveModule(null)} />;
      case 'backup': return <BackupModule onClose={() => setActiveModule(null)} />;
      case 'settings': return <SettingsModule onClose={() => setActiveModule(null)} />;
      case 'calculator': return <PriceCalculatorModule onClose={() => setActiveModule(null)} />;
      default: return <Dashboard onModuleSelect={setActiveModule} />;
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-foreground">Oturum kontrol ediliyor...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden font-inter">
      <VoiceControl onCommand={handleVoiceCommand} activeModule={activeModule} />
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-64 flex-col glass-panel border-r border-white/10 z-20">
        <div className="p-4 flex items-center gap-2 border-b border-white/10">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-white">G</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">GSM Servis</h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <ModuleButton icon={<User className="w-4 h-4" />} label="Müşteriler" active={activeModule === 'customer'} onClick={() => setActiveModule('customer')} />
          <ModuleButton icon={<ShoppingCart className="w-4 h-4" />} label="Satışlar" active={activeModule === 'sales'} onClick={() => setActiveModule('sales')} />
          <ModuleButton icon={<Settings className="w-4 h-4" />} label="Servis" active={activeModule === 'service'} onClick={() => setActiveModule('service')} />
          <ModuleButton icon={<Database className="w-4 h-4" />} label="Stoklar" active={activeModule === 'stock'} onClick={() => setActiveModule('stock')} />
          <ModuleButton icon={<DollarSign className="w-4 h-4" />} label="Kasa" active={activeModule === 'cashier'} onClick={() => setActiveModule('cashier')} />
          <ModuleButton icon={<Truck className="w-4 h-4" />} label="Toptancılar" active={activeModule === 'wholesaler'} onClick={() => setActiveModule('wholesaler')} />
          <ModuleButton icon={<FileText className="w-4 h-4" />} label="Raporlar" active={activeModule === 'reports'} onClick={() => setActiveModule('reports')} />
          <ModuleButton icon={<Package className="w-4 h-4" />} label="İhtiyaçlar" active={activeModule === 'needs'} onClick={() => setActiveModule('needs')} />
          <ModuleButton icon={<Banknote className="w-4 h-4" />} label="Hesaplar" active={activeModule === 'accounts'} onClick={() => setActiveModule('accounts')} />
          <ModuleButton icon={<Archive className="w-4 h-4" />} label="Yedekleme" active={activeModule === 'backup'} onClick={() => setActiveModule('backup')} />
          <ModuleButton icon={<Sliders className="w-4 h-4" />} label="Ayarlar" active={activeModule === 'settings'} onClick={() => setActiveModule('settings')} />
          <div className="my-2 border-t border-white/10 mx-2"></div>
          <ModuleButton icon={<Calculator className="w-4 h-4" />} label="Fiyat Hesapla" active={activeModule === 'calculator'} onClick={() => setActiveModule('calculator')} />
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white border border-white/10">
              {session.user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-200">{session.user?.email}</p>
              <p className="text-xs text-gray-500">Yönetici</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10" disabled={loginLoading}>
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 glass-panel border-b border-white/10 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-white">G</span>
          </div>
          <span className="font-bold text-lg text-white">GSM Servis</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setActiveModule(null)} className="text-white">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden">

        {/* Mobile Menu (Bottom Navigation) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-panel border-t border-white/10 z-30 flex items-center justify-around px-2 pb-safe">
          <Button variant="ghost" size="icon" className={`flex flex-col gap-1 h-full w-14 rounded-none ${!activeModule ? 'text-blue-400' : 'text-gray-400'}`} onClick={() => setActiveModule(null)}>
            <User className="h-5 w-5" />
            <span className="text-[10px]">Ana Sayfa</span>
          </Button>
          <Button variant="ghost" size="icon" className={`flex flex-col gap-1 h-full w-14 rounded-none ${activeModule === 'sales' ? 'text-blue-400' : 'text-gray-400'}`} onClick={() => setActiveModule('sales')}>
            <ShoppingCart className="h-5 w-5" />
            <span className="text-[10px]">Satış</span>
          </Button>
          <Button variant="ghost" size="icon" className={`flex flex-col gap-1 h-full w-14 rounded-none ${activeModule === 'customer' ? 'text-blue-400' : 'text-gray-400'}`} onClick={() => setActiveModule('customer')}>
            <User className="h-5 w-5" />
            <span className="text-[10px]">Müşteri</span>
          </Button>
          <Button variant="ghost" size="icon" className={`flex flex-col gap-1 h-full w-14 rounded-none ${activeModule === 'service' ? 'text-blue-400' : 'text-gray-400'}`} onClick={() => setActiveModule('service')}>
            <Settings className="h-5 w-5" />
            <span className="text-[10px]">Servis</span>
          </Button>
          <Button variant="ghost" size="icon" className={`flex flex-col gap-1 h-full w-14 rounded-none ${activeModule === 'calculator' ? 'text-blue-400' : 'text-gray-400'}`} onClick={() => setActiveModule('calculator')}>
            <Calculator className="h-5 w-5" />
            <span className="text-[10px]">Hsp.</span>
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {activeModule && (
              <div className="mb-4 flex items-center justify-between md:hidden">
                <Button variant="ghost" onClick={() => setActiveModule(null)} className="text-gray-400 hover:text-white pl-0">
                  ← Geri Dön
                </Button>
                <h2 className="font-bold text-white capitalize">{activeModule === 'calculator' ? 'Hesaplama' : activeModule}</h2>
              </div>
            )}
            <div className="h-full glass-card overflow-hidden animate-in fade-in duration-300">
              {renderModule()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;