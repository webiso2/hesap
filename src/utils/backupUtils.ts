// --- START OF FILE src/utils/backupUtils.ts ---

import { supabase, checkSupabaseConnection as checkSupabaseConnectionClient } from "@/integrations/supabase/client";
// Tipleri backup.ts'den alıyoruz
import type {
    BackupData, BackupRecord, Customer, Product, Sale, CashTransaction, Need, Service,
    CustomerTransaction, Account, AccountTransaction, Wholesaler, WholesalerTransaction,
    PurchaseInvoice // Tüm tiplerin burada olduğundan emin olun
} from "@/types/backup.ts";

export const BUCKET_NAME = 'backups'; // Supabase'deki bucket adınızla eşleşmeli

// Validate BackupData - Yeni tabloları da kontrol et
export const validateBackupData = (data: any): data is BackupData => {
  if (typeof data !== 'object' || data === null || typeof data.timestamp !== 'string') return false;
  const checkArrayOrNull = (key: keyof BackupData) => data[key] === undefined || data[key] === null || Array.isArray(data[key]);
  return checkArrayOrNull('customers') &&
         checkArrayOrNull('accounts') &&
         checkArrayOrNull('expense_categories') && // expense_categories eklendi (varsa)
         checkArrayOrNull('products') &&
         checkArrayOrNull('needs') &&
         checkArrayOrNull('services') &&
         checkArrayOrNull('sales') &&
         checkArrayOrNull('customer_transactions') &&
         checkArrayOrNull('account_transactions') &&
         checkArrayOrNull('wholesalers') &&             // Eklendi
         checkArrayOrNull('wholesaler_transactions') && // Eklendi
         checkArrayOrNull('purchase_invoices') &&       // Eklendi
         checkArrayOrNull('cashTransactions');          // Eski nakit (varsa)
};

// safeParseJSON (Değişiklik yok)
export const safeParseJSON = (jsonString: string | null): any => { if (!jsonString) return null; try { return JSON.parse(jsonString); } catch (error) { console.error("JSON parse hatası:", error); return null; } };

// Supabase'den Yedek Verisi Oluşturma (Yeni tablolar eklendi)
export const createBackupDataFromSupabase = async (): Promise<BackupData | null> => {
    console.log("Supabase'den yedek verisi oluşturuluyor..."); const timestamp = new Date().toISOString();
    let backupData: Partial<BackupData> = { timestamp };

    // Yedeklenecek Tabloların Listesi (Yeni tablolar eklendi)
    const tablesToBackup: (keyof Omit<BackupData, 'timestamp'>)[] = [
        'customers',                // Bağımsız
        'accounts',                 // Bağımsız
        'expense_categories',       // Bağımsız (varsa)
        'products',                 // Bağımsız
        'wholesalers',              // Bağımsız
        'needs',                    // products, customers bağlı
        'services',                 // customers bağlı
        'sales',                    // customers, products bağlı
        'purchase_invoices',        // wholesalers, products bağlı
        'customer_transactions',    // customers bağlı
        'wholesaler_transactions',  // wholesalers, purchase_invoices, account_transactions bağlı
        'account_transactions',     // accounts, sales, services, customer_transactions, wholesaler_transactions bağlı
        'cashTransactions'          // Eski nakit (varsa)
    ];

    try {
        for (const tableName of tablesToBackup) {
            console.log(`Çekiliyor: ${tableName}...`);
            const supabaseTableName = tableName === 'cashTransactions' ? 'cash_transactions' : tableName;
            const { data, error } = await supabase.from(supabaseTableName).select('*');
            if (error) {
                // expense_categories yoksa hatayı görmezden gel (opsiyonel)
                if (tableName === 'expense_categories' && error.code === '42P01') { // '42P01' undefined_table
                    console.warn("expense_categories tablosu bulunamadı, yedeklemede atlanıyor.");
                    backupData[tableName] = null; // veya undefined bırak
                    continue;
                }
                // cash_transactions yoksa hatayı görmezden gel (opsiyonel)
                 if (tableName === 'cashTransactions' && error.code === '42P01') {
                     console.warn("cash_transactions tablosu bulunamadı, yedeklemede atlanıyor.");
                     backupData[tableName] = null;
                     continue;
                 }
                console.error(`Tablo çekme hatası (${supabaseTableName}):`, error);
                throw new Error(`'${supabaseTableName}' tablosu yedeklenemedi: ${error.message}`);
            } else {
                console.log(`${supabaseTableName}: ${data?.length||0} kayıt bulundu.`);
                // JOIN artıklarını temizle
                if (data) {
                    data.forEach((row: any) => {
                         delete row.customer;
                         delete row.account;
                         // Gerekirse diğer join artıkları da silinebilir
                     });
                }
                backupData[tableName] = data ?? null;
            }
        }
        console.log("Tüm tablolar çekildi.");
        return backupData as BackupData;
    } catch (error: any) {
         console.error("Yedek oluşturulurken genel hata:", error);
         return null;
    }
};


