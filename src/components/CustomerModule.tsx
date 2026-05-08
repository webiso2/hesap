// --- START OF FILE src/CustomerModule.tsx ---

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, User, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DebtDetailsDialog from "@/components/DebtDetailsDialog";
import CustomerForm from "@/components/customer/CustomerForm";
import CustomerOperations from "@/components/customer/CustomerOperations";
import CustomerList from "@/components/customer/CustomerList";
import CustomerDetailPanel from "@/components/customer/CustomerDetailPanel";
import PaymentDialog from "@/components/customer/PaymentDialog";
import AddDebtDialog from "@/components/customer/AddDebtDialog";
import { Customer, FormData, CustomerTransaction } from "@/types/customer";
import type { Account } from "@/types/backup";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomers, useAccounts } from "@/hooks/useAppData";
import { formatPhoneNumber } from "@/utils/customerUtils";
import { cleanVoiceValue, isDeleteIntent, capitalizeText, cleanPhoneNumber as voiceCleanPhone } from "@/utils/voiceUtils";

const initialFormData: FormData = {
  name: "", phone: "", address: "", city: "", email: "", notes: "", credit_limit: "0",
};

interface CustomerModuleProps {
  onClose: () => void;
  initialData?: { name?: string; phone?: string }; // Keep for now if called with props, though unused by voice
}

