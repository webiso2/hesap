
import React, { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Wallet,
    PlusCircle,
    Loader2,
    History,
    CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Account, AccountTransaction } from "@/types/backup";

interface ServicePaymentPanelProps {
    accounts: Account[];
    transactions: AccountTransaction[];
    totalPaid: number;
    cost: number;
    remainingDebt: number;
    isAddingPayment: boolean;
    onAddPayment: (amount: number, accountId: string, description: string) => Promise<void>;
    formatCurrency: (value: number) => string;
}

const ServicePaymentPanel: React.FC<ServicePaymentPanelProps> = ({
    accounts,
    transactions,
    totalPaid,
    cost,
    remainingDebt,
    isAddingPayment,
    onAddPayment,
    formatCurrency
}) => {
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentAccountId, setPaymentAccountId] = useState("");
    const [paymentDescription, setPaymentDescription] = useState("Servis ödemesi / Kapora");

    const handleAddClick = async () => {
        if (!paymentAmount || !paymentAccountId) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return;

        await onAddPayment(amount, paymentAccountId, paymentDescription);

        // Reset form after successful addition
        setPaymentAmount("");
        setPaymentDescription("Servis ödemesi / Kapora");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Payment Form */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                    <Label className="text-sm font-bold text-emerald-400 border-b border-emerald-500/20 pb-2 flex items-center gap-2">
                        <Wallet className="h-4 w-4" /> Ödeme Al / Kapora
                    </Label>

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400">Tutar</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="pl-8 bg-black/40 border-white/10 text-white"
                                    placeholder="0.00"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₺</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400">Hesap</Label>
                            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                                <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                    <SelectValue placeholder="Hesap seçin..." />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.type === 'credit_card' ? 'K.Kartı' : 'Nakit'})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-400">Açıklama</Label>
                            <Textarea
                                value={paymentDescription}
                                onChange={(e) => setPaymentDescription(e.target.value)}
                                className="bg-black/40 border-white/10 text-white text-xs min-h-[60px]"
                            />
                        </div>

                        <Button onClick={handleAddClick} disabled={isAddingPayment || !paymentAmount || !paymentAccountId} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isAddingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                            Ödeme Ekle
                        </Button>
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Servis Tutarı:</span>
                        <span className="font-mono font-bold text-white">{formatCurrency(cost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Ödenen:</span>
                        <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                        <span className="text-gray-300 font-medium">Kalan:</span>
                        <span className={cn("font-mono font-bold text-lg", remainingDebt > 0 ? "text-red-400" : "text-gray-400")}>
                            {formatCurrency(remainingDebt)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="lg:col-span-2 bg-white/5 rounded-xl border border-white/5 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-bold text-gray-200 flex items-center gap-2">
                        <History className="h-4 w-4 text-blue-400" /> Ödeme Geçmişi
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
                            <CreditCard className="h-10 w-10 opacity-20 mb-2" />
                            <p>Henüz ödeme alınmamış.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-black/20 text-gray-400 sticky top-0">
                                <tr>
                                    <th className="p-3 font-medium">Tarih</th>
                                    <th className="p-3 font-medium">Açıklama</th>
                                    <th className="p-3 font-medium text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/5">
                                        <td className="p-3 text-gray-300">{format(new Date(tx.date), 'dd.MM.yyyy HH:mm')}</td>
                                        <td className="p-3 text-gray-300">{tx.description}</td>
                                        <td className="p-3 text-emerald-400 text-right font-mono font-medium">{formatCurrency(tx.amount || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServicePaymentPanel;
