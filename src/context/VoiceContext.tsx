import React, { createContext, useContext, ReactNode, useEffect, useState, useRef } from 'react';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useToast } from '@/hooks/use-toast';
import { speak } from '@/utils/ttsUtils';

interface VoiceContextType {
    isListening: boolean;
    transcript: string;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    lastCommand: string | null;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isListening, transcript, startListening, stopListening, resetTranscript, error } = useVoiceRecognition();
    const [lastCommand, setLastCommand] = useState<string | null>(null);
    const { toast } = useToast();

    // isListening değişimini takip etmek için ref
    const wasListeningRef = useRef(isListening);

    useEffect(() => {
        if (error) {
            toast({
                title: "Ses Tanıma Hatası",
                description: error,
                variant: "destructive"
            });
            speak("Bir hata oluştu.");
        }
    }, [error, toast]);

    // Dinleme bittiğinde (isListening: true -> false) işlem yap
    useEffect(() => {
        const wasListening = wasListeningRef.current;
        if (wasListening && !isListening) {
            // Kullanıcı konuşmayı bitirdi, transcript varsa gönder
            if (transcript.trim().length > 0) {
                setLastCommand(transcript);
                // Komutu sesli tekrar kapatalım, sadece aksiyon alsın
                // speak(transcript); 
            }
        }
        wasListeningRef.current = isListening;
    }, [isListening, transcript]);

    return (
        <VoiceContext.Provider value={{
            isListening,
            transcript,
            startListening,
            stopListening,
            resetTranscript,
            lastCommand
        }}>
            {children}
        </VoiceContext.Provider>
    );
};

export const useVoice = () => {
    const context = useContext(VoiceContext);
    if (context === undefined) {
        throw new Error('useVoice must be used within a VoiceProvider');
    }
    return context;
};
