// 📁 File: functions/utils/encryption.ts
// [האפליקציה - app.tariff-ai.com]

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getCryptoKey(): Promise<CryptoKey> {
    const secret = Deno.env.get('ENCRYPTION_MASTER_KEY');
    
    if (!secret || secret.length < 32) {
        throw new Error('Critical Security Error: ENCRYPTION_MASTER_KEY is missing or too short');
    }

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('salt-tariff-ai-static'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

export async function encrypt(text: string): Promise<string> {
    if (!text) return text;

    try {
        const key = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const encodedText = enc.encode(text);

        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            key,
            encodedText
        );

        const ivHex = bufferToHex(iv.buffer);
        const encryptedHex = bufferToHex(encryptedBuffer);

        return `${ivHex}:${encryptedHex}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Encryption failed');
    }
}

export async function decrypt(text: string): Promise<string> {
    if (!text) return text;

    if (!text.includes(':') || text.length < 32) {
        return text; 
    }

    try {
        const [ivHex, encryptedHex] = text.split(':');
        
        if (ivHex.length !== IV_LENGTH * 2 || !encryptedHex) {
            return text; 
        }

        const key = await getCryptoKey();
        const iv = hexToBytes(ivHex);
        const encryptedBytes = hexToBytes(encryptedHex);

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            key,
            encryptedBytes
        );

        return dec.decode(decryptedBuffer);
    } catch (error) {
        console.warn('Decryption failed (returning original text):', error);
        return text;
    }
}