const CustomerModule: React.FC<CustomerModuleProps> = ({ onClose, initialData }) => {
  const [formData, setFormData] = useState<FormData>(initialData ? { ...initialFormData, name: initialData.name || "", phone: initialData.phone || "" } : initialFormData);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [debtDetailsOpen, setDebtDetailsOpen] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isAddDebtDialogOpen, setIsAddDebtDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const { data: customersData, isLoading: isCustomersLoading } = useCustomers();
  const { data: accountsData } = useAccounts();

  const customers = customersData || [];
  const accounts = accountsData || [];
  const isLoading = isCustomersLoading;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };



  const handleCustomerSelect = useCallback((customer: Customer) => {
    if (isEditing) {
      console.warn("Düzenleme modunda müşteri seçimi engellendi.");
      return;
    }
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
      credit_limit: customer.credit_limit?.toString() ?? '0',
    });
  }, [isEditing]);

  const openDetailPanel = useCallback((customer: Customer) => {
    if (isEditing) {
      console.warn("Düzenleme modunda detay paneli açma engellendi.");
      return;
    }
    setViewingCustomerId(customer.id);
    setIsDetailPanelOpen(true);
  }, [isEditing]);

  const prepareDataForSupabase = (data: FormData) => {
    console.log("[prepareDataForSupabase] Veri hazırlanıyor:", data);
    const formattedPhone = formatPhoneNumber(data.phone);

    // Geçersiz format uyarısı ver ama kaydı durdurma (eğer numara varsa - formatPhoneNumber geçersizse null döner)
    if (data.phone && !formattedPhone && data.phone.trim() !== '') {
      console.warn("[prepareDataForSupabase] Telefon formatı eşleşmedi, ham veri kullanılacak:", data.phone);
      // toast({ title: "Bilgi", description: "Telefon formatı tam anlaşılamadı, olduğu gibi kaydediliyor.", variant: "default" });
    }

    if (!data.name.trim()) {
      console.error("[prepareDataForSupabase] HATA: Müşteri adı boş!");
      toast({ title: "Uyarı", description: "Müşteri adı zorunludur.", variant: "destructive" });
      return null;
    }

    const prepared = {
      name: data.name.trim(),
      phone: formattedPhone || data.phone?.trim() || null, // Formatlı yoksa ham veriyi kullan
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      email: data.email?.trim().toLowerCase() || null,
      notes: data.notes?.trim() || null,
      credit_limit: parseFloat(data.credit_limit) || 0,
    };

    console.log("[prepareDataForSupabase] Hazırlanan veri:", prepared);
    return prepared;
  };

  const handleAddCustomer = useCallback(async () => {
    if (isEditing) return;
    const customerData = prepareDataForSupabase(formData);
    if (!customerData) return;

    setIsSaving(true);
    try {
      const dataToInsert = { ...customerData, debt: 0 };
      const { data, error } = await supabase.from('customers').insert([dataToInsert]).select().single();
      if (error) throw error;

      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast({ title: "Başarılı", description: `"${data.name}" başarıyla eklendi.` });
        setFormData(initialFormData);
        setSelectedCustomer(null);
      }
    } catch (error: any) {
      console.error("Müşteri Ekleme Hatası:", error);
      toast({ title: "Hata", description: `Müşteri eklenemedi: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [isEditing, formData, queryClient, toast]);

  const handleUpdateCustomer = useCallback(async () => {
    if (!editingCustomerId || !isEditing) return;
    const customerData = prepareDataForSupabase(formData);
    if (!customerData) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('customers').update(customerData).eq('id', editingCustomerId).select().single();
      if (error) throw error;

      if (data) {
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast({ title: "Başarılı", description: `"${data.name}" başarıyla güncellendi.` });
        setIsEditing(false);
        setEditingCustomerId(null);
        setSelectedCustomer(null);
        setFormData(initialFormData);
      }
    } catch (error: any) {
      console.error("Müşteri Güncelleme Hatası:", error);
      toast({ title: "Hata", description: `Müşteri güncellenemedi: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [editingCustomerId, isEditing, formData, queryClient, toast]);

  const handleEditClick = useCallback(() => {
    if (!isEditing) {
      if (!selectedCustomer) {
        toast({ title: "Bilgi", description: "Lütfen düzenlemek için bir müşteri seçin.", variant: "default" });
        setFormData(initialFormData);
        return;
      }
      setIsEditing(true);
      setEditingCustomerId(selectedCustomer.id);
    } else {
      handleUpdateCustomer();
    }
  }, [isEditing, selectedCustomer, handleUpdateCustomer, toast]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingCustomerId(null);
    setSelectedCustomer(null);
    setFormData(initialFormData);
  }, []);

  const handleDeleteCustomer = useCallback(async () => {
    if (!selectedCustomer || isEditing) return;
    if (!window.confirm(`"${selectedCustomer.name}" isimli müşteriyi silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz!`)) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', selectedCustomer.id);
      if (error) {
        if (error.code === '23503') {
          console.warn("Müşteri silinemedi - İlişkili kayıtlar var:", error);
          toast({ title: "Hata", description: "Bu müşteriye ait satış, servis veya işlem kaydı bulunduğu için silinemez.", variant: "destructive", duration: 7000 });
        } else throw error;
      } else {
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast({ title: "Başarılı", description: `"${selectedCustomer.name}" silindi.` });
        setSelectedCustomer(null);
        setFormData(initialFormData);
      }
    } catch (error: any) {
      console.error("Müşteri Silme Hatası:", error);
      toast({ title: "Hata", description: `Müşteri silinemedi: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedCustomer, isEditing, queryClient, toast]);

  const handleAddDebt = useCallback(() => {
    if (!selectedCustomer) { toast({ title: "Uyarı", description: "Lütfen önce borç eklenecek müşteriyi seçin.", variant: "destructive" }); return; }
    if (isEditing) { toast({ title: "Uyarı", description: "Müşteri düzenleme modundayken borç eklenemez.", variant: "destructive" }); return; }
    setIsAddDebtDialogOpen(true);
  }, [selectedCustomer, isEditing]);

  const handlePayment = useCallback(() => {
    if (!selectedCustomer) { toast({ title: "Uyarı", description: "Lütfen önce tahsilat yapılacak müşteriyi seçin.", variant: "destructive" }); return; }
    if (isEditing) { toast({ title: "Uyarı", description: "Müşteri düzenleme modundayken tahsilat yapılamaz.", variant: "destructive" }); return; }
    if (selectedCustomer.debt <= 0) { toast({ title: "Bilgi", description: "Müşterinin tahsilat yapılacak borcu bulunmamaktadır.", variant: "default" }); return; }
    setIsPaymentDialogOpen(true);
  }, [selectedCustomer, isEditing]);

  const handleDebtDetailsClick = useCallback((customer: Customer | null) => {
    if (!customer) { toast({ title: "Uyarı", description: "Lütfen önce bir müşteri seçin.", variant: "destructive" }); return; }
    if (isEditing) { toast({ title: "Uyarı", description: "Müşteri düzenleme modundayken borç detayı görüntülenemez.", variant: "destructive" }); return; }
    setDebtDetailsOpen(true);
  }, [isEditing]);

  const handleTransactionUpdate = useCallback((updatedCustomerId: string, newDebt: number) => {
    queryClient.setQueryData(['customers'], (oldData: Customer[] | undefined) => {
      if (!oldData) return [];
      return oldData.map(c => c.id === updatedCustomerId ? { ...c, debt: newDebt } : c);
    });
    if (selectedCustomer?.id === updatedCustomerId) {
      setSelectedCustomer(prevSelected =>
        prevSelected ? { ...prevSelected, debt: newDebt } : null
      );
    }
  }, [selectedCustomer?.id, queryClient]);

  // Voice Command Refs to avoid stale closures
  const addCustomerRef = useRef(handleAddCustomer);
  const updateCustomerRef = useRef(handleUpdateCustomer);
  const editClickRef = useRef(handleEditClick);
  const cancelEditRef = useRef(handleCancelEdit);
  const deleteCustomerRef = useRef(handleDeleteCustomer);
  const addDebtRef = useRef(handleAddDebt);
  const paymentRef = useRef(handlePayment);
  const debtDetailsRef = useRef(handleDebtDetailsClick);
  const isEditingRef = useRef(isEditing);
  const selectedCustomerRef = useRef(selectedCustomer);
  const setFormDataRef = useRef(setFormData);
  const toastRef = useRef(toast);

  useEffect(() => {
    addCustomerRef.current = handleAddCustomer;
    updateCustomerRef.current = handleUpdateCustomer;
    editClickRef.current = handleEditClick;
    cancelEditRef.current = handleCancelEdit;
    deleteCustomerRef.current = handleDeleteCustomer;
    addDebtRef.current = handleAddDebt;
    paymentRef.current = handlePayment;
    debtDetailsRef.current = handleDebtDetailsClick;
    isEditingRef.current = isEditing;
    selectedCustomerRef.current = selectedCustomer;
    setFormDataRef.current = setFormData;
    toastRef.current = toast;
  }, [handleAddCustomer, handleUpdateCustomer, handleEditClick, handleCancelEdit, handleDeleteCustomer, handleAddDebt, handlePayment, handleDebtDetailsClick, isEditing, selectedCustomer, toast]);

  useEffect(() => {
    const handleVoiceCommand = (e: any) => {
      const { command, handledByButton } = e.detail;
      if (handledByButton) return; // Buton olarak işlendiyse burada tekrar işleme

      const cmd = command.toLowerCase().trim();
      console.log("CustomerModule'da işleniyor:", cmd);

      // --- SİLME / TEMİZLEME KOMUTLARI ---
      if (isDeleteIntent(cmd, ['müşteri adı', 'isim', 'adı', 'ismi'])) {
        setFormDataRef.current(prev => ({ ...prev, name: "" }));
        toastRef.current({ title: "Sesli Komut", description: "Müşteri adı silindi." });
        return;
      }
      if (isDeleteIntent(cmd, ['telefon', 'numara', 'cep'])) {
        setFormDataRef.current(prev => ({ ...prev, phone: "" }));
        toastRef.current({ title: "Sesli Komut", description: "Telefon numarası silindi." });
        return;
      }
      if (isDeleteIntent(cmd, ['adres'])) {
        setFormDataRef.current(prev => ({ ...prev, address: "" }));
        toastRef.current({ title: "Sesli Komut", description: "Adres silindi." });
        return;
      }
      if (isDeleteIntent(cmd, ['şehir'])) {
        setFormDataRef.current(prev => ({ ...prev, city: "" }));
        toastRef.current({ title: "Sesli Komut", description: "Şehir silindi." });
        return;
      }
      if (isDeleteIntent(cmd, ['limit', 'kredi'])) {
        setFormDataRef.current(prev => ({ ...prev, credit_limit: "0" }));
        toastRef.current({ title: "Sesli Komut", description: "Kredi limiti sıfırlandı." });
        return;
      }
      if (isDeleteIntent(cmd, ['not'])) {
        setFormDataRef.current(prev => ({ ...prev, notes: "" }));
        toastRef.current({ title: "Sesli Komut", description: "Notlar silindi." });
        return;
      }

      // --- VERİ GİRİŞ KOMUTLARI ---

      // Müşteri Adı
      if (cmd.includes('müşteri adı') || cmd.startsWith('isim') || cmd.startsWith('adı')) {
        const val = capitalizeText(cleanVoiceValue(command, ['müşteri adı', 'isim', 'adı', 'ismi']));
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, name: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Müşteri Adı: ${val}` });
          return;
        }
      }

      // Telefon
      if (cmd.includes('telefon') || cmd.includes('numara')) {
        const val = voiceCleanPhone(cleanVoiceValue(command, ['telefon', 'numara', 'numarası']));
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, phone: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Telefon: ${val}` });
          return;
        }
      }

      // Adres
      if (cmd.startsWith('adres')) {
        const val = cleanVoiceValue(command, ['adres']);
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, address: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Adres: ${val}` });
          return;
        }
      }

      // Şehir
      if (cmd.startsWith('şehir')) {
        const val = capitalizeText(cleanVoiceValue(command, ['şehir']));
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, city: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Şehir: ${val}` });
          return;
        }
      }

      // E-posta
      if (cmd.startsWith('e-posta') || cmd.startsWith('eposta') || cmd.startsWith('mail')) {
        const val = cleanVoiceValue(command, ['e-posta', 'eposta', 'mail', 'e posta']).replace(/\s/g, '').toLowerCase();
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, email: val }));
          toastRef.current({ title: "Sesli Giriş", description: `E-posta: ${val}` });
          return;
        }
      }

      // Özel Notlar
      if (cmd.includes('notlar') || cmd.includes('not')) {
        const val = cleanVoiceValue(command, ['özel notlar', 'notlar', 'not']);
        if (val) {
          setFormDataRef.current(prev => ({ ...prev, notes: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Notlar: ${val}` });
          return;
        }
      }

      // Kredi Limiti
      if (cmd.includes('kredi limiti') || cmd.includes('limit')) {
        const val = cleanVoiceValue(command, ['kredi limiti', 'limit', 'limiti']).replace(',', '.').replace(/\s/g, '');
        if (val && !isNaN(parseFloat(val))) {
          setFormDataRef.current(prev => ({ ...prev, credit_limit: val }));
          toastRef.current({ title: "Sesli Giriş", description: `Kredi Limiti: ${val}` });
          return;
        }
      }

      // Akıllı Tahmin (fallback)
      const digitsOnly = cmd.replace(/\s/g, '');
      if (/^\d{7,15}$/.test(digitsOnly) || (digitsOnly.length >= 10 && digitsOnly.startsWith('5'))) {
        setFormDataRef.current(prev => ({ ...prev, phone: digitsOnly }));
        toastRef.current({ title: "Akıllı Giriş", description: `Telefon algılandı: ${digitsOnly}` });
        return;
      }
    };

    window.addEventListener('voice-command', handleVoiceCommand as any);
    return () => window.removeEventListener('voice-command', handleVoiceCommand as any);
  }, [selectedCustomer, handleDebtDetailsClick, handleAddDebt, handlePayment, handleEditClick, handleDeleteCustomer, handleCancelEdit, toast]);

  return (
    <div className="h-full flex flex-col p-2 sm:p-4 overflow-hidden animate-in fade-in duration-300">
      <div className="glass-panel rounded-xl h-full flex flex-col overflow-hidden border border-white/10 shadow-2xl">
        {/* Başlık ve Kapatma Butonu */}
        <div className="bg-white/5 border-b border-white/10 p-3 flex justify-between items-center shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Müşteri Bilgi Sistemi</h1>
          </div>
          <Button variant="ghost" size="icon" className="hover:bg-red-500/20 hover:text-red-400 h-8 w-8 rounded-lg transition-colors" onClick={onClose} disabled={isSaving || isProcessing}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Ana İçerik Alanı */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sol Taraf: Form */}
              <div className="glass-card p-4">
                <CustomerForm
                  formData={formData}
                  handleInputChange={handleInputChange}
                  isEditing={isEditing}
                  isSaving={isSaving}
                />
              </div>

              {/* Sağ Taraf: Operasyonlar */}
              <div className="glass-card p-4">
                <CustomerOperations
                  formData={formData}
                  handleInputChange={handleInputChange}
                  selectedCustomer={selectedCustomer}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  isLoading={isProcessing}
                  handleDebtDetailsClick={handleDebtDetailsClick}
                  handleAddDebt={handleAddDebt}
                  handlePayment={handlePayment}
                  handleAddCustomer={handleAddCustomer}
                  handleEditClick={handleEditClick}
                  handleCancelEdit={handleCancelEdit}
                  handleDeleteCustomer={handleDeleteCustomer}
                />
              </div>
            </div>

            {/* Alt Taraf: Müşteri Listesi */}
            <div className="mt-4 glass-card p-4 min-h-[400px]">
              <CustomerList
                customers={customers}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedCustomer={selectedCustomer}
                handleCustomerSelect={handleCustomerSelect}
                isEditing={isEditing}
                isLoading={isLoading}
                onRowClick={openDetailPanel}
              />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Dialoglar */}
      {selectedCustomer && (
        <>
          <DebtDetailsDialog
            open={debtDetailsOpen}
            onOpenChange={setDebtDetailsOpen}
            customerName={selectedCustomer.name}
            customerId={selectedCustomer.id}
            onTransactionUpdate={handleTransactionUpdate}
          />

          <AddDebtDialog
            isOpen={isAddDebtDialogOpen}
            onOpenChange={setIsAddDebtDialogOpen}
            customer={selectedCustomer}
            accounts={accounts}
            onDebtAdded={(customerId, newDebt, updatedAccount) => {
              handleTransactionUpdate(customerId, newDebt);
              if (updatedAccount) {
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
              }
            }}
          />

          <PaymentDialog
            isOpen={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            customer={selectedCustomer}
            accounts={accounts}
            onPaymentCompleted={(customerId, newDebt, updatedAccount) => {
              handleTransactionUpdate(customerId, newDebt);
              if (updatedAccount) {
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
              }
            }}
          />
        </>
      )}

      <CustomerDetailPanel
        customerId={viewingCustomerId}
        open={isDetailPanelOpen}
        onOpenChange={setIsDetailPanelOpen}
      />
    </div>
  );
};

export default CustomerModule;
// --- END OF FILE src/CustomerModule.tsx ---