// saveToLocalStorage (Değişiklik yok, sadece Supabase'e yazılıyor)
export const saveToLocalStorage = (data: BackupData): boolean => {
    // ... (Bu fonksiyonun Supabase geri yükleme ile doğrudan ilgisi yok) ...
    console.warn("saveToLocalStorage çağrıldı, ancak geri yükleme artık Supabase üzerinden yapılıyor.");
    return true; // Veya eski işlevselliği koruyun
};


// Storage Fonksiyonları (Değişiklik yok)
export const uploadBackupToStorage = async (backupData: BackupData, filename: string): Promise<{ storagePath: string | null; error: Error | null }> => { /* ... önceki kod ... */
    try { const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }); const filePath = `${filename}`; const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, blob, { upsert: true }); if (error) throw error; const path = data?.path; if (!path) throw new Error("Storage upload başarılı ancak path alınamadı."); return { storagePath: path, error: null }; } catch (e: any) { const errorMessage = e instanceof Error ? e.message : String(e); return { storagePath: null, error: new Error(`Storage yükleme hatası: ${errorMessage}`) }; }
};
export const addBackupMetadata = async (filename: string, storagePath: string): Promise<{ error: Error | null }> => { /* ... önceki kod ... */
    try { if (!storagePath) throw new Error("Storage path eksik."); const { error } = await supabase.from('backups').insert({ filename: filename, storage_path: storagePath }); if (error) throw error; return { error: null }; } catch (e: any) { const errorMessage = e instanceof Error ? e.message : String(e); return { error: new Error(`Meta veri eklenemedi: ${errorMessage}`) }; }
};
export const downloadBackupFromStorage = async (storagePath: string): Promise<{ data: BackupData | null; error: Error | null }> => { /* ... önceki kod ... */
    try { const { data: blob, error } = await supabase.storage.from(BUCKET_NAME).download(storagePath); if (error) throw error; if (!blob) throw new Error("İndirilen veri (blob) boş."); const text = await blob.text(); const jsonData = safeParseJSON(text); if (!validateBackupData(jsonData)) { throw new Error("Geçersiz yedek formatı."); } return { data: jsonData as BackupData, error: null }; } catch (e: any) { const errorMessage = e instanceof Error ? e.message : String(e); return { data: null, error: new Error(`Storage indirme hatası: ${errorMessage}`) }; }
};


