// --- START OF FILE src/components/SalesModule.tsx ---

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useProducts, useCustomers, useAccounts, useSales } from "@/hooks/useAppData";
import { X, ShoppingCart, Search, Plus, Minus, Printer, Trash2, Edit, Loader2, Tag, Banknote, Landmark, TerminalSquare, ScanBarcode, Receipt, PackageCheck, MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import type { Customer } from "@/types/customer";
import type { Account, Product as BackupProduct, Sale as BackupSale } from "@/types/backup";
import EditSaleDialog from './sales/EditSaleDialog';
import { getSettings, AppSettings } from "@/utils/settingsUtils";
import { generateSalesMessage, openWhatsApp } from "@/utils/whatsappUtils";
import { cn } from "@/lib/utils";

// --- Tipler ---
interface Product extends BackupProduct { }
interface CartItem extends Product { cartQuantity: number; product_id: string | null; purchasePrice: number; sellingPrice: number; }
interface Sale extends Omit<BackupSale, 'items'> { items: CartItem[] }
type PaymentMethod = 'cash' | 'pos' | 'bank';
interface SalesModuleProps { onClose: () => void; }

// --- Yardımcı Fonksiyon: İhtiyaç Kontrolü ---
async function checkAndAddNeed(productId: string, productName: string, currentQuantity: number, minStockLevel: number, toastFn: (options: any) => void) {
    if (minStockLevel <= 0 || currentQuantity >= minStockLevel) return;
    try {
        const { count, error } = await supabase.from('needs').select('id', { count: 'exact', head: true }).eq('product_id', productId);
        if (error) return;
        if (count === 0) {
            const quantityNeeded = minStockLevel - currentQuantity > 0 ? minStockLevel - currentQuantity : 1;
            await supabase.from('needs').insert({ date: new Date().toISOString(), description: `${productName} (Otomatik - Stok Azaldı)`, quantity: quantityNeeded, product_id: productId, supplier: null });
            toastFn({ title: "Stok Uyarısı", description: `"${productName}" ihtiyaç listesine eklendi.` });
            window.dispatchEvent(new CustomEvent('needs-updated'));
        }
    } catch (e) { console.error(e); }
}

const SalesModule: React.FC<SalesModuleProps> = ({ onClose }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // --- State ---
    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerId, setCustomerId] = useState<string>("");
    const [isStockless, setIsStockless] = useState(false);
    const [isBarcodeMode, setIsBarcodeMode] = useState(false);
    const [manualProduct, setManualProduct] = useState<Partial<Omit<Product, 'id' | 'created_at'>>>({ name: '', selling_price: 0, purchase_price: 0, quantity: 1, unit: 'adet' });
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [discountAmount, setDiscountAmount] = useState<string>("0");
    const [receivedAmount, setReceivedAmount] = useState<string>(""); // Alınan Tutar (Kapora/Tahsilat)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    const today = format(new Date(), 'yyyy-MM-dd');
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Hooks ---
    const { data: productsData, isLoading: isLoadingProducts } = useProducts();
    const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();
    const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts();
    const { data: salesData, isLoading: isLoadingSales } = useSales(startDate, endDate);

    // --- Veri Dönüştürme ---
    const products = useMemo(() => (productsData || []) as Product[], [productsData]);
    const customers = useMemo(() => (customersData || []) as Customer[], [customersData]);
    const accounts = useMemo(() => (accountsData || []) as Account[], [accountsData]);

    const sales = useMemo(() => {
        return (salesData || []).map((s: any) => ({
            id: s.id,
            created_at: s.created_at,
            date: s.date,
            items: (s.items ?? []).map((item: any) => ({
                ...item,
                name: item.name || 'Bilinmeyen Ürün',
                cartQuantity: item.cartQuantity ?? 1,
                sellingPrice: item.sellingPrice ?? 0
            })),
            total: s.total ?? 0,
            discount_amount: s.discount_amount ?? 0,
            net_total: s.net_total ?? 0,
            customer_id: s.customer?.id ?? s.customer_id,
            is_stockless: s.is_stockless ?? false,
            related_service_id: s.related_service_id ?? null
        }));
    }, [salesData]);

    // --- Effectler ---
    useEffect(() => {
        const loadedSettings = getSettings();
        setSettings(loadedSettings);
        setIsBarcodeMode(loadedSettings.enableBarcodeMode);
    }, []);

    useEffect(() => {
        if (isBarcodeMode && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isBarcodeMode, cart]);

    useEffect(() => {
        if (customers.length > 0 && !customerId) {
            const gC = customers.find(c => c.name === "Genel Müşteri");
            if (gC) setCustomerId(gC.id);
        }
    }, [customers, customerId]);

    useEffect(() => {
        if (accounts.length > 0) {
            const currentSelectedAcc = accounts.find(a => a.id === selectedAccountId);
            if (!selectedAccountId || !currentSelectedAcc || currentSelectedAcc.type !== paymentMethod) {
                const defaultAcc = accounts.find(a => a.type === paymentMethod && a.is_default);
                const firstAcc = accounts.find(a => a.type === paymentMethod);
                if (defaultAcc || firstAcc) setSelectedAccountId((defaultAcc || firstAcc)!.id);
            }
        }
    }, [accounts, paymentMethod, selectedAccountId]);

    // --- Fonksiyonlar ---
    const deleteSaleAndReturnStockInternal = useCallback(async (saleId: string, isStocklessParam: boolean, items: CartItem[] | null | undefined) => {
        let stockReturnSuccess = true;
        const itemsToProcess = items ?? [];
        if (!isStocklessParam && itemsToProcess.length > 0) {
            const stockReturnPromises = itemsToProcess.filter(item => item.id && !item.id.startsWith('manual-')).map(async (item) => {
                try {
                    const { error } = await supabase.rpc('increment_product_quantity', { product_id_input: item.id, quantity_change: item.cartQuantity });
                    if (error) { console.error(`Stok iade hatası (rpc) ${item.id}:`, error); return { id: item.id, success: false, error }; }
                    return { id: item.id, success: true, error: null };
                } catch (e) { console.error(`Stok iade Exception ${item.id}:`, e); return { id: item.id, success: false, error: e }; }
            });
            const results = await Promise.all(stockReturnPromises);
            const failedReturns = results.filter(r => r && !r.success);
            if (failedReturns.length > 0) stockReturnSuccess = false;
            else await queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
        }
        const { error: saleDeleteError } = await supabase.from('sales').delete().eq('id', saleId);
        if (saleDeleteError) throw saleDeleteError;
        return stockReturnSuccess;
    }, [queryClient]);

    const handleDeleteSale = async (saleId: string) => {
        if (isProcessingSale || isLoadingSales) return;
        const saleToDelete = sales.find(s => s.id === saleId);
        if (!saleToDelete) return;
        if (!window.confirm(`"${new Date(saleToDelete.date).toLocaleString('tr-TR')}" tarihli satışı silmek istediğinize emin misiniz?`)) return;
        setIsProcessingSale(true);
        try {
            // 1. İlgili ödeme işlemini bul (Account Transaction üzerinden)
            const { data: accTxData } = await supabase.from('account_transactions').select('id, account_id, amount, related_customer_tx_id').eq('related_sale_id', saleId).maybeSingle();

            // 2. Hesaptan parayı düş ve işlemi sil
            if (accTxData) {
                // Customer Payment Transaction'ı sil (Eğer varsa)
                if (accTxData.related_customer_tx_id) {
                    await supabase.from('customer_transactions').delete().eq('id', accTxData.related_customer_tx_id);
                }

                // Account Transaction'ı sil
                await supabase.from('account_transactions').delete().eq('id', accTxData.id);

                // Bakiyeyi güncelle
                if (accTxData.account_id && accTxData.amount != null) {
                    await supabase.rpc('increment_account_balance', { account_id_input: accTxData.account_id, balance_change: -accTxData.amount });
                    await queryClient.invalidateQueries({ queryKey: ['accounts'], refetchType: 'all' });
                }
            }

            // 3. Müşteri Borç Kaydını (Charge) Sil
            // Charge işleminin ID'sini saklamadık ama CustomerID, Tarih ve Açıklama üzerinden bulabiliriz. 
            // Veya daha güvenlisi: Satış sırasında açıklama'ya SaleID'yi koymuştuk.
            // Description LIKE '%SaleID%' olanları sil.
            const dateOnly = new Date(saleToDelete.date).toISOString().split('T')[0];
            const { error: deleteChargeError } = await supabase.from('customer_transactions')
                .delete()
                .eq('customer_id', saleToDelete.customer_id)
                .eq('type', 'charge')
                .eq('date', dateOnly) // Tarih kontrolü de ekledik yanlışlık olmasın
                .ilike('description', `%${saleId.substring(0, 6)}%`);

            if (deleteChargeError) console.error("Borç kaydı silinirken hata:", deleteChargeError);

            // 4. Müşteri Borcunu Güncelle
            await supabase.rpc('update_customer_debt', { customer_id_input: saleToDelete.customer_id });

            // 5. Servis Bağlantısı Varsa Durumu Geri Al (Data Consistency Fix)
            if (saleToDelete.related_service_id) {
                const { error: serviceUpdateError } = await supabase
                    .from('services')
                    .update({ status: 'in_progress' }) // Servisi tekrar işleme al
                    .eq('id', saleToDelete.related_service_id);

                if (serviceUpdateError) {
                    console.error("Servis durumu güncellenemedi:", serviceUpdateError);
                    toast({ title: "Uyarı", description: "Satış silindi ancak servis durumu güncellenemedi.", variant: "default" });
                } else {
                    toast({ title: "Bilgi", description: "İlgili servis durumu 'İşlemde' olarak güncellendi." });
                }
            }

            const stockSuccess = await deleteSaleAndReturnStockInternal(saleId, saleToDelete.is_stockless, saleToDelete.items);
            await queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
            if (stockSuccess) toast({ title: "Başarılı", description: "Satış ve ilgili işlemler silindi." });
            else toast({ title: "Uyarı", description: "Satış silindi, stok iadesinde sorunlar olabilir.", variant: "destructive" });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
            toast({ title: "Hata", description: errorMessage, variant: "destructive" });
        } finally { setIsProcessingSale(false); }
    };

    const handleEditSaleClick = (sale: Sale) => { setEditingSale(sale); setIsEditDialogOpen(true); };
    const handleSaleUpdated = async () => { setIsEditDialogOpen(false); setEditingSale(null); await queryClient.invalidateQueries({ queryKey: ['sales'] }); await queryClient.invalidateQueries({ queryKey: ['accounts'] }); await queryClient.invalidateQueries({ queryKey: ['account_transactions'] }); };

    const addToCart = useCallback((product: Product | CartItem) => {
        if (isProcessingSale) return;
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            const availableStock = 'quantity' in product ? product.quantity : 0;
            const isManual = product.id && product.id.startsWith('manual-');
            if (existingItem) {
                if (!isStockless && !isManual && existingItem.cartQuantity >= availableStock) {
                    toast({ title: "Stok Sınırı", description: `Stokta sadece ${availableStock} adet var.`, variant: "destructive" });
                    return prevCart;
                }
                return prevCart.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
            } else {
                if (!isStockless && !isManual && availableStock <= 0) {
                    toast({ title: "Stok Yok", description: `"${product.name}" stokta tükenmiş.`, variant: "destructive" });
                    return prevCart;
                }
                return [...prevCart, { ...product, cartQuantity: 1, product_id: product.id || null, purchasePrice: product.purchase_price ?? 0, sellingPrice: product.selling_price ?? 0 }];
            }
        });
    }, [isStockless, toast, isProcessingSale]);

    const removeFromCart = useCallback((productId: string) => {
        if (isProcessingSale) return;
        setCart(p => {
            const ex = p.find(i => i.id === productId);
            if (ex && ex.cartQuantity > 1) return p.map(i => i.id === productId ? { ...i, cartQuantity: i.cartQuantity - 1 } : i);
            return p.filter(i => i.id !== productId);
        });
    }, [isProcessingSale]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (isBarcodeMode && searchTerm.trim()) {
                const exactMatch = products.find(p => p.code === searchTerm.trim());
                if (exactMatch) {
                    addToCart(exactMatch);
                    setSearchTerm("");
                    toast({ title: "Eklendi", description: `${exactMatch.name}`, duration: 1000 });
                } else {
                    toast({ title: "Bulunamadı", description: "Bu koda sahip ürün yok.", variant: "destructive" });
                    setSearchTerm("");
                }
            }
        }
    };

    const calculateTotal = useMemo(() => cart.reduce((t, i) => t + ((i.selling_price ?? 0) * i.cartQuantity), 0), [cart]);
    const calculateNetTotal = useMemo(() => Math.max(0, calculateTotal - (parseFloat(discountAmount) || 0)), [calculateTotal, discountAmount]);

    // Sepet veya indirim değişince alınan tutarı varsayılan olarak güncelle
    useEffect(() => {
        setReceivedAmount(calculateNetTotal.toString());
    }, [calculateNetTotal]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

    const handleCompleteSale = useCallback(async () => {
        if (cart.length === 0 || !customerId || !selectedAccountId || isProcessingSale) {
            toast({ title: "Eksik Bilgi", description: "Sepet boş veya hesap seçilmedi.", variant: "destructive" });
            return;
        }
        setIsProcessingSale(true);
        const netTotal = Math.max(0, cart.reduce((t, i) => t + ((i.selling_price ?? 0) * i.cartQuantity), 0) - (parseFloat(discountAmount) || 0));
        const discount = parseFloat(discountAmount) || 0;
        let saleId: string | null = null;

        try {
            if (!isStockless) {
                for (const item of cart) {
                    if (item.id && !item.id.startsWith('manual-')) {
                        const dbProd = products.find(p => p.id === item.id);
                        if (!dbProd || dbProd.quantity < item.cartQuantity) throw new Error(`${item.name} stok yetersiz.`);
                        const { error } = await supabase.rpc('increment_product_quantity', { product_id_input: item.id, quantity_change: -item.cartQuantity });
                        if (error) throw error;
                        checkAndAddNeed(item.id, item.name, dbProd.quantity - item.cartQuantity, dbProd.min_stock_level, toast);
                    }
                }
            }

            const now = new Date();
            const localISOTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();

            const saleData = {
                items: cart.map(i => ({ product_id: i.id?.startsWith('manual-') ? null : i.id, code: i.code || 'MANUEL', name: i.name, cartQuantity: i.cartQuantity, unit: i.unit, purchasePrice: i.purchase_price, sellingPrice: i.selling_price })),
                total: cart.reduce((t, i) => t + ((i.selling_price ?? 0) * i.cartQuantity), 0),
                discount_amount: discount,
                net_total: netTotal,
                customer_id: customerId,
                is_stockless: isStockless,
                date: localISOTime,
                related_service_id: null
            };

            const { data: savedSale, error: saleError } = await supabase.from('sales').insert(saleData).select('id').single();
            if (saleError) throw saleError;
            saleId = savedSale.id;

            // 1. Müşteriye BORÇ Ekle (Satış Tutarı Kadar) -> Transaction type: 'charge'
            // NOT: dateOnly formatı yyyy-MM-dd olmalı
            const dateOnly = localISOTime.split('T')[0];
            const { data: chargeTx, error: chargeError } = await supabase.from('customer_transactions').insert({
                customer_id: customerId,
                date: dateOnly,
                type: 'charge',
                amount: netTotal,
                description: `Satış: ${saleId?.substring(0, 6)} - Ürün Bedeli`
            }).select('id').single();
            if (chargeError) throw chargeError;

            // 2. Eğer ödeme alındıysa TAHSİLAT ve KASA Girişi Yap
            const paidAmount = parseFloat(receivedAmount) || 0;

            if (paidAmount > 0) {
                // A) Müşteriden Tahsilat Düş (Payment)
                const { data: paymentTx, error: paymentError } = await supabase.from('customer_transactions').insert({
                    customer_id: customerId,
                    date: dateOnly,
                    type: 'payment',
                    amount: -paidAmount,
                    description: `Tahsilat: Satış (${saleId?.substring(0, 6)})`
                }).select('id').single();

                if (paymentError) throw paymentError;

                // B) Kasaya/Bankaya Para Girişi
                const { data: accData } = await supabase.from('accounts').select('current_balance').eq('id', selectedAccountId).single();
                const newBalance = (accData?.current_balance ?? 0) + paidAmount;

                const { error: txError } = await supabase.from('account_transactions').insert({
                    date: localISOTime,
                    account_id: selectedAccountId,
                    type: 'sale_payment',
                    amount: paidAmount, // Sadece alınan tutar girer
                    balance_after: newBalance,
                    description: `Satış Tahsilatı: ${customers.find(c => c.id === customerId)?.name} (ID: ${saleId?.substring(0, 6)})`,
                    related_sale_id: saleId,
                    related_customer_tx_id: paymentTx.id // İlişki kur
                });
                if (txError) throw txError;

                await supabase.rpc('increment_account_balance', { account_id_input: selectedAccountId, balance_change: paidAmount });
            }

            // 3. Müşteri Toplam Borcunu Güncelle (Opsiyonel ama iyi olur)
            // Önceki görevde bunu dinamik yaptık ama veritabanındaki static alanı da güncel tutmak iyidir.
            await supabase.rpc('update_customer_debt', { customer_id_input: customerId }); // Varsa böyle bir rpc, yoksa manuel hesaplayabiliriz ya da şimdilik atlayabiliriz çünkü UI dinamik.
            // Manuel basit update
            try {
                const { data: allTxs } = await supabase.from('customer_transactions').select('amount').eq('customer_id', customerId);
                if (allTxs) {
                    const totalDebt = allTxs.reduce((sum, t) => sum + t.amount, 0);
                    await supabase.from('customers').update({ debt: totalDebt }).eq('id', customerId);
                }
            } catch (e) { console.error("Müşteri borç update hatası", e); }

            toast({ title: "Satış Tamamlandı", description: `Tutar: ${formatCurrency(netTotal)}` });

            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['accounts'] });
            await queryClient.invalidateQueries({ queryKey: ['products'] });
            setCart([]);
            setDiscountAmount("0");
            setIsStockless(false);
            if (isBarcodeMode && searchInputRef.current) searchInputRef.current.focus();

        } catch (error: any) {
            console.error(error);
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessingSale(false);
        }
    }, [cart, customerId, selectedAccountId, isProcessingSale, isStockless, discountAmount, receivedAmount, products, customers, toast, queryClient, isBarcodeMode]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'F2') { event.preventDefault(); handleCompleteSale(); } };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCompleteSale]);

    const handlePrintReceipt = (itemsToPrint: CartItem[], discount: number, total: number, dateStr?: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const width = settings.receiptPrinterWidth === '58mm' ? '58mm' : '80mm';
        const fontSize = settings.receiptPrinterWidth === '58mm' ? '10px' : '12px';
        const date = dateStr ? new Date(dateStr).toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR');
        const customerName = customers.find(c => c.id === customerId)?.name || 'Müşteri';
        const html = `<html><head><title>Fiş Yazdır</title><style>body{margin:0;padding:0;font-family:'Courier New',monospace;font-size:${fontSize};width:${width};}.header{text-align:center;margin-bottom:10px;}.title{font-weight:bold;font-size:1.2em;display:block;}.info{font-size:0.9em;}.divider{border-bottom:1px dashed #000;margin:5px 0;}.item-row{display:flex;justify-content:space-between;margin-bottom:2px;}.item-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%;}.totals{text-align:right;margin-top:10px;font-weight:bold;}.footer{text-align:center;margin-top:15px;font-size:0.8em;}@media print{@page{margin:0;}}</style></head><body><div class="header"><span class="title">${settings.companyName}</span><div class="info">${settings.companyAddress}</div><div class="info">Tel: ${settings.companyPhone}</div><div class="info">Tarih: ${date}</div><div class="info">Müşteri: ${customerName}</div></div><div class="divider"></div>${itemsToPrint.map(item => `<div class="item-row"><span class="item-name">${item.name}</span><span>${item.cartQuantity} x ${item.selling_price.toFixed(2)}</span></div>`).join('')}<div class="divider"></div><div class="totals">Top. Tutar: ${(total + discount).toFixed(2)}${settings.currencySymbol}<br/>${settings.showDiscountOnReceipt && discount > 0 ? `İndirim: -${discount.toFixed(2)}${settings.currencySymbol}<br/>` : ''}NET ÖDENEN: ${total.toFixed(2)}${settings.currencySymbol}</div><div class="footer">Mali Değeri Yoktur - Bilgi Fişi<br/>Teşekkürler, Yine Bekleriz.</div><script>window.onload=function(){window.print();window.close();}</script></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    // --- YENİ: GÜNCELLENMİŞ WHATSAPP MESAJI (FİŞ FORMATI) ---
    const handleSendWhatsapp = (sale: any) => {
        const customer = customers.find(c => c.id === sale.customer_id);
        if (!customer) { toast({ title: "Hata", description: "Müşteri bulunamadı.", variant: "destructive" }); return; }
        if (!customer.phone) { toast({ title: "Hata", description: "Müşterinin telefon numarası yok.", variant: "destructive" }); return; }

        // Yeni fonksiyona "sale" objesini tam olarak gönderiyoruz
        const message = generateSalesMessage(customer.name, sale);
        openWhatsApp(customer.phone, message);
    };

    const filteredProducts = useMemo(() => products.filter(p => (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))) && (isStockless || p.quantity > 0)), [products, searchTerm, isStockless]);
    const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'cash'), [accounts]);
    const posAccounts = useMemo(() => accounts.filter(a => a.type === 'pos'), [accounts]);
    const bankAccounts = useMemo(() => accounts.filter(a => a.type === 'bank'), [accounts]);

    return (
        <div className="h-full p-2 sm:p-4 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden border border-white/10 shadow-2xl">
                <div className="bg-white/5 border-b border-white/10 p-3 flex justify-between items-center flex-shrink-0 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <ShoppingCart className="h-5 w-5 text-blue-400" />
                        </div>
                        <h1 className="text-lg font-bold text-white tracking-tight">Satış Noktası (POS)</h1>
                    </div>
                    <Button variant="ghost" size="icon" className="hover:bg-red-500/20 hover:text-red-400 h-8 w-8 rounded-lg transition-colors" onClick={onClose} disabled={isProcessingSale}><X className="h-5 w-5" /></Button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-4">
                    <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
                        <div className="flex flex-col gap-3 p-3 bg-black/20 rounded-xl border border-white/5 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                        <Switch id="barcode-mode" checked={isBarcodeMode} onCheckedChange={setIsBarcodeMode} disabled={isProcessingSale} className="data-[state=checked]:bg-blue-500" />
                                        <Label htmlFor="barcode-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1 text-gray-300"><ScanBarcode className="h-3.5 w-3.5 text-blue-400" /> Barkod Modu</Label>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                        <Switch id="stockless-mode" checked={isStockless} onCheckedChange={(v) => { setIsStockless(v); setShowManualEntry(v); }} disabled={isProcessingSale} className="data-[state=checked]:bg-orange-500" />
                                        <Label htmlFor="stockless-mode" className="text-xs font-medium cursor-pointer text-gray-300">Stoksuz / Manuel</Label>
                                    </div>
                                </div>
                            </div>
                            {!showManualEntry ? (
                                <div className="relative group">
                                    <Input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder={isBarcodeMode ? "Barkod okutunuz... (Enter)" : "Ürün ara..."} className={`bg-black/40 border-white/10 text-white pl-10 h-11 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${isBarcodeMode ? 'border-blue-500/30 ring-1 ring-blue-500/20' : ''}`} disabled={isProcessingSale} autoFocus={isBarcodeMode} />
                                    {isBarcodeMode ? <ScanBarcode className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400 animate-pulse" /> : <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-black/40 p-2 rounded-lg border border-white/10">
                                    <Input placeholder="Ürün Adı" value={manualProduct.name} onChange={e => setManualProduct(p => ({ ...p, name: e.target.value }))} className="col-span-2 h-9 text-xs bg-white/5 border-white/10 text-white focus:border-blue-500/50" />
                                    <Input type="number" placeholder="Maliyet" value={manualProduct.purchase_price || ''} onChange={e => setManualProduct(p => ({ ...p, purchase_price: parseFloat(e.target.value) }))} className="h-9 text-xs bg-white/5 border-white/10 text-white focus:border-blue-500/50" />
                                    <Input type="number" placeholder="Satış Fiyatı" value={manualProduct.selling_price || ''} onChange={e => setManualProduct(p => ({ ...p, selling_price: parseFloat(e.target.value) }))} className="h-9 text-xs bg-white/5 border-white/10 text-white focus:border-blue-500/50" />
                                    <Button size="sm" onClick={() => {
                                        if (!manualProduct.name || !manualProduct.selling_price) return;
                                        addToCart({
                                            ...manualProduct,
                                            id: `manual-${Date.now()}`,
                                            code: 'MANUEL',
                                            cartQuantity: 1,
                                            purchasePrice: manualProduct.purchase_price || 0,
                                            sellingPrice: manualProduct.selling_price
                                        } as CartItem);
                                        setManualProduct({ name: '', selling_price: 0, purchase_price: 0, quantity: 1 });
                                    }} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /></Button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 bg-black/20 border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-0 shadow-inner">
                            <div className="bg-white/5 text-gray-300 text-xs font-semibold p-2 grid grid-cols-12 gap-2 sticky top-0 z-10 flex-shrink-0 border-b border-white/5">
                                <div className="hidden sm:block sm:col-span-2 pl-2">KOD</div>
                                <div className="col-span-7 sm:col-span-5">ÜRÜN ADI</div>
                                <div className="col-span-2 text-right">STOK</div>
                                <div className="col-span-2 text-right">FİYAT</div>
                                <div className="col-span-1 text-center">EKLE</div>
                            </div>
                            <ScrollArea className="flex-1">
                                {isLoadingProducts ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-400 h-8 w-8" /></div>
                                ) : (
                                    filteredProducts.map(p => (
                                        <div key={p.id} className="grid grid-cols-12 gap-2 p-2 border-b border-white/5 text-xs hover:bg-white/5 items-center transition-colors group">
                                            <div className="hidden sm:block sm:col-span-2 truncate font-mono text-gray-400 group-hover:text-gray-200">{p.code}</div>
                                            <div className="col-span-7 sm:col-span-5 truncate font-medium text-gray-200 group-hover:text-white">{p.name}</div>
                                            <div className={`col-span-2 text-right font-mono ${p.quantity <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{p.quantity}</div>
                                            <div className="col-span-2 text-right font-bold text-blue-400 font-mono">{formatCurrency(p.selling_price ?? 0)}</div>
                                            <div className="col-span-1 text-center">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-md" onClick={() => addToCart(p)} disabled={!isStockless && p.quantity <= 0}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </ScrollArea>
                        </div>
                    </div>

                    <div className="w-full md:w-[400px] flex flex-col gap-3 flex-shrink-0 h-full overflow-hidden">
                        <div className="flex-shrink-0 bg-black/20 p-3 rounded-xl border border-white/5">
                            <Label className="text-xs font-medium mb-1.5 block text-gray-400">Müşteri Seçimi</Label>
                            <Select value={customerId} onValueChange={setCustomerId} disabled={isProcessingSale}>
                                <SelectTrigger className="h-10 text-sm bg-white/5 border-white/10 text-white focus:ring-blue-500/50">
                                    <SelectValue placeholder="Müşteri Seçiniz..." />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                    {customers.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-gray-800 focus:text-white">{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1 bg-black/20 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden shadow-inner relative">
                            <div className="bg-white/5 p-3 border-b border-white/5 text-xs font-bold flex justify-between items-center flex-shrink-0">
                                <span className="text-gray-300 flex items-center gap-2"><ShoppingCart className="h-3.5 w-3.5" /> Sepet ({cart.length})</span>
                                <span className="text-red-400 cursor-pointer hover:text-red-300 transition-colors text-[10px] uppercase tracking-wider" onClick={() => setCart([])}>Temizle</span>
                            </div>
                            <ScrollArea className="flex-1 p-2">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 opacity-50">
                                        <ShoppingCart className="h-12 w-12 stroke-1" />
                                        <span className="text-xs">Sepetiniz boş</span>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-white/5 mb-2 p-2 rounded-lg border border-white/5 group hover:border-white/10 transition-all">
                                            <div className="flex-1 truncate pr-2">
                                                <div className="font-medium text-white text-sm">{item.name}</div>
                                                <div className="text-gray-400 text-xs font-mono">{formatCurrency(item.selling_price)} x {item.cartQuantity}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-blue-400 font-mono text-sm">{formatCurrency(item.selling_price * item.cartQuantity)}</span>
                                                <div className="flex items-center bg-black/20 rounded-md border border-white/5">
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400 rounded-l-md" onClick={() => removeFromCart(item.id)}><Minus className="h-3 w-3" /></Button>
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-green-500/20 hover:text-green-400 rounded-r-md" onClick={() => addToCart(item)}><Plus className="h-3 w-3" /></Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </ScrollArea>
                            <div className="p-4 bg-black/40 border-t border-white/10 flex-shrink-0 backdrop-blur-sm">
                                <div className="flex justify-between text-xs mb-2 text-gray-400"><span>Ara Toplam:</span><span className="font-mono">{formatCurrency(calculateTotal)}</span></div>
                                <div className="flex justify-between items-center text-xs mb-3">
                                    <span className="flex items-center gap-1 text-gray-400"><Tag className="h-3 w-3" /> İndirim:</span>
                                    <Input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="h-7 w-24 text-right bg-white/5 border-white/10 text-white text-xs focus:border-blue-500/50" />
                                </div>
                                <div className="flex justify-between items-center text-xs mb-3">
                                    <span className="flex items-center gap-1 text-gray-400"><Banknote className="h-3 w-3" /> Alınan:</span>
                                    <Input
                                        type="number"
                                        value={receivedAmount}
                                        onChange={e => setReceivedAmount(e.target.value)}
                                        className={cn("h-7 w-24 text-right bg-white/5 border-white/10 text-white text-xs focus:border-blue-500/50",
                                            parseFloat(receivedAmount) < calculateNetTotal ? "text-red-400 border-red-500/30" : "text-emerald-400"
                                        )}
                                    />
                                </div>
                                <div className="flex justify-between text-xs mb-1 text-gray-500">
                                    <span>Kalan Borç:</span>
                                    <span className="font-mono">{formatCurrency(Math.max(0, calculateNetTotal - (parseFloat(receivedAmount) || 0)))}</span>
                                </div>
                                <div className="flex justify-between items-end border-t border-white/10 pt-3">
                                    <span className="text-sm font-medium text-gray-300">GENEL TOPLAM</span>
                                    <span className="text-2xl font-bold text-blue-400 neon-text font-mono">{formatCurrency(calculateNetTotal)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex-shrink-0 space-y-3">
                            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex gap-2">
                                <div className={`flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 flex-1 justify-center cursor-pointer transition-all ${paymentMethod === 'cash' ? 'bg-blue-500/20 border-blue-500/50' : 'hover:bg-white/10'}`}>
                                    <RadioGroupItem value="cash" id="r-cash" className="border-white/20 text-blue-500" />
                                    <Label htmlFor="r-cash" className="cursor-pointer text-xs font-medium text-white"><Banknote className="inline h-3.5 w-3.5 mr-1.5" />Nakit</Label>
                                </div>
                                <div className={`flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 flex-1 justify-center cursor-pointer transition-all ${paymentMethod === 'pos' ? 'bg-blue-500/20 border-blue-500/50' : 'hover:bg-white/10'}`}>
                                    <RadioGroupItem value="pos" id="r-pos" className="border-white/20 text-blue-500" />
                                    <Label htmlFor="r-pos" className="cursor-pointer text-xs font-medium text-white"><TerminalSquare className="inline h-3.5 w-3.5 mr-1.5" />POS</Label>
                                </div>
                                <div className={`flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 flex-1 justify-center cursor-pointer transition-all ${paymentMethod === 'bank' ? 'bg-blue-500/20 border-blue-500/50' : 'hover:bg-white/10'}`}>
                                    <RadioGroupItem value="bank" id="r-bank" className="border-white/20 text-blue-500" />
                                    <Label htmlFor="r-bank" className="cursor-pointer text-xs font-medium text-white"><Landmark className="inline h-3.5 w-3.5 mr-1.5" />Havale</Label>
                                </div>
                            </RadioGroup>

                            <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isProcessingSale}>
                                <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Hesap Seçin..." />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                    {(paymentMethod === 'pos' ? posAccounts : paymentMethod === 'bank' ? bankAccounts : cashAccounts).map(acc => (<SelectItem key={acc.id} value={acc.id} className="focus:bg-gray-800 focus:text-white">{acc.name}</SelectItem>))}
                                </SelectContent>
                            </Select>

                            <div className="flex gap-2">
                                <Button className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white h-12 font-bold text-base shadow-lg shadow-green-900/20 border-0 rounded-lg transition-all" onClick={handleCompleteSale} disabled={cart.length === 0 || isProcessingSale}>
                                    {isProcessingSale ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="mr-2 h-5 w-5" />} SATIŞI BİTİR (F2)
                                </Button>
                                <Button className="w-12 bg-white/10 hover:bg-white/20 text-white h-12 border border-white/10 rounded-lg" disabled={true} title="Önce Satışı Tamamla"><MessageCircle className="h-5 w-5" /></Button>
                                <Button className="w-12 bg-white/10 hover:bg-white/20 text-white h-12 border border-white/10 rounded-lg" disabled={cart.length === 0} onClick={() => handlePrintReceipt(cart, parseFloat(discountAmount), calculateNetTotal)} title="Fiş Yazdır"><Receipt className="h-5 w-5" /></Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-[200px] border-t border-white/10 bg-black/20 p-2 flex flex-col flex-shrink-0 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 px-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                            <PackageCheck className="h-4 w-4 text-blue-400" />
                            <span>Geçmiş Satışlar</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-7 w-auto text-xs bg-white/5 border-white/10 text-white" />
                            <span className="text-gray-500">-</span>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-7 w-auto text-xs bg-white/5 border-white/10 text-white" />
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => queryClient.invalidateQueries({ queryKey: ['sales'] })}>Yenile</Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-white/5 border border-white/5 rounded-lg overflow-y-auto overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-white/5 text-gray-300 sticky top-0 z-20 backdrop-blur-md">
                                <tr>
                                    <th className="text-left pl-3 py-2 w-[120px] font-medium">Tarih</th>
                                    <th className="text-left py-2 w-[150px] font-medium">Müşteri</th>
                                    <th className="text-left py-2 font-medium">Ürünler</th>
                                    <th className="text-right pr-3 py-2 w-[100px] font-medium">Tutar</th>
                                    <th className="text-center py-2 w-[120px] font-medium">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sales.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">Bu tarih aralığında satış bulunamadı.</td></tr>
                                ) : (
                                    sales.map(s => (
                                        <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="pl-3 py-2 whitespace-nowrap text-gray-400 font-mono">{new Date(s.date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="py-2 text-gray-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={customers.find(c => c.id === s.customer_id)?.name}>{customers.find(c => c.id === s.customer_id)?.name}</td>
                                            <td className="py-2 text-gray-500 group-hover:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]" title={s.items.map(i => `${i.name} (${i.cartQuantity})`).join(', ')}>{s.items.map(i => i.name).join(', ')}</td>
                                            <td className="text-right pr-3 font-bold py-2 text-emerald-400 font-mono">
                                                {(() => {
                                                    // @ts-ignore - account_transactions useSales ile geliyor
                                                    const paid = s.account_transactions?.[0]?.amount;
                                                    if (paid !== undefined && paid !== s.net_total) {
                                                        return (
                                                            <div className="flex flex-col items-end leading-tight">
                                                                <span className="text-emerald-400">{formatCurrency(paid)}</span>
                                                                <span className="text-[10px] text-gray-500 line-through decoration-gray-500">{formatCurrency(s.net_total)}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return formatCurrency(s.net_total);
                                                })()}
                                            </td>
                                            <td className="text-center py-2 flex justify-center gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-green-500/20 text-gray-500 hover:text-green-400 rounded-md transition-colors" onClick={() => handleSendWhatsapp(s)} title="WhatsApp Fiş Gönder"><MessageCircle className="h-3.5 w-3.5" /></Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 rounded-md transition-colors" onClick={() => handleEditSaleClick(s)} title="Düzenle"><Edit className="h-3.5 w-3.5" /></Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-md transition-colors" onClick={() => handleDeleteSale(s.id)} title="Sil"><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isEditDialogOpen && editingSale && (<EditSaleDialog isOpen={isEditDialogOpen} setIsOpen={setIsEditDialogOpen} saleToEdit={editingSale} onSaleUpdated={handleSaleUpdated} customers={customers} accounts={accounts} />)}
        </div>
    );
};

export default SalesModule;
// --- END OF FILE src/components/SalesModule.tsx ---