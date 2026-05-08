import React, { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { TrendingUp, Users, Package, AlertTriangle, DollarSign, ShoppingCart, Activity, Database, BarChart3, Calculator } from 'lucide-react';
import { useSales, useAccountTransactions, useProducts, useCustomers } from '@/hooks/useAppData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

interface DashboardProps {
    onModuleSelect?: (module: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onModuleSelect }) => {
    const today = new Date();
    // Son 7 günü kapsayacak şekilde başlangıç tarihi (Bugün dahil 7 gün)
    const startDate = format(subDays(today, 6), 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');

    // Verileri çek (Son 7 gün)
    const { data: salesData, isLoading: isLoadingSales } = useSales(startDate, endDate);
    const { data: transactionsData, isLoading: isLoadingTransactions } = useAccountTransactions(startDate, endDate);
    const { data: productsData, isLoading: isLoadingProducts } = useProducts();
    const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();

    // İstatistikler
    const stats = useMemo(() => {
        const todayStr = format(today, 'yyyy-MM-dd');

        // Sadece bugünün satışlarını filtrele
        const totalSalesToday = (salesData || [])
            .filter(s => format(new Date(s.date), 'yyyy-MM-dd') === todayStr)
            .reduce((acc, sale) => acc + (sale.net_total || 0), 0);

        const totalIncomeToday = (transactionsData || [])
            .filter(t => format(new Date(t.date), 'yyyy-MM-dd') === todayStr)
            .filter(t => t.amount > 0 && t.type !== 'transfer_in' && t.type !== 'initial_balance')
            .reduce((acc, t) => acc + t.amount, 0);

        const criticalStockCount = (productsData || []).filter(p => p.quantity <= p.min_stock_level).length;
        const totalCustomers = (customersData || []).length;

        return {
            totalSalesToday,
            totalIncomeToday,
            criticalStockCount,
            totalCustomers
        };
    }, [salesData, transactionsData, productsData, customersData]);

    // Grafik Verisi Hazırlama
    const chartData = useMemo(() => {
        if (!salesData) return [];
        const dailyMap = new Map<string, number>();

        // Son 7 günü 0 olarak başlat
        for (let i = 6; i >= 0; i--) {
            const d = subDays(today, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            dailyMap.set(dateStr, 0);
        }

        // Satışları günlere dağıt
        salesData.forEach(sale => {
            const dateStr = format(new Date(sale.date), 'yyyy-MM-dd');
            if (dailyMap.has(dateStr)) {
                dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + sale.net_total);
            }
        });

        // Grafik formatına çevir
        return Array.from(dailyMap.entries()).map(([date, total]) => ({
            name: format(new Date(date), 'd MMM', { locale: tr }),
            total: total,
            date: date
        }));
    }, [salesData]);

    // Son İşlemler (Sadece bugün)
    const recentSales = useMemo(() => {
        const todayStr = format(today, 'yyyy-MM-dd');
        return (salesData || [])
            .filter(s => format(new Date(s.date), 'yyyy-MM-dd') === todayStr)
            .slice(0, 5);
    }, [salesData]);

    const isLoading = isLoadingSales || isLoadingTransactions || isLoadingProducts || isLoadingCustomers;

    if (isLoading) {
        return <div className="p-4 text-center">Sistem verileri yükleniyor...</div>;
    }

    return (
        <div className="space-y-4 p-1 h-full flex flex-col overflow-y-auto">
            {/* Üst Kartlar */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
                <Card className="glass-card border-none text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Günlük Satış</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold neon-text">{formatCurrency(stats.totalSalesToday)}</div>
                        <p className="text-xs text-gray-400">Bugün yapılan toplam satış</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-none text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Günlük Tahsilat</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">{formatCurrency(stats.totalIncomeToday)}</div>
                        <p className="text-xs text-gray-400">Bugün kasaya giren nakit</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-none text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Kritik Stok</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">{stats.criticalStockCount}</div>
                        <p className="text-xs text-gray-400">Azalan ürün sayısı</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-none text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Müşteriler</CardTitle>
                        <Users className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]">{stats.totalCustomers}</div>
                        <p className="text-xs text-gray-400">Kayıtlı toplam müşteri</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 flex-1 min-h-[300px]">
                {/* GRAFİK ALANI - YENİ */}
                {/* GRAFİK ALANI - YENİ */}
                <Card className="col-span-4 glass-card border-none text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold flex items-center text-blue-400">
                            <BarChart3 className="mr-2 h-5 w-5" /> SATIŞ TRENDİ (7 GÜN)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px] pl-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}₺`} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#60a5fa' }}
                                    formatter={(value: number) => [formatCurrency(value), 'Satış']}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Hızlı İşlemler */}
                {/* Hızlı İşlemler */}


                {/* Hızlı İşlemler */}
                <Card className="col-span-3 glass-card border-none text-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-gray-200">Hızlı İşlemler</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button onClick={() => onModuleSelect?.('sales')} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-100 border border-blue-500/30 justify-start h-14 rounded-lg transition-all duration-300 group">
                            <div className="bg-blue-500/20 p-2 rounded-md mr-3 group-hover:bg-blue-500/30 transition-colors">
                                <ShoppingCart className="h-6 w-6 text-blue-400" />
                            </div>
                            <div className="text-left"><div className="font-bold text-base">Yeni Satış</div><div className="text-xs text-blue-200/70">Satış işlemi başlat</div></div>
                        </Button>
                        <Button onClick={() => onModuleSelect?.('customer')} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-100 border border-purple-500/30 justify-start h-14 rounded-lg transition-all duration-300 group">
                            <div className="bg-purple-500/20 p-2 rounded-md mr-3 group-hover:bg-purple-500/30 transition-colors">
                                <Users className="h-6 w-6 text-purple-400" />
                            </div>
                            <div className="text-left"><div className="font-bold text-base">Müşteriler</div><div className="text-xs text-purple-200/70">Müşteri yönetimi</div></div>
                        </Button>
                        <Button onClick={() => onModuleSelect?.('stock')} className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-100 border border-emerald-500/30 justify-start h-14 rounded-lg transition-all duration-300 group">
                            <div className="bg-emerald-500/20 p-2 rounded-md mr-3 group-hover:bg-emerald-500/30 transition-colors">
                                <Database className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="text-left"><div className="font-bold text-base">Stok Yönetimi</div><div className="text-xs text-emerald-200/70">Ürün ve stok işlemleri</div></div>
                        </Button>
                        <Button onClick={() => onModuleSelect?.('calculator')} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-100 border border-indigo-500/30 justify-start h-14 rounded-lg transition-all duration-300 group">
                            <div className="bg-indigo-500/20 p-2 rounded-md mr-3 group-hover:bg-indigo-500/30 transition-colors">
                                <Calculator className="h-6 w-6 text-indigo-400" />
                            </div>
                            <div className="text-left"><div className="font-bold text-base">Fiyat Hesaplama</div><div className="text-xs text-indigo-200/70">Kar ve vergi analizi</div></div>
                        </Button>
                        <Button onClick={() => onModuleSelect?.('cashier')} className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-100 border border-orange-500/30 justify-start h-14 rounded-lg transition-all duration-300 group">
                            <div className="bg-orange-500/20 p-2 rounded-md mr-3 group-hover:bg-orange-500/30 transition-colors">
                                <DollarSign className="h-6 w-6 text-orange-400" />
                            </div>
                            <div className="text-left"><div className="font-bold text-base">Kasa İşlemleri</div><div className="text-xs text-orange-200/70">Gelir/gider yönetimi</div></div>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Son Satışlar Listesi - Alt Kısım */}
            {/* Son Satışlar Listesi - Alt Kısım */}
            <Card className="glass-card border-none text-white">
                <CardHeader className="py-2">
                    <CardTitle className="text-sm font-bold flex items-center text-gray-300">
                        <Activity className="mr-2 h-4 w-4" /> Son Satışlar (Bugün)
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                    <div className="space-y-1">
                        {isLoadingSales ? (
                            <div className="text-center text-gray-500 text-xs">Yükleniyor...</div>
                        ) : recentSales.length > 0 ? (
                            recentSales.map((sale) => (
                                <div key={sale.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg border-b border-white/5 last:border-0 text-sm transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-mono bg-white/5 px-1 rounded">{format(new Date(sale.date), 'HH:mm')}</span>
                                        <span className="font-medium text-gray-200">{sale.customer?.name || 'Misafir Müşteri'}</span>
                                    </div>
                                    <div className="font-bold text-blue-400">{formatCurrency(sale.net_total)}</div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 text-xs py-2">Bugün henüz satış yok.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Dashboard;