// Supabase Geri Yükleme (Sıralama ve Filtreleme GÜNCELLENDİ)
export const restoreBackupToSupabase = async (backupData: BackupData): Promise<{ success: boolean; error: Error | null }> => {
    console.log("[restoreBackupToSupabase] Başladı...");

    // Silme Sırası (Güncellendi): Bağımlılıkları olanlar (çocuklar) önce silinmeli
    const tablesToDeleteOrder = [
        'wholesaler_transactions',  // account_transactions ve purchase_invoices'a bağlı
        'customer_transactions',    // account_transactions'a bağlı
        'account_transactions',     // sales, services vb. bağlı
        'purchase_invoices',        // wholesalers, products bağlı
        'sales',                    // customers, products bağlı
        'services',                 // customers bağlı
        'needs',                    // products, customers bağlı
        'cash_transactions',        // Eski nakit (varsa)
        'products',                 // Temel
        'wholesalers',              // Temel
        'accounts',                 // Temel
        'customers',                // Temel
        'expense_categories'        // Temel (varsa)
    ];

    // Ekleme Sırası (Güncellendi): Bağımsızlar ve temeller (ebeveynler) önce eklenmeli
    const tablesToInsertOrder = [
        'customers',                // Temel
        'accounts',                 // Temel
        'expense_categories',       // Temel (varsa)
        'products',                 // Temel
        'wholesalers',              // Temel
        'cash_transactions',        // Eski nakit (varsa)
        'needs',                    // products, customers bağlı
        'services',                 // customers bağlı
        'sales',                    // customers, products bağlı
        'purchase_invoices',        // wholesalers, products bağlı
        'account_transactions',     // <--- ÖNCE KASA İŞLEMLERİ (Transaction'ların temeli)
        'customer_transactions',    // customers, account_transactions bağlı
        'wholesaler_transactions'   // wholesalers, purchase_invoices, account_transactions bağlı
    ];

    // Yedekteki geçerli ID'leri topla (Yeni tablolar eklendi)
    const validCustomerIds = new Set<string>(); backupData.customers?.forEach((c: any) => { if (c?.id) validCustomerIds.add(c.id); });
    const validAccountIds = new Set<string>(); backupData.accounts?.forEach((a: any) => { if (a?.id) validAccountIds.add(a.id); });
    const validProductIds = new Set<string>(); backupData.products?.forEach((p: any) => { if (p?.id) validProductIds.add(p.id); });
    const validWholesalerIds = new Set<string>(); backupData.wholesalers?.forEach((w: any) => { if (w?.id) validWholesalerIds.add(w.id); });
    const validSaleIds = new Set<string>(); backupData.sales?.forEach((s: any) => { if (s?.id) validSaleIds.add(s.id); });
    const validServiceIds = new Set<string>(); backupData.services?.forEach((s: any) => { if (s?.id) validServiceIds.add(s.id); });
    const validAccountTxIds = new Set<string>(); backupData.account_transactions?.forEach((at: any) => { if (at?.id) validAccountTxIds.add(at.id); }); // Eklendi
    const validCustomerTxIds = new Set<string>(); backupData.customer_transactions?.forEach((ct: any) => { if (ct?.id) validCustomerTxIds.add(ct.id); });
    const validPurchaseInvoiceIds = new Set<string>(); backupData.purchase_invoices?.forEach((pi: any) => { if (pi?.id) validPurchaseInvoiceIds.add(pi.id); });
    const validWholesalerTxIds = new Set<string>(); backupData.wholesaler_transactions?.forEach((wt: any) => { if (wt?.id) validWholesalerTxIds.add(wt.id); });
    const validExpenseCategoryIds = new Set<string>(); backupData.expense_categories?.forEach((ec: any) => { if (ec?.id) validExpenseCategoryIds.add(ec.id); });


    console.log(`Yedekten ${validCustomerIds.size} Müşteri, ${validAccountIds.size} Hesap, ${validProductIds.size} Ürün, ${validWholesalerIds.size} Toptancı ID'si bulundu.`);

    // === Ön Kontroller (Genişletildi) ===
    const checkFK = (dataArray: any[] | null | undefined, fkField: string, validIds: Set<string>, tableName: string, fkName: string): boolean => {
        if (!dataArray) return true; // Veri yoksa sorun yok
        return dataArray.every((item: any) => {
            const fkValue = item[fkField];
            const isValid = !fkValue || validIds.has(fkValue); // FK boş olabilir veya geçerli ID setinde olmalı
            if (!isValid) console.error(`[restoreBackupToSupabase] Yedek tutarsız: ${tableName} tablosundaki ${fkName} (${fkValue}) geçersiz.`);
            return isValid;
        });
    }

    if (!checkFK(backupData.services, 'customer_id', validCustomerIds, 'services', 'customer_id') ||
        !checkFK(backupData.sales, 'customer_id', validCustomerIds, 'sales', 'customer_id') ||
        !checkFK(backupData.customer_transactions, 'customer_id', validCustomerIds, 'customer_transactions', 'customer_id') ||
        !checkFK(backupData.customer_transactions, 'related_account_tx_id', validAccountTxIds, 'customer_transactions', 'related_account_tx_id') || // Eklendi
        !checkFK(backupData.needs, 'customer_id', validCustomerIds, 'needs', 'customer_id') ||
        !checkFK(backupData.needs, 'product_id', validProductIds, 'needs', 'product_id') ||
        !checkFK(backupData.purchase_invoices, 'wholesaler_id', validWholesalerIds, 'purchase_invoices', 'wholesaler_id') ||
        !checkFK(backupData.wholesaler_transactions, 'wholesaler_id', validWholesalerIds, 'wholesaler_transactions', 'wholesaler_id') ||
        !checkFK(backupData.wholesaler_transactions, 'related_purchase_invoice_id', validPurchaseInvoiceIds, 'wholesaler_transactions', 'related_purchase_invoice_id') ||
        !checkFK(backupData.wholesaler_transactions, 'related_account_tx_id', validAccountTxIds, 'wholesaler_transactions', 'related_account_tx_id') || // Eklendi
        !checkFK(backupData.account_transactions, 'account_id', validAccountIds, 'account_transactions', 'account_id') ||
        !checkFK(backupData.account_transactions, 'related_sale_id', validSaleIds, 'account_transactions', 'related_sale_id') ||
        !checkFK(backupData.account_transactions, 'related_service_id', validServiceIds, 'account_transactions', 'related_service_id') ||
        !checkFK(backupData.account_transactions, 'related_customer_tx_id', validCustomerTxIds, 'account_transactions', 'related_customer_tx_id') ||
        !checkFK(backupData.account_transactions, 'related_wholesaler_transaction_id', validWholesalerTxIds, 'account_transactions', 'related_wholesaler_transaction_id') ||
        !checkFK(backupData.account_transactions, 'expense_category_id', validExpenseCategoryIds, 'account_transactions', 'expense_category_id')
       )
     {
        return { success: false, error: new Error("Yedek dosyası ilişkisel olarak tutarsız. Konsol loglarını kontrol edin.") };
    }
    console.log("[restoreBackupToSupabase] İlişkisel ön kontrol başarılı.");
    // === Ön Kontroller Bitti ===


    try {
        // 1. Mevcut Verileri Sil (Doğru sırada)
        console.log("[restoreBackupToSupabase] Mevcut veriler siliniyor...");
        for (const tn of tablesToDeleteOrder) {
            const supabaseTableName = tn === 'cashTransactions' ? 'cash_transactions' : tn;
            // Tablonun var olup olmadığını kontrol et (opsiyonel ama daha sağlam)
             const { error: checkTableError } = await supabase.from(supabaseTableName).select('id', { head: true, count: 'exact' }).limit(0);
             if (checkTableError && checkTableError.code === '42P01') { // '42P01' undefined_table
                 console.warn(`${supabaseTableName} tablosu bulunamadı, silme işlemi atlanıyor.`);
                 continue; // Sonraki tabloya geç
             } else if (checkTableError) {
                 // Başka bir hata varsa fırlat
                  throw new Error(`Tablo kontrol hatası (${supabaseTableName}): ${checkTableError.message}`);
             }

            console.log(`Siliniyor: ${supabaseTableName}...`);
            const { error: dE } = await supabase.from(supabaseTableName).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Tümünü sil
            if (dE) {
                console.error(`${supabaseTableName} silme hatası:`, dE);
                throw new Error(`Tablo boşaltılamadı (${supabaseTableName}): ${dE.message}`);
            }
        }
        console.log("[restoreBackupToSupabase] Tüm mevcut tablolar boşaltıldı.");

        // 2. Yedekten Verileri Ekle (Doğru sırada ve ID'leri koruyarak)
        console.log("[restoreBackupToSupabase] Yedekten veriler ekleniyor...");
        for (const tableName of tablesToInsertOrder) {
            const supabaseTableName = tableName === 'cashTransactions' ? 'cash_transactions' : tableName;
            let tableData = backupData[tableName as keyof BackupData];

            if (tableData && Array.isArray(tableData) && tableData.length > 0) {
                 // Tablonun var olup olmadığını kontrol et (ekleme için)
                const { error: checkTableError } = await supabase.from(supabaseTableName).select('id', { head: true, count: 'exact' }).limit(0);
                if (checkTableError && checkTableError.code === '42P01') {
                    console.warn(`${supabaseTableName} tablosu bulunamadı, ekleme işlemi atlanıyor.`);
                    continue;
                } else if (checkTableError) {
                    throw new Error(`Tablo kontrol hatası (${supabaseTableName}): ${checkTableError.message}`);
                }

                console.log(`Ekleniyor: ${supabaseTableName} (${tableData.length} kayıt)...`);

                // JOIN artıklarını temizle ve FK filtrelemesi yap (ön kontrole ek olarak burada da yapalım)
                let dataToInsert = tableData
                    .map((item: any) => {
                        const cleanItem = { ...item };
                        delete cleanItem.customer; delete cleanItem.account; // Örnek join artıkları
                        return cleanItem;
                    })
                    .filter((item: any) => { // FK Filtreleme
                        if (tableName === 'needs') return (!item.product_id || validProductIds.has(item.product_id)) && (!item.customer_id || validCustomerIds.has(item.customer_id));
                        if (tableName === 'services') return !item.customer_id || validCustomerIds.has(item.customer_id);
                        if (tableName === 'sales') return !item.customer_id || validCustomerIds.has(item.customer_id); // products items içinde kontrol edilir
                        if (tableName === 'purchase_invoices') return (!item.wholesaler_id || validWholesalerIds.has(item.wholesaler_id)); // products items içinde kontrol edilir
                        if (tableName === 'customer_transactions') return !item.customer_id || validCustomerIds.has(item.customer_id);
                        if (tableName === 'wholesaler_transactions') return (!item.wholesaler_id || validWholesalerIds.has(item.wholesaler_id)) && (!item.related_purchase_invoice_id || validPurchaseInvoiceIds.has(item.related_purchase_invoice_id));
                        if (tableName === 'account_transactions') return (!item.account_id || validAccountIds.has(item.account_id)) && (!item.related_sale_id || validSaleIds.has(item.related_sale_id)) && (!item.related_service_id || validServiceIds.has(item.related_service_id)) && (!item.related_customer_tx_id || validCustomerTxIds.has(item.related_customer_tx_id)) && (!item.related_wholesaler_transaction_id || validWholesalerTxIds.has(item.related_wholesaler_transaction_id)) && (!item.expense_category_id || validExpenseCategoryIds.has(item.expense_category_id));
                        return true; // Diğer tablolar için filtre yok
                    });


                if (dataToInsert.length < tableData.length) {
                    console.warn(`[restoreBackupToSupabase] ${supabaseTableName}: ${tableData.length - dataToInsert.length} kayıt FK filtrelemesi nedeniyle atlandı.`);
                }

                if (dataToInsert.length > 0) {
                    // Büyük veri setlerini parçalara ayırarak ekleme (örneğin 500'lük)
                    const chunkSize = 500;
                    for (let i = 0; i < dataToInsert.length; i += chunkSize) {
                        const chunk = dataToInsert.slice(i, i + chunkSize);
                        console.log(` -> ${supabaseTableName} - Chunk ${i / chunkSize + 1} ekleniyor (${chunk.length} kayıt)...`);
                        const { error: insertError } = await supabase.from(supabaseTableName).insert(chunk);
                        if (insertError) {
                            console.error(`${supabaseTableName} chunk ekleme hatası:`, insertError);
                            // Hatanın detayını göstermeye çalış
                             let detail = insertError.details;
                             try { if (detail && typeof detail === 'string') detail = JSON.parse(detail).detail } catch (e) {} // Postgres hatasını parse etmeye çalış
                            throw new Error(`Veri eklenemedi (${supabaseTableName}): ${insertError.message} ${detail ? `(${detail})` : ''}`);
                        }
                    }
                     console.log(`[restoreBackupToSupabase] ${supabaseTableName}: Toplam ${dataToInsert.length} kayıt eklendi.`);
                } else {
                    console.log(`Atlanıyor: ${supabaseTableName} (Filtreleme sonrası veya yedekte kayıt yok)`);
                }
            } else {
                console.log(`Atlanıyor: ${tableName} (Yedekte veri yok veya boş)`);
            }
        }
        console.log("[restoreBackupToSupabase] Tüm veriler başarıyla eklendi.");
        return { success: true, error: null };
    } catch (error: any) {
        console.error("[restoreBackupToSupabase] Supabase geri yükleme hatası:", error);
        return { success: false, error };
    }
};

export const checkSupabaseConnection = checkSupabaseConnectionClient;

// --- END OF FILE src/utils/backupUtils.ts ---