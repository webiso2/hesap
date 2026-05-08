import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Command } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Speech Recognition Interfaces ---
interface SpeechRecognitionResult {
    isFinal: boolean;
    [key: number]: {
        transcript: string;
    };
    length: number;
}

interface SpeechRecognitionEvent {
    resultIndex: number;
    results: {
        length: number;
        [key: number]: SpeechRecognitionResult;
    };
}

interface SpeechRecognitionErrorEvent {
    error: string;
    message?: string;
}

interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onstart: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
}

interface WindowWithSpeech extends Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
}

interface VoiceControlProps {
    onCommand?: (command: string, transcript: string) => void;
    activeModule?: string | null;
}

const VoiceControl: React.FC<VoiceControlProps> = ({ onCommand }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        const SpeechRecognitionCtor = (window as unknown as WindowWithSpeech).SpeechRecognition ||
            (window as unknown as WindowWithSpeech).webkitSpeechRecognition;

        if (!SpeechRecognitionCtor) {
            console.error("Tarayıcınız ses tanımayı desteklemiyor.");
            return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'tr-TR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
            toast({ title: "Sesli Kontrol", description: "Sizi dinliyorum...", duration: 2000 });
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const finalResult = event.results[i][0].transcript.trim().toLowerCase();
                    processCommand(finalResult);
                } else {
                    currentTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(currentTranscript);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Ses tanıma hatası:", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                toast({ title: "Hata", description: "Mikrofon izni verilmedi.", variant: "destructive" });
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const attemptToClickButton = (command: string) => {
        const cmd = command.toLowerCase().trim();
        // Skip common data entry phrases to avoid accidental clicks while filling forms
        const dataPrefixes = ['adı', 'isim', 'telefon', 'numara', 'adres', 'şehir', 'not', 'limit', 'marka', 'model'];
        if (dataPrefixes.some(p => cmd.startsWith(p))) return false;

        // Find all buttons
        const buttons = Array.from(document.querySelectorAll('button'));

        // Match candidates
        const candidates = buttons
            .map(btn => ({
                btn,
                text: btn.innerText?.toLowerCase().trim(),
                aria: btn.getAttribute('aria-label')?.toLowerCase().trim()
            }))
            .filter(c => c.text || c.aria);

        // 1. Exact Match Priority (Top Priority)
        const exactMatch = candidates.find(c => c.text === cmd || c.aria === cmd);

        if (exactMatch) {
            const { btn, text, aria } = exactMatch;
            console.log(`VoiceControl: Tam eşleşme -> "${text || aria}"`);

            btn.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-black', 'scale-105', 'transition-all', 'duration-300');

            setTimeout(() => {
                btn.click();
                btn.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-black', 'scale-105');
            }, 400);

            toast({
                title: "Sesli Komut",
                description: `"${text || aria}" butonu tıklandı.`,
                duration: 2000
            });
            return true;
        }

        // 2. Specialized Synonym Check (Handle 'ekle' correctly)
        if (cmd === 'ekle') {
            const addBtn = candidates.find(c => c.text?.includes('ekle') && !c.text?.includes('yedek'));
            if (addBtn) {
                const { btn, text, aria } = addBtn;
                btn.click();
                toast({ title: "Sesli Komut", description: `"${text || aria}" tıklandı.` });
                return true;
            }
        }

        // 3. Partial Match (Second Priority - only for longer commands)
        if (cmd.length > 3) {
            const partialMatch = candidates.find(c => (c.text && c.text.includes(cmd)) || (c.aria && c.aria.includes(cmd)));
            if (partialMatch) {
                const { btn, text, aria } = partialMatch;
                console.log(`VoiceControl: Kısmi eşleşme -> "${text || aria}"`);

                btn.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-black', 'scale-105', 'transition-all', 'duration-300');

                setTimeout(() => {
                    btn.click();
                    btn.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-black', 'scale-105');
                }, 400);

                toast({
                    title: "Sesli Komut",
                    description: `"${text || aria}" butonu tıklandı.`,
                    duration: 2000
                });
                return true;
            }
        }

        return false;
    };

    const processCommand = (command: string) => {
        console.log("Algılanan komut:", command);

        // First attempt to click a button with this command
        const wasButtonClicked = attemptToClickButton(command);

        // Dispatch a global event for components to listen to (for data entry, etc.)
        const event = new CustomEvent('voice-command', {
            detail: { command, original: command, handledByButton: wasButtonClicked }
        });
        window.dispatchEvent(event);

        if (onCommand) {
            onCommand(command, command);
        }

        // Only show general feedback if it wasn't a button click (to avoid double toast)
        if (!wasButtonClicked) {
            toast({
                title: "Komut Algılandı",
                description: `"${command}"`,
                duration: 1000
            });
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            try {
                recognitionRef.current?.start();
            } catch (err) {
                console.error("Başlatma hatası:", err);
            }
        }
    };

    return (
        <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-2">
            {transcript && isListening && (
                <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/10 shadow-2xl mb-2 max-w-[250px] animate-in slide-in-from-bottom-2 duration-300">
                    <p className="text-xs text-blue-400 font-bold mb-1 flex items-center gap-1">
                        <Command className="h-3 w-3" /> Canlı Çeviri
                    </p>
                    <p className="text-sm italic opacity-90">"{transcript}"</p>
                </div>
            )}

            <Button
                onClick={toggleListening}
                size="icon"
                className={cn(
                    "h-14 w-14 rounded-full shadow-2xl transition-all duration-500 relative",
                    isListening
                        ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/50"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/50"
                )}
            >
                {isListening ? (
                    <>
                        <Mic className="h-6 w-6 text-white animate-pulse" />
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25"></span>
                    </>
                ) : (
                    <MicOff className="h-6 w-6 text-white" />
                )}
            </Button>
        </div>
    );
};

export default VoiceControl;
