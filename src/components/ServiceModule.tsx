// --- START OF FILE src/ServiceModule.tsx ---

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Wrench, Plus, Loader2, CheckCircle, Clock, XCircle, Info, ListFilter, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@/types/customer";
import type { Product, Account } from "@/types/backup";
import type { Service, ServicePart } from "@/types/service";
import ServiceList from "./service/ServiceList";
import EditServiceDialog from "./service/EditServiceDialog";
import AddNewCustomerDialog from "./service/AddNewCustomerDialog";
import { supabase } from "@/integrations/supabase/client";
import { printServiceRecord } from "@/utils/printUtils";
import { getStatusText, getStatusColor } from "@/utils/serviceUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ServiceModuleProps { onClose: () => void; }
type StatusFilter = Service['status'] | 'all';

const ServiceModule: React.FC<ServiceModuleProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchData = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    let success = true;
    try {
      const results = await Promise.allSettled([
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('services').select('*, customer:customers!services_customer_id_fkey( name )').order('date', { ascending: false }),
        supabase.from('accounts').select('*').order('name')
      ]);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const requestName = ['Customers', 'Products', 'Services', 'Accounts'][index];
          console.error(`[ServiceModule fetchData] İstek BAŞARISIZ (${requestName}):`, result.reason);
        }
      });

      let fetchedCustomers: Customer[] = [];
      let customerMap = new Map<string, string>();
      if (results[0].status === 'fulfilled') {
        const customerData = results[0].value.data; const customerError = results[0].value.error;
        if (customerError) throw new Error(`Müşteri: ${customerError.message}`);
        fetchedCustomers = (customerData || []).map(c => ({ id: c.id, created_at: c.created_at, name: c.name, phone: c.phone ?? null, address: c.address ?? null, city: c.city ?? null, email: c.email ?? null, notes: c.notes ?? null, credit_limit: c.credit_limit ?? 0, total_credit: c.total_credit ?? 0, remaining_installments: c.remaining_installments ?? 0, total_debt: c.total_debt ?? 0, debt: c.debt ?? 0 }));
        setCustomers(fetchedCustomers); customerMap = new Map(fetchedCustomers.map(c => [c.id, c.name]));
      } else { throw new Error(`Müşteri: ${results[0].reason?.message || "Bilinmeyen hata"}`); }

      if (results[1].status === 'fulfilled') {
        const productData = results[1].value.data; const productError = results[1].value.error;
        if (productError) throw new Error(`Ürün: ${productError.message}`);
        const fetchedProducts: Product[] = (productData || []).map(p => ({ id: p.id, created_at: p.created_at, code: p.code, name: p.name, description: p.description ?? null, category: p.category ?? null, quantity: p.quantity ?? 0, unit: p.unit ?? 'adet', purchase_price: p.purchase_price ?? 0, selling_price: p.selling_price ?? 0, min_stock_level: p.min_stock_level ?? 0, supplier: p.supplier ?? null }));
        setProducts(fetchedProducts);
      } else { throw new Error(`Ürün: ${results[1].reason?.message || "Bilinmeyen hata"}`); }

      if (results[2].status === 'fulfilled') {
        const serviceData = results[2].value.data; const serviceError = results[2].value.error;
        if (serviceError) {
          console.error("Servis çekme hatası (embedding sorunu olabilir):", serviceError);
          throw new Error(`Servis: ${serviceError.message}`);
        }
        const fetchedServices: Service[] = (serviceData || []).map((s: any) => {
          const customerNameFromMap = customerMap.get(s.customer_id);
          const finalCustomerName = customerNameFromMap || s.customer?.name || '?';
          const partsData = s.parts; let serviceParts: ServicePart[] = [];
          if (Array.isArray(partsData)) { serviceParts = partsData.map((p: any, index: number) => ({ id: p.id || `part-${s.id}-${index}`, productId: p.productId || null, name: p.name || 'İsimsiz Parça', quantity: p.quantity || 0, unitPrice: p.unitPrice || 0, isStockItem: p.isStockItem ?? false, })); }
          return {
            id: s.id, created_at: s.created_at, date: s.date, customer_id: s.customer_id, customerName: finalCustomerName,
            deviceType: s.device_type, brand: s.brand, model: s.model, serialNumber: s.serial_number,
            problem: s.problem, diagnosis: s.diagnosis, solution: s.solution,
            status: ['pending', 'in_progress', 'completed', 'cancelled'].includes(s.status) ? s.status : 'pending',
            cost: s.cost ?? 0, parts: serviceParts,
            device_type: s.device_type, serial_number: s.serial_number,
            tracking_code: s.tracking_code // Eklendi
          };
        });
        setServices(fetchedServices);
      } else {
        console.error("Servis isteği başarısız oldu:", results[2].reason);
        throw new Error(`Servis: ${results[2].reason?.message || "Bilinmeyen istek hatası"}`);
      }

      if (results[3].status === 'fulfilled') {
        const accountData = results[3].value.data; const accountError = results[3].value.error;
        if (accountError) throw new Error(`Hesaplar: ${accountError.message}`);
        const fetchedAccounts: Account[] = (accountData || []).map(acc => ({
          id: acc.id, created_at: acc.created_at, name: acc.name ?? '',
          type: acc.type ?? 'cash',
          account_number: acc.account_number ?? null, bank_name: acc.bank_name ?? null,
          initial_balance: acc.initial_balance ?? 0, current_balance: acc.current_balance ?? 0,
          is_default: acc.is_default ?? false,
          credit_limit: acc.credit_limit ?? 0
        }));
        setAccounts(fetchedAccounts);
      } else { throw new Error(`Hesaplar: ${results[3].reason?.message || "Bilinmeyen hata"}`); }

    } catch (error: any) {
      console.error("[ServiceModule fetchData] Hata Yakalandı! Detaylar:", error);
      const displayErrorMessage = error?.message || 'Bilinmeyen bir hata oluştu.';
      toast({ title: "Veri Yükleme Hatası", description: displayErrorMessage, variant: "destructive" });
      success = false; setCustomers([]); setProducts([]); setServices([]);
    } finally {
      if (showLoadingIndicator) { setIsLoading(false); }
    }
    return success;
  }, [toast]);

  useEffect(() => { fetchData(true); }, [fetchData]);



  const serviceCounts = useMemo(() => { const counts: { [key in Service['status'] | 'all']: number } = { pending: 0, in_progress: 0, completed: 0, cancelled: 0, all: services?.length ?? 0 }; if (Array.isArray(services)) { services.forEach(service => { if (service?.status && counts[service.status] !== undefined) { counts[service.status]++; } }); } return counts; }, [services]);

  const openNewServiceDialog = () => { setEditingService(null); setIsServiceDialogOpen(true); };

  const openNewServiceDialogRef = useRef(openNewServiceDialog);
  openNewServiceDialogRef.current = openNewServiceDialog;

  useEffect(() => {
    const handleVoiceCommand = (e: any) => {
      const { command, handledByButton } = e.detail;
      if (handledByButton) return;

      const cmd = command.toLowerCase().trim();

      if (cmd.includes('servis ekle') || cmd.includes('yeni servis')) {
        openNewServiceDialogRef.current();
      }
    };

    window.addEventListener('voice-command', handleVoiceCommand as any);
    return () => window.removeEventListener('voice-command', handleVoiceCommand as any);
  }, []);
  const openEditServiceDialog = (service: Service) => { setEditingService(service); setIsServiceDialogOpen(true); };
  const handleCloseServiceDialog = (refreshNeeded?: boolean) => { setIsServiceDialogOpen(false); setEditingService(null); if (refreshNeeded) { fetchData(false); } };
  const handleServiceSaved = (savedService: Service) => { const customer = customers.find(c => c.id === savedService.customer_id); const serviceWithCorrectName = { ...savedService, customerName: customer?.name || '?' }; setServices(prev => { const index = prev.findIndex(s => s.id === serviceWithCorrectName.id); if (index > -1) { const updated = [...prev]; updated[index] = serviceWithCorrectName; return updated; } else { return [serviceWithCorrectName, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); } }); handleCloseServiceDialog(false); const isNew = !editingService; if (isNew) { setTimeout(() => { if (window.confirm("Servis kaydı oluşturuldu. Fişi yazdırmak ister misiniz?")) { if (customer) { printServiceRecord(serviceWithCorrectName, customer); } else { printServiceRecord(serviceWithCorrectName); } } }, 100); } };
  const handleDeleteServiceCallback = (serviceId: string) => { setServices(prev => prev.filter(s => s.id !== serviceId)); toast({ title: "Başarılı", description: "Servis kaydı silindi." }); };
  const openAddCustomerDialog = () => setIsAddCustomerDialogOpen(true);
  const handleCustomerAdded = (newCustomer: Customer | null) => { setIsAddCustomerDialogOpen(false); if (newCustomer) { setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name))); toast({ title: "Müşteri Eklendi", description: `${newCustomer.name} başarıyla eklendi.` }); } };

  const filterOptions = useMemo(() => [
    { value: 'all' as StatusFilter, label: `Tümü`, icon: <ListFilter className="h-4 w-4 mr-1.5" /> },
    { value: 'pending' as StatusFilter, label: getStatusText('pending'), icon: <AlertCircle className="h-4 w-4 mr-1.5" /> },
    { value: 'in_progress' as StatusFilter, label: getStatusText('in_progress'), icon: <Clock className="h-4 w-4 mr-1.5" /> },
    { value: 'completed' as StatusFilter, label: getStatusText('completed'), icon: <CheckCircle className="h-4 w-4 mr-1.5" /> },
    { value: 'cancelled' as StatusFilter, label: getStatusText('cancelled'), icon: <XCircle className="h-4 w-4 mr-1.5" /> }
  ], []);

  return (
    <div className="h-full p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="glass-panel rounded-xl h-full flex flex-col border border-white/10 shadow-2xl overflow-hidden">
        <div className="bg-white/5 border-b border-white/10 p-3 flex justify-between items-center flex-shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-400" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Servis İşlemleri</h1>
          </div>
          <Button variant="ghost" size="icon" className="hover:bg-red-500/20 hover:text-red-400 h-8 w-8 rounded-lg transition-colors" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-3 sm:p-4 flex-1 flex flex-col overflow-hidden gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
            {filterOptions.filter(o => o.value !== 'all').map(option => (
              <div
                key={option.value}
                className={cn(
                  "p-3 rounded-lg border border-white/5 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02]",
                  option.value === 'pending' && "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
                  option.value === 'in_progress' && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                  option.value === 'completed' && "bg-green-500/10 border-green-500/20 text-green-400",
                  option.value === 'cancelled' && "bg-red-500/10 border-red-500/20 text-red-400"
                )}
              >
                <div className="text-xs font-medium opacity-80 mb-1">{option.label}</div>
                <div className="text-2xl font-bold tracking-tight">{serviceCounts ? serviceCounts[option.value as Service['status']] ?? 0 : 0}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 bg-white/5 p-2 rounded-lg border border-white/10">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {filterOptions.map(option => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                  className={cn(
                    "h-8 px-3 text-xs transition-all duration-200",
                    statusFilter === option.value
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  {option.icon} {option.label}
                  <span className="ml-1.5 opacity-60 text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full">
                    {serviceCounts ? serviceCounts[option.value] ?? 0 : 0}
                  </span>
                </Button>
              ))}
            </div>
            <Button onClick={openNewServiceDialog} size="sm" className="w-full sm:w-auto h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all duration-200">
              <Plus className="h-4 w-4 mr-1.5" /> Yeni Servis
            </Button>
          </div>

          <div className="flex-1 overflow-hidden glass-card rounded-lg border border-white/10">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-full text-gray-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Servis kayıtları yükleniyor...</span>
              </div>
            ) : (
              <ServiceList
                services={services}
                customers={customers}
                onDeleteService={handleDeleteServiceCallback}
                onEditService={openEditServiceDialog}
                isLoading={false}
                fetchServices={async () => { await fetchData(false); }}
                activeFilter={statusFilter}
              />
            )}
          </div>
        </div>
      </div>

      <EditServiceDialog
        isOpen={isServiceDialogOpen}
        setIsOpen={(open, refresh) => handleCloseServiceDialog(refresh as boolean)}
        editingService={editingService}
        onServiceSaved={handleServiceSaved}
        customers={customers}
        products={products}
        accounts={accounts}
        openAddCustomerDialog={openAddCustomerDialog}
      />
      <AddNewCustomerDialog
        isOpen={isAddCustomerDialogOpen}
        setIsOpen={setIsAddCustomerDialogOpen}
        onCustomerAdded={handleCustomerAdded}
      />
    </div>
  );
};

export default ServiceModule;
// --- END OF FILE src/ServiceModule.tsx ---