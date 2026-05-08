import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API için tip tanımlamaları
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export interface VoiceRecognitionState {
    isListening: boolean;
    transcript: string;
    error: string | null;
}

export const useVoiceRecognition = () => {
    const [state, setState] = useState<VoiceRecognitionState>({
        isListening: false,
        transcript: '',
        error: null,
    });

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionAdapter = SpeechRecognition || webkitSpeechRecognition;

        if (SpeechRecognitionAdapter) {
            const recognition = new SpeechRecognitionAdapter();
            recognition.continuous = true; // Sürekli dinleme modu
            recognition.interimResults = true; // Anlık sonuçları göster
            recognition.lang = 'tr-TR'; // Türkçe

            recognition.onstart = () => {
                setState((prev) => ({ ...prev, isListening: true, error: null }));
            };

            recognition.onend = () => {
                setState((prev) => ({ ...prev, isListening: false }));
            };

            recognition.onerror = (event: any) => {
                console.error('Ses tanıma hatası:', event.error);
                setState((prev) => ({ ...prev, isListening: false, error: event.error }));
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                // Tüm sonuçları baştan sona tara ki "continuous" modda önceki cümleler kaybolmasın
                for (let i = 0; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                // Final metinleri ve varsa o anki geçici metni birleştir
                const currentTranscript = finalTranscript + interimTranscript;

                if (currentTranscript) {
                    setState((prev) => ({ ...prev, transcript: currentTranscript }));
                }
            };

            recognitionRef.current = recognition;
        } else {
            setState((prev) => ({ ...prev, error: 'Tarayıcınız ses tanıma özelliğini desteklemiyor.' }));
        }
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !state.isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Başlatma hatası:", e);
            }
        }
    }, [state.isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && state.isListening) {
            recognitionRef.current.stop();
        }
    }, [state.isListening]);

    const resetTranscript = useCallback(() => {
        setState((prev) => ({ ...prev, transcript: '' }));
    }, []);

    return {
        isListening: state.isListening,
        transcript: state.transcript,
        error: state.error,
        startListening,
        stopListening,
        resetTranscript,
    };
};
