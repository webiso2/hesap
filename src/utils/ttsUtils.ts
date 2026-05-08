/**
 * Metin Okuma (Text-to-Speech) Yardımcı Fonksiyonları
 */

let speechSynthesisUtterance: SpeechSynthesisUtterance | null = null;
let voices: SpeechSynthesisVoice[] = [];

// Sesleri yükle
const loadVoices = () => {
    voices = window.speechSynthesis.getVoices();
};

// Tarayıcı sesleri asenkron yükleyebilir, bu yüzden olay dinleyicisi ekle
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        loadVoices();
    };
}

/**
 * Verilen metni sesli okur.
 * @param text Okunacak metin
 */
export const speak = (text: string) => {
    if (!window.speechSynthesis) {
        console.error("Tarayıcı metin okuma özelliğini desteklemiyor.");
        return;
    }

    // Eğer zaten konuşuyorsa durdur
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }

    speechSynthesisUtterance = new SpeechSynthesisUtterance(text);

    // Eğer sesler henüz yüklenmediyse tekrar dene
    if (voices.length === 0) {
        loadVoices();
    }

    // Türkçe sesleri bul
    const turkishVoices = voices.filter(voice => voice.lang.includes('tr') || voice.lang.includes('TR'));

    // Öncelik: "Google" içeren ses (Genellikle daha doğal/kadın sesi) -> Yoksa herhangi bir Türkçe ses
    const preferredVoice = turkishVoices.find(voice => voice.name.includes('Google')) || turkishVoices[0];

    // Eğer Türkçe ses varsa onu kullan, yoksa varsayılanı kullan
    if (preferredVoice) {
        speechSynthesisUtterance.voice = preferredVoice;
    }

    // Hız ve ton ayarları (isteğe bağlı)
    speechSynthesisUtterance.rate = 1.0; // Normal hız
    speechSynthesisUtterance.pitch = 1.1; // Hafifçe inceltilmiş ton (daha nazik/kadınsı olması için)

    window.speechSynthesis.speak(speechSynthesisUtterance);
};

/**
 * Okumayı durdurur.
 */
export const stopSpeaking = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};
