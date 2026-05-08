import React, { useState, useEffect } from 'react';
import { X, Calculator, RefreshCw, ArrowRight, DollarSign, Percent, Truck, Building, Wallet } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from 'date-fns';

interface PriceCalculatorModuleProps {
    onClose: () => void;
}

const PriceCalculatorModule: React.FC<PriceCalculatorModuleProps> = ({ onClose }) => {
    // Inputs
    const [purchasePrice, setPurchasePrice] = useState<number>(0);
    const [vatRate, setVatRate] = useState<number>(20); // %20 Default
    const [cargoCost, setCargoCost] = useState<number>(0);
    const [profitMargin, setProfitMargin] = useState<number>(30); // %30 Default
    const [incomeTaxRate, setIncomeTaxRate] = useState<number>(20); // %20 Default

    // Outputs
    const [results, setResults] = useState({
        costBase: 0,
        profitAmount: 0,
        netSalesPrice: 0,
        vatAmount: 0,
        grossSalesPrice: 0,
        incomeTaxAmount: 0,
        netProfit: 0
    });

    useEffect(() => {
        calculateCices();
    }, [purchasePrice, vatRate, cargoCost, profitMargin, incomeTaxRate]);

    const calculateCices = () => {
        // 1. Maliyet Tabanı = Alış Fiyatı + Kargo
        const costBase = purchasePrice + cargoCost;

        // 2. Kar Tutarı = Maliyet Tabanı * (Kar Marjı / 100)
        // Burada kar marjı "maliyet üzerinden" hesaplanıyor (Mark-up)
        const profitAmount = costBase * (profitMargin / 100);

        // 3. KDV Hariç Satış Fiyatı
        const netSalesPrice = costBase + profitAmount;

        // 4. KDV Tutarı = KDV Hariç Satış * (KDV Oranı / 100)
        const vatAmount = netSalesPrice * (vatRate / 100);

        // 5. KDV Dahil Satış Fiyatı (Müşteriye Söylenecek)
        const grossSalesPrice = netSalesPrice + vatAmount;

        // 6. Gelir Vergisi (Kar üzerinden)
        // Vergi matrahı genellikle kar tutarıdır.
        const incomeTaxAmount = profitAmount * (incomeTaxRate / 100);

        // 7. Net Kar (Vergiden Sonra)
        const netProfit = profitAmount - incomeTaxAmount;

        setResults({
            costBase,
            profitAmount,
            netSalesPrice,
            vatAmount,
            grossSalesPrice,
            incomeTaxAmount,
            netProfit
        });
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

    return (
        <div className="h-full p-2 sm:p-4 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="bg-white/5 border-b border-white/10 p-3 flex justify-between items-center flex-shrink-0 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Calculator className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Fiyat Hesaplama Modülü</h1>
                            <p className="text-xs text-gray-400">Gelişmiş kar ve vergi hesaplama</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="hover:bg-red-500/20 hover:text-red-400 h-8 w-8 rounded-lg transition-colors" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 grid md:grid-cols-2 gap-6">

                    {/* Inputs Section */}
                    <div className="space-y-6">
                        <Card className="glass-card border-none text-white">
                            <CardHeader>
                                <CardTitle className="text-base font-medium text-gray-300 flex items-center">
                                    <Sliders className="mr-2 h-4 w-4 text-blue-400" /> Girdi Parametreleri
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400 text-xs">Alış Fiyatı (KDV Hariç Tavsiye Edilir)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                        <Input
                                            type="number"
                                            value={purchasePrice || ''}
                                            onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-400 text-xs text-nowrap">Kargo / Ek Maliyet</Label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                            <Input
                                                type="number"
                                                value={cargoCost || 0}
                                                onChange={(e) => setCargoCost(parseFloat(e.target.value) || 0)}
                                                className="pl-9 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-400 text-xs text-nowrap">Kar Marjı (%)</Label>
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                            <Input
                                                type="number"
                                                value={profitMargin}
                                                onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                                                className="pl-9 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-400 text-xs">KDV Oranı (%)</Label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                            <Input
                                                type="number"
                                                value={vatRate}
                                                onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                                                className="pl-9 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-400 text-xs text-nowrap">Gelir Vergisi (%)</Label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                            <Input
                                                type="number"
                                                value={incomeTaxRate}
                                                onChange={(e) => setIncomeTaxRate(parseFloat(e.target.value) || 0)}
                                                className="pl-9 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Results Section */}
                    <div className="space-y-6">
                        <Card className="glass-card border-none text-white h-full bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border border-white/5">
                            <CardHeader>
                                <CardTitle className="text-base font-medium text-gray-300 flex items-center">
                                    <Wallet className="mr-2 h-4 w-4 text-green-400" /> Hesaplanan Değerler
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">

                                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                                    <span className="text-gray-400 text-sm">Toplam Maliyet Tabanı:</span>
                                    <span className="text-base font-mono text-gray-200">{formatCurrency(results.costBase)}</span>
                                </div>

                                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <span className="text-green-400 font-medium">Hedeflenen Kar (Brüt):</span>
                                    <span className="text-lg font-bold font-mono text-green-400">{formatCurrency(results.profitAmount)}</span>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
                                    <div className="text-center space-y-1">
                                        <span className="text-blue-200 text-sm uppercase tracking-wider font-semibold">Tavsiye Edilen Satış Fiyatı</span>
                                        <div className="text-3xl font-bold text-white neon-text font-mono">
                                            {formatCurrency(results.grossSalesPrice)}
                                        </div>
                                        <div className="text-xs text-blue-300">
                                            (KDV Dahil)
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-500/20 text-xs text-blue-200 flex justify-center gap-2">
                                            <span>Ödenen KDV:</span>
                                            <span className="font-bold font-mono text-white">{formatCurrency(results.vatAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                        <div className="text-red-300 text-xs mb-1">Tahmini Gelir Vergisi</div>
                                        <div className="text-red-400 font-mono font-bold">{formatCurrency(results.incomeTaxAmount)}</div>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                        <div className="text-emerald-300 text-xs mb-1">Cebinize Kalan (Net)</div>
                                        <div className="text-emerald-400 font-mono font-bold">{formatCurrency(results.netProfit)}</div>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 mt-4 text-center">
                                    * Bu hesaplama bağlayıcı değildir, vergi oranları ve yasal yükümlülükler değişiklik gösterebilir.
                                </div>

                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Icon import helper (using existing lucide-react integration)
import { Sliders } from "lucide-react";

export default PriceCalculatorModule;
