/**
 * Sesli komutları temizlemek ve anlamlandırmak için yardımcı araçlar.
 */

/**
 * Komut içindeki belirli anahtar kelimeleri ve gereksiz ekleri temizler.
 * Örn: "müşteri adı Ahmet" -> "Ahmet"
 * Örn: "adı sil" -> TRUE (silme isteği)
 */
export const cleanVoiceValue = (transcript: string, fieldKeywords: string[]): string => {
    let cleaned = transcript.toLowerCase().trim();

    // Alan belirten anahtar kelimeleri temizle
    for (const kw of fieldKeywords) {
        // "adı", "ismi", "numarası" gibi kelimeleri temizle
        const regex = new RegExp(`^${kw}\\s+|\\s+${kw}$|^${kw}$`, 'gi');
        cleaned = cleaned.replace(regex, '');
    }

    // Baştaki "adı", "ismi" gibi sık kullanılan gereksiz kelimeleri temizle
    cleaned = cleaned.replace(/^(adı|ismi|olsun|yap|ayarla|gir)\s+/gi, '');

    // Sondaki "olsun", "yap", "ayarla" gibi kelimeleri temizle
    cleaned = cleaned.replace(/\s+(olsun|yap|ayarla|gir)$/gi, '');

    return cleaned.trim();
};

/**
 * Belirli bir alan için "sil" (temizle) isteği olup olmadığını kontrol eder.
 * Örn: "müşteri adını sil", "adı temizle", "limit sil"
 */
export const isDeleteIntent = (transcript: string, fieldKeywords: string[]): boolean => {
    const cmd = transcript.toLowerCase().trim();
    const deleteKeywords = ['sil', 'temizle', 'kaldır', 'sıfırla', 'boşalt'];

    const hasDeleteWord = deleteKeywords.some(kw => cmd.includes(kw));
    if (!hasDeleteWord) return false;

    const hasFieldWord = fieldKeywords.some(kw => cmd.includes(kw));
    return hasFieldWord;
};

/**
 * Metni ilk harfi büyük olacak şekilde düzeltir (İsimler için)
 */
export const capitalizeText = (text: string): string => {
    if (!text) return text;
    return text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

/**
 * Telefon numarasındaki boşlukları temizler
 */
export const cleanPhoneNumber = (text: string): string => {
    return text.replace(/\s/g, '');
};